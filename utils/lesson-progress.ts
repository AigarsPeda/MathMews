import { getLearningProgress, getPracticeIds, isLessonAvailable } from "@/constants/curriculum";
import type { LearningLesson, LearningLevel } from "@/types/curriculum";
import type { Progress } from "@/types/game";

export type LessonProgressSave = Pick<Progress, "completedPuzzleIds" | "attemptedPuzzleIds" | "challengeAttempt">;
export type LessonActivity = {
  kind: LearningLevel["kind"];
  solved: number;
  total: number;
  complete: boolean;
  started: boolean;
  locked: boolean;
};

/** Optional challenges remain separate from the practice and boss completion rule. */
export function getLessonProgress(lesson: LearningLesson, progress: LessonProgressSave) {
  const completed = progress.completedPuzzleIds ?? [], attempted = new Set(progress.attemptedPuzzleIds ?? []);
  const available = isLessonAvailable(lesson, completed);
  const practiceDone = getLearningProgress(getPracticeIds(lesson), completed).complete;
  const parts: LessonActivity[] = (["practice", "challenge", "boss"] as const).map(kind => {
    const levels = lesson.levels.filter(level => level.kind === kind);
    const ids = levels.flatMap(level => level.puzzleIds);
    const state = getLearningProgress(ids, completed);
    const started = state.solved > 0 || ids.some(id => attempted.has(id))
      || kind === "challenge" && levels.some(level => progress.challengeAttempt?.levelId === level.id);
    return { kind, ...state, started, locked: !state.complete && !started && !(available && (kind === "practice" || practiceDone)) };
  });
  const [practice, challenge, boss] = parts;
  const requiredComplete = practice.complete && (!boss.total || boss.complete);
  const status = !available ? "locked" : requiredComplete && (!challenge.total || challenge.complete) ? "complete"
    : requiredComplete ? "challengeLeft" : practiceDone ? "bossLeft" : parts.some(part => part.started) ? "started" : "notStarted";
  return { available, parts, requiredComplete, status };
}
