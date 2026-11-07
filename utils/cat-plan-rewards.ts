import { CAT_PLAN_REWARDS } from '@/constants/cat-plan-rewards';
import type { GameSave } from '@/types/save';
import { getDecorationOwnedCount } from '@/utils/decoration-store';
import { lifetimePuzzleIds } from '@/utils/reset-puzzle-progress';

/** Inventory and its receipt are saved together, including while offline. */
export function grantCatPlanRewards(save: GameSave): GameSave {
  const completed = new Set(lifetimePuzzleIds(save.progress));
  let next = save;
  for (const reward of CAT_PLAN_REWARDS) {
    if (next.progress.catPlanRewardsClaimed?.includes(reward.lessonId) || !reward.puzzleIds.every(id => completed.has(id))) continue;
    const progress = next.progress;
    next = { ...next, progress: { ...progress,
      catPlanRewardsClaimed: [...(progress.catPlanRewardsClaimed ?? []), reward.lessonId],
      decorationsUnlocked: [...new Set([...progress.decorationsUnlocked, reward.decorationId])],
      decorationQuantities: { ...progress.decorationQuantities,
        [reward.decorationId]: getDecorationOwnedCount(reward.decorationId, progress) + 1 },
      storeGoal: progress.storeGoal?.kind === 'decoration' && progress.storeGoal.id === reward.decorationId ? undefined : progress.storeGoal,
    } };
  }
  return next;
}
