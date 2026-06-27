import {
  CAT_TOY_IDS,
  isCatToyId,
  isLargeToyId,
  resolveCatToyId,
  type CatToyId,
} from "@/constants/cat-toys";
import type { StorePrice, ToyPurchaseResult } from "@/types/store";

const TOY_ORDER: CatToyId[] = [
  "orangeBall",
  "blueBall",
  "pinkBall",
  "mouse",
  "scratchPostGreen",
  "scratchPostBlue",
  "scratchPostPurple",
  "scratchPostRed",
];

function toyIndex(toyId: CatToyId): number {
  const index = TOY_ORDER.indexOf(toyId);
  return index >= 0 ? index : 0;
}

/** Catalog pricing — change amounts here; swap kind to `iap` per toy later. */
export function getToyStorePrice(toyId: CatToyId): StorePrice {
  const index = toyIndex(toyId);
  if (index <= 0) {
    return { kind: "free" };
  }
  if (isLargeToyId(toyId)) {
    return { kind: "coins", amount: 22 + (index - 4) * 6 };
  }
  return { kind: "coins", amount: 8 + index * 4 };
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

export function tryPurchaseToy(params: {
  toyId: CatToyId;
  walletCoins: number;
  toysUnlocked: CatToyId[];
}): {
  result: ToyPurchaseResult;
  walletCoins: number;
  toysUnlocked: CatToyId[];
} {
  const toyId = resolveCatToyId(params.toyId);
  if (!toyId) {
    return {
      result: "invalid_item",
      walletCoins: params.walletCoins,
      toysUnlocked: params.toysUnlocked,
    };
  }

  const price = getToyStorePrice(toyId);

  if (price.kind === "iap") {
    return {
      result: "not_for_sale",
      walletCoins: params.walletCoins,
      toysUnlocked: params.toysUnlocked,
    };
  }

  if (isToyUnlocked(toyId, params.toysUnlocked)) {
    return {
      result: "already_owned",
      walletCoins: params.walletCoins,
      toysUnlocked: params.toysUnlocked,
    };
  }

  if (price.kind === "free") {
    return {
      result: "purchased",
      walletCoins: params.walletCoins,
      toysUnlocked: [...params.toysUnlocked, toyId],
    };
  }

  if (params.walletCoins < price.amount) {
    return {
      result: "insufficient_funds",
      walletCoins: params.walletCoins,
      toysUnlocked: params.toysUnlocked,
    };
  }

  return {
    result: "purchased",
    walletCoins: params.walletCoins - price.amount,
    toysUnlocked: [...params.toysUnlocked, toyId],
  };
}
