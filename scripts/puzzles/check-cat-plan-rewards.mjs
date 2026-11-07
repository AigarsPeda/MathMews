import assert from 'node:assert/strict';
import fs from 'node:fs';

export function checkCatPlanRewards({ load }) {
  const { CAT_PLAN_REWARDS } = load('@/constants/cat-plan-rewards');
  const { grantCatPlanRewards } = load('@/utils/cat-plan-rewards');
  const { getPathLesson } = load('@/constants/puzzle-path');
  const { createDefaultGameSave, parseGameSaveFromValue } = load('@/utils/game-storage');
  const { applyPuzzleAnswer } = load('@/utils/game-operations');
  const { resetPuzzleProgress } = load('@/utils/reset-puzzle-progress');
  const { beginTimedChallenge, settleChallengeTimeout } = load('@/utils/timed-challenge');
  const { getPuzzlesByDifficulty } = load('@/constants/puzzles');
  const { storedRoomItems, createRoomPlacementDraft, applyRoomObjectEdits } = load('@/utils/room-edit');
  const { isCanonicalDecorationStoreId } = load('@/constants/decoration-variants');
  const catalog = JSON.parse(fs.readFileSync('data/puzzle-curriculum.json'));
  assert.equal(catalog.topics.at(-1).id, 'cat-plans', 'Cat plans follows every regular subject');
  assert.equal(catalog.topics[0].id, 'addition');
  assert.equal(CAT_PLAN_REWARDS.length, 9);
  assert.equal(new Set(CAT_PLAN_REWARDS.map(r => r.decorationId)).size, 9);
  for (const reward of CAT_PLAN_REWARDS) {
    const difficulty = reward.lessonId.split('-')[0], lesson = getPathLesson(difficulty, reward.lessonId);
    assert.deepEqual([...reward.puzzleIds], [...lesson.levels.flatMap(level => [...level.puzzleIds])]);
    assert.ok(isCanonicalDecorationStoreId(reward.decorationId), 'Use placeable inventory IDs');
    for (const locale of ['en', 'lv', 'ru']) {
      assert.ok(JSON.parse(fs.readFileSync(`locales/${locale}.json`)).store.decorationName[reward.decorationId]);
    }
    const puzzles = getPuzzlesByDifficulty('en', difficulty);
    const initial = createDefaultGameSave();
    initial.progress.decorationsUnlocked.push(reward.decorationId);
    initial.progress.decorationQuantities[reward.decorationId] = 2;
    for (let length = 0; length < 10; length++) {
      initial.progress.completedPuzzleIds = reward.puzzleIds.slice(0, length);
      assert.equal(grantCatPlanRewards(initial), initial, 'Partial plans never grant a decoration');
    }
    const finalPuzzle = puzzles.find(p => p.id === reward.puzzleIds[9]);
    assert.equal(applyPuzzleAnswer(initial, finalPuzzle, false, 'wrong').save.progress.catPlanRewardsClaimed, undefined);
    const earned = applyPuzzleAnswer(initial, finalPuzzle, true, 'right').save;
    assert.equal(earned.progress.decorationQuantities[reward.decorationId], 3, 'Add one even when the item was bought before');
    assert.ok(earned.progress.catPlanRewardsClaimed.includes(reward.lessonId));
    assert.equal(grantCatPlanRewards(earned), earned, 'Repeated delivery does not grant again');
    const restored = parseGameSaveFromValue(JSON.stringify(earned)).save;
    assert.equal(restored.progress.decorationQuantities[reward.decorationId], 3, 'Receipt and quantity survive cloud/local restore');
    assert.equal(grantCatPlanRewards(resetPuzzleProgress(restored)).progress.decorationQuantities[reward.decorationId], 3, 'Learning reset cannot farm items');
    assert.equal(applyPuzzleAnswer(restored, finalPuzzle, true, 'replay').save.progress.decorationQuantities[reward.decorationId], 3);
    const legacy = createDefaultGameSave(); legacy.progress.completedPuzzleIds = [...reward.puzzleIds];
    const backfilled = parseGameSaveFromValue(legacy).save;
    assert.equal(backfilled.progress.decorationQuantities[reward.decorationId], 1, 'Previously completed plans receive their item on load');
    assert.equal(parseGameSaveFromValue(backfilled).save.progress.decorationQuantities[reward.decorationId], 1);
    assert.equal(backfilled.wallet.coins, legacy.wallet.coins, 'Free items never debit or credit coins');
    const target = { kind: 'decoration', id: reward.decorationId };
    assert.ok(storedRoomItems(backfilled.pet, backfilled.progress).some(item => item.target.id === reward.decorationId && item.count === 1));
    const draft = createRoomPlacementDraft(target, backfilled.pet);
    const furnished = applyRoomObjectEdits(backfilled.pet, [{ instanceId: draft.item.instanceId, offset: { x: 0.1, y: 0.2 } }], [], draft);
    assert.ok(furnished.placedDecorations.some(item => item.decorationId === reward.decorationId));
    assert.ok(!storedRoomItems(furnished, backfilled.progress).some(item => item.target.id === reward.decorationId), 'Placing consumes the available inventory copy');
    for (const mode of ['timed', 'untimed']) {
      let timed = createDefaultGameSave(); timed.progress.completedPuzzleIds = reward.puzzleIds.slice(0, 7);
      timed.progress = beginTimedChallenge(timed.progress, lesson.levels[7], `${reward.lessonId}-${mode}`, Date.now(), mode);
      for (let index = 7; index < 10; index++) {
        timed = applyPuzzleAnswer(timed, puzzles.find(p => p.id === reward.puzzleIds[index]), true, `${mode}-${index}`).save;
        assert.equal(timed.progress.catPlanRewardsClaimed?.includes(reward.lessonId) ?? false, index === 9, 'Both timer modes require the whole plan');
        if (mode === 'timed' && index === 8) {
          const expired = { ...timed, progress: settleChallengeTimeout(timed.progress, timed.progress.challengeAttempt.deadlineAt + 1) };
          assert.equal(grantCatPlanRewards(expired).progress.catPlanRewardsClaimed, undefined, 'Expired runs do not award furniture');
        }
      }
    }
  }
  console.log('Verified nine usable decoration rewards: both timer modes, partial/expired runs, first clear, replay, existing quantities, reset, restore, backfill and actual room placement.');
}
