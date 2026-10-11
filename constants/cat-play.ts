import { BOX_PLAY_HAPPINESS_BOOST } from "@/constants/game";

/** All play activities are free, even at full happiness. */
export const CAT_PLAY_ACTIVITIES = [
  { id: "ball", icon: "ball", happinessBoost: 12, mood: "playBall" },
  { id: "box", icon: "box", happinessBoost: BOX_PLAY_HAPPINESS_BOOST, mood: "playBox" },
  { id: "yarn", icon: "play", happinessBoost: 22, mood: "playYarn" },
  { id: "feather", icon: "feather", happinessBoost: 28, mood: "playFeather" },
] as const;

export type CatPlayActivity = (typeof CAT_PLAY_ACTIVITIES)[number];

export function getCatPlayActivity(id: string): CatPlayActivity | undefined {
  return CAT_PLAY_ACTIVITIES.find((activity) => activity.id === id);
}

/** Placed-object play uses the same care reward as the matching cat action. */
export function getRoomPlayHappinessBoost(kind: string, modelId?: string): number {
  if (kind !== "toyPlay" && kind !== "mouseChase" && kind !== "plantPlay") return 0;
  return getCatPlayActivity(modelId?.startsWith("yarn") ? "yarn" : "ball")!.happinessBoost;
}
