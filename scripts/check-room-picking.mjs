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

// Mount the real UI-thread gesture adapter with a controllable RN queue.
const slots = [], layouts = [], effects = [], rn = [];
let cursor = 0, now = 1000, background;
const shared = value => ({ value, get() { return this.value; }, set(next) { this.value = typeof next === 'function' ? next(this.value) : next; } });
const React = {
  useRef: value => slots[cursor++] ??= { current: value },
  useState: init => { const i = cursor++; slots[i] ??= { value: typeof init === 'function' ? init() : init }; return [slots[i].value, value => { slots[i].value = value; }]; },
  useMemo: (fn, deps = []) => {
    const i = cursor++, old = slots[i];
    if (!old || deps.some((value, j) => !Object.is(value, old.deps[j]))) slots[i] = { value: fn(), deps };
    return slots[i].value;
  },
  useCallback: (fn, deps) => React.useMemo(() => fn, deps),
  useLayoutEffect: fn => layouts.push(fn), useEffect: fn => effects.push(fn),
};
const Gesture = { Pan() {
  const result = {};
  result.simultaneousWithExternalGesture = (...gestures) => { result.cameraGestures = gestures; return result; };
  for (const key of ['minDistance', 'maxPointers', 'onTouchesDown', 'onTouchesMove', 'onTouchesUp', 'onFinalize']) {
    result[key] = value => { result[key + 'Value'] = value; return result; };
  }
  return result;
} };
const { NativeRoomEditor } = compile('components/pet/NativeRoomEditor.tsx', {
  react: React, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  'react-native': { View: 'View', AppState: { addEventListener: (_event, fn) => { background = fn; return { remove() {} }; } }, StyleSheet: { absoluteFill: {} } },
  'react-native-gesture-handler': { Gesture, GestureDetector: 'GestureDetector' },
  'react-native-reanimated': { useSharedValue: value => React.useMemo(() => shared(value), []) },
  'react-native-worklets': { scheduleOnRN: (fn, ...args) => rn.push(() => fn(...args)) },
  '@/lib/app-diagnostics': { reportAppError: (_tag, error) => errors.push(error) },
  '@/utils/room-drag-controller': { createRoomDragController },
  '@/utils/room-layer-order': { ROOM_MENU_OPEN_Z_INDEX: 600100 },
}, { requestAnimationFrame: options.schedule, cancelAnimationFrame: options.cancel, Date: { now: () => now } });
const motion = shared({ session: 0, sequence: 0, x: 0, y: 0, active: false }), measure = shared(true), prepared = [];
const base = shared(undefined);
let stops = 0, latestSaves = 0;
const cameraPinch = {}, cameraPan = {};
const props = { ...options, cameraGesture: { toGestureArray: () => [cameraPinch, cameraPan] }, motion, base, measure, zoom: 2, prepare: (...args) => { prepared.push(args); base.set({ session: args[2].session }); }, stop: () => stops++ };
function render(next = props) {
  cursor = 0; layouts.length = 0;
  const node = NativeRoomEditor(next); layouts.forEach(fn => fn()); return node.props.gesture;
}
const flushRN = () => { while (rn.length) rn.shift()(); };
let handlers = render();
assert.deepEqual(handlers.cameraGestures, [cameraPinch, cameraPan], 'Native dragging must not cancel the parent camera pinch recognizer');
const cleanup = effects[0](); effects[1]();
handlers.onTouchesDownValue({ numberOfTouches: 1, allTouches: [{ x: 123, y: 234, absoluteX: 0, absoluteY: 0 }] }, {}); flushRN();
assert.deepEqual(JSON.parse(JSON.stringify(queries.at(-1).point)), { x: 123, y: 234 });
queries.at(-1).resolve('ball'); await drain();
assert.equal(prepared.at(-1)[0], 'ball');
const beforeMoves = moves.length;
for (let i = 1; i <= 120; i++) { now++; handlers.onTouchesMoveValue({ numberOfTouches: 1, allTouches: [{ absoluteX: i, absoluteY: i * 2 }] }); }
assert.equal(motion.get().x, 60, 'Pointer advances on UI while the RN queue is stalled');
assert.equal(motion.get().y, 120);
assert.equal(moves.length, beforeMoves, 'Movement does not wait for JS collision feedback');
assert.equal(rn.length, 2, '120 UI updates only enqueue two feedback requests');
flushRN(); frame();
assert.equal(moves.length, beforeMoves + 1, 'Feedback coalesces to the newest available sample');
handlers = render({ ...props, commit: () => latestSaves++ });
handlers.onTouchesUpValue({ changedTouches: [{ absoluteX: 150, absoluteY: 300 }] }); flushRN();
assert.equal(moves.at(-1).point.y, 170, 'Release validates its final pointer even between feedback samples');
assert.equal(latestSaves, 1, 'The latest commit callback is used once');

handlers = render(props);
const quickSaves = commits.length;
handlers.onTouchesDownValue({ numberOfTouches: 1, allTouches: [{ x: 123, y: 234, absoluteX: 100, absoluteY: 200 }] }, {}); flushRN();
const quickPick = queries.at(-1);
// A short simulator/native gesture can deliver no intermediate movement event.
handlers.onTouchesUpValue({ changedTouches: [{ absoluteX: 130, absoluteY: 240 }] });
handlers.onFinalizeValue({}, false); flushRN();
quickPick.resolve('ball'); await drain();
assert.equal(commits.length, quickSaves + 1, 'A release-only drag survives recognizer finalization and delayed picking');
assert.equal(commits.at(-1).point.y, 40, 'Raw release coordinates retain short-drag displacement');

let taps = 0;
handlers = render({ ...props, tap: () => taps++ });
handlers.onTouchesDownValue({ numberOfTouches: 1, allTouches: [{ x: 1, y: 2, absoluteX: 100, absoluteY: 200 }] }, {}); flushRN();
handlers.onTouchesUpValue({ changedTouches: [{ absoluteX: 100, absoluteY: 200 }] });
handlers.onFinalizeValue({}, false); flushRN();
queries.at(-1).resolve('ball'); await drain();
assert.equal(taps, 1, 'An unmoved touch remains a tap after a delayed pick');
assert.equal(commits.length, quickSaves + 1, 'Taps never save furniture');

handlers.onTouchesDownValue({ numberOfTouches: 1, allTouches: [{ x: 1, y: 2, absoluteX: 0, absoluteY: 0 }] }, {}); flushRN();
const returningPick = queries.at(-1);
handlers.onTouchesMoveValue({ numberOfTouches: 1, allTouches: [{ absoluteX: 1, absoluteY: 1 }] });
now++;
handlers.onTouchesMoveValue({ numberOfTouches: 1, allTouches: [{ absoluteX: 50, absoluteY: 50 }] });
handlers.onTouchesUpValue({ changedTouches: [{ absoluteX: 0, absoluteY: 0 }] }); flushRN();
returningPick.resolve('ball'); await drain();
assert.equal(commits.length, quickSaves + 2, 'Returning to the start remains a drag even when JS only receives the last point');
assert.equal(taps, 1);

handlers = render({ ...props, zoom: .65 });
handlers.onTouchesDownValue({ numberOfTouches: 1, allTouches: [{ x: 123, y: 234, absoluteX: 0, absoluteY: 0 }] }, {}); flushRN(); queries.at(-1).resolve('ball'); await drain();
now += 100; handlers.onTouchesMoveValue({ numberOfTouches: 1, allTouches: [{ absoluteX: 13, absoluteY: 26 }] });
assert.equal(motion.get().x, 20); assert.equal(motion.get().y, 40);
let failed = false;
handlers.onTouchesDownValue({ numberOfTouches: 2 }, { fail() { failed = true; } });
assert.equal(failed, true, 'A second finger yields the drag to pinch');
handlers.onFinalizeValue({}, false); flushRN();
assert.equal(motion.get().active, false); assert.equal(discards.at(-1), 'ball');

handlers.onTouchesDownValue({ numberOfTouches: 1, allTouches: [{ x: 1, y: 2, absoluteX: 0, absoluteY: 0 }] }, {}); flushRN();
queries.at(-1).resolve(undefined); await drain(); base.set(undefined);
for (let i = 1; i <= 32; i++) { now++; handlers.onTouchesMoveValue({ numberOfTouches: 1, allTouches: [{ absoluteX: i, absoluteY: i }] }); }
assert.equal(rn.length, 2, 'Empty-space panning retains frame-rate feedback instead of the furniture throttle');
handlers.onFinalizeValue({}, false); flushRN();


handlers.onTouchesDownValue({ numberOfTouches: 1, allTouches: [{ x: 1, y: 2, absoluteX: 0, absoluteY: 0 }] }, {}); flushRN();
const pending = queries.at(-1), selectionCountAfterStart = selections.length;
handlers.onFinalizeValue({}, false); flushRN(); pending.resolve('lamp'); await drain();
assert.equal(selections.length, selectionCountAfterStart, 'Cancelled pending picks cannot select or prepare a model');
handlers.onTouchesDownValue({ numberOfTouches: 1, allTouches: [{ x: 1, y: 2, absoluteX: 0, absoluteY: 0 }] }, {}); flushRN(); queries.at(-1).resolve('ball'); await drain();
const savesBeforeBackground = commits.length; background('background');
assert.equal(motion.get().active, false); assert.equal(commits.length, savesBeforeBackground);
assert.ok(stops > 0, 'Cancelled/tapped gestures clear native preview ownership');
cleanup();
console.log('Verified UI pointer updates without RN work, feedback coalescing, exact release, latest callbacks, pending-pick cancellation, pinch handoff and background cleanup.');
