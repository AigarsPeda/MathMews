/** How a store item is priced — swap `coins` for `iap` per room when ready. */
type Promotion = { originalAmount?: number; promotion?: string; promotionEndsAt?: string };
export type StorePrice =
  | ({ kind: "free" } & Promotion)
  | ({ kind: "coins"; amount: number } & Promotion)
  | { kind: "iap"; productId: string };

export type StorePurchaseResult =
  | "unavailable"
  | "price_changed"
  | "purchased"
  | "queued"
  | "already_owned"
  | "insufficient_funds"
  | "not_for_sale";

export type RoomPurchaseResult = StorePurchaseResult | "invalid_room";

export type BedPurchaseResult = StorePurchaseResult | "invalid_item";

export type ToyPurchaseResult = StorePurchaseResult | "invalid_item";

export type DecorationPurchaseResult = StorePurchaseResult | "invalid_item";

export type SkinPurchaseResult = StorePurchaseResult | "invalid_item";
