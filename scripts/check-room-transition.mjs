/** Exercise readiness, rapid input, interruption and direction using the real transition hook. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const slots = [], cache = new Map(), animations = [];
let index = 0, effects = [], visibility = { active: true, reduceMotion: false };
const slot = init => { const i = index++; if (!(i in slots)) slots[i] = init(); return [i, slots[i]]; };
const mocks = {
  react: {
    useCallback: fn => fn,
    useRef: value => slot(() => ({ current: value }))[1],
    useState: value => { const [i, current] = slot(() => value); return [current, next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useEffect: (fn, deps) => { const [i, old] = slot(() => null); if (!old || deps.some((v, j) => v !== old.deps[j])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  },
  '@/hooks/use-animation-activity': { useAnimationActivity: () => visibility },
  'react-native-reanimated': {
    useSharedValue: value => slot(() => ({ value, get() { return this.value; }, set(next) { this.value = next; } }))[1],
    cancelAnimation: shared => { for (const a of animations) if (shared.value === a) a.cancelled = true; },
    withTiming: (value, options, complete) => { const animation = { value, options, complete }; animations.push(animation); return animation; },
    runOnJS: fn => fn, Easing: { cubic: x => x, inOut: fn => fn },
  },
};
function load(id) {
  if (id in mocks) return mocks[id];
  const file = path.join(process.cwd(), id.slice(2) + '.ts');
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: load });
  return module.exports;
}
const { useRoomTransition } = load('@/hooks/use-room-transition');
const { HOME_ROOM_IDS, roomTravelDirection } = load('@/constants/home-rooms');
assert.deepEqual(Array.from(HOME_ROOM_IDS), ['bedroom', 'livingRoom', 'kitchen', 'bathroom']);
assert.equal(roomTravelDirection('livingRoom', 'bedroom'), -1);
assert.equal(roomTravelDirection('livingRoom', 'kitchen'), 1);
let pet = { type: 'cat', homeRoomId: 'livingRoom', catHomeRoomId: 'livingRoom' };
const visits = [];
const visit = id => { visits.push(id); pet = { ...pet, homeRoomId: id }; };
function render() {
  index = 0; effects = [];
  // A dependency-aware dispatcher exercises the hook without a native mount.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = useRoomTransition(pet, visit);
  effects.forEach(fn => fn()); return result;
}
const first = render(); first.visit('bedroom'); first.visit('kitchen');
assert.deepEqual(visits, ['bedroom'], 'Repeated input before the next render cannot queue another slide');
let current = render();
assert.equal(current.transition.direction, -1);
assert.equal(current.transition.outgoing.homeRoomId, 'livingRoom');
assert.equal(current.progress.get(), 0);
assert.equal(pet.catHomeRoomId, 'livingRoom', 'Browsing changes only the viewed room');
current.ready('livingRoom');
assert.equal(animations.length, 0, 'The source cannot start the transition');
current.ready('bedroom'); current.ready('bedroom');
assert.equal(animations.length, 1, 'Only the destination readiness starts one slide');
assert.equal(animations[0].options.duration, 420);
animations[0].complete(true); current = render();
assert.equal(current.transition, null);
current.visit('livingRoom'); current = render();
assert.equal(current.transition.direction, 1);
animations[0].complete(true); current = render();
assert.equal(current.transition.destination, 'livingRoom', 'A stale completion cannot clear a later slide');
current.ready('livingRoom');
visibility = { active: false, reduceMotion: false }; render(); current = render();
assert.equal(current.transition, null, 'Covering the screen settles the scene without locking controls');
assert.equal(animations[1].cancelled, true);
visibility = { active: true, reduceMotion: true }; current = render(); current.visit('kitchen'); current = render();
assert.equal(current.transition, null);
assert.equal(pet.homeRoomId, 'kitchen');
assert.equal(animations.length, 2, 'Reduced Motion switches directly without a slide');
assert.equal(pet.catHomeRoomId, 'livingRoom');
console.log('Verified room ordering, readiness before sliding, repeated input, stale completions, covered screens, independent cat location and Reduce Motion.');
