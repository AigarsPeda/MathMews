export type CoinTransactionKind =
  | "iap_purchase"
  | "puzzle_reward"
  | "pet_feed"
  | "pet_play_box"
  | "life_purchase"
  | "visual_help"
  | "store_room"
  | "store_bed"
  | "store_toy"
  | "store_decoration"
  | "store_skin";

export type CoinTransaction = {
  id: string;
  kind: CoinTransactionKind;
  /** Positive = earned, negative = spent. */
  amount: number;
  balanceAfter: number;
  at: number;
  itemId?: string;
  productId?: string;
  transactionId?: string;
  priceString?: string;
  label?: string;
};

export type CoinTransactionInput = {
  kind: CoinTransactionKind;
  itemId?: string;
  productId?: string;
  transactionId?: string;
  priceString?: string;
  label?: string;
};
