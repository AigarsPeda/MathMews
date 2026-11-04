import extras from "@/data/puzzle-path-extras.json";
import { LEARNING_CATALOG, getLearningProgress, getPracticeIds, getRequiredIds, isLessonAvailable, type LearningSession } from "@/constants/curriculum";
import type { LearningLesson, LearningLevel } from "@/types/curriculum";
import type { Progress } from "@/types/game";
import type { PuzzleDifficulty } from "@/types/puzzle";

/** Navigation is independent of the archived story/reward catalog. Puzzle IDs never change. */
export const PUZZLE_PATHS: LearningLesson[] = LEARNING_CATALOG.lessons.map(lesson => {
  const practice = lesson.levels.filter(level => level.kind === "practice");
  const applications = lesson.levels.filter(level => level.kind === "boss").flatMap(level =>
    level.puzzleIds.map((id, index): LearningLevel => ({ id: `${level.id}-step-${index + 1}`, kind: "practice",
      title: lesson.title, description: lesson.description, puzzleIds: [id] })));
  const challenge = lesson.levels.filter(level => level.kind === "challenge");
  const review = (extras as Record<string, string[]>)[lesson.id].map((id): LearningLevel => ({ id, kind: "practice",
    title: lesson.title, description: lesson.description, puzzleIds: [id] }));
  return { ...lesson, levels: [...practice, ...applications, ...challenge, ...review] };
});
const locations = new Map(PUZZLE_PATHS.flatMap(lesson => lesson.levels.map(level => [level.id, { lesson, level }] as const)));
const lessonIds = new Set(PUZZLE_PATHS.map(lesson => lesson.id));
type PathProgress = Pick<Progress, "completedPuzzleIds" | "attemptedPuzzleIds" | "challengeAttempt" | "completedPathLessonIds" | "unlockedPathLessonIds">;
export const getPathLocation = (id: string) => locations.get(id);
export const getTopicPaths = (difficulty: PuzzleDifficulty, topicId: string) => PUZZLE_PATHS.filter(l => l.difficulty === difficulty && l.topicId === topicId);
export const getPathLesson = (difficulty: PuzzleDifficulty, id?: string) => PUZZLE_PATHS.find(l => l.difficulty === difficulty && l.id === id);
export function getPathProgress(lesson: LearningLesson, progress: PathProgress) {
  const counts = getLearningProgress(lesson.levels.flatMap(l => l.puzzleIds), progress.completedPuzzleIds ?? []);
  return { ...counts, complete: counts.complete || !!progress.completedPathLessonIds?.includes(lesson.id) };
}
/** Count every playable puzzle, including challenges and newly added review tasks. */
export function getTopicPathProgress(difficulty: PuzzleDifficulty, topicId: string, progress: PathProgress) {
  return getLearningProgress(getTopicPaths(difficulty, topicId).flatMap(lesson => lesson.levels.flatMap(level => level.puzzleIds)),
    progress.completedPuzzleIds ?? []);
}
export function isPathAvailable(lesson: LearningLesson, progress: PathProgress): boolean {
  if (progress.unlockedPathLessonIds?.includes(lesson.id) || progress.completedPathLessonIds?.includes(lesson.id)) return true;
  if (lesson.levels.some(l => l.puzzleIds.some(id => progress.completedPuzzleIds?.includes(id)))) return true;
  const track = getTopicPaths(lesson.difficulty, lesson.topicId);
  const index = track.findIndex(l => l.id === lesson.id);
  return index >= 0 && track.slice(0, index).every(l => getPathProgress(l, progress).complete);
}
export function getPathStepState(lesson: LearningLesson, level: LearningLevel, progress: PathProgress) {
  const completed = progress.completedPuzzleIds ?? [];
  if (level.puzzleIds.every(id => completed.includes(id))) return "completed" as const;
  if (!isPathAvailable(lesson, progress)) return "locked" as const;
  if (progress.challengeAttempt?.levelId === level.id && progress.challengeAttempt.status === "active") return "current" as const;
  // A previously finished level remains open, including its new review questions.
  if (progress.completedPathLessonIds?.includes(lesson.id)) return "current" as const;
  const index = lesson.levels.findIndex(l => l.id === level.id);
  return index >= 0 && lesson.levels.slice(0, index).every(l => l.puzzleIds.every(id => completed.includes(id))) ? "current" as const : "locked" as const;
}
export function getPathRecommendation(difficulty: PuzzleDifficulty, progress: PathProgress, topicId?: string) {
  const candidates = PUZZLE_PATHS.filter(l => l.difficulty === difficulty && (!topicId || l.topicId === topicId) && isPathAvailable(l, progress));
  const active = progress.challengeAttempt;
  if (active?.status === "active" && (active.mode === "untimed" || active.deadlineAt > Date.now())) {
    const location = getPathLocation(active.levelId);
    if (location && candidates.some(l => l.id === location.lesson.id)) return { ...location, resumeChallenge: true };
  }
  const unfinished = candidates.filter(l => !getPathProgress(l, progress).complete);
  const attempts = [...(progress.completedPuzzleIds ?? []), ...(progress.attemptedPuzzleIds ?? [])];
  let lesson = unfinished[0];
  for (let i = attempts.length - 1; i >= 0; i--) {
    const started = unfinished.find(l => l.levels.some(v => v.puzzleIds.includes(attempts[i])));
    if (started) { lesson = started; break; }
  }
  lesson ??= candidates[0];
  if (!lesson) return;
  const level = lesson.levels.find(l => getPathStepState(lesson, l, progress) === "current") ?? lesson.levels[0];
  return { lesson, level, resumeChallenge: false };
}
/** Offer a continuation only when this difficulty has saved activity. */
export function getPathResumeRecommendation(difficulty: PuzzleDifficulty, progress: PathProgress) {
  const recommendation = getPathRecommendation(difficulty, progress);
  if (!recommendation) return;
  if (recommendation.resumeChallenge) return recommendation;
  if (getPathProgress(recommendation.lesson, progress).complete) return;
  const history = [...(progress.completedPuzzleIds ?? []), ...(progress.attemptedPuzzleIds ?? [])];
  const lessons = PUZZLE_PATHS.filter(lesson => lesson.difficulty === difficulty);
  for (let index = history.length - 1; index >= 0; index--) {
    const last = lessons.find(lesson => lesson.levels.some(level => level.puzzleIds.includes(history[index])));
    if (!last) continue;
    // Finishing a level should continue its topic, not jump to the catalog's first topic.
    const next = getPathRecommendation(difficulty, progress, last.topicId);
    return next && !getPathProgress(next.lesson, progress).complete ? next : recommendation;
  }
  return lessons.some(lesson => progress.completedPathLessonIds?.includes(lesson.id)) ? recommendation : undefined;
}
export function resolvePathSession(difficulty: PuzzleDifficulty, lessonId: string | undefined, levelId: string | undefined,
  phaseParam: string | undefined, progress: PathProgress): LearningSession | null {
  const lesson = getPathLesson(difficulty, lessonId);
  if (!lesson || !levelId || phaseParam !== undefined && !/^\d+$/.test(phaseParam)) return null;
  // Old story deep links land on the corresponding individual puzzle.
  const archived = LEARNING_CATALOG.lessons.find(l => l.id === lessonId)?.levels.find(l => l.id === levelId);
  const phase = phaseParam === undefined && archived?.kind === "boss"
    ? Math.max(0, archived.puzzleIds.findIndex(id => !progress.completedPuzzleIds?.includes(id))) : Number(phaseParam ?? 0);
  if (!Number.isSafeInteger(phase) || phase < 0) return null;
  const level = archived?.kind === "boss" ? lesson.levels.find(l => l.puzzleIds[0] === archived.puzzleIds[phase])
    : phase === 0 ? lesson.levels.find(l => l.id === levelId) : undefined;
  if (!level || getPathStepState(lesson, level, progress) === "locked") return null;
  return { lesson, level, phase: 0 };
}
/** A topic node opens its level directly, resuming the first unfinished puzzle. */
export function getPathEntry(lesson: LearningLesson, progress: PathProgress) {
  if (!isPathAvailable(lesson, progress)) return;
  const active = progress.challengeAttempt;
  const running = active?.status === "active" && (active.mode === "untimed" || active.deadlineAt > Date.now())
    ? lesson.levels.find(level => level.id === active.levelId) : undefined;
  const level = running ?? lesson.levels.find(level => getPathStepState(lesson, level, progress) === "current") ?? lesson.levels[0];
  const count = getPathProgress(lesson, progress);
  return { lesson, level, replay: !running && count.solved === count.total };
}

/** A level is one ten-puzzle session. Its final puzzle returns to the topic path. */
export function getNextPathStep(lesson: LearningLesson, level: LearningLevel, progress: PathProgress, replay = false) {
  const index = lesson.levels.findIndex(l => l.id === level.id);
  if (index < 0) return;
  const next = replay ? lesson.levels[index + 1]
    : lesson.levels.slice(index + 1).find(item => getPathStepState(lesson, item, progress) === "current");
  if (next && getPathStepState(lesson, next, progress) !== "locked") return { lesson, level: next };
  // A resumed legacy challenge can precede unfinished application puzzles.
  const unfinished = lesson.levels.find(l => getPathStepState(lesson, l, progress) === "current");
  if (unfinished) return { lesson, level: unfinished };
}
/** Freeze legacy completion/unlocks once; never manufacture answers or reward claims. */
export function migratePathProgress(value: Partial<Progress>, completed: string[]) {
  const clean = (ids: unknown) => Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string" && lessonIds.has(id)))] : [];
  if (value.pathVersion === 1) return { pathVersion: 1 as const,
    completedPathLessonIds: clean(value.completedPathLessonIds), unlockedPathLessonIds: clean(value.unlockedPathLessonIds) };
  return { pathVersion: 1 as const,
    completedPathLessonIds: LEARNING_CATALOG.lessons.filter(l => getLearningProgress(getRequiredIds(l), completed).complete).map(l => l.id),
    unlockedPathLessonIds: LEARNING_CATALOG.lessons.filter(l => isLessonAvailable(l, completed) &&
      (getLearningProgress(getPracticeIds(l), completed).solved > 0 || getTopicPaths(l.difficulty, l.topicId)[0]?.id !== l.id)).map(l => l.id) };
}
