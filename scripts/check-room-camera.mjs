import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules = new Map();
let slots = [], index = 0;
const memo = (fn, deps) => { const i = index++, old = slots[i]; if (!old || deps.some((v,k) => v !== old.deps[k])) slots[i] = { deps, value: fn() }; return slots[i].value; };
class Gesture {
  constructor(kind) { this.kind = kind; this.handlers = {}; }
}
for (const name of ['enabled','minDistance','maxPointers','manualActivation','onStart','onUpdate','onFinalize','onTouchesDown','onTouchesMove'])
  Gesture.prototype[name] = function(value) { this.handlers[name] = value; return this; };
const mocks = {
  react: { useMemo: memo, useCallback: (fn,deps) => memo(() => fn,deps), useEffect: () => {}, useState: value => { const slot = memo(() => ({ value }), []); return [slot.value, next => { slot.value = next; }]; } },
  'react-native-reanimated': { useSharedValue: value => memo(() => ({ value, get() { return this.value; }, set(v) { this.value = v; } }), []), withTiming: value => value, cancelAnimation() {} },
  'react-native-worklets': { scheduleOnRN: (fn,...args) => fn(...args) },
  'react-native-gesture-handler': { Gesture: { Pinch: () => new Gesture('pinch'), Pan: () => new Gesture('pan'), Simultaneous: (...gestures) => gestures } },
};
function load(id) {
  if (id in mocks) return mocks[id];
  if (modules.has(id)) return modules.get(id).exports;
  const file = id.replace('@/', '') + '.ts', module = { exports: {} }; modules.set(id,module);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: load, Math }); return module.exports;
}
const { useRoomCamera } = load('@/hooks/use-room-camera');
function render() { index = 0; return useRoomCamera(320,400,true,false); }
let camera = render();
const [pinch, pan] = camera.gesture;
const manager = { activate() { this.active = true; }, fail() { this.failed = true; } };
pan.handlers.onTouchesDown({ allTouches: [{ x: 60, y: 100 }] });
pan.handlers.onTouchesMove({ numberOfTouches: 1, allTouches: [{ x: 61, y: 101 }] }, manager);
assert.equal(manager.failed,true,'At 1× a scroll remains with the surrounding page');
pinch.handlers.onStart({ focalX: 200, focalY: 160 });
pinch.handlers.onUpdate({ scale: 1.73, focalX: 200, focalY: 160 });
assert.equal(camera.scale.get(),1.73,'Pinch does not snap to an integer');
assert.ok(Math.abs(camera.x.get() + 40*1.73 - 40) < 1e-8,'The point under the fingers stays under them');
assert.ok(Math.abs(camera.y.get() - 40*1.73 + 40) < 1e-8);
pinch.handlers.onFinalize(); camera = render(); assert.equal(camera.zoom,1.73);
manager.active = false;
pan.handlers.onTouchesDown({ allTouches: [{ x: 60, y: 100 }] });
pan.handlers.onTouchesMove({ numberOfTouches: 1, allTouches: [{ x: 62, y: 101 }] }, manager);
assert.equal(manager.active,false,'A tap on a zoomed object never activates pan');
pan.handlers.onTouchesMove({ numberOfTouches: 1, allTouches: [{ x: 85, y: 110 }] }, manager);
assert.equal(manager.active,true);
pan.handlers.onStart(); pan.handlers.onUpdate({ translationX: 999, translationY: -999 });
assert.ok(Math.abs(camera.x.get()-.73*160)<1e-8); assert.ok(Math.abs(camera.y.get()+.73*200)<1e-8);
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
camera.reset(); assert.equal(camera.scale.get(),1); assert.equal(render().zoom,1);
console.log('Verified fractional focal-point pinch zoom, bounded panning, tap threshold, scroll at 1× and reset.');
