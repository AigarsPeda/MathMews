import type { CatDecorationId } from "@/constants/cat-decorations";

export function isAirConditionerDecorationId(id: string): boolean {
  return id === "livingAirCon" || id === "officeAc";
}

/** Foliage moves above this height; the pot and root stay fixed. Cacti stay still. */
export const PLANT_FOLIAGE_SPLIT: Partial<Record<CatDecorationId, number>> = {
  plantSmall: 0.6,
  plantA: 0.6,
  plantB: 0.6,
  plantE: 0.58,
  plantPotted: 0.58,
  plantSunflower: 0.7,
  plantTallGreen: 0.58,
  plantTallPink: 0.58,
  plantTallBlue: 0.58,
  plantTallPurple: 0.58,
};
