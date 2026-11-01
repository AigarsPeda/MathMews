import assert from 'node:assert/strict';

export function checkPaths({ load }) {
  const path = load('@/constants/puzzle-path');
  const legacy = load('@/constants/curriculum');
  const { createDefaultGameSave, parseGameSaveFromValue } = load('@/utils/game-storage');
  const { applyPuzzleAnswer } = load('@/utils/game-operations');
  const { getPuzzlesByDifficulty } = load('@/constants/puzzles');
  const timer = load('@/utils/timed-challenge');
  const clone = value => JSON.parse(JSON.stringify(value));
  const now = Date.now();
  const allIds = [];
  const nextLessonLocked = (track, lesson) => track[track.indexOf(lesson) + 1];
  for (const lesson of path.PUZZLE_PATHS) {
    assert.equal(lesson.levels.length, 10);
    assert.equal(lesson.levels[7].kind, 'challenge');
    assert.equal(lesson.levels.filter(l => l.kind === 'challenge').length, 1);
    assert.ok(lesson.levels.every(l => l.kind !== 'boss' && !l.story && l.puzzleIds.length === 1));
    const track = path.getTopicPaths(lesson.difficulty, lesson.topicId);
    const previous = track.slice(0, track.findIndex(l => l.id === lesson.id)).flatMap(l => l.levels.flatMap(v => v.puzzleIds));
    let progress = { ...createDefaultGameSave().progress, completedPuzzleIds: previous };
    assert.ok(path.isPathAvailable(lesson, progress));
    assert.equal(path.getPathEntry(lesson, progress).level.id, lesson.levels[0].id);
    if (nextLessonLocked(track, lesson)) assert.equal(path.getPathEntry(nextLessonLocked(track, lesson), progress), undefined);
    for (const [index, level] of lesson.levels.entries()) {
      const puzzleId = level.puzzleIds[0]; allIds.push(puzzleId);
      assert.equal(path.getPathStepState(lesson, level, progress), 'current');
      assert.equal(path.resolvePathSession(lesson.difficulty, lesson.id, level.id, undefined, progress)?.level.id, level.id);
      for (const invalid of ['-1', '1', '1.1', 'NaN', 'Infinity', '99999999999999999999999']) {
        assert.equal(path.resolvePathSession(lesson.difficulty, lesson.id, level.id, invalid, progress), null);
      }
      const next = lesson.levels[index + 1];
      if (next) assert.equal(path.resolvePathSession(lesson.difficulty, lesson.id, next.id, undefined, progress), null);
      progress = { ...progress, completedPuzzleIds: [...progress.completedPuzzleIds, puzzleId] };
      assert.equal(path.getPathProgress(lesson, progress).solved, index + 1);
      if (next) assert.equal(path.getPathEntry(lesson, progress).level.id, next.id, 'Tapping a started level resumes the next puzzle directly');
      assert.equal(path.getPathProgress(lesson, progress).complete, index === 9);
      assert.equal(path.getPathStepState(lesson, level, progress), 'completed');
      if (next) assert.equal(path.getNextPathStep(lesson, level, progress)?.level.id, next.id);
    }
    const nextLesson = track[track.indexOf(lesson) + 1];
    assert.equal(path.getNextPathStep(lesson, lesson.levels[9], progress), undefined, 'The tenth puzzle ends the level at its topic path');
    if (nextLesson) assert.ok(path.isPathAvailable(nextLesson, progress));
    const replay = path.getPathEntry(lesson, progress);
    assert.equal(replay.level.id, lesson.levels[0].id);
    assert.equal(replay.replay, true);
    for (let index = 0; index < 9; index++) assert.equal(path.getNextPathStep(lesson, lesson.levels[index], progress, true)?.level.id, lesson.levels[index+1].id, 'Replay keeps all ten puzzles in sequence');
    const original = legacy.LEARNING_CATALOG.lessons.find(l => l.id === lesson.id);
    const saved = createDefaultGameSave();
    delete saved.progress.pathVersion;
    saved.progress.completedPuzzleIds = legacy.getRequiredIds(original);
    saved.wallet.coins = 137;
    const restored = parseGameSaveFromValue(saved).save;
    assert.ok(path.getPathProgress(lesson, restored.progress).complete, 'Legacy completion is retained');
    assert.ok(restored.progress.completedPathLessonIds.includes(lesson.id));
    assert.deepEqual(clone(restored.progress.completedPuzzleIds), saved.progress.completedPuzzleIds, 'Migration creates no solved answers');
    assert.equal(restored.wallet.coins, 137, 'Migration creates no rewards');
    const before = path.PUZZLE_PATHS.filter(l => legacy.isLessonAvailable(legacy.LEARNING_CATALOG.lessons.find(v => v.id === l.id), saved.progress.completedPuzzleIds)).map(l => l.id);
    assert.ok(before.every(id => path.isPathAvailable(path.PUZZLE_PATHS.find(l => l.id === id), restored.progress)), 'Every previously unlocked level remains open');
    assert.deepEqual(clone(parseGameSaveFromValue(restored).save.progress.completedPathLessonIds), clone(restored.progress.completedPathLessonIds), 'Migration is stable after reopening');

    const challenge = lesson.levels[7];
    const puzzle = getPuzzlesByDifficulty('en', lesson.difficulty).find(p => p.id === challenge.puzzleIds[0]);
    const initial = createDefaultGameSave();
    initial.progress.completedPuzzleIds = lesson.levels.slice(0, 4).flatMap(l => l.puzzleIds);
    initial.progress.challengeAttempt = timer.beginTimedChallenge(initial.progress, challenge, 'legacy-active', now).challengeAttempt;
    assert.ok(path.resolvePathSession(lesson.difficulty, lesson.id, challenge.id, undefined, initial.progress), 'A running legacy challenge remains resumable at step eight');
    let untimed = createDefaultGameSave();
    untimed.progress = timer.beginTimedChallenge(untimed.progress, challenge, 'untimed', now, 'untimed');
    const muchLater = now + 86400000;
    assert.equal(timer.settleChallengeTimeout(untimed.progress, muchLater), untimed.progress, 'Untimed mode never expires');
    assert.ok(timer.isChallengeOpen(untimed.progress.challengeAttempt, puzzle.id, muchLater));
    const normalized = timer.normalizeChallengeAttempt(untimed.progress.challengeAttempt);
    assert.equal(normalized.mode, 'untimed');
    assert.equal(parseGameSaveFromValue(untimed).save.progress.challengeAttempt.mode, 'untimed');
    const result = applyPuzzleAnswer(untimed, puzzle, true, 'untimed-answer', muchLater);
    assert.equal(result.accepted, true);
    assert.equal(result.save.progress.challengeAttempt.status, 'completed');
    assert.equal(applyPuzzleAnswer(result.save, puzzle, true, 'untimed-answer', muchLater).accepted, false, 'Double taps never pay again');
    let timed = createDefaultGameSave();
    timed.progress = timer.beginTimedChallenge(timed.progress, challenge, 'timed', now);
    assert.equal(applyPuzzleAnswer(timed, puzzle, true, 'timed-answer', now + 1).coins, result.coins, 'Both modes give the same first reward');
    assert.equal(timer.beginTimedChallenge(timed.progress, challenge, 'switch', now + 1, 'untimed').challengeAttempt.id, 'timed', 'Mode selection cannot reset a running clock');
    const extra = getPuzzlesByDifficulty('en', lesson.difficulty).find(p => p.id === lesson.levels[9].puzzleIds[0]);
    const evidence = applyPuzzleAnswer(createDefaultGameSave(), extra, true, 'extra-answer', now).save;
    assert.ok(parseGameSaveFromValue(evidence).save.progress.learningEvidence[lesson.skillId].independentPuzzleIds.includes(extra.id), 'Review evidence survives reload');
  }
  assert.equal(new Set(allIds).size, allIds.length, 'Every individual puzzle appears once');
  const first = path.PUZZLE_PATHS[0], fresh = createDefaultGameSave().progress;
  for (const topic of legacy.getLearningTopics('easy')) {
    assert.equal(path.getPathRecommendation('easy', fresh, topic.id).lesson.topicId, topic.id, 'Play respects the selected topic');
  }
  const freshPartial = { ...fresh, completedPuzzleIds: first.levels.slice(0,4).flatMap(l => l.puzzleIds) };
  const second = path.getTopicPaths(first.difficulty, first.topicId)[1];
  const reloaded = parseGameSaveFromValue({ ...createDefaultGameSave(), progress: freshPartial }).save;
  assert.equal(path.isPathAvailable(second, reloaded.progress), false, 'New saves do not gain legacy four-puzzle unlocks');
  console.log(`Verified ${path.PUZZLE_PATHS.length} ten-puzzle paths: sequential guards, direct play, legacy progress, saved untimed mode, equal rewards and next-level progression.`);
}
