import { PUZZLE_PATHS } from '@/constants/puzzle-path';
import type { PuzzleCatReaction } from '@/constants/puzzle-cat-reactions';

export const LEARNING_MILESTONES = [
  { lessons: 1, performance: ['puzzleProud', 'puzzleHighPaw'] },
  { lessons: 10, performance: ['puzzleBounce', 'puzzleProud'] },
  { lessons: 50, performance: ['puzzleHighPaw', 'puzzleBounce', 'puzzleProud'] },
] as const satisfies readonly { lessons: number; performance: readonly PuzzleCatReaction[] }[];
export type LearningMilestone = typeof LEARNING_MILESTONES[number];

/** Derived from durable completions: replaying or opening the collection grants nothing. */
export function countFinishedLessons(ids: readonly string[]) {
  const completed = new Set(ids);
  return PUZZLE_PATHS.filter(lesson => lesson.levels.every(level => level.puzzleIds.every(id => completed.has(id)))).length;
}
export function getNewLearningMilestone(before: readonly string[], after: readonly string[]) {
  const previous = countFinishedLessons(before), current = countFinishedLessons(after);
  return LEARNING_MILESTONES.find(m => previous < m.lessons && current >= m.lessons);
}
