import {
  CAT_SKIN_IDS,
  isCatSkinId,
  type CatSkinId,
} from "@/constants/cat-skins";
import type { SkinPurchaseResult } from "@/types/store";

const SKIN_ORDER: CatSkinId[] = ["orange", "grey", "white"];

function skinIndex(skinId: CatSkinId): number {
  const index = SKIN_ORDER.indexOf(skinId);
  return index >= 0 ? index : 0;
}

/** Store pricing — starter color is unlocked at onboarding, not sold free here. */
export function getSkinStorePrice(
  skinId: CatSkinId,
): { kind: "coins"; amount: number } {
  const index = skinIndex(skinId);
  return { kind: "coins", amount: 20 + index * 10 };
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

  if (params.walletCoins < price.amount) {
    return {
      result: "insufficient_funds",
      walletCoins: params.walletCoins,
      skinsUnlocked: params.skinsUnlocked,
    };
  }

  return {
    result: "purchased",
    walletCoins: params.walletCoins - price.amount,
    skinsUnlocked: [...params.skinsUnlocked, skinId],
  };
}
