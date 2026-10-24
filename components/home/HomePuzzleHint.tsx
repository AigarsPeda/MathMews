import { IconText as Text } from '@/components/ui/IconText';
import { getStoreCoinPrice, subscribeStoreCatalog } from '@/utils/store-catalog';
import type { Progress } from '@/types/game';
import { getStoreGoalDetails } from '@/utils/store-goal';
import { memo, useCallback, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, TextStyle } from 'react-native';

/** Price updates only affect the saving hint, not the preloaded room tree. */
export const HomePuzzleHint = memo(function HomePuzzleHint({ goal, coins, petName, style }: {
  goal: Progress['storeGoal']; coins: number; petName: string; style: StyleProp<TextStyle>;
}) {
  const getPrice = useCallback(() => goal ? getStoreCoinPrice(goal.kind, goal.id) : undefined, [goal]);
  const amount = useSyncExternalStore(subscribeStoreCatalog, getPrice, getPrice);
  const { t } = useTranslation();
  const savingGoal = getStoreGoalDetails(goal, coins, t, amount);
  return <Text style={style}>{savingGoal
    ? t('store.goalProgress', { name: savingGoal.name, remaining: savingGoal.remaining })
    : t('home.solvePuzzleHint', { name: petName })}</Text>;
});
