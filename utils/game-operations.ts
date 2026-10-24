import { recordLearningAttempt } from "@/utils/learning-evidence";
import type { LearningAttemptContext } from "@/types/learning";
import { FEED_HAPPINESS_BOOST, FEED_HUNGER_RESTORE, getPuzzleCoinReward, PUZZLE_HAPPINESS_BOOST, PUZZLE_REPLAY_HAPPINESS_BOOST } from "@/constants/game";
import { getPuzzlesByDifficulty, PUZZLE_DIFFICULTIES, PUZZLE_CONTENT_VERSION } from "@/constants/puzzles";
import { getPuzzleLevelKind, getTimedChallengeLevel } from "@/constants/curriculum";
import type { Progress, PuzzleProgress } from "@/types/game";
import type { Puzzle } from "@/types/puzzle";
import type { GameSave } from "@/types/save";
import { withCoinDelta } from "@/utils/coin-ledger";
import { boostStat, canFeedForEffect, withPetCareUpdate } from "@/utils/pet-care";
import { recordTopicAttempt } from "@/utils/topic-stats";
import { applyLifeRegen, loseLife } from "@/utils/lives";
import { isChallengeOpen, settleChallengeTimeout } from "@/utils/timed-challenge";

function puzzleDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Yesterday's streak remains active until today's opportunity has passed. */
export function currentPuzzleStreak(progress: Pick<Progress, "streak" | "lastPuzzleDay">, now = Date.now()): number {
  const today = new Date(now);
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  return progress.lastPuzzleDay === puzzleDay(today) || progress.lastPuzzleDay === puzzleDay(yesterday)
    ? Math.max(0, Math.floor(progress.streak)) : 0;
}

export function getCompletedPuzzleIds(progress: Pick<Progress, "completedPuzzleIds">): string[] {
  const known = new Set(PUZZLE_DIFFICULTIES.flatMap(tier => getPuzzlesByDifficulty("en", tier).map(puzzle => puzzle.id)));
  return [...new Set(progress.completedPuzzleIds ?? [])].filter(id => known.has(id));
}

export function getSolvedCounts(ids: readonly string[]): PuzzleProgress {
  const completed = new Set(ids);
  return Object.fromEntries(PUZZLE_DIFFICULTIES.map(tier => {
    const puzzles = getPuzzlesByDifficulty("en", tier);
    return [tier, puzzles.filter(puzzle => completed.has(puzzle.id)).length];
  })) as PuzzleProgress;
}

/** One committed answer owns its reward and completion. Repeated delivery is harmless. */
export function applyPuzzleAnswer(save: GameSave, puzzle: Puzzle, correct: boolean, attemptId: string, now = Date.now(), context: LearningAttemptContext = {}) {
  if (save.progress.processedAttemptIds?.includes(attemptId)) return { save, coins: 0, accepted: false };
  const synced = settleChallengeTimeout(save.progress, now);
  if (synced !== save.progress) save = { ...save, progress: synced };
  if (getTimedChallengeLevel(puzzle.id) && !isChallengeOpen(save.progress.challengeAttempt, puzzle.id, now)) return { save, coins: 0, accepted: false };
  const lives = applyLifeRegen(save.progress.lives, now);
  if (lives.current <= 0) return { save, coins: 0, accepted: false };
  const completed = getCompletedPuzzleIds(save.progress);
  const replay = completed.includes(puzzle.id);
  const coins = correct ? getPuzzleCoinReward(puzzle.difficulty, replay, getPuzzleLevelKind(puzzle.id)) : 0;
  const ids = correct && !replay ? [...completed, puzzle.id] : completed;
  const date = new Date(now);
  const day = puzzleDay(date);
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const previousDay = puzzleDay(yesterday);
  const currentStreak = currentPuzzleStreak(save.progress, now);
  const streak = !correct || save.progress.lastPuzzleDay === day ? currentStreak
    : save.progress.lastPuzzleDay === previousDay ? currentStreak + 1 : 1;
  let next: GameSave = {
    ...save,
    progress: { ...save.progress, puzzleContentVersion: PUZZLE_CONTENT_VERSION, completedPuzzleIds: ids, puzzlesSolved: getSolvedCounts(ids),
      attemptedPuzzleIds: [...new Set([...(save.progress.attemptedPuzzleIds ?? []), puzzle.id])],
      processedAttemptIds: [...(save.progress.processedAttemptIds ?? []), attemptId].slice(-200),
      lives: correct ? lives : loseLife(lives, now),
      challengeAttempt: correct && getTimedChallengeLevel(puzzle.id) && save.progress.challengeAttempt
        ? { ...save.progress.challengeAttempt, status: "completed" } : save.progress.challengeAttempt,
      learningEvidence: recordLearningAttempt(save.progress.learningEvidence, puzzle, correct, !context.helpUsed && !save.progress.learningSupportIds?.includes(puzzle.id) && !save.progress.attemptedPuzzleIds?.includes(puzzle.id) && !replay, now),
      topicStats: recordTopicAttempt(save.progress.topicStats, puzzle.topic, correct),
      topicStatsByDifficulty: { ...save.progress.topicStatsByDifficulty,
        [puzzle.difficulty]: recordTopicAttempt(save.progress.topicStatsByDifficulty?.[puzzle.difficulty], puzzle.topic, correct) },
      puzzleStreak: correct ? save.progress.puzzleStreak + (replay ? 0 : 1) : save.progress.puzzleStreak,
      streak, lastPuzzleDay: correct ? day : save.progress.lastPuzzleDay },
    pet: { ...withPetCareUpdate(save.pet, stats => ({ ...stats,
      happiness: correct ? boostStat(stats.happiness, replay ? PUZZLE_REPLAY_HAPPINESS_BOOST : PUZZLE_HAPPINESS_BOOST) : stats.happiness,
      level: 1 + Math.floor(ids.length / 10) }), now), lastInteractionAt: now },
  };
  if (coins) next = withCoinDelta(next, coins, { kind: "puzzle_reward", itemId: puzzle.id }, now)!;
  return { save: next, coins, accepted: true };
}

export function applyFeed(save: GameSave, now = Date.now()): GameSave | null {
  if (!canFeedForEffect(save.pet.stats, save.pet.isAsleep === true)) return null;
  return { ...save, pet: { ...withPetCareUpdate(save.pet, stats => ({ ...stats,
    hunger: boostStat(stats.hunger, FEED_HUNGER_RESTORE), happiness: boostStat(stats.happiness, FEED_HAPPINESS_BOOST) }), now),
    isAsleep: false, lastInteractionAt: now } };
}
