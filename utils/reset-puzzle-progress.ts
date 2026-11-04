import type { GameSave } from '@/types/save';
import type { Progress } from '@/types/game';
/** Earned pet growth survive a deliberate learning-path reset. */
export function lifetimePuzzleIds(progress: Progress): string[] {
  return [...new Set([...(progress.lifetimeCompletedPuzzleIds ?? []), ...(progress.completedPuzzleIds ?? [])])];
}
/** Reset learning and its achievements. Purchases, help unlocks, lives, daily streak and wallet stay intact. */
export function resetPuzzleProgress(save: GameSave): GameSave {
  return { ...save, progress: { ...save.progress,
    lifetimeCompletedPuzzleIds: lifetimePuzzleIds(save.progress),
    completedPuzzleIds: [], attemptedPuzzleIds: [], completedPathLessonIds: [], unlockedPathLessonIds: [], pathVersion: 1,
    puzzlesSolved: { easy: 0, medium: 0, hard: 0 }, puzzleStreak: 0,
    topicStats: {}, topicStatsByDifficulty: {}, learningEvidence: {}, learningSupportIds: [], reviewAttemptKeys: [], challengeAttempt: undefined,
  } };
}
