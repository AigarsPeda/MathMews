import { recordGuidedLearning } from "@/utils/learning-evidence";
import { LEARNING_CATALOG } from '@/constants/curriculum';
import { getLearningReview } from '@/constants/learning-review';
import type { GameSave } from '@/types/save';
import { settleChallengeTimeout } from '@/utils/timed-challenge';
import { applyLifeRegen, loseLife } from '@/utils/lives';
/** One independent review submission per skill/day. Reopening cannot turn a retry into evidence. */
export function applyLearningReview(save: GameSave, lessonId: string, day: number, selected: number, now = Date.now()) {
  const lesson = LEARNING_CATALOG.lessons.find(l => l.id === lessonId);
  if (!lesson?.skillId || day !== Math.floor(now / 86400000)) return {save,accepted:false,correct:false};
  const synced = settleChallengeTimeout(save.progress, now);
  if (synced !== save.progress) save = { ...save, progress: synced };
  const key=`${lessonId}/${day}`;
  const lives=applyLifeRegen(save.progress.lives,now);
  if(lives.current<=0 || save.progress.reviewAttemptKeys?.includes(key)) return {save,accepted:false,correct:false};
  const question=getLearningReview(lesson,day);
  if(!Number.isInteger(selected)||selected<0||selected>=question.choices.length)return {save,accepted:false,correct:false};
  const correct=selected===question.correctIndex;
  const prior=save.progress.learningEvidence?.[lesson.skillId];
  // Review checks corroborate a skill; they never grant ordinary completions or currency.
  const evidence=prior?{...save.progress.learningEvidence,[lesson.skillId]:{...prior,lastReviewedAt:now,reviewCorrect:(prior.reviewCorrect??0)+(correct?1:0),reviewWrong:(prior.reviewWrong??0)+(correct?0:1)}}:save.progress.learningEvidence;
  return {accepted:true,correct,save:{...save,progress:{...save.progress,lives:correct?lives:loseLife(lives,now),learningEvidence:evidence,reviewAttemptKeys:[...(save.progress.reviewAttemptKeys??[]),key].slice(-200)}}};
}

/** Free teaching changes only supported-learning history, including at zero lives. */
export function applyGuidedLearning(save: GameSave, lessonId: string, attemptId: string, now = Date.now()): GameSave {
  const lesson = LEARNING_CATALOG.lessons.find(l => l.id === lessonId);
  if (!lesson?.skillId || !attemptId || save.progress.guidedAttemptIds?.includes(attemptId)) return save;
  return { ...save, progress: { ...save.progress,
    guidedAttemptIds: [...(save.progress.guidedAttemptIds ?? []), attemptId].slice(-200),
    learningEvidence: recordGuidedLearning(save.progress.learningEvidence, lesson.skillId, now),
  } };
}
