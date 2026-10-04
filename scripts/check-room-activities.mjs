/** Exercise the room planner and idle scheduler without native rendering. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root = process.cwd();
const cache = new Map();
const mocks = {};
let now = 0, timerId = 0;
const timers = new Map();
const setTimeoutMock = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, at: now + delay }); return id; };
function advance(ms) {
  const until = now + ms;
  for (;;) {
    const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next || next[1].at > until) break;
    now = next[1].at; timers.delete(next[0]); next[1].fn();
  }
  now = until;
}
function load(id) {
  if (id in mocks) return mocks[id];
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : id;
  if (/\.(png|webp|mp4)$/.test(file)) return 1;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: load, setTimeout: setTimeoutMock, clearTimeout: id => timers.delete(id) });
  return module.exports;
}
const { buildRoomActivity, roomOffsetToPoint, ROOM_IDLE_DELAY_MS } = load('@/utils/room-activities');
const room = { width: 320, height: 320, petSize: 120, sizeScale: 1,
  homeOffset: { x: -.3, y: .3 }, decorations: [], toys: [], ownedToyIds: [], hungry: false, asleep: false };
assert.equal(buildRoomActivity(room, 0), null);
assert.equal(buildRoomActivity({ ...room, width: 0 }, 0), null);
const sofa = { decorationId: 'sofaA', instanceId: 'sofa', offset: { x: .4, y: -.2 } };
const furnished = { ...room, decorations: [sofa] };
const serialized = JSON.stringify(furnished);
const sit = buildRoomActivity(furnished, 0);
const sleep = buildRoomActivity(furnished, 1);
assert.equal(sit.kind, 'sofaSit');
assert.equal(sleep.kind, 'sofaSleep');
assert.ok(sleep.steps.some(step => step.mood === 'sleeping'));
assert.equal(sit.targetInstanceId, 'sofa');
assert.equal(JSON.stringify(sit.steps.at(-1).position), JSON.stringify(roomOffsetToPoint(room.homeOffset, 320, 320, 120)));
const flipped = buildRoomActivity({ ...furnished, decorations: [{ ...sofa, wallFlipped: true }] }, 0);
assert.ok(flipped.steps[1].position.x > sit.steps[1].position.x, 'Mirrored sofas must use the opposite seat');
const rotated = buildRoomActivity({ ...furnished, decorations: [{ ...sofa, rotationIndex: 1 }] }, 0);
assert.equal(rotated.steps[1].position.x, flipped.steps[1].position.x);
const larger = buildRoomActivity({ ...furnished, decorations: [{ ...sofa, scale: 2 }] }, 0);
assert.ok(larger.steps[1].scale > sit.steps[1].scale);
assert.equal(buildRoomActivity({ ...furnished, asleep: true }, 0).kind, 'sofaSleep');
const ball = { toyId: 'blueBall', instanceId: 'ball', offset: { x: .3, y: .4 } };
const play = buildRoomActivity({ ...room, toys: [ball] }, 0);
assert.equal(play.kind, 'toyPlay');
assert.equal(play.steps[1].mood, 'playBall');
assert.equal(buildRoomActivity({ ...room, ownedToyIds: ['blueBall'] }, 0), null, 'Balls must be placed');
assert.equal(buildRoomActivity({ ...room, toys: [ball], hungry: true }, 0), null);
assert.equal(buildRoomActivity({ ...room, toys: [ball], asleep: true }, 0), null);
const ownedMouse = { ...room, ownedToyIds: ['mouse'] };
const chase = buildRoomActivity(ownedMouse, 0);
assert.equal(chase.kind, 'mouseChase');
assert.equal(chase.mouseInstanceId, undefined, 'Owned mice can appear temporarily');
const mouse = { toyId: 'mouse', instanceId: 'mouse', offset: { x: -.4, y: .4 } };
const placedChase = buildRoomActivity({ ...ownedMouse, toys: [mouse] }, 0);
assert.equal(placedChase.mouseInstanceId, 'mouse');
assert.equal(JSON.stringify(placedChase.mouseStart), JSON.stringify(placedChase.steps.at(-1).mousePosition));
for (const plan of [sit, sleep, flipped, larger, play, chase, placedChase]) {
  for (const step of plan.steps) {
    assert.ok(Math.abs(step.position.x) <= 100 && Math.abs(step.position.y) <= 100, 'Cat stays inside room bounds');
    assert.ok(step.durationMs > 0);
  }
}
assert.equal(JSON.stringify(furnished), serialized, 'Ambient plans must not mutate saved placements');

// React hooks with dependency-aware effects and fake time.
const slots = []; let index = 0, effects = [], visibility = { active: true, reduceMotion: false };
const shared = initial => { let value = initial; return { get: () => value, set: next => { value = next; } }; };
const slot = initial => { const i = index++; if (!(i in slots)) slots[i] = initial(); return [i, slots[i]]; };
mocks.react = {
  useRef: initial => slot(() => ({ current: initial }))[1],
  useState: initial => { const [i, value] = slot(() => initial); return [value, next => { slots[i] = next; }]; },
  useEffect: (fn, deps) => {
    const [i, old] = slot(() => null);
    if (!old || deps.some((dep, i) => dep !== old.deps[i])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
  },
};
mocks['@/pet-display/media/sprite/use-sprite-clock'] = { useSpriteActivity: () => visibility };
mocks['react-native-reanimated'] = {
  useSharedValue: initial => slot(() => shared(initial))[1], cancelAnimation() {},
  withTiming: value => value, withRepeat: value => value, withSequence: (...values) => values.at(-1),
  Easing: { quad: x => x, inOut: fn => fn },
};
const { useRoomActivity } = load('@/hooks/use-room-activity');
const petX = shared(0), petY = shared(0);
let interaction = 1, enabled = true;
function render() {
  index = 0; effects = [];
  const result = useRoomActivity(ownedMouse, enabled, interaction, petX, petY);
  effects.forEach(fn => fn()); return result;
}
assert.equal(render().activity, null);
advance(ROOM_IDLE_DELAY_MS - 1); assert.equal(render().activity, null);
advance(1); assert.equal(render().activity.plan.kind, 'mouseChase');
advance(2300); assert.equal(render().activity.stepIndex, 1);
interaction++; assert.equal(render().activity, null, 'Touches interrupt idle play');
assert.equal(petX.get(), -30); assert.equal(petY.get(), 30);
assert.equal(timers.size, 1, 'Interruption must replace the old timer');
enabled = false; render(); advance(60_000); assert.equal(render().activity, null, 'Care and decorating block ambient motion');
assert.equal(timers.size, 0);
enabled = true; visibility = { active: false, reduceMotion: false }; render(); advance(60_000); assert.equal(render().activity, null);
visibility = { active: true, reduceMotion: true }; render(); advance(60_000); assert.equal(render().activity, null);
visibility = { active: true, reduceMotion: false }; render(); advance(ROOM_IDLE_DELAY_MS); assert.equal(render().activity.plan.kind, 'mouseChase');
advance(4 * 2300 + 2200); assert.equal(render().activity, null, 'Completed activity returns to the saved placement');
assert.equal(petX.get(), -30); assert.equal(petY.get(), 30);
console.log('Verified sofas, mirrored/scaled seating, toy eligibility, mouse chases, idle timing, interruption, care/edit blocking, background pause, Reduce Motion, and saved placement preservation.');
