/** Exercise the real gesture controller and editor with delayed native geometry picks. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(file, mocks = {}, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: id => {
    assert.ok(id in mocks, id); return mocks[id];
  }, ...globals });
  return module.exports;
}
const { createRoomDragController } = compile('utils/room-drag-controller.ts');
let nextFrame = 0;
const frames = new Map(), queries = [], selections = [], moves = [], commits = [], discards = [], errors = [];
const options = {
  pick: point => new Promise((resolve, reject) => queries.push({ point, resolve, reject })),
  anchor: () => ({ x: 10, y: 20 }), select: id => selections.push(id),
  move: (id, point) => { moves.push({ id, point }); return { x: Math.min(40, point.x), y: point.y }; },
  commit: (id, point) => commits.push({ id, point }), discard: id => discards.push(id),
  schedule: fn => { const id = ++nextFrame; frames.set(id, fn); return id; },
  cancel: id => frames.delete(id), onError: error => errors.push(error),
};
const controller = createRoomDragController(options);
const drain = async () => { await Promise.resolve(); await Promise.resolve(); };
function frame() { for (const [id, fn] of [...frames]) { frames.delete(id); fn(); } }
controller.begin({ x: 123, y: 234 });
queries.at(-1).resolve('ball'); await drain();
assert.equal(selections.at(-1), 'ball', 'Geometry-selected ball wins inside the lamp rectangle');
for (let i = 0; i < 120; i++) controller.update(i, 10);
assert.equal(queries.length, 1, 'A captured gesture never repicks objects crossed during movement');
assert.equal(frames.size, 1, '120 input events schedule only one frame');
frame();
assert.equal(moves.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(moves.at(-1))), { id: 'ball', point: { x: 129, y: 30 } });
controller.release(); controller.release();
assert.equal(moves.length, 1, 'Releasing an already applied point does no extra collision work');
assert.deepEqual(JSON.parse(JSON.stringify(commits)), [{ id: 'ball', point: { x: 40, y: 30 } }], 'Save the accepted collision point once');

controller.begin({ x: 4, y: 5 });
controller.update(20, 30); controller.release();
assert.equal(commits.length, 1, 'Release waits for a pending native pick');
queries.at(-1).resolve('chair'); await drain();
assert.equal(commits.at(-1).id, 'chair');
assert.equal(commits.at(-1).point.y, 50, 'Quick movement is retained while geometry picking completes');

controller.begin({ x: 4, y: 5 }); queries.at(-1).resolve('lamp'); await drain();
controller.update(20, 30); controller.update(22, 35); controller.release();
assert.equal(frames.size, 0);
assert.equal(commits.at(-1).point.y, 55, 'Release flushes the latest pending movement');

controller.begin({ x: 4, y: 5 });
const stale = queries.at(-1);
controller.begin({ x: 6, y: 7 });
const beforeStale = selections.length;
stale.resolve('lamp'); await drain();
assert.equal(selections.length, beforeStale, 'An older native query cannot change selection');
const selectionCount = selections.length;
queries.at(-1).resolve(undefined); await drain(); controller.release();
assert.equal(selections.length, selectionCount + 1, 'Only the current pick may select an object');
assert.equal(selections.at(-1), undefined, 'Empty space clears selection');

controller.begin({ x: 4, y: 5 }); queries.at(-1).resolve('ball'); await drain();
controller.update(20, 30); frame(); controller.update(30, 40); controller.cancel();
assert.equal(frames.size, 0);
assert.equal(discards.at(-1), 'ball', 'Unmount discards the unsaved preview');
const saves = commits.length;
controller.release(); assert.equal(commits.length, saves);
controller.begin({ x: 4, y: 5 }); controller.cancel();
queries.at(-1).resolve('lamp'); await drain();
assert.equal(commits.length, saves, 'Unmount invalidates delayed native results');
controller.begin({ x: 4, y: 5 }); queries.at(-1).reject(new Error('picker unavailable')); await drain();
assert.equal(errors.length, 1); assert.equal(commits.length, saves);

// Mount the actual component: rerenders replace callbacks without losing capture.
const slots = [], layouts = [], effects = [];
let cursor = 0;
const React = {
  useRef: value => slots[cursor++] ??= { current: value },
  useMemo: (fn,deps=[]) => {
    const index=cursor++,old=slots[index];
    if(!old || deps.some((value,i)=>!Object.is(value,old.deps[i]))) slots[index]={value:fn(),deps};
    return slots[index].value;
  },
  useLayoutEffect: fn => layouts.push(fn), useEffect: fn => effects.push(fn),
};
const { NativeRoomEditor } = compile('components/pet/NativeRoomEditor.tsx', {
  react: React, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  'react-native': { View: 'View', PanResponder: { create: panHandlers => ({ panHandlers }) }, StyleSheet: { absoluteFill: {} } },
  '@/lib/app-diagnostics': { reportAppError: (_tag, error) => errors.push(error) },
  '@/utils/room-drag-controller': { createRoomDragController },
  '@/utils/room-layer-order': { ROOM_MENU_OPEN_Z_INDEX: 600100 },
}, { requestAnimationFrame: options.schedule, cancelAnimationFrame: options.cancel });
function render(props) {
  cursor = 0; layouts.length = 0;
  const node = NativeRoomEditor(props); layouts.forEach(fn => fn()); return node.props;
}
let handlers = render({ ...options, zoom: 2 });
const cleanup = effects[0]();
handlers.onPanResponderGrant({ nativeEvent: { locationX: 123, locationY: 234 } });
assert.deepEqual(JSON.parse(JSON.stringify(queries.at(-1).point)), { x: 123, y: 234 }, 'Pick coordinates stay in local DP; Filament handles density/Y conversion');
queries.at(-1).resolve('ball'); await drain();
let latestSaves = 0;
handlers = render({ ...options, zoom: 1.5, commit: () => latestSaves++ });
handlers.onPanResponderMove({}, { dx: 30, dy: 60 }); frame();
assert.equal(moves.at(-1).point.x, 30); assert.equal(moves.at(-1).point.y, 60);
handlers.onPanResponderTerminate();
assert.equal(latestSaves, 1, 'Termination saves the accepted point with the latest callbacks');
assert.equal(handlers.onStartShouldSetPanResponder({nativeEvent:{touches:[{},{}]}}),false,'A pinch must not start an object drag');
assert.equal(handlers.onPanResponderTerminationRequest({}, {numberActiveTouches:2}),true,'Multi-touch may yield to the camera pinch');
handlers.onPanResponderGrant({ nativeEvent: { locationX: 1, locationY: 2 } });
queries.at(-1).resolve('ball'); await drain();
handlers.onPanResponderMove({}, {dx:30,dy:60,numberActiveTouches:1});frame();
const movedBeforePinch=moves.length;
handlers.onPanResponderMove({}, {dx:300,dy:600,numberActiveTouches:2});
handlers.onPanResponderRelease();frame();
assert.equal(moves.length,movedBeforePinch,'A second finger cancels object movement');
assert.equal(latestSaves,1,'Pinching does not save a stray object move');
handlers.onPanResponderGrant({ nativeEvent: { locationX: 1, locationY: 2 } });
cleanup(); queries.at(-1).resolve('ball'); await drain();
assert.equal(latestSaves, 1, 'Component cleanup prevents late gesture effects');
console.log('Verified geometry gesture capture, delayed picks, frame coalescing, final saves, cleanup, zoom and rerender continuity.');

// Run the actual sprite/accessibility drag component's release path as well.
slots.length=0;cursor=0;layouts.length=0;effects.length=0;
React.useCallback=fn=>fn;
React.useState=initial=>{
  const index=cursor++;
  const state=slots[index]??={value:typeof initial==='function'?initial():initial};
  return [state.value,next=>{state.value=typeof next==='function'?next(state.value):next;}];
};
const shared=initial=>{let value=initial;return {get:()=>value,set:next=>{value=next;}};};
const jsx=(type,props)=>({type,props});
const {DraggableRoomPet}=compile('components/pet/DraggableRoomPet.tsx',{
  react:React,'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-i18next':{useTranslation:()=>({t:key=>key})},
  'react-native':{View:'View',PanResponder:{create:panHandlers=>({panHandlers})},StyleSheet:{create:value=>value,absoluteFill:{}}},
  'react-native-reanimated':{default:{View:'AnimatedView'},useSharedValue:value=>React.useMemo(()=>shared(value),[]),useAnimatedStyle:read=>({read})},
  '@/utils/scale':{moderateScale:value=>value},
  '@/utils/room-depth':{getRoomDepthZIndex:y=>y},
  '@/utils/room-layer-order':{ROOM_MENU_OPEN_Z_INDEX:600100},
  '@/components/pet/RoomActionMenu':{RoomActionMenu:'RoomActionMenu'},
});
let previews=0,validations=0,savedOffset;
const dragProps={petSize:60,initialOffset:{x:0,y:0},children:null,
  onDragPositionChange:point=>{previews++;return point;},
  onDragEnd:()=>{validations++;return {x:0,y:0};},
  onOffsetChange:offset=>{savedOffset=offset;}};
function renderSprite(){cursor=0;layouts.length=0;const node=DraggableRoomPet(dragProps);layouts.forEach(fn=>fn());return node;}
let sprite=renderSprite();
sprite.props.onLayout({nativeEvent:{layout:{width:400,height:400}}});
sprite=renderSprite();sprite=renderSprite();
function flatten(node){return node?.props?[node,...[node.props.children].flat(Infinity).flatMap(flatten)]:[];}
const spriteHandlers=flatten(sprite).find(node=>node.props.onPanResponderGrant).props;
spriteHandlers.onPanResponderGrant();
spriteHandlers.onPanResponderMove({}, {dx:50,dy:40});
spriteHandlers.onPanResponderMove({}, {dx:70,dy:50});
assert.equal(previews,2);assert.equal(validations,0,'Sprite previews do no release validation');
spriteHandlers.onPanResponderRelease();
assert.equal(validations,1,'The sprite validates once when released');
assert.equal(savedOffset.x,0);assert.equal(savedOffset.y,0,'The rejected position cannot be saved');
const liveStyle=flatten(sprite).flatMap(node=>[node.props.style].flat(Infinity)).find(style=>style?.read?.().transform);
assert.equal(liveStyle.read().transform[0].translateX,0);
assert.equal(liveStyle.read().transform[1].translateY,0,'The visible sprite returns immediately to the accepted anchor');
console.log('Verified real sprite drag previews, release-only validation and immediate visual restoration after rejection.');
