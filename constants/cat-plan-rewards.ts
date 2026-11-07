import type { CatDecorationId } from '@/constants/cat-decorations';

/** One usable furnishing per ten-task plan, kept stable across replays and resets. */
const decorations: Record<string, CatDecorationId> = {
  'easy-cat-plans-picnic': 'kitchenBreadBasket',
  'easy-cat-plans-reading-corner': 'booksPile',
  'easy-cat-plans-cat-party': 'rugFlowerPink',
  'medium-cat-plans-picnic': 'rugBraidedRound',
  'medium-cat-plans-reading-corner': 'lampTableMushroom',
  'medium-cat-plans-cat-party': 'livingSpeaker',
  'hard-cat-plans-picnic': 'kitchenDiningTable',
  'hard-cat-plans-reading-corner': 'chairRockingOak',
  'hard-cat-plans-cat-party': 'tablePink',
};
export const CAT_PLAN_REWARDS = Object.entries(decorations).map(([lessonId, decorationId]) => ({
  lessonId, decorationId, puzzleIds: Array.from({ length: 10 }, (_, index) => `v2-${lessonId}-${index + 1}`),
}));
export const getCatPlanReward = (lessonId: string) => CAT_PLAN_REWARDS.find(reward => reward.lessonId === lessonId);
