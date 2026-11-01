import { getCatalogStorePrice } from "@/utils/store-catalog";
import {
  CAT_TOY_IDS,
  isCatToyId,
  type CatToyId,
} from "@/constants/cat-toys";
import type { StorePrice } from "@/types/store";
import type { PlacedToy, Progress } from "@/types/game";
import { countPlacedToys } from "@/utils/room-placement";

/** Catalog pricing — change amounts here; swap kind to `iap` per toy later. */
export function getToyStorePrice(toyId: CatToyId): StorePrice {
  return getCatalogStorePrice("toy", toyId);
}

export function isToyUnlocked(
  toyId: CatToyId,
  toysUnlocked: CatToyId[],
): boolean {
  return toysUnlocked.includes(toyId);
}

export function normalizeToysUnlocked(
  value: unknown,
  placedToyIds: CatToyId[] = [],
): CatToyId[] {
  const unlocked = new Set<CatToyId>();

  for (const id of placedToyIds) {
    unlocked.add(id);
  }

  if (Array.isArray(value)) {
    for (const id of value) {
      if (typeof id === "string" && isCatToyId(id)) {
        unlocked.add(id);
      }
    }
  }

  return CAT_TOY_IDS.filter((id) => unlocked.has(id));
}

export function getToyOwnedCount(
  toyId: CatToyId,
  progress: Pick<Progress, "toysUnlocked" | "toyQuantities">,
): number {
  if (!isToyUnlocked(toyId, progress.toysUnlocked as CatToyId[])) {
    return 0;
  }

  const saved = progress.toyQuantities?.[toyId];
  return typeof saved === "number" && saved > 0 ? saved : 1;
}

export function normalizeToyQuantities(
  value: unknown,
  toysUnlocked: CatToyId[],
  placedToys: PlacedToy[] = [],
): Record<string, number> {
  const quantities: Record<string, number> = {};

  if (value && typeof value === "object") {
    for (const [id, count] of Object.entries(value as Record<string, unknown>)) {
      if (isCatToyId(id) && typeof count === "number" && count > 0) {
        quantities[id] = count;
      }
    }
  }

  for (const id of toysUnlocked) {
    if ((quantities[id] ?? 0) < 1) {
      quantities[id] = 1;
    }
  }

  for (const id of toysUnlocked) {
    const placedCount = countPlacedToys(id, placedToys);
    if (placedCount > (quantities[id] ?? 0)) {
      quantities[id] = placedCount;
    }
  }

  return quantities;
}
