import STORE_PRICES from "@/data/store-prices.json";
import {
  CARPET_DECORATION_IDS,
  CAT_DECORATION_IDS,
  CHAIR_DECORATION_IDS,
  COMPUTER_ANIMATED_DECORATION_IDS,
  COMPUTER_DECORATION_IDS,
  CONSOLE_DECORATION_IDS,
  DESK_DECORATION_IDS,
  FURNITURE_DECORATION_IDS,
  resolveCatDecorationId,
  type CatDecorationId,
} from "@/constants/cat-decorations";
import {
  isCanonicalDecorationStoreId,
  resolveDecorationPlacement,
} from "@/constants/decoration-variants";
import {
  JAPANESE_DECORATION_IDS,
} from "@/constants/japanese-decorations";
import {
  LIVING_ROOM_DECORATION_IDS,
} from "@/constants/living-room-decorations";
import {
  OFFICE_DECORATION_IDS,
} from "@/constants/office-decorations";
import {
  BATHROOM_DECORATION_IDS,
} from "@/constants/bathroom-decorations";
import {
  BOOKS_DECORATION_IDS,
} from "@/constants/books-decorations";
import {
  CAT_SUPPLIES_DECORATION_IDS,
} from "@/constants/cat-supplies-decorations";
import {
  PLANT_DECORATION_IDS,
} from "@/constants/plant-decorations";
import {
  POSTER_DECORATION_IDS,
} from "@/constants/poster-decorations";
import {
  SOFA_DECORATION_IDS,
} from "@/constants/sofa-decorations";
import {
  TV_DECORATION_IDS,
} from "@/constants/tv-decorations";
import {
  WINDOW_DECORATION_IDS,
} from "@/constants/window-decorations";
import type { DecorationPurchaseResult, StorePrice } from "@/types/store";
import type { PlacedDecoration, Progress } from "@/types/game";
import { countPlacedDecorations } from "@/utils/room-placement";

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



/** Catalog pricing — change amounts here; swap kind to `iap` per item later. */
export function getDecorationStorePrice(
  decorationId: CatDecorationId,
): StorePrice {
  const amount = STORE_PRICES.decoration[decorationId];
  return amount === 0 ? { kind: "free" } : { kind: "coins", amount };
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
