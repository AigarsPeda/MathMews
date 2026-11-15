/* eslint-disable react-hooks/rules-of-hooks -- Deterministic hook dispatcher with mocked native handles. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { transformSync } from '@babel/core';

function mealHarness({ fullness = 36, fps = 60, reduced = false, compiled = false, refreshOptions = false } = {}) {
  let now = 1000, timerId = 0, dirty = true, owner, effects = [], draw, api, options;
  const timers = new Map(), cache = new Map(), callbacks = [], bites = [], failures = [];
  const scheduler = { slots: [], cursor: 0 }, actor = { slots: [], cursor: 0 };
  const same = (before, after) => before?.length === after.length && after.every((value, index) => Object.is(value, before[index]));
  function slot(initial) {
    const index = owner.cursor++;
    if (!(index in owner.slots)) owner.slots[index] = initial();
    return [owner, index, owner.slots[index]];
  }
  const react = {
    useRef: value => slot(() => ({ current: value }))[2],
    useState(initial) {
      const [host, index, value] = slot(() => typeof initial === 'function' ? initial() : initial);
      return [value, update => {
        const next = typeof update === 'function' ? update(host.slots[index]) : update;
        if (!Object.is(next, host.slots[index])) { host.slots[index] = next; dirty = true; }
      }];
    },
    useMemo(fn, deps) {
      const [host, index, previous] = slot(() => null);
      if (!previous || !same(previous.deps, deps)) host.slots[index] = { deps, value: fn() };
      return host.slots[index].value;
    },
    useCallback: (fn, deps) => react.useMemo(() => fn, deps),
    useEffect(fn, deps) {
      const [host, index, previous] = slot(() => null);
      if (!previous || !same(previous.deps, deps)) effects.push(() => {
        previous?.cleanup?.(); host.slots[index] = { deps, cleanup: fn() };
      });
    },
  };
  const shared = initial => ({ value: initial, get() { return this.value; }, set(value) { this.value = value; } });
  const clips = Object.entries(JSON.parse(fs.readFileSync('scripts/3d/clips.json', 'utf8')));
  const asset = { getFirstEntityByName: () => undefined };
  const animator = { getAnimationCount: () => clips.length, getAnimationName: index => clips[index][0],
    getAnimationDuration: index => clips[index][1][0] / clips[index][1][1],
    applyAnimation() {}, applyCrossFade() {}, updateBoneMatrices() {} };
  const transformManager = { createIdentityMatrix: () => ({ scaling() { return this; }, rotate() { return this; }, translate() { return this; } }), setTransform() {} };
  const mocks = {
    react,
    'react/compiler-runtime': { c: size => react.useMemo(() => Array(size).fill(Symbol.for('react.memo_cache_sentinel')), []) },
    '@/hooks/use-animation-activity': { useAnimationActivity: () => ({ active: true, reduceMotion: reduced }) },
    'react-native-reanimated': { useSharedValue: value => react.useRef(shared(value)).current,
      cancelAnimation() {}, withTiming: value => value, withDelay: (_, value) => value, withSequence: (...values) => values.at(-1),
      Easing: { linear: value => value, quad: value => value * value, inOut: fn => fn, in: fn => fn, out: fn => fn } },
    'react-native-worklets-core': { useSharedValue: value => react.useRef(shared(value)).current,
      Worklets: { createRunOnJS: fn => (...args) => callbacks.push(() => fn(...args)) } },
    'react-native-filament': { useModel: () => ({ state: 'loaded', asset, rootEntity: {} }), useAnimator: () => animator,
      useFilamentContext: () => ({ transformManager }), RenderCallbackContext: { useRenderCallback: fn => { draw = fn; } } },
    './use-model-shadows': { useModelShadows() {} },
    'react/jsx-runtime': {},
  };
  class Clock extends Date { static now() { return now; } }
  function load(id) {
    if (id in mocks) return mocks[id];
    if (/\.(png|webp|glb|mp4)$/.test(id)) return id;
    const base = path.resolve(id.startsWith('@/') ? id.slice(2) : id);
    const file = fs.existsSync(base) ? base : ['.ts', '.tsx', '.json'].map(extension => base + extension).find(candidate => fs.existsSync(candidate));
    assert.ok(file, id);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    if (file.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(file, 'utf8'));
    else {
      let source = fs.readFileSync(file, 'utf8');
      if (compiled && /\/(hooks|components)\//.test(file)) source = transformSync(source, { filename: file, configFile: false, babelrc: false,
        parserOpts: { plugins: ['typescript', 'jsx'] }, plugins: [['babel-plugin-react-compiler', { target: '19' }]] }).code;
      vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, { module, exports: module.exports, require: load, Math, Date: Clock, Map, Set,
      setTimeout: (fn, delay = 0) => { const id = ++timerId; timers.set(id, { at: now + delay, fn }); return id; }, clearTimeout: id => timers.delete(id) });
    }
    return module.exports;
  }
  const { useRoomActivity } = load('@/hooks/use-room-activity');
  const { NativeCatActor, useCatModel } = load('@/components/pet/native/NativeCatActor');
  const { buildNativeRoomWorld, catScreenPoint } = load('@/utils/native-room-world');
  const { roomActivityStepKey } = load('@/utils/room-activities');
  const { createRoomActivitySegment, catModelRegistry } = load('@/pet-display/registry/cat-model-registry');
  const { applyFeedBite } = load('@/utils/game-operations');
  let save = { pet: { type: 'cat', isAsleep: false, lastCareAt: now, lastInteractionAt: now,
    stats: { hunger: fullness, happiness: 50, level: 1 } } };
  const base = { width: 390, height: 420, petSize: 80, sizeScale: 1.15, homeRoomId: 'kitchen',
    homeOffset: { x: .5, y: .6 }, decorations: [{ decorationId: 'bowlBlue', instanceId: 'bowl', offset: { x: 0, y: -.25 } }],
    toys: [], ownedToyIds: [], hungry: fullness < 30, asleep: false, period: 'morning', nativeStepCompletion: true };
  base.nativeWorld = buildNativeRoomWorld(base); options = base;
  let optionsFullness = fullness;
  const home = catScreenPoint(base.nativeWorld.home, base.nativeWorld), petX = shared(home.x), petY = shared(home.y);
  function feed(finished, amount) {
    save = applyFeedBite(save, finished, now, amount);
    assert.ok(save, 'Each scheduled bite applies to the latest save');
    bites.push({ finished, amount, fullness: save.pet.stats.hunger, at: now }); dirty = true;
  }
  function render() {
    const hungry = save.pet.stats.hunger < 30;
    if (refreshOptions && optionsFullness !== save.pet.stats.hunger || options.hungry !== hungry) options = { ...options, hungry };
    optionsFullness = save.pet.stats.hunger;
    owner = scheduler; owner.cursor = 0; effects = [];
    api = useRoomActivity(options, save.pet.stats.hunger, true, save.pet.lastInteractionAt, petX, petY,
      undefined, feed, undefined, true, false, undefined, undefined, failure => failures.push(failure));
    effects.splice(0).forEach(fn => fn());
    const state = api.activity, step = state?.plan.steps[state.stepIndex];
    owner = actor; owner.cursor = 0; effects = [];
    NativeCatActor({ model: useCatModel(), active: true, world: base.nativeWorld, reduceMotion: reduced,
      playback: { kind: 'segment', mood: step?.mood ?? 'idle', segment: step?.animation
        ? createRoomActivitySegment(step.animation, step.reverse, step.animationFps) : catModelRegistry.getSegment(step?.mood ?? 'idle') },
      activityKey: state ? roomActivityStepKey(state) : undefined, travel: step?.native,
      onContactPosition: api.updateNativeHeight, onRoomStepComplete: api.completeNativeStep });
    effects.splice(0).forEach(fn => fn());
  }
  function flush() {
    for (let iteration = 0; ; iteration++) {
      assert.ok(iteration < 100, 'Bite updates and renderer reports settle');
      if (dirty) { dirty = false; render(); }
      callbacks.splice(0).forEach(fn => fn());
      const due = [...timers].filter(([, timer]) => timer.at <= now);
      due.forEach(([id, timer]) => { timers.delete(id); timer.fn(); });
      if (!dirty && !callbacks.length && !due.length) return;
    }
  }
  function advance(seconds) {
    for (let frame = 0; frame < Math.ceil(seconds * fps); frame++) {
      now += 1000 / fps; draw({ timeSinceLastFrame: 1 / fps }); flush();
    }
  }
  function until(predicate, seconds = 60) {
    for (let frame = 0; frame < seconds * fps; frame++) {
      if (predicate()) return;
      advance(1 / fps);
    }
    assert.fail(`Meal did not reach the expected state: ${JSON.stringify({ bites, activity: api.activity, failures })}`);
  }
  flush(); advance(.1); api.startActivity('bowlEat', 'bowl'); flush();
  return { bites, failures, advance, until, get api() { return api; }, get fullness() { return save.pet.stats.hunger; },
    stop() { api.returnHome(); flush(); }, start() { api.startActivity('bowlEat', 'bowl'); flush(); } };
}

for (const compiled of [false, true]) for (const fps of [30, 60, 120]) {
  const meal = mealHarness({ fps, compiled });
  meal.until(() => meal.bites.length === 1);
  assert.equal(Math.round(meal.fullness), 41);
  meal.advance(.5);
  assert.equal(meal.api.activity?.plan.steps[meal.api.activity.stepIndex].mood, 'eating', 'The real renderer must keep eating after the first bite');
  meal.until(() => meal.api.activity?.plan.steps[meal.api.activity.stepIndex].returnHome);
  assert.equal(meal.bites.length, 13, 'A 36-percent-full cat needs thirteen actual bites');
  assert.equal(meal.fullness, 100, 'The cat can leave the bowl only when full');
  assert.equal(meal.bites.filter(bite => bite.finished).length, 1);
  assert.deepEqual(meal.failures, []);
}
for (const fullness of [0, 26, 30, 74.8, 95, 96, 99.75]) {
  const meal = mealHarness({ fullness });
  meal.until(() => meal.api.activity?.plan.steps[meal.api.activity.stepIndex].returnHome);
  assert.equal(meal.fullness, 100);
  assert.equal(meal.bites.length, Math.max(1, Math.ceil((100 - Math.round(fullness)) / 5)));
  assert.deepEqual(meal.failures, []);
}
for (const compiled of [false, true]) {
  const meal = mealHarness({ fullness: 26, compiled, refreshOptions: true });
  meal.until(() => meal.fullness === 100);
  assert.equal(meal.bites.length, 15, 'Parent option refreshes and the hungry threshold cannot stop a meal');
  assert.deepEqual(meal.failures, []);
}
for (const compiled of [false, true]) {
  const meal = mealHarness({ fullness: 20, compiled });
  meal.until(() => meal.bites.length === 4);
  assert.equal(Math.round(meal.fullness), 40);
  meal.stop(); meal.advance(5);
  assert.equal(meal.bites.length, 4);
  meal.start(); meal.until(() => meal.api.mealProgress !== null);
  assert.equal(meal.api.mealProgress.total, 12, 'Fractional care decay cannot add a thirteenth restart segment at displayed 40%');
  meal.until(() => meal.fullness === 100);
  meal.advance(3);
  assert.equal(meal.bites.length, 16, 'Restart reaches 100% on the twelfth remaining bite without a duplicate 100% bite');
}
for (const compiled of [false, true]) for (const reduced of [false, true]) for (const stoppedAfter of [1, 7]) {
  const meal = mealHarness({ compiled, reduced });
  meal.until(() => meal.bites.length === stoppedAfter);
  const retained = meal.fullness;
  meal.stop(); meal.advance(15);
  assert.equal(meal.bites.length, stoppedAfter, 'Stopping cancels all remaining meal bites');
  assert.equal(meal.fullness, retained, 'Stopping preserves the food already eaten');
  meal.start(); meal.until(() => meal.fullness === 100);
  assert.equal(meal.bites.length, 13, 'A later Eat finishes from the saved fullness');
  assert.deepEqual(meal.failures, []);
}
console.log('Verified full meals through the real scheduler, native render worklet, and saved stat updates at 30/60/120 FPS.');
console.log('Verified user interruption after the first bite and in a later helping, retained stats, restart, Reduce Motion, and React Compiler.');
