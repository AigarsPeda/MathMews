/** How a store item is priced — swap `coins` for `iap` per room when ready. */
export type StorePrice =
  | { kind: "free" }
  | { kind: "coins"; amount: number }
  | { kind: "iap"; productId: string };

export type StorePurchaseResult =
  | "purchased"
  | "already_owned"
  | "insufficient_funds"
  | "not_for_sale";

export type RoomPurchaseResult = StorePurchaseResult | "invalid_room";

export type BedPurchaseResult = StorePurchaseResult | "invalid_item";

export type ToyPurchaseResult = StorePurchaseResult | "invalid_item";

export type DecorationPurchaseResult = StorePurchaseResult | "invalid_item";
