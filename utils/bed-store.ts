import { getCatalogStorePrice } from "@/utils/store-catalog";
import {
  CAT_BED_IDS,
  isCatBedId,
  type CatBedId,
} from "@/constants/cat-beds";
import type { StorePrice } from "@/types/store";

/** Current server price, with bundled display defaults while offline. */
export function getBedStorePrice(bedId: CatBedId): StorePrice {
  return getCatalogStorePrice("bed", bedId);
}

export function isBedUnlocked(
  bedId: CatBedId,
  bedsUnlocked: CatBedId[],
): boolean {
  return bedsUnlocked.includes(bedId);
}

export function normalizeBedsUnlocked(
  value: unknown,
  equippedBedId: CatBedId | undefined,
): CatBedId[] {
  const unlocked = new Set<CatBedId>();

  if (equippedBedId) {
    unlocked.add(equippedBedId);
  }

  if (Array.isArray(value)) {
    for (const id of value) {
      if (typeof id === "string" && isCatBedId(id)) {
        unlocked.add(id);
      }
    }
  }

  return CAT_BED_IDS.filter((id) => unlocked.has(id));
}
