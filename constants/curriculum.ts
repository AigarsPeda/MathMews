import catalogData from "@/data/puzzle-curriculum.json";
import { getPuzzlesByDifficulty } from "@/constants/puzzles";
import type { LearningCatalog, LearningLesson, LearningLevel } from "@/types/curriculum";
import type { AppLocale } from "@/types/locale";
import type { PuzzleDifficulty } from "@/types/puzzle";

export const LEARNING_CATALOG = catalogData as LearningCatalog;

export function getTopicLessons(difficulty: PuzzleDifficulty, topicId: string): LearningLesson[] {
  return LEARNING_CATALOG.lessons.filter(lesson => lesson.difficulty === difficulty && lesson.topicId === topicId);
}

export function getLearningTopics(difficulty: PuzzleDifficulty) {
  return LEARNING_CATALOG.topics.filter(topic => getTopicLessons(difficulty, topic.id).length > 0);
}

export function getLearningLesson(difficulty: PuzzleDifficulty, lessonId: string | undefined) {
  return LEARNING_CATALOG.lessons.find(lesson => lesson.difficulty === difficulty && lesson.id === lessonId);
}

export function getLevelPuzzles(locale: AppLocale, lesson: LearningLesson, level: LearningLevel) {
  const puzzles = getPuzzlesByDifficulty(locale, lesson.difficulty);
  return level.puzzleIds.map(id => puzzles.find(puzzle => puzzle.id === id)!);
}

export function getPracticeIds(lesson: LearningLesson): string[] {
  return lesson.levels.filter(level => level.kind === "practice").flatMap(level => level.puzzleIds);
}

/** Bosses count toward completion; challenges remain optional. Unlocks use practice only. */
export function getRequiredIds(lesson: LearningLesson): string[] {
  return lesson.levels.filter(level => level.kind !== "challenge").flatMap(level => level.puzzleIds);
}

/** Completion is derived from stable IDs, so each topic and lesson is independent. */
export function getLearningProgress(ids: readonly string[], completedIds: readonly string[]) {
  const completed = new Set(completedIds);
  const solved = ids.filter(id => completed.has(id)).length;
  return { solved, total: ids.length, complete: ids.length > 0 && solved === ids.length };
}

export function getTopicProgress(difficulty: PuzzleDifficulty, topicId: string, completedIds: readonly string[]) {
  return getLearningProgress(getTopicLessons(difficulty, topicId).flatMap(getRequiredIds), completedIds);
}

export function isLessonAvailable(lesson: LearningLesson, completedIds: readonly string[]): boolean {
  if (lesson.levels.some(level => level.puzzleIds.some(id => completedIds.includes(id)))) return true;
  const lessons = getTopicLessons(lesson.difficulty, lesson.topicId);
  const index = lessons.findIndex(item => item.id === lesson.id);
  return index >= 0 && lessons.slice(0, index).every(item => getLearningProgress(getPracticeIds(item), completedIds).complete);
}

export function getLearningLevelState(lesson: LearningLesson, level: LearningLevel, completedIds: readonly string[]) {
  const progress = getLearningProgress(level.puzzleIds, completedIds);
  if (progress.complete) return "completed" as const;
  if (!isLessonAvailable(lesson, completedIds)) return "locked" as const;
  if (level.kind !== "practice") {
    return progress.solved > 0 || getLearningProgress(getPracticeIds(lesson), completedIds).complete ? "current" as const : "locked" as const;
  }
  const index = lesson.levels.findIndex(item => item.id === level.id);
  return lesson.levels.slice(0, index).filter(item => item.kind === "practice")
    .every(item => getLearningProgress(item.puzzleIds, completedIds).complete) ? "current" as const : "locked" as const;
}

export type LearningSession = {
  lesson: LearningLesson;
  level: LearningLevel;
  phase: number;
};

/** Validate deep links before a task component reads its payload. */
export function resolveLearningSession(difficulty: PuzzleDifficulty, lessonId: string | undefined, levelId: string | undefined,
  phaseParam: string | undefined, completedIds: readonly string[]): LearningSession | null {
  const lesson = getLearningLesson(difficulty, lessonId);
  const level = lesson?.levels.find(item => item.id === levelId);
  if (!lesson || !level || getLearningLevelState(lesson, level, completedIds) === "locked") return null;
  if (phaseParam !== undefined && !/^\d+$/.test(phaseParam)) return null;
  const firstUnfinished = level.puzzleIds.findIndex(id => !completedIds.includes(id));
  const phase = phaseParam === undefined ? Math.max(0, firstUnfinished) : Number(phaseParam);
  if (!Number.isSafeInteger(phase) || phase < 0 || phase >= level.puzzleIds.length) return null;
  if (!level.puzzleIds.slice(0, phase).every(id => completedIds.includes(id))) return null;
  return { lesson, level, phase };
}

export function getNextPracticeLevel(lesson: LearningLesson, level: LearningLevel) {
  if (level.kind !== "practice") return undefined;
  const index = lesson.levels.findIndex(item => item.id === level.id);
  return lesson.levels.slice(index + 1).find(item => item.kind === "practice");
}
