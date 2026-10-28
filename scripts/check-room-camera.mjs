import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules = new Map();
let slots = [], index = 0, rnCalls = 0;
const memo = (fn, deps) => { const i = index++, old = slots[i]; if (!old || deps.some((v,k) => v !== old.deps[k])) slots[i] = { deps, value: fn() }; return slots[i].value; };
class Gesture {
  constructor(kind) { this.kind = kind; this.handlers = {}; }
}
for (const name of ['enabled','minDistance','maxPointers','manualActivation','onStart','onUpdate','onFinalize','onTouchesDown','onTouchesMove','onTouchesUp'])
  Gesture.prototype[name] = function(value) { this.handlers[name] = value; return this; };
const mocks = {
  react: { useMemo: memo, useCallback: (fn,deps) => memo(() => fn,deps), useEffect: () => {}, useState: value => { const slot = memo(() => ({ value }), []); return [slot.value, next => { slot.value = next; }]; } },
  'react-native-reanimated': { useSharedValue: value => memo(() => ({ value, get() { return this.value; }, set(v) { this.value = v; } }), []), withTiming: value => value, cancelAnimation() {} },
  'react-native-worklets': { scheduleOnRN: (fn,...args) => { rnCalls++; return fn(...args); } },
  'react-native-gesture-handler': { Gesture: { Pinch: () => new Gesture('pinch'), Pan: () => new Gesture('pan'), Simultaneous: (...gestures) => gestures } },
};
function load(id) {
  if (id in mocks) return mocks[id];
  if (modules.has(id)) return modules.get(id).exports;
  const file = id.replace('@/', '') + '.ts', module = { exports: {} }; modules.set(id,module);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: load, Math }); return module.exports;
}
const { useRoomCamera: renderRoomCamera } = load('@/hooks/use-room-camera');
function render(panEnabled = true, frameScale = 1, frameY = 0) { index = 0; return renderRoomCamera(320,400,true,false,panEnabled,frameScale,frameY); }
let camera = render();
const [pinch, pan] = camera.gesture;
const manager = { activations:0, activate() { this.activations++; this.active = true; }, fail() { this.failed = true; } };
pan.handlers.onTouchesDown({ allTouches: [{ x: 60, y: 100 }] },manager);
assert.equal(manager.failed,true,'A normal-zoom touch releases the manual pan before any movement or timeout');
pan.handlers.onTouchesMove({ numberOfTouches: 1, allTouches: [{ x: 61, y: 101 }] }, manager);
assert.equal(manager.failed,true,'At 1× a scroll remains with the surrounding page');
pinch.handlers.onStart({ focalX: 200, focalY: 160 });
pinch.handlers.onUpdate({ scale: 1.73, focalX: 200, focalY: 160 });
assert.equal(camera.scale.get(),1.73,'Pinch does not snap to an integer');
assert.ok(Math.abs(camera.x.get() + 40*1.73 - 40) < 1e-8,'The point under the fingers stays under them');
assert.ok(Math.abs(camera.y.get() - 40*1.73 + 40) < 1e-8);
pinch.handlers.onFinalize(); camera = render(); assert.equal(camera.zoom,1.73);
manager.active = false;manager.failed=false;
pan.handlers.onTouchesDown({ allTouches: [{ x: 60, y: 100 }] },manager);
pan.handlers.onTouchesMove({ numberOfTouches: 1, allTouches: [{ x: 62, y: 101 }] }, manager);
assert.equal(manager.active,false,'A tap on a zoomed object never activates pan');
pan.handlers.onTouchesUp({},manager);
assert.equal(manager.failed,true,'A zoomed tap releases the manual pan on finger-up so its native menu can open');
manager.failed=false;
pan.handlers.onTouchesDown({ allTouches: [{ x: 60, y: 100 }] },manager);
pan.handlers.onTouchesMove({ numberOfTouches: 1, allTouches: [{ x: 63, y: 100 }] }, manager);
assert.equal(manager.active,false,'Movement below four points remains a tap');
pan.handlers.onTouchesMove({ numberOfTouches: 1, allTouches: [{ x: 64, y: 100 }] }, manager);
assert.equal(manager.active,true);
assert.equal(pan.handlers.minDistance,4,'The native recognizer uses the same threshold as the worklet');
const activations=manager.activations;
const callsBeforePan=rnCalls;
for(let frame=0;frame<120;frame++)pan.handlers.onTouchesMove({numberOfTouches:1,allTouches:[{x:85+frame,y:110}]},manager);
assert.equal(manager.activations,activations,'A pan requests native activation once, including moves before the start callback');
pan.handlers.onStart();
for(let frame=0;frame<120;frame++) {
  pan.handlers.onTouchesMove({numberOfTouches:1,allTouches:[{x:85+frame,y:110}]},manager);
  pan.handlers.onUpdate({translationX:frame*.25,translationY:0});
}
assert.equal(manager.activations,activations,'Active pan frames never reset the native recognizer to Began');
assert.equal(rnCalls,callsBeforePan,'Pan frames never schedule React state or JavaScript work');
pan.handlers.onUpdate({ translationX: 999, translationY: -999 });
pan.handlers.onTouchesUp({},manager);assert.equal(manager.failed,false,'An actual pan finishes normally without becoming a menu tap');
pan.handlers.onFinalize();
assert.ok(Math.abs(camera.x.get()-.73*160)<1e-8); assert.ok(Math.abs(camera.y.get()+.73*200)<1e-8);
pan.handlers.onTouchesDown({allTouches:[{x:60,y:100}]},manager);
pan.handlers.onTouchesMove({numberOfTouches:1,allTouches:[{x:64,y:100}]},manager);
assert.equal(manager.activations,activations+1,'A finished pan releases its activation latch for the next gesture');
pan.handlers.onStart();pan.handlers.onFinalize();
pinch.handlers.onStart({ focalX: 160, focalY: 200 });
pinch.handlers.onUpdate({ scale: .1, focalX: 160, focalY: 200 });
assert.equal(camera.scale.get(),1); assert.ok(Math.abs(camera.x.get())<1e-8); assert.ok(Math.abs(camera.y.get())<1e-8);
pinch.handlers.onUpdate({ scale: 100, focalX: 160, focalY: 200 });
assert.equal(camera.scale.get(),3,'A large pinch stops at the 3× maximum');
pinch.handlers.onStart({ focalX: 160, focalY: 200 });
pinch.handlers.onUpdate({ scale: 2, focalX: 160, focalY: 200 });
assert.equal(camera.scale.get(),3,'Repeated pinches cannot exceed 3×');
pinch.handlers.onStart({ focalX: 160, focalY: 200 });
pinch.handlers.onUpdate({ scale: 2.36 / 3, focalX: 160, focalY: 200 });
assert.ok(Math.abs(camera.scale.get()-2.36)<1e-8,'Pinching inward from the cap preserves fractional zoom');
pinch.handlers.onFinalize(); camera = render();
const modeFrame = load('@/utils/room-camera').roomEditingFrame(220,74,48,66);
const modeCamera = render(false, modeFrame.scale, modeFrame.y);
assert.equal(modeCamera.zoom, 2.36, 'Entering decoration mode keeps the selected zoom');
assert.equal(modeCamera.scale.get() * modeFrame.scale, 2.36, 'The displayed room keeps that zoom');
assert.equal(render().zoom, 2.36, 'Returning to game mode keeps the same zoom');
camera.reset(); assert.equal(camera.scale.get(),1); assert.equal(render().zoom,1);
const editingCamera = render(false);
assert.equal(editingCamera.gesture[0].handlers.enabled, true, 'Pinching remains available while decorating');
assert.equal(editingCamera.gesture[1].handlers.enabled, false, 'A one-finger item drag cannot move the camera while decorating');
console.log('Verified fractional focal-point pinch zoom, bounded panning, four-point activation, one native activation per pan, no JS work during pans, tap menus, scroll at 1× and reset.');

const { roomEditingFrame, clampRoomEditingCamera, clampRoomCamera } = load('@/utils/room-camera');
for (const [width, height] of [[320, 380], [390, 460], [768, 700]]) {
  const dock = Math.min(260, Math.max(160, height * .55));
  const frame = roomEditingFrame(dock, 74, 48, 66);
  // The editor may cover part of the room on short screens, but opening it
  // cannot silently change the user's chosen zoom level.
  const top = height / 2 + frame.y - width * frame.scale / 2;
  const bottom = height / 2 + frame.y + width * frame.scale / 2;
  assert.equal(frame.scale, 1);
  assert.ok(Math.abs((top + bottom) / 2 - (66 + height - frame.overlap) / 2) < 1e-8);
  const hidden = Math.max(0, (width - (height - frame.overlap - 66)) / 2);
  assert.equal(clampRoomEditingCamera(0, 1000, 1, width, height, frame.overlap, 66).y, hidden);
  assert.equal(clampRoomEditingCamera(0, -1000, 1, width, height, frame.overlap, 66).y, -hidden);
  assert.equal(clampRoomCamera(0, hidden, 1, width, height).y, 0, 'Returning to play recenters a panned 1× room');
}
console.log('Verified editing frames preserve room zoom and let short screens pan covered room areas.');

slots = []; index = 0;
const shifted = renderRoomCamera(320, 400, true, false, false, modeFrame.scale, modeFrame.y);
const [shiftedPinch] = shifted.gesture;
shiftedPinch.handlers.onStart({ focalX: 200, focalY: 200 + modeFrame.y + 40 });
shiftedPinch.handlers.onUpdate({ scale: 1.5, focalX: 200, focalY: 200 + modeFrame.y + 40 });
assert.ok(Math.abs(160 + shifted.x.get() + 40 * 1.5 - 200) < 1e-8);
assert.ok(Math.abs(200 + modeFrame.y + shifted.y.get() + 40 * 1.5 - (200 + modeFrame.y + 40)) < 1e-8);
console.log('Verified pinch keeps its focal point while the editing frame shifts the room.');
