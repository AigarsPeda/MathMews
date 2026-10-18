/** Run the real native actor with delayed JS snapshots and repeated command renders. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

let slots = [], cursor = 0, effects = [], frame, position, heading, animation, currentFps = 60;
const cache = new Map(), clips = Object.entries(JSON.parse(fs.readFileSync('scripts/3d/clips.json', 'utf8')));
function memo(fn, deps) {
  const i = cursor++, old = slots[i];
  if (!old || deps.some((value, j) => !Object.is(value, old.deps[j]))) slots[i] = { deps, value: fn() };
  return slots[i].value;
}
const asset = { getFirstEntityByName: () => undefined };
const animator = { getAnimationCount: () => clips.length, getAnimationName: i => clips[i][0],
  getAnimationDuration: i => clips[i][1][0] / clips[i][1][1],
  applyAnimation(i, time) { animation = { name: clips[i][0], time }; }, applyCrossFade() {}, updateBoneMatrices() {} };
const context = { transformManager: { createIdentityMatrix() { return {
  scaling() { return this; }, rotate(angle) { heading = angle; return this; }, translate(point) { position = [...point]; return this; },
}; }, setTransform() {} } };
const mocks = {
  react: { useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps), useRef: current => memo(() => ({ current }), []),
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((value, j) => !Object.is(value, old.deps[j]))) { slots[i] = { deps }; effects.push(fn); } } },
  'react-native-worklets-core': { useSharedValue: value => memo(() => ({ value }), []), Worklets: { createRunOnJS: fn => fn } },
  'react-native-filament': { useModel: () => ({ state: 'loaded', asset, rootEntity: {} }), useAnimator: () => animator,
    useFilamentContext: () => context, RenderCallbackContext: { useRenderCallback: fn => { frame = fn; } } },
  './use-model-shadows': { useModelShadows() {} },
};
function load(id) {
  if (id in mocks) return mocks[id];
  if (/\.(png|webp|glb|mp4)$/.test(id)) return id;
  const base = path.resolve(id.startsWith('@/') ? id.slice(2) : id);
  const file = fs.existsSync(base) ? base : ['.ts', '.tsx', '.json'].map(ext => base + ext).find(fs.existsSync);
  assert.ok(file, id); if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  if (file.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(file, 'utf8'));
  else vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports, require: load, Math, Date, Map, Set });
  return module.exports;
}
const { NativeCatActor } = load('@/components/pet/native/NativeCatActor');
const { FLOOR_Y, pathLength } = load('@/utils/native-room-world');
const world = { width: 390, height: 420, catScale: .5, radius: .3, home: [0, FLOOR_Y, 0], objects: [] };
const playback = { kind: 'segment', segment: { assetKey: 'walk', loop: true } };
function render(props) { cursor = 0; effects = []; NativeCatActor(props); effects.forEach(fn => fn()); }
function tick(seconds, fps = currentFps) { for (let i = 0; i < Math.round(seconds * fps); i++) frame({ timeSinceLastFrame: 1 / fps }); }
const walk = (start, end, extra = {}) => ({ path: [start, end], distance: pathLength([start, end]), duration: 2, jump: false, ...extra });
const failures = [];
function check(name, fn) { try { fn(); console.log(`Verified ${name} at ${currentFps} FPS`); } catch (error) { failures.push(error); console.error(name + ': ' + error.message); } }

for (const fps of [30, 60, 120]) {
currentFps = fps;

check('identical playback snapshots preserve walking position and clock', () => {
  slots = [];
  const props = { active: true, world, playback, activityKey: 'walk-1', travel: walk(world.home, [1, FLOOR_Y, 0]) };
  render(props); tick(.75); const before = [...position];
  render({ ...props, playback: { ...playback, segment: { ...playback.segment } } }); tick(1 / 60);
  assert.ok(pathLength([before, position]) < .025, 'A new React object with the same animation must not restart the route');
});

check('new commands continue from the rendered position rather than a delayed JS report', () => {
  slots = [];
  const props = { active: true, world, playback, activityKey: 'first', travel: walk(world.home, [1, FLOOR_Y, 0]) };
  render(props); tick(.75); const before = [...position];
  const stale = [before[0] - .15, FLOOR_Y, before[2]];
  render({ ...props, activityKey: 'second', travel: walk(stale, [.8, FLOOR_Y, 1]) }); tick(1 / 60);
  assert.ok(pathLength([before, position]) < .025, 'Changing task cannot slide the root backwards to an older sample');
});

check('a new walk-and-hop itinerary also starts at the rendered pose', () => {
  slots = [];
  const props = { active: true, world, playback, activityKey: 'before-hop', travel: walk(world.home, [1, FLOOR_Y, 0]) };
  render(props); tick(.75); const before = [...position];
  const stale = [before[0] - .15, FLOOR_Y, before[2]], takeoff = [.65, FLOOR_Y, 0], landing = [1, FLOOR_Y, 0];
  render({ ...props, activityKey: 'walk-and-hop', travel: {
    path: [stale, takeoff, landing], distance: 1 - stale[0], duration: 1.6, jump: false,
    legs: [{ kind: 'walk', path: [stale, takeoff], duration: .7 }, { kind: 'hop', path: [takeoff, landing], duration: .9, arcHeight: .2 }],
  } }); tick(1 / fps);
  assert.ok(pathLength([before, position]) < .025, 'Starting an itinerary cannot slide back before its first walking leg');
  tick(2);
  assert.ok(pathLength([position, landing]) < .0001);
});

check('delayed RN resume snapshots cannot rewind a revised walking or jumping leg', () => {
  for (const pauseAt of [.2, .8]) {
    slots = [];
    const props = { active: true, world, playback, activityKey: 'before-resume', travel: walk(world.home, [1, FLOOR_Y, 0]) };
    render(props); tick(.75);
    const stale = [position[0] - .15, FLOOR_Y, position[2]], takeoff = [.65, FLOOR_Y, 0], landing = [1, FLOOR_Y, 0];
    let reportedElapsed = 0;
    const next = { ...props, activityKey: 'resumed-itinerary', onContactPosition: (_point, elapsed) => { reportedElapsed = elapsed; }, travel: {
      path: [stale, takeoff, landing], distance: 1 - stale[0], duration: 1.6, jump: false,
      legs: [{ kind: 'walk', path: [stale, takeoff], duration: .7 }, { kind: 'hop', path: [takeoff, landing], duration: .9, arcHeight: .2 }],
    } };
    render(next); tick(pauseAt);
    const before = [...position];
    render({ ...next, active: false }); tick(.3);
    assert.deepEqual(position, before);
    render({ ...next, travel: { ...next.travel, elapsed: Math.max(.01, reportedElapsed - .04) } }); tick(1 / fps);
    assert.ok(pathLength([before, position]) < .05, 'Resuming uses the exact native pose and phase, not an older RN report');
    tick(2); assert.ok(pathLength([position, landing]) < .0001);
  }
});

check('arrivals stop the walking gait while waiting for JS to start the next action', () => {
  slots = [];
  render({ active: true, world, playback, activityKey: 'arrival', travel: walk(world.home, [1, FLOOR_Y, 0], { awaitCompletion: true }) });
  tick(2.2);
  assert.equal(animation.name, 'idle', 'The paws cannot keep walking after the cat has stopped');
});

check('a large new heading is faced before floor translation begins', () => {
  slots = [];
  const idle = { kind: 'segment', segment: { assetKey: 'idle', loop: true } };
  render({ active: true, world, playback: idle }); tick(.1);
  render({ active: true, world, playback, activityKey: 'turn-around', travel: walk(world.home, [-1, FLOOR_Y, 0]) });
  for (let i = 0; i < 24; i++) {
    const previous = [...position]; tick(1 / 60);
    const error = Math.abs(Math.atan2(Math.sin(-Math.PI / 2 - heading), Math.cos(-Math.PI / 2 - heading)));
    if (error > .35) assert.ok(pathLength([previous, position]) < .001, 'The cat must not drift sideways while still facing away from its path');
  }
});

check('fresh React snapshots every frame preserve stride phase and one arrival', () => {
  slots = [];
  const arrivals = [], props = { active: true, world, playback, activityKey: 'stable-walk',
    travel: walk(world.home, [1, FLOOR_Y, 0], { awaitCompletion: true }), onRoomStepComplete: key => arrivals.push(key) };
  for (let i = 0; i < fps * 3; i++) {
    render({ ...props, playback: { ...playback, segment: { ...playback.segment } } }); tick(1 / fps);
    if (animation.name === 'walk') {
      const clipDuration = clips.find(([name]) => name === 'walk')[1];
      const expected = (position[0] / (.8 * world.catScale) % 1) * clipDuration[0] / clipDuration[1];
      assert.ok(Math.abs(animation.time - expected) < .0001, 'The paw cycle stays locked to the distance actually travelled');
    }
  }
  assert.deepEqual(arrivals, ['stable-walk']);
  assert.ok(pathLength([position, [1, FLOOR_Y, 0]]) < .0001);
});

check('pausing during the turn preserves the pose and resumes the requested journey', () => {
  slots = [];
  const idle = { kind: 'segment', segment: { assetKey: 'idle', loop: true } }, arrivals = [];
  render({ active: true, world, playback: idle }); tick(.1);
  const props = { active: true, world, playback, activityKey: 'paused-turn',
    travel: walk(world.home, [-1, FLOOR_Y, 0], { awaitCompletion: true }), onRoomStepComplete: key => arrivals.push(key) };
  render(props); tick(.1);
  const before = [...position], facing = heading;
  render({ ...props, active: false }); tick(10);
  assert.deepEqual(position, before); assert.equal(heading, facing); assert.equal(arrivals.length, 0);
  render(props); tick(2 + load('@/utils/native-cat-turn').catTurnDuration(Math.PI) + .1);
  assert.deepEqual(arrivals, ['paused-turn']);
  assert.ok(pathLength([position, [-1, FLOOR_Y, 0]]) < .0001);
});

check('finishing a bed crawl holds the low pose instead of standing through the covers', () => {
  slots = [];
  render({ active: true, world, playback, activityKey: 'bed-crawl', travel: walk([0, .5, 0], [.3, .5, 0], {
    bed: { instanceId: 'bed', phase: 'crawl' },
  }) });
  tick(2.2);
  assert.equal(animation.name, 'crawl');
  const phase = animation.time;
  tick(.2);
  assert.equal(animation.time, phase, 'Arriving under the blanket stops the paws in the existing crouch');
});
}

check('a delayed curved route drops passed waypoints rather than reversing over them', () => {
  const { catPathFromPosition } = load('@/utils/native-cat-locomotion');
  const points = [[0, FLOOR_Y, 0], [.1, FLOOR_Y, 0], [.2, FLOOR_Y, .05], [.3, FLOOR_Y, .15], [.3, FLOOR_Y, 1]];
  const path = new Proxy(points, { get: (target, key, receiver) => key === 'slice' ? undefined : Reflect.get(target, key, receiver) });
  const actual = [.25, FLOOR_Y, .1], resumed = catPathFromPosition(path, actual, [1, 1, 1.1, 1.4, 1]);
  assert.deepEqual(Array.from(resumed.path[0]), actual);
  assert.deepEqual(Array.from(resumed.path[1]), points[3], 'The next point is ahead of the cat on the curve');
  assert.equal(resumed.paces[1], 1.4, 'The remaining curve retains its speed weights');
  assert.ok(resumed.fraction < 1, 'Only the remaining distance contributes to the revised duration');
});

if (failures.length) process.exitCode = 1;
