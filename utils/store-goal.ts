import { getStoreCoinPrice } from "@/utils/store-catalog";
import type { Progress } from "@/types/game";

export function getStoreGoalDetails(goal: Progress["storeGoal"], coins: number, t: (key: string, options?: Record<string, unknown>) => string,
  amount = goal ? getStoreCoinPrice(goal.kind, goal.id) : undefined) {
  if (!goal) return null;
  if (amount === undefined) return null;
  const name = goal.kind === "room" ? t(`store.roomStyles.${goal.id}.name`)
    : t(`store.${goal.kind === "skin" ? "skin" : goal.kind}Name.${goal.id}`).replace(/\n/g, " ");
  return { name, amount, remaining: Math.max(0, amount - coins) };
}
