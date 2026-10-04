import STORE_PRICES from "@/data/store-prices.json";
import {
  CAT_BED_IDS,
  isCatBedId,
  resolveCatBedId,
  type CatBedId,
} from "@/constants/cat-beds";
import type { BedPurchaseResult, StorePrice } from "@/types/store";






/** Catalog pricing — change amounts here; swap kind to `iap` per bed later. */
export function getBedStorePrice(bedId: CatBedId): StorePrice {
  const amount = STORE_PRICES.bed[bedId];
  return amount === 0 ? { kind: "free" } : { kind: "coins", amount };
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

export function tryPurchaseBed(params: {
  bedId: CatBedId;
  walletCoins: number;
  bedsUnlocked: CatBedId[];
}): {
  result: BedPurchaseResult;
  walletCoins: number;
  bedsUnlocked: CatBedId[];
} {
  const bedId = resolveCatBedId(params.bedId);
  if (!bedId) {
    return {
      result: "invalid_item",
      walletCoins: params.walletCoins,
      bedsUnlocked: params.bedsUnlocked,
    };
  }

  const price = getBedStorePrice(bedId);

  if (price.kind === "iap") {
    return {
      result: "not_for_sale",
      walletCoins: params.walletCoins,
      bedsUnlocked: params.bedsUnlocked,
    };
  }

  if (isBedUnlocked(bedId, params.bedsUnlocked)) {
    return {
      result: "already_owned",
      walletCoins: params.walletCoins,
      bedsUnlocked: params.bedsUnlocked,
    };
  }

  if (price.kind === "free") {
    return {
      result: "purchased",
      walletCoins: params.walletCoins,
      bedsUnlocked: [...params.bedsUnlocked, bedId],
    };
  }

  if (params.walletCoins < price.amount) {
    return {
      result: "insufficient_funds",
      walletCoins: params.walletCoins,
      bedsUnlocked: params.bedsUnlocked,
    };
  }

  return {
    result: "purchased",
    walletCoins: params.walletCoins - price.amount,
    bedsUnlocked: [...params.bedsUnlocked, bedId],
  };
}
