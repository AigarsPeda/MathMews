/** Exercise the production route gate and answer/save logic with React; native views are boundaries. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React, { act } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import Reconciler from 'react-reconciler';
import { DefaultEventPriority } from 'react-reconciler/constants.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const hostContext = {};
const renderer = Reconciler({
  isPrimaryRenderer: true, supportsMutation: true,
  getRootHostContext: () => hostContext, getChildHostContext: () => hostContext,
  prepareForCommit: () => null, resetAfterCommit() {}, clearContainer() {},
  getCurrentUpdatePriority: () => DefaultEventPriority, setCurrentUpdatePriority() {},
  resolveUpdatePriority: () => DefaultEventPriority, maySuspendCommit: () => false,
  scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
  supportsMicrotasks: true, scheduleMicrotask: queueMicrotask,
});

function harness() {
  const cache = new Map(), probes = new Map(), components = new Map(), routes = [];
  const gameContext = React.createContext(null);
  let now = Date.now(), params = {}, save, mounted = false, revision = 0;
  class ClockDate extends Date { static now() { return now; } }
  function view(name) {
    if (!components.has(name)) components.set(name, props => {
      probes.set(name, props);
      return React.createElement(React.Fragment, null, ...React.Children.toArray(props.children).filter(React.isValidElement));
    });
    return components.get(name);
  }
  const router = {
    setParams(next) { routes.push(['params', next]); params = { ...params, ...next }; render(); },
    replace(route) { routes.push(['replace', route]); params = route.params; revision++; render(); },
    dismissTo(route) { routes.push(['path', route]); },
  };
  const mocks = {
    react: React, 'react/jsx-runtime': jsxRuntime,
    '@/contexts/GameProvider': { useGame: () => React.useContext(gameContext) },
    '@/contexts/LocaleProvider': { useLocale: () => ({ locale: 'en' }) },
    '@/hooks/use-world-clock-now': { useWorldClockNow: () => now },
    '@/utils/scale': { moderateScale: n => n },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    'expo-font': { useFonts: () => [true, null] },
    'expo-haptics': { ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' }, impactAsync() {} },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => params, Redirect: view('Redirect') },
    'react-native': { View: view('View'), Pressable: view('Pressable'), ActivityIndicator: view('ActivityIndicator'),
      StyleSheet: { create: x => x }, Platform: { OS: 'ios' } },
    'react-native-safe-area-context': { SafeAreaView: view('SafeAreaView') },
    'react-native-reanimated': { __esModule: true, default: { ScrollView: view('ScrollView') },
      FadeIn: { duration: () => ({ reduceMotion: () => ({}) }) }, ReduceMotion: { System: 'system' } },
    '@react-native-async-storage/async-storage': {},
  };
  function load(id) {
    if (id in mocks) return mocks[id];
    if (id.startsWith('@/components/')) return new Proxy({}, { get: (_, name) => view(name) });
    if (/\.(png|webp|mp4|ttf)$/.test(id)) return id;
    const base = path.resolve(id.replace('@/', ''));
    const file = fs.existsSync(base) ? base : ['.ts', '.tsx', '.json'].map(ext => base + ext).find(fs.existsSync);
    assert.ok(file, id);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    if (file.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(file, 'utf8'));
    else vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, { module, exports: module.exports, require: load, Date: ClockDate, Math, Set, Map });
    return module.exports;
  }
  const paths = load('@/constants/puzzle-path'), timer = load('@/utils/timed-challenge');
  const storage = load('@/utils/game-storage'), operations = load('@/utils/game-operations');
  const puzzles = load('@/constants/puzzles');
  const PlayScreen = load('@/app/play').default;
  const root = renderer.createContainer({}, 0, null, false, null, '', error => { throw error; }, error => { throw error; }, () => {});
  save = storage.createDefaultGameSave();
  const game = {
    isReady: true, hasCompletedOnboarding: true, recordInteraction() {}, recordLearningHelp() {},
    purchaseVisualHelp() {}, requestRoomDecoration() {}, buyLife() {},
    answerPuzzle(puzzle, correct, id) {
      const result = operations.applyPuzzleAnswer(save, puzzle, correct, id, now);
      save = result.save; render(); return result.accepted ? result.coins : null;
    },
    beginChallenge(levelId, mode) {
      const progress = timer.beginTimedChallenge(save.progress, paths.getPathLocation(levelId).level, `run-${now}`, now, mode);
      if (!progress) return false;
      save = { ...save, progress }; render(); return true;
    },
    expireChallenge(id) { save = { ...save, progress: timer.settleChallengeTimeout(save.progress, now, id) }; render(); },
  };
  function render() {
    if (!mounted) return;
    probes.clear();
    renderer.updateContainer(React.createElement(gameContext.Provider, { value: { ...game, ...save, isReady: true, hasCompletedOnboarding: true } },
      React.createElement(PlayScreen, { key: revision })), root, null, null);
  }
  const api = {
    load, paths, timer, storage, operations, puzzles, routes,
    get save() { return save; }, set save(next) { save = next; }, get now() { return now; },
    async enter(lesson, level, replay) {
      params = { difficulty: lesson.difficulty, lesson: lesson.id, level: level.id, replay: replay ? '1' : undefined };
      revision++; mounted = true; await act(render);
      assert.equal(probes.has('Redirect'), false, 'Valid replay entry never redirects to the map');
    },
    props(name) { return probes.get(name); },
    async start(mode = 'timed') {
      await act(() => probes.get('TimedChallengeActions').onModeChange(mode));
      await act(() => probes.get('TimedChallengeActions').onStart());
    },
    async answer(correct = true) {
      const task = probes.get('PuzzleTaskView');
      assert.ok(task, 'The next task stays playable');
      await act(() => task.onSelectChoice(correct ? task.puzzle.correctIndex : (task.puzzle.correctIndex + 1) % task.puzzle.choices.length));
      const press = probes.get('PuzzleButton').onPress;
      await act(() => { press(); press(); });
    },
    async next() { assert.ok(probes.get('ResultOverlay'), 'A completed task holds its result'); await act(() => probes.get('ResultOverlay').onContinue()); },
    async advance(ms) { now += ms; await act(render); },
    async dispose() { await act(() => renderer.updateContainer(null, root, null, null)); },
  };
  return api;
}

const clone = value => JSON.parse(JSON.stringify(value));
function complete(h, lesson) {
  const track = h.paths.getTopicPaths(lesson.difficulty, lesson.topicId);
  h.save = { ...h.save, progress: { ...h.save.progress,
    completedPuzzleIds: track.slice(0, track.indexOf(lesson) + 1).flatMap(l => l.levels.flatMap(v => v.puzzleIds)) } };
  h.save = h.load('@/utils/cat-plan-rewards').grantCatPlanRewards(h.save);
}

for (const explicitReplay of [false, true]) test(`timed replay survives re-entry and reaches level 2, replay flag ${explicitReplay}`, async () => {
  const h = harness(), [lesson, second] = h.paths.getTopicPaths('easy', 'cat-plans');
  complete(h, lesson);
  const completed = clone(h.save.progress.completedPuzzleIds);
  await h.enter(lesson, lesson.levels[7], explicitReplay);
  await h.start();
  const deadline = h.save.progress.challengeAttempt.deadlineAt;
  for (let index = 7; index < 10; index++) {
    assert.equal(h.props('PuzzleTaskView').puzzle.id, lesson.levels[index].puzzleIds[0]);
    await h.answer();
    assert.equal(h.props('ResultOverlay').correct, true);
    assert.equal(h.props('ResultOverlay').decorationLessonId, undefined);
    assert.equal(h.props('ResultOverlay').continueLabel, index < 9 ? 'play.nextPuzzle' : 'puzzlePathDesign.nextLevel');
    assert.equal(h.paths.isPathAvailable(second, h.save.progress), true, 'Replay cannot revoke the next level');
    assert.deepEqual(clone(h.save.progress.completedPuzzleIds), completed);
    if (index < 9) {
      // The result can remain open, and reopening must resume the run cursor.
      await h.advance(1000);
      const entry = h.paths.getPathEntry(lesson, h.save.progress);
      assert.equal(entry.replay, true, 'A saved timed replay retains replay semantics');
      await h.enter(lesson, entry.level, false);
      assert.equal(h.props('PuzzleTaskView').puzzle.id, lesson.levels[index + 1].puzzleIds[0]);
      assert.equal(h.save.progress.challengeAttempt.deadlineAt, deadline);
    } else await h.next();
  }
  assert.equal(h.save.progress.challengeAttempt.status, 'completed');
  assert.equal(h.routes.filter(([kind]) => kind === 'path').length, 0);
  assert.equal(h.props('PuzzleTaskView').puzzle.id, second.levels[0].puzzleIds[0]);
  await h.dispose();
});

test('every path preserves replay progress, unlocks, timeout checkpoints and reward amounts', () => {
  const h = harness();
  const { getPuzzleCoinReward } = h.load('@/constants/game');
  const { getPuzzleLevelKind } = h.load('@/constants/curriculum');
  let cases = 0;
  for (const lesson of h.paths.PUZZLE_PATHS) {
    h.save = h.storage.createDefaultGameSave(); complete(h, lesson);
    const baseline = h.save, challenge = lesson.levels[7];
    const second = h.paths.getNextPathLevel(lesson, baseline.progress)?.lesson;
    const byId = new Map(h.puzzles.getPuzzlesByDifficulty('en', lesson.difficulty).map(p => [p.id, p]));
    for (const mode of ['timed', 'untimed']) {
      let save = { ...baseline, progress: h.timer.beginTimedChallenge(baseline.progress, challenge, 'replay', h.now, mode) };
      for (let index = 7; index < 10; index++) {
        const puzzle = byId.get(lesson.levels[index].puzzleIds[0]), id = `${lesson.id}-${mode}-${index}`;
        const result = h.operations.applyPuzzleAnswer(save, puzzle, true, id, h.now + index);
        assert.equal(result.accepted, true); save = result.save;
        const expectedCoins = mode === 'timed' ? index < 9 ? 0 : 2 * lesson.levels.slice(7).reduce((sum, step) =>
          sum + getPuzzleCoinReward(lesson.difficulty, true, getPuzzleLevelKind(step.puzzleIds[0])), 0)
          : getPuzzleCoinReward(lesson.difficulty, true, getPuzzleLevelKind(puzzle.id));
        assert.equal(result.coins, expectedCoins, 'Replay rewards settle once at the replay rate');
        assert.equal(h.operations.applyPuzzleAnswer(save, puzzle, true, id, h.now + index).accepted, false);
        assert.deepEqual(clone(save.progress.completedPuzzleIds), clone(baseline.progress.completedPuzzleIds));
        if (second) assert.equal(h.paths.isPathAvailable(second, save.progress), true);
        if (index < 9) {
          assert.equal(h.paths.getNextPathStep(lesson, lesson.levels[index], save.progress, true)?.level.id, lesson.levels[index + 1].id);
          if (mode === 'timed') {
            assert.equal(h.paths.getNextPathStep(lesson, lesson.levels[index], save.progress)?.level.id, lesson.levels[index + 1].id,
              'An active timed cursor takes priority over permanent completion');
            const restored = h.storage.parseGameSaveFromValue(save).save;
            assert.equal(h.paths.getPathEntry(lesson, restored.progress).replay, true);
            const expired = h.timer.settleChallengeTimeout(save.progress, save.progress.challengeAttempt.deadlineAt);
            assert.deepEqual(clone(expired.completedPuzzleIds), clone(baseline.progress.completedPuzzleIds));
            assert.equal(h.paths.getPathEntry(lesson, expired).level.id, challenge.id, 'An expired replay reopens at its timer checkpoint');
            if (second) assert.equal(h.paths.isPathAvailable(second, expired), true);
          }
        }
        cases++;
      }
    }
    // Provisional answers cannot grant a new unlock when later tasks were solved before this run.
    const missingChallenge = { ...baseline.progress, completedPuzzleIds: baseline.progress.completedPuzzleIds.filter(id => id !== challenge.puzzleIds[0]) };
    const active = h.timer.beginTimedChallenge(missingChallenge, challenge, 'partial', h.now);
    const pending = h.operations.applyPuzzleAnswer({ ...baseline, progress: active }, byId.get(challenge.puzzleIds[0]), true, 'pending', h.now + 1).save.progress;
    assert.equal(h.paths.getPathProgress(lesson, pending).complete, false, 'Pending timed answers do not permanently finish a level');
    if (second) assert.equal(h.paths.isPathAvailable(second, pending), false);
  }
  console.log(`Exercised ${cases} replay answers across ${h.paths.PUZZLE_PATHS.length} paths and both pace modes.`);
});

for (const replay of [false, true]) for (const mode of ['timed', 'untimed']) test(`all ten tasks continue in place, ${mode}, replay ${replay}`, async () => {
  const h = harness(), [lesson, second] = h.paths.getTopicPaths('easy', 'cat-plans');
  if (replay) complete(h, lesson);
  const rewardIds = clone(h.save.progress.catPlanRewardsClaimed ?? []);
  await h.enter(lesson, lesson.levels[0], replay);
  for (let index = 0; index < 10; index++) {
    if (index === 7) await h.start(mode);
    assert.equal(h.props('PuzzleTaskView').puzzle.id, lesson.levels[index].puzzleIds[0]);
    await h.answer();
    assert.equal(h.props('ResultOverlay').continueLabel, index < 9 ? 'play.nextPuzzle' : 'puzzlePathDesign.nextLevel');
    assert.equal(h.props('PuzzleTaskView').answered, true, 'Saving an answer never replaces the task beneath its sheet');
    if (replay) assert.deepEqual(clone(h.save.progress.catPlanRewardsClaimed), rewardIds, 'Replay never duplicates a furnishing');
    await h.next();
    assert.equal(h.props('Redirect'), undefined);
    if (index === 6) assert.ok(h.props('TimedChallengeActions'), 'Task eight offers a pace choice');
    else {
      assert.equal(h.props('PuzzleTaskView').answered, false, 'Every next task starts with empty answer state');
      assert.equal(h.props('PuzzleTaskView').selectedIndex, null);
    }
  }
  assert.equal(h.props('PuzzleTaskView').puzzle.id, second.levels[0].puzzleIds[0]);
  assert.equal(h.props('ResultOverlay'), undefined);
  assert.ok(h.routes.every(([kind]) => kind === 'params'), 'Next stays on the same screen throughout');
  await h.dispose();
});

test('expiry beneath an open replay result retries the checkpoint and retains level 2', async () => {
  const h = harness(), [lesson, second] = h.paths.getTopicPaths('easy', 'cat-plans');
  complete(h, lesson);
  const baseline = clone(h.save.progress.completedPuzzleIds), coins = h.save.wallet.coins;
  await h.enter(lesson, lesson.levels[7], true); await h.start(); await h.answer();
  await h.advance(180000);
  assert.equal(h.props('ResultOverlay').continueLabel, 'timedChallenge.retry');
  assert.equal(h.save.progress.lives.current, 2);
  assert.equal(h.save.wallet.coins, coins);
  assert.deepEqual(clone(h.save.progress.completedPuzzleIds), baseline);
  assert.equal(h.paths.isPathAvailable(second, h.save.progress), true);
  await h.next();
  assert.ok(h.props('TimedChallengeActions'), 'The checkpoint offers a new run');
  await h.start('untimed');
  await h.answer(); await h.next();
  assert.equal(h.props('PuzzleTaskView').puzzle.id, lesson.levels[8].puzzleIds[0]);
  await h.dispose();
});

test('wrong answers in a timed replay retain the task and clock', async () => {
  const h = harness(), [lesson] = h.paths.getTopicPaths('easy', 'cat-plans');
  complete(h, lesson); await h.enter(lesson, lesson.levels[7], true); await h.start();
  const deadline = h.save.progress.challengeAttempt.deadlineAt;
  await h.answer(false);
  assert.equal(h.props('ResultOverlay'), undefined);
  assert.equal(h.save.progress.lives.current, 2, 'A duplicate wrong tap costs only one life');
  assert.equal(h.save.progress.challengeAttempt.deadlineAt, deadline);
  await h.answer(); await h.next();
  assert.equal(h.props('PuzzleTaskView').puzzle.id, lesson.levels[8].puzzleIds[0]);
  await h.dispose();
});

test('replay resumes another active run without losing its cursor', async () => {
  const h = harness(), [lesson, second] = h.paths.getTopicPaths('easy', 'cat-plans');
  complete(h, lesson);
  h.save = { ...h.save, progress: h.timer.beginTimedChallenge(h.save.progress, lesson.levels[7], 'existing', h.now) };
  const puzzle = h.puzzles.getPuzzlesByDifficulty('en', 'easy').find(p => p.id === lesson.levels[7].puzzleIds[0]);
  h.save = h.operations.applyPuzzleAnswer(h.save, puzzle, true, 'first', h.now).save;
  await h.enter(second, second.levels[0], false);
  // Reach the other level's challenge through valid saved work.
  h.save = { ...h.save, progress: { ...h.save.progress,
    completedPuzzleIds: [...h.save.progress.completedPuzzleIds, ...second.levels.slice(0, 7).flatMap(level => level.puzzleIds)] } };
  await h.enter(second, second.levels[7], false);
  assert.equal(h.props('TimedChallengeActions').otherActive, true);
  await act(() => h.props('TimedChallengeActions').onResume());
  assert.equal(h.props('PuzzleTaskView').puzzle.id, lesson.levels[8].puzzleIds[0]);
  await h.answer(); await h.next();
  assert.equal(h.props('PuzzleTaskView').puzzle.id, lesson.levels[9].puzzleIds[0]);
  await h.dispose();
});
