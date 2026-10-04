/** Check exact startup pixels and delayed Canvas readiness using the real component. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';

const portrait = await sharp('assets/3d/cat-splash.png').ensureAlpha().raw().toBuffer();
const firstCell = await sharp('assets/3d/atlases/cat-orange-idle.png')
  .extract({ left: 0, top: 0, width: 192, height: 192 }).ensureAlpha().raw().toBuffer();
assert.deepEqual(portrait, firstCell, 'The startup portrait must be the exact first animation cell');

let texture = null, playing = false, slots = [], cursor = 0, effects = [], readyPages;
let nextId = 1, readyCalls = 0;
const frames = new Map();
const isMounted = { current: true };
function memo(fn, deps) {
  const index = cursor++;
  const old = slots[index];
  if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
    slots[index] = { value: fn(), deps };
  }
  return slots[index].value;
}
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useCallback: (fn, deps) => memo(() => fn, deps),
  useState: initial => {
    const index = cursor++;
    slots[index] ??= { value: initial };
    return [slots[index].value, value => { slots[index].value = value; }];
  },
  useEffect: (fn, deps) => {
    const index = cursor++;
    const old = slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      old?.cleanup?.();
      slots[index] = { deps };
      effects.push(() => { slots[index].cleanup = fn(); });
    }
  },
};
const mocks = {
  react: React,
  'react-native': { View: 'View', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } } },
  'react-native-reanimated': { useDerivedValue: fn => ({ get: fn }) },
  '@shopify/react-native-skia': { Canvas: 'Canvas', Group: 'Group', Image: 'SkiaImage', FilterMode: { Linear: 1 }, MipmapMode: { None: 0 }, useImage: () => texture },
  '@/constants/cat-skins': { CAT_SKIN_SOURCES: { orange: 1 }, CAT_SKIN_SHEET: { frameSize: 192, width: 1536, height: 2304, cols: 8 } },
  '@/constants/cat-sprite-catalog': { CAT_SPRITE_CATALOG: { idle: { frameCount: 96, fps: 24 } } },
  '@/pet-display/media/sprite/use-sprite-clock': { useSpriteClock: options => { readyPages = options.readyPages; return { get: () => 0 }; } },
  '@/constants/game': { GameColors: {} },
  '@/hooks/use-is-mounted': { useIsMounted: () => isMounted },
  '@/utils/scale': { moderateScale: value => value },
};
const module = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('components/branding/AnimatedSplashCat.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
vm.runInNewContext(code, { module, exports: module.exports, React,
  require: id => { assert.ok(id in mocks, id); return mocks[id]; },
  requestAnimationFrame: fn => { const id = nextId++; frames.set(id, fn); return id; },
  cancelAnimationFrame: id => frames.delete(id),
});
const onReady = () => { readyCalls++; playing = true; };
function render() {
  cursor = 0; effects = [];
  const result = module.exports.AnimatedSplashCat({ size: 192, playing, onReady });
  effects.forEach(fn => fn());
  return result;
}
function paint() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); }
const pending = render();
pending.props.onLayout();
render();
assert.equal(readyCalls, 0, 'A missing sheet must retain the portrait');
texture = { id: 'idle' };
const tree = render();
assert.equal(readyCalls, 0, 'A decoded sheet alone must not remove the portrait');
const canvas = tree.props.children[0];
assert.equal(canvas.type, 'Canvas');
assert.equal(canvas.props.onLayout, undefined, 'Fabric Canvas layout must come from its native wrapper');
assert.equal(canvas.props.colorSpace, 'srgb', 'Canvas and startup PNG must use the same color space');
render();
assert.equal(readyPages.length, 0, 'Playback holds frame zero beneath the portrait');
paint();
assert.equal(readyCalls, 0, 'Layout must get a drawing turn before handoff');
paint();
assert.equal(readyCalls, 1);
render();
assert.equal(readyPages[0], 0, 'Playback starts only after the static portrait handoff');
slots.forEach(slot => slot.cleanup?.());
assert.equal(frames.size, 0, 'Unmount cancels pending handoff callbacks');
console.log('Verified identical startup/animation pixels, decoded-and-laid-out readiness, and frame-zero playback handoff.');

// If the Canvas wins the decode race, the removed fallback must not leave the
// gate waiting forever for that Image's onLoad callback.
slots = []; frames.clear();
React.useRef = initial => memo(() => ({ current: initial }), []);
React.useSyncExternalStore = (_subscribe, get) => get();
const timers = new Map();
let hidden = 0;
const gateMocks = {
  ...mocks,
  'react-native': { ...mocks['react-native'], Image: 'NativeImage' },
  '@/components/branding/AnimatedSplashCat': { AnimatedSplashCat: 'AnimatedSplashCat', SplashBackdrop: 'SplashBackdrop' },
  '@/components/ui/ProgressBar': { ProgressBar: 'ProgressBar' },
  '@/contexts/AuthProvider': { useAuth: () => ({ isAuthReady: true }) },
  '@/contexts/GameProvider': { useGame: () => ({ isReady: true, cloudRestoreCheckComplete: true }) },
  '@/lib/init-game-asset-prefetch': { subscribeGameAssetLoading: () => () => {}, getGameAssetLoadingSnapshot: () => ({ mayContinue: true, completed: 1, failed: 0, total: 1 }) },
  'expo-constants': { default: { expoConfig: { name: 'Math Mews' } } },
  'expo-splash-screen': { hideAsync: async () => { hidden++; } },
  'react-i18next': { useTranslation: () => ({ t: value => value }) },
  '@/assets/images/splash-brand.png': 'logo',
  '@/assets/3d/cat-splash.png': 'portrait',
};
const gateModule = { exports: {} };
const gateCode = ts.transpileModule(fs.readFileSync('components/branding/SplashGate.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
vm.runInNewContext(gateCode, { module: gateModule, exports: gateModule.exports, React,
  require: id => { assert.ok(id in gateMocks, id); return gateMocks[id]; },
  requestAnimationFrame: fn => { const id = nextId++; frames.set(id, fn); return id; },
  setTimeout: (fn, delay) => { const id = nextId++; timers.set(id, { fn, delay }); return id; },
  clearTimeout: id => timers.delete(id),
});
function renderGate() {
  cursor = 0; effects = [];
  const result = gateModule.exports.SplashGate({ children: 'gameplay' });
  effects.forEach(fn => fn());
  return result;
}
const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...node.props.children.flat().flatMap(flatten)];
let gateTree = renderGate();
let nodes = flatten(gateTree);
// Native Image starts with the bundled PNG's intrinsic size. Yoga's absolute
// offsets do not replace those dimensions, so explicit styles must override it.
const dimensions = {
  logo: await sharp('assets/images/splash-brand.png').metadata(),
  portrait: await sharp('assets/3d/cat-splash.png').metadata(),
};
function imageSize(node) {
  const source = dimensions[node.props.source];
  const styles = [node.props.style].flat(Infinity).filter(Boolean);
  return Object.assign({ width: source.width, height: source.height }, ...styles);
}
const logo = nodes.find(node => node.props.source === 'logo');
const fallback = nodes.find(node => node.props.source === 'portrait');
assert.equal(imageSize(logo).width, 240, 'Branding must override its intrinsic 640 px width');
assert.equal(imageSize(logo).height, 240, 'Branding must override its intrinsic 640 px height');
assert.equal(imageSize(fallback).width, 192);
assert.equal(imageSize(fallback).height, 192);
const content = nodes.find(node => node.props.accessibilityRole === 'header');
assert.equal(content.props.style.overflow, 'hidden', 'Branding must not spill outside its native-size box');
const catWindow = nodes.find(node => node.props.style?.left === 24);
assert.equal(catWindow.props.style.overflow, 'hidden');
assert.equal(catWindow.props.style.width, imageSize(fallback).width);
assert.equal(catWindow.props.style.height, imageSize(fallback).height);
nodes.find(node => node.type === 'AnimatedSplashCat').props.onReady();
renderGate(); paint();
assert.equal(hidden, 0, 'Native launch must wait for its replacement logo');
nodes.find(node => node.props.source === 'logo').props.onLoad();
nodes.find(node => node.props.accessibilityRole === 'header').props.onLayout();
renderGate(); paint();
assert.equal(hidden, 1, 'A ready Canvas can replace a portrait whose onLoad never fired');
for (const [id, timer] of [...timers]) if (timer.delay === 1200) { timers.delete(id); timer.fn(); }
renderGate();
for (const [id, timer] of [...timers]) if (timer.delay === 250) { timers.delete(id); timer.fn(); }
gateTree = renderGate();
assert.equal(gateTree.props.children[0], 'gameplay', 'The decode race must not strand the gate');
slots.forEach(slot => slot.cleanup?.());
console.log('Verified explicit native-size image bounds, clipping, native-logo readiness and gameplay continuation when the Canvas decodes before the fallback image.');
