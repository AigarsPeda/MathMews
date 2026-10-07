import { FEED_HAPPINESS_BOOST, FEED_HUNGER_RESTORE, getPuzzleCoinReward, PUZZLE_HAPPINESS_BOOST, PUZZLE_REPLAY_HAPPINESS_BOOST } from "@/constants/game";
import { getLegacyCompletedPuzzleIds, getPuzzlesByDifficulty, PUZZLE_DIFFICULTIES } from "@/constants/puzzles";
import type { Progress, PuzzleProgress } from "@/types/game";
import type { Puzzle } from "@/types/puzzle";
import type { GameSave } from "@/types/save";
import { withCoinDelta } from "@/utils/coin-ledger";
import { boostStat, canFeedForEffect, withPetCareUpdate } from "@/utils/pet-care";
import { recordTopicAttempt } from "@/utils/topic-stats";

export function getCompletedPuzzleIds(progress: Pick<Progress, "puzzlesSolved" | "completedPuzzleIds">): string[] {
  return [...new Set(progress.completedPuzzleIds ?? getLegacyCompletedPuzzleIds(progress.puzzlesSolved))];
}

export function getSolvedCounts(ids: readonly string[]): PuzzleProgress {
  const completed = new Set(ids);
  return Object.fromEntries(PUZZLE_DIFFICULTIES.map(tier => {
    const puzzles = getPuzzlesByDifficulty("en", tier);
    const index = puzzles.findIndex(puzzle => !completed.has(puzzle.id));
    return [tier, index < 0 ? puzzles.length : index];
  })) as PuzzleProgress;
}

/** One committed answer owns its reward and completion. Repeated delivery is harmless. */
export function applyPuzzleAnswer(save: GameSave, puzzle: Puzzle, correct: boolean, attemptId: string, now = Date.now()) {
  if (save.progress.processedAttemptIds?.includes(attemptId)) return { save, coins: 0 };
  const completed = getCompletedPuzzleIds(save.progress);
  const replay = completed.includes(puzzle.id);
  const coins = correct ? getPuzzleCoinReward(puzzle.difficulty, replay) : 0;
  const ids = correct && !replay ? [...completed, puzzle.id] : completed;
  const date = new Date(now);
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const previousDay = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
  const streak = !correct || save.progress.lastPuzzleDay === day ? save.progress.streak
    : save.progress.lastPuzzleDay === previousDay ? save.progress.streak + 1 : 1;
  let next: GameSave = {
    ...save,
    progress: { ...save.progress, completedPuzzleIds: ids, puzzlesSolved: getSolvedCounts(ids),
      processedAttemptIds: [...(save.progress.processedAttemptIds ?? []), attemptId].slice(-200),
      topicStats: recordTopicAttempt(save.progress.topicStats, puzzle.topic, correct),
      puzzleStreak: correct ? save.progress.puzzleStreak + (replay ? 0 : 1) : save.progress.puzzleStreak,
      streak, lastPuzzleDay: correct ? day : save.progress.lastPuzzleDay },
    pet: { ...withPetCareUpdate(save.pet, stats => ({ ...stats,
      happiness: correct ? boostStat(stats.happiness, replay ? PUZZLE_REPLAY_HAPPINESS_BOOST : PUZZLE_HAPPINESS_BOOST) : stats.happiness,
      level: 1 + Math.floor(ids.length / 10) }), now), lastInteractionAt: now },
  };
  if (coins) next = withCoinDelta(next, coins, { kind: "puzzle_reward", itemId: puzzle.id }, now)!;
  return { save: next, coins };
}

export function applyFeed(save: GameSave, now = Date.now()): GameSave | null {
  if (!canFeedForEffect(save.pet.stats, save.pet.isAsleep === true)) return null;
  return { ...save, pet: { ...withPetCareUpdate(save.pet, stats => ({ ...stats,
    hunger: boostStat(stats.hunger, FEED_HUNGER_RESTORE), happiness: boostStat(stats.happiness, FEED_HAPPINESS_BOOST) }), now),
    isAsleep: false, lastInteractionAt: now } };
}
