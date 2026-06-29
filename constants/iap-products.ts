/** Consumable coin packs — product IDs must match App Store Connect / Play Console. */
export const COIN_PACK_PRODUCTS = {
  brainpet_coins_100: { coins: 100 },
  brainpet_coins_500: { coins: 500 },
  brainpet_coins_1200: { coins: 1200 },
} as const;

export type CoinPackProductId = keyof typeof COIN_PACK_PRODUCTS;

export const COIN_PACK_PRODUCT_IDS = Object.keys(
  COIN_PACK_PRODUCTS,
) as CoinPackProductId[];
