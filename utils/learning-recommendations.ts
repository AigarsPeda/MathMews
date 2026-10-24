import { getPracticeIds, getTopicLessons, isLessonAvailable, LEARNING_CATALOG } from '@/constants/curriculum';
import type { Progress } from '@/types/game';
import type { LearningLesson } from '@/types/curriculum';
import type { PuzzleDifficulty } from '@/types/puzzle';
export type LearningRecommendation = { lesson: LearningLesson; kind: 'support' | 'review' | 'ready' };
/** Suggestions never revoke earned completions or lock a different topic. */
export function getLearningRecommendation(progress: Progress, difficulty: PuzzleDifficulty, topicId?: string, now = Date.now()): LearningRecommendation | null {
  const lessons = LEARNING_CATALOG.lessons.filter(l => l.difficulty === difficulty && (!topicId || l.topicId === topicId));
  const evidence = progress.learningEvidence ?? {}, completed = progress.completedPuzzleIds ?? [];
  const candidates = lessons.filter(l => isLessonAvailable(l, completed));
  const struggling = candidates.find(l => {
    const e = evidence[l.skillId ?? ''];
    return e && e.mistakes >= 2 && e.independentPuzzleIds.length < 2 && e.guidedSessions === 0 && !getPracticeIds(l).every(id => completed.includes(id));
  });
  if (struggling) return {lesson: struggling, kind: 'support'};
  const due = candidates.filter(l => {
    const e = evidence[l.skillId ?? ''];
    return e && e.independentPuzzleIds.length >= 2 && now - Math.max(e.lastIndependentAt, e.lastReviewedAt ?? 0) >= 2 * 86400000;
  }).sort((a,b) => evidence[a.skillId!].lastIndependentAt - evidence[b.skillId!].lastIndependentAt)[0];
  if (due) return {lesson: due, kind: 'review'};
  for (const lesson of candidates) {
    const e = evidence[lesson.skillId ?? ''];
    if (!e || e.independentPuzzleIds.length < 2 || !getPracticeIds(lesson).every(id => completed.includes(id))) continue;
    const track = getTopicLessons(difficulty, lesson.topicId), next = track[track.indexOf(lesson) + 1];
    if (next && isLessonAvailable(next, completed) && !getPracticeIds(next).every(id => completed.includes(id))) return {lesson: next, kind: 'ready'};
  }
  return null;
}
