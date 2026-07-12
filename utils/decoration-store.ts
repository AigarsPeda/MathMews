import {
  ANIMATED_DECORATION_IDS,
  CARPET_DECORATION_IDS,
  CAT_DECORATION_IDS,
  CHAIR_DECORATION_IDS,
  COMPUTER_ANIMATED_DECORATION_IDS,
  COMPUTER_DECORATION_IDS,
  CONSOLE_DECORATION_IDS,
  DESK_DECORATION_IDS,
  FURNITURE_DECORATION_IDS,
  LAVA_LAMP_DECORATION_IDS,
  isAnimatedDecorationId,
  isCarpetDecorationId,
  isChairDecorationId,
  isComputerDecorationId,
  isConsoleDecorationId,
  isDeskDecorationId,
  isLavaLampDecorationId,
  resolveCatDecorationId,
  type CatDecorationId,
} from "@/constants/cat-decorations";
import {
  isCanonicalDecorationStoreId,
  resolveDecorationPlacement,
} from "@/constants/decoration-variants";
import {
  JAPANESE_DECORATION_CATALOG,
  JAPANESE_DECORATION_IDS,
  isJapaneseDecorationId,
} from "@/constants/japanese-decorations";
import {
  LIVING_ROOM_DECORATION_IDS,
  isLivingRoomDecorationId,
} from "@/constants/living-room-decorations";
import {
  OFFICE_DECORATION_CATALOG,
  OFFICE_DECORATION_IDS,
  isOfficeDecorationId,
} from "@/constants/office-decorations";
import {
  BATHROOM_DECORATION_CATALOG,
  BATHROOM_DECORATION_IDS,
  isBathroomDecorationId,
} from "@/constants/bathroom-decorations";
import {
  BOOKS_DECORATION_IDS,
  isBooksDecorationId,
} from "@/constants/books-decorations";
import {
  CAT_SUPPLIES_DECORATION_IDS,
  isCatSuppliesDecorationId,
} from "@/constants/cat-supplies-decorations";
import {
  PLANT_DECORATION_IDS,
  isPlantDecorationId,
} from "@/constants/plant-decorations";
import {
  POSTER_DECORATION_IDS,
  isPosterDecorationId,
} from "@/constants/poster-decorations";
import {
  SOFA_DECORATION_IDS,
  isSofaDecorationId,
} from "@/constants/sofa-decorations";
import {
  TV_DECORATION_CATALOG,
  TV_DECORATION_IDS,
  isTvDecorationId,
} from "@/constants/tv-decorations";
import {
  WINDOW_DECORATION_IDS,
  isWindowDecorationId,
} from "@/constants/window-decorations";
import type { DecorationPurchaseResult, StorePrice } from "@/types/store";
import type { PlacedDecoration, Progress } from "@/types/game";
import { countPlacedDecorations } from "@/utils/room-placement";

const DECORATION_ORDER: CatDecorationId[] = [...CAT_DECORATION_IDS];

const COMPUTER_ANIMATED_ID_SET = new Set<string>(
  COMPUTER_ANIMATED_DECORATION_IDS,
);

function isComputerStoreDecorationId(
  decorationId: CatDecorationId,
): boolean {
  return (
    isComputerDecorationId(decorationId) ||
    COMPUTER_ANIMATED_ID_SET.has(decorationId)
  );
}

function isFurnitureDecorationId(decorationId: CatDecorationId): boolean {
  return FURNITURE_DECORATION_ID_SET.has(decorationId);
}

export const CARPET_DECORATION_STORE_IDS = [...CARPET_DECORATION_IDS];

export const CHAIR_DECORATION_STORE_IDS = CHAIR_DECORATION_IDS.filter((id) =>
  isCanonicalDecorationStoreId(id),
);

export const DESK_DECORATION_STORE_IDS = DESK_DECORATION_IDS.filter((id) =>
  isCanonicalDecorationStoreId(id),
);

export const COMPUTER_DECORATION_STORE_IDS: CatDecorationId[] = [
  ...COMPUTER_DECORATION_IDS.filter((id) => isCanonicalDecorationStoreId(id)),
  ...COMPUTER_ANIMATED_DECORATION_IDS,
];

export const CONSOLE_DECORATION_STORE_IDS = [...CONSOLE_DECORATION_IDS];

export const FURNITURE_DECORATION_STORE_IDS = [...FURNITURE_DECORATION_IDS];

const FURNITURE_DECORATION_ID_SET = new Set<string>(FURNITURE_DECORATION_IDS);

export const JAPANESE_DECORATION_STORE_IDS = [...JAPANESE_DECORATION_IDS];

export const LIVING_ROOM_DECORATION_STORE_IDS = [...LIVING_ROOM_DECORATION_IDS];

export const OFFICE_DECORATION_STORE_IDS = [...OFFICE_DECORATION_IDS];

export const BATHROOM_DECORATION_STORE_IDS = [...BATHROOM_DECORATION_IDS];

export const BOOKS_DECORATION_STORE_IDS = [...BOOKS_DECORATION_IDS];

export const CAT_SUPPLIES_DECORATION_STORE_IDS = [...CAT_SUPPLIES_DECORATION_IDS];

export const PLANT_DECORATION_STORE_IDS = [...PLANT_DECORATION_IDS];

export const POSTER_DECORATION_STORE_IDS = [...POSTER_DECORATION_IDS];

export const SOFA_DECORATION_STORE_IDS = SOFA_DECORATION_IDS.filter((id) =>
  isCanonicalDecorationStoreId(id),
);

export const TV_DECORATION_STORE_IDS = [...TV_DECORATION_IDS];

export const WINDOW_DECORATION_STORE_IDS = WINDOW_DECORATION_IDS.filter((id) =>
  isCanonicalDecorationStoreId(id),
);

function decorationIndex(decorationId: CatDecorationId): number {
  const index = DECORATION_ORDER.indexOf(decorationId);
  return index >= 0 ? index : 0;
}

/** Catalog pricing — change amounts here; swap kind to `iap` per item later. */
export function getDecorationStorePrice(
  decorationId: CatDecorationId,
): StorePrice {
  if (isCarpetDecorationId(decorationId)) {
    const carpetIndex = CARPET_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 35 + carpetIndex * 8 };
  }

  if (isChairDecorationId(decorationId)) {
    const chairIndex = CHAIR_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 40 + chairIndex * 7 };
  }

  if (isDeskDecorationId(decorationId)) {
    const deskIndex = DESK_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 60 + deskIndex * 12 };
  }

  if (isComputerStoreDecorationId(decorationId)) {
    const computerIndex = COMPUTER_DECORATION_STORE_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 45 + computerIndex * 4 };
  }

  if (isConsoleDecorationId(decorationId)) {
    const consoleIndex = CONSOLE_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 50 + consoleIndex * 5 };
  }

  if (isLavaLampDecorationId(decorationId)) {
    return { kind: "coins", amount: 45 };
  }

  if (isFurnitureDecorationId(decorationId)) {
    const furnitureIndex = FURNITURE_DECORATION_STORE_IDS.findIndex(
      (id) => id === decorationId,
    );
    if (furnitureIndex <= 0) {
      return { kind: "free" };
    }
    return { kind: "coins", amount: 20 + furnitureIndex * 4 };
  }

  if (isJapaneseDecorationId(decorationId)) {
    const japaneseIndex = JAPANESE_DECORATION_IDS.indexOf(decorationId);
    const entry = JAPANESE_DECORATION_CATALOG[decorationId];
    if ("frames" in entry) {
      return { kind: "coins", amount: 95 + japaneseIndex * 3 };
    }
    return { kind: "coins", amount: 55 + japaneseIndex * 5 };
  }

  if (isLivingRoomDecorationId(decorationId)) {
    const livingIndex = LIVING_ROOM_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 50 + livingIndex * 8 };
  }

  if (isOfficeDecorationId(decorationId)) {
    const officeIndex = OFFICE_DECORATION_IDS.indexOf(decorationId);
    const entry = OFFICE_DECORATION_CATALOG[decorationId];
    if ("frames" in entry) {
      return { kind: "coins", amount: 80 + officeIndex * 4 };
    }
    return { kind: "coins", amount: 45 + officeIndex * 3 };
  }

  if (isBathroomDecorationId(decorationId)) {
    const bathroomIndex = BATHROOM_DECORATION_IDS.indexOf(decorationId);
    const entry = BATHROOM_DECORATION_CATALOG[decorationId];
    if ("frames" in entry) {
      return { kind: "coins", amount: 75 + bathroomIndex * 5 };
    }
    return { kind: "coins", amount: 40 + bathroomIndex * 4 };
  }

  if (isBooksDecorationId(decorationId)) {
    const booksIndex = BOOKS_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 30 + booksIndex * 5 };
  }

  if (isCatSuppliesDecorationId(decorationId)) {
    const catIndex = CAT_SUPPLIES_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 35 + catIndex * 6 };
  }

  if (isPlantDecorationId(decorationId)) {
    const plantIndex = PLANT_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 40 + plantIndex * 6 };
  }

  if (isPosterDecorationId(decorationId)) {
    const posterIndex = POSTER_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 35 + posterIndex * 5 };
  }

  if (isSofaDecorationId(decorationId)) {
    const sofaIndex = SOFA_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 55 + sofaIndex * 10 };
  }

  if (isTvDecorationId(decorationId)) {
    const tvIndex = TV_DECORATION_IDS.indexOf(decorationId);
    const entry = TV_DECORATION_CATALOG[decorationId];
    if ("frames" in entry) {
      return { kind: "coins", amount: 85 + tvIndex * 20 };
    }
    return { kind: "coins", amount: 50 };
  }

  if (isWindowDecorationId(decorationId)) {
    const windowIndex = WINDOW_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 45 + windowIndex * 6 };
  }

  if (isAnimatedDecorationId(decorationId)) {
    const animatedIndex = ANIMATED_DECORATION_IDS.indexOf(decorationId);
    return { kind: "coins", amount: 75 + animatedIndex * 15 };
  }

  const index = decorationIndex(decorationId);
  if (index <= 0) {
    return { kind: "free" };
  }
  return { kind: "coins", amount: 12 + index * 3 };
}

export function isDecorationUnlocked(
  decorationId: CatDecorationId,
  decorationsUnlocked: CatDecorationId[],
): boolean {
  return decorationsUnlocked.includes(decorationId);
}

export function normalizeDecorationsUnlocked(
  value: unknown,
  placedDecorationIds: CatDecorationId[] = [],
): CatDecorationId[] {
  const unlocked = new Set<CatDecorationId>();

  for (const id of placedDecorationIds) {
    unlocked.add(id);
  }

  if (Array.isArray(value)) {
    for (const id of value) {
      if (typeof id === "string") {
        const resolved = resolveCatDecorationId(id);
        if (resolved) {
          const placement = resolveDecorationPlacement(resolved);
          if (placement) {
            unlocked.add(placement.decorationId);
          }
        }
      }
    }
  }

  return CAT_DECORATION_IDS.filter((id) => unlocked.has(id));
}

export function getDecorationOwnedCount(
  decorationId: CatDecorationId,
  progress: Pick<Progress, "decorationsUnlocked" | "decorationQuantities">,
): number {
  if (!isDecorationUnlocked(decorationId, progress.decorationsUnlocked as CatDecorationId[])) {
    return 0;
  }

  const saved = progress.decorationQuantities?.[decorationId];
  return typeof saved === "number" && saved > 0 ? saved : 1;
}

export function normalizeDecorationQuantities(
  value: unknown,
  decorationsUnlocked: CatDecorationId[],
  placedDecorations: PlacedDecoration[] = [],
): Record<string, number> {
  const quantities: Record<string, number> = {};

  if (value && typeof value === "object") {
    for (const [id, count] of Object.entries(value as Record<string, unknown>)) {
      const resolved = resolveCatDecorationId(id);
      if (resolved && typeof count === "number" && count > 0) {
        quantities[resolved] = count;
      }
    }
  }

  for (const id of decorationsUnlocked) {
    if ((quantities[id] ?? 0) < 1) {
      quantities[id] = 1;
    }
  }

  for (const id of decorationsUnlocked) {
    const placedCount = countPlacedDecorations(id, placedDecorations);
    if (placedCount > (quantities[id] ?? 0)) {
      quantities[id] = placedCount;
    }
  }

  return quantities;
}

export function tryPurchaseDecoration(params: {
  decorationId: CatDecorationId;
  walletCoins: number;
  decorationsUnlocked: CatDecorationId[];
}): {
  result: DecorationPurchaseResult;
  walletCoins: number;
  decorationsUnlocked: CatDecorationId[];
} {
  const decorationId = resolveCatDecorationId(params.decorationId);
  if (!decorationId) {
    return {
      result: "invalid_item",
      walletCoins: params.walletCoins,
      decorationsUnlocked: params.decorationsUnlocked,
    };
  }

  const price = getDecorationStorePrice(decorationId);

  if (price.kind === "iap") {
    return {
      result: "not_for_sale",
      walletCoins: params.walletCoins,
      decorationsUnlocked: params.decorationsUnlocked,
    };
  }

  const alreadyUnlocked = isDecorationUnlocked(
    decorationId,
    params.decorationsUnlocked,
  );

  if (price.kind === "free") {
    return {
      result: "purchased",
      walletCoins: params.walletCoins,
      decorationsUnlocked: alreadyUnlocked
        ? params.decorationsUnlocked
        : [...params.decorationsUnlocked, decorationId],
    };
  }

  if (params.walletCoins < price.amount) {
    return {
      result: "insufficient_funds",
      walletCoins: params.walletCoins,
      decorationsUnlocked: params.decorationsUnlocked,
    };
  }

  return {
    result: "purchased",
    walletCoins: params.walletCoins - price.amount,
    decorationsUnlocked: alreadyUnlocked
      ? params.decorationsUnlocked
      : [...params.decorationsUnlocked, decorationId],
  };
}
