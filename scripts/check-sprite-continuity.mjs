/** Exercise the real renderer's texture handoff without mounting native Skia. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let pages = [], frame = 0;
let propPages = [];
const reactions = [];
const shared = value => ({ get: () => value, set: next => { value = next; } });
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {},
  useRef: current => ({ current }), useState: initial => [initial, () => {}],
};
const mocks = {
  react: React,
  '@/contexts/StartupVisualContext': { useStartupVisualReady: () => {} },
  'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: value => value } },
  '@shopify/react-native-skia': { Canvas: 'Canvas', Group: 'Group', Image: 'SkiaImage', FilterMode: { Linear: 1 }, MipmapMode: { None: 0 } },
  'react-native-reanimated': { useSharedValue: shared, useDerivedValue: fn => ({ get: fn }), useAnimatedReaction: (read, apply) => reactions.push(() => apply(read(), null)) },
  'react-native-worklets': { scheduleOnRN: (fn, ...args) => fn(...args) },
  '@/constants/game': { GameColors: {} }, '@/utils/scale': { moderateScale: x => x },
  './use-atlas-pages': { useAtlasPages: sources => sources[0] === 3 ? propPages : pages },
  './use-sprite-clock': { useSpriteClock: () => ({ get: () => frame }) },
  './room-play-prop': { EMPTY_PLAY_PROP: { image: null, col: 0, row: 0, groundY: .8 } },
};
const module = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('pet-display/media/sprite/PetSpriteRenderer.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
vm.runInNewContext(source, { module, exports: module.exports, React, require: id => { assert.ok(id in mocks, id); return mocks[id]; } });
const sprite = { source: 1, pages: [1], framesPerPage: 4, frames: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }], frameWidth: 768, frameHeight: 768, sheetWidth: 1536, sheetHeight: 1536, fps: 24 };
const segment = { assetKey: 'idle', sprite };
const tree = module.exports.PetSpriteRenderer({ segment, size: 120, resolutionScale: 3 });
const flatten = node => [node, ...node.props.children.flat().filter(Boolean).flatMap(flatten)];
const nodes = flatten(tree);
const controller = nodes.find(node => typeof node.type === 'function');
const canvas = nodes.find(node => node.type === 'Canvas');
const image = nodes.find(node => node.type === 'SkiaImage');
assert.ok(controller && canvas && image);
function update(nextSegment, nextPages, nextFrame) {
  pages = nextPages; frame = nextFrame; reactions.length = 0;
  assert.equal(controller.type({ ...controller.props, segment: nextSegment }), null, 'Clip controllers must not own/remount the Canvas');
  reactions.forEach(run => run());
}
const oldTexture = { id: 'idle-page' }, nextTexture = { id: 'reaction-page' };
update(segment, [{ page: 0, image: oldTexture }], 2);
assert.equal(image.props.image.get(), oldTexture);
const priorY = image.props.y.get();
const reaction = { assetKey: 'correct', sprite: { ...sprite, source: 2, pages: [2] } };
update(reaction, [], 0);
assert.equal(image.props.image.get(), oldTexture, 'A pending clip must retain the last visible texture');
assert.equal(image.props.y.get(), priorY, 'A pending clip must retain the old frame coordinates');
update(reaction, [{ page: 0, image: nextTexture }], 0);
assert.equal(image.props.image.get(), nextTexture);
assert.ok(image.props.y.get() === 0, 'Texture and frame coordinates must change together');
update(reaction, [], 3);
assert.equal(image.props.image.get(), nextTexture, 'A delayed page must not erase the cat');
assert.equal(canvas.props.style.width, 324, 'The drawing surface keeps its close-up resolution');
console.log('Verified a stable Canvas, delayed clip/page continuity, and atomic texture/coordinate changes.');
const toyTexture = { id: 'yarn-page' };
const play = { assetKey: 'yarnRoll', sprite: { ...sprite, playProp: { pages: [3], groundY: [.8,.82,.84,.86] } } };
propPages = [{ page: 0, image: toyTexture }];
update(play, [{ page: 0, image: oldTexture }], 2);
assert.equal(controller.props.playProp.get().image, toyTexture, 'Separate toy must follow the same decoded frame as the cat');
assert.equal(controller.props.playProp.get().col, 2);
assert.equal(controller.props.playProp.get().groundY, .84, 'Room depth must use the toy ground contact rather than its bounce height');
update(reaction, [], 0);
assert.equal(controller.props.playProp.get().image, toyTexture, 'A pending transition must retain both layers together');
update(reaction, [{ page: 0, image: nextTexture }], 0);
assert.equal(controller.props.playProp.get().image, null, 'The toy must disappear atomically when the next cat clip is ready');
console.log('Verified synchronized toy frames, independent ground depth and atomic play-prop removal.');
