import {
  CAT_DECORATION_IDS,
  isCatDecorationId,
  resolveCatDecorationId,
  type CatDecorationId,
} from "@/constants/cat-decorations";
import type { DecorationPurchaseResult, StorePrice } from "@/types/store";

const DECORATION_ORDER: CatDecorationId[] = [...CAT_DECORATION_IDS];

function decorationIndex(decorationId: CatDecorationId): number {
  const index = DECORATION_ORDER.indexOf(decorationId);
  return index >= 0 ? index : 0;
}

/** Catalog pricing — change amounts here; swap kind to `iap` per item later. */
export function getDecorationStorePrice(
  decorationId: CatDecorationId,
): StorePrice {
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
      if (typeof id === "string" && isCatDecorationId(id)) {
        unlocked.add(id);
      }
    }
  }

  return CAT_DECORATION_IDS.filter((id) => unlocked.has(id));
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

  if (isDecorationUnlocked(decorationId, params.decorationsUnlocked)) {
    return {
      result: "already_owned",
      walletCoins: params.walletCoins,
      decorationsUnlocked: params.decorationsUnlocked,
    };
  }

  if (price.kind === "free") {
    return {
      result: "purchased",
      walletCoins: params.walletCoins,
      decorationsUnlocked: [...params.decorationsUnlocked, decorationId],
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
    decorationsUnlocked: [...params.decorationsUnlocked, decorationId],
  };
}
