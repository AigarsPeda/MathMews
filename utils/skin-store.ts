import { getCatalogStorePrice } from "@/utils/store-catalog";
import {
  CAT_SKIN_IDS,
  isCatSkinId,
  type CatSkinId,
} from "@/constants/cat-skins";
import type { StorePrice, SkinPurchaseResult } from "@/types/store";




/** Store pricing — starter color is unlocked at onboarding, not sold free here. */
export function getSkinStorePrice(
  skinId: CatSkinId,
): StorePrice {
  return getCatalogStorePrice("skin", skinId);
}

export function isSkinUnlocked(
  skinId: CatSkinId,
  skinsUnlocked: CatSkinId[],
): boolean {
  return skinsUnlocked.includes(skinId);
}

export function normalizeSkinsUnlocked(
  value: unknown,
  equippedSkinId: CatSkinId | undefined,
): CatSkinId[] {
  const unlocked = new Set<CatSkinId>();

  if (equippedSkinId) {
    unlocked.add(equippedSkinId);
  }

  if (Array.isArray(value)) {
    for (const id of value) {
      if (typeof id === "string" && isCatSkinId(id)) {
        unlocked.add(id);
      }
    }
  }

  return CAT_SKIN_IDS.filter((id) => unlocked.has(id));
}

export function tryPurchaseSkin(params: {
  skinId: CatSkinId;
  walletCoins: number;
  skinsUnlocked: CatSkinId[];
}): {
  result: SkinPurchaseResult;
  walletCoins: number;
  skinsUnlocked: CatSkinId[];
} {
  const skinId = params.skinId;

  if (isSkinUnlocked(skinId, params.skinsUnlocked)) {
    return {
      result: "already_owned",
      walletCoins: params.walletCoins,
      skinsUnlocked: params.skinsUnlocked,
    };
  }

  const price = getSkinStorePrice(skinId);
  if (price.kind === "iap") return { result: "not_for_sale", walletCoins: params.walletCoins, skinsUnlocked: params.skinsUnlocked };
  const amount = price.kind === "free" ? 0 : price.amount;

  if (params.walletCoins < amount) {
    return {
      result: "insufficient_funds",
      walletCoins: params.walletCoins,
      skinsUnlocked: params.skinsUnlocked,
    };
  }

  return {
    result: "purchased",
    walletCoins: params.walletCoins - amount,
    skinsUnlocked: [...params.skinsUnlocked, skinId],
  };
}
