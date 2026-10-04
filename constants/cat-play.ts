import { BOX_PLAY_HAPPINESS_BOOST } from "@/constants/game";

/** All play activities are free, even at full happiness. */
export const CAT_PLAY_ACTIVITIES = [
  { id: "ball", emoji: "⚽", happinessBoost: 12, mood: "playBall" },
  { id: "box", emoji: "📦", happinessBoost: BOX_PLAY_HAPPINESS_BOOST, mood: "playBox" },
  { id: "yarn", emoji: "🧶", happinessBoost: 22, mood: "playYarn" },
  { id: "feather", emoji: "🪶", happinessBoost: 28, mood: "playFeather" },
] as const;

export type CatPlayActivity = (typeof CAT_PLAY_ACTIVITIES)[number];

export function getCatPlayActivity(id: string): CatPlayActivity | undefined {
  return CAT_PLAY_ACTIVITIES.find((activity) => activity.id === id);
}
