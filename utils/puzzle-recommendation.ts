import { LEARNING_CATALOG, getLearningLevelLocation, getLearningLevelState, getLearningProgress, getRequiredIds, isLessonAvailable } from "@/constants/curriculum";
import type { LearningLesson } from "@/types/curriculum";
import type { Progress } from "@/types/game";
import type { PuzzleDifficulty } from "@/types/puzzle";

/** Derive the next action from the real save. Never skip a prerequisite or restart a running clock. */
export function getPuzzleRecommendation(difficulty: PuzzleDifficulty, progress: Progress, now = Date.now()) {
  const completed = progress.completedPuzzleIds ?? [];
  const run = progress.challengeAttempt;
  if (run?.status === "active" && run.deadlineAt > now) {
    const location = getLearningLevelLocation(run.levelId);
    if (location && getLearningLevelState(location.lesson, location.level, completed) === "current") {
      return { ...location, resumeChallenge: true };
    }
  }
  const available = LEARNING_CATALOG.lessons.filter(lesson => lesson.difficulty === difficulty && isLessonAvailable(lesson, completed));
  const unfinished = available.filter(lesson => !getLearningProgress(getRequiredIds(lesson), completed).complete);
  const pool = unfinished.length ? unfinished : available;
  const nextLevel = (lesson: LearningLesson) => (["practice", "boss", "challenge"] as const)
    .flatMap(kind => lesson.levels.filter(level => level.kind === kind))
    .find(level => getLearningLevelState(lesson, level, completed) === "current");
  const attempts = [...(progress.attemptedPuzzleIds ?? []), ...completed];
  const started = [...attempts].reverse().map(id => pool.find(lesson => lesson.levels.some(level => level.puzzleIds.includes(id))))
    .find(lesson => lesson && nextLevel(lesson));
  const lesson = started ?? pool.find(item => nextLevel(item));
  const level = lesson && nextLevel(lesson);
  return lesson && level ? { lesson, level, resumeChallenge: false } : undefined;
}
