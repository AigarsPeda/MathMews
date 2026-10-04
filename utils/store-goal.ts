import prices from "@/data/store-prices.json";
import type { Progress } from "@/types/game";

export function getStoreGoalDetails(goal: Progress["storeGoal"], coins: number, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!goal) return null;
  const table = prices[goal.kind] as Record<string, number>;
  const amount = table?.[goal.id];
  if (!Number.isFinite(amount)) return null;
  const name = goal.kind === "room" ? t("store.roomName", { number: Number(goal.id.replace("room", "")) })
    : t(`store.${goal.kind === "skin" ? "skin" : goal.kind}Name.${goal.id}`).replace(/\n/g, " ");
  return { name, amount, remaining: Math.max(0, amount - coins) };
}
