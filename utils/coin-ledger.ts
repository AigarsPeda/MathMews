import type { GameSave } from "@/types/save";
import type { CoinTransaction, CoinTransactionInput } from "@/types/coin-transaction";

export const MAX_COIN_TRANSACTIONS = 150;

export function createCoinTransactionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeCoinTransactions(value: unknown): CoinTransaction[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => {
      return typeof entry === "object" && entry !== null;
    })
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : createCoinTransactionId(),
      kind:
        typeof entry.kind === "string"
          ? (entry.kind as CoinTransaction["kind"])
          : "puzzle_reward",
      amount: typeof entry.amount === "number" ? entry.amount : 0,
      balanceAfter:
        typeof entry.balanceAfter === "number" ? entry.balanceAfter : 0,
      at: typeof entry.at === "number" ? entry.at : Date.now(),
      itemId: typeof entry.itemId === "string" ? entry.itemId : undefined,
      productId:
        typeof entry.productId === "string" ? entry.productId : undefined,
      transactionId:
        typeof entry.transactionId === "string"
          ? entry.transactionId
          : undefined,
      priceString:
        typeof entry.priceString === "string" ? entry.priceString : undefined,
      label: typeof entry.label === "string" ? entry.label : undefined,
    }))
    .slice(-MAX_COIN_TRANSACTIONS);
}

export function appendCoinTransaction(
  existing: CoinTransaction[] | undefined,
  transaction: CoinTransaction,
): CoinTransaction[] {
  return [...(existing ?? []), transaction].slice(-MAX_COIN_TRANSACTIONS);
}

export function withCoinDelta(
  save: GameSave,
  delta: number,
  meta: CoinTransactionInput,
): GameSave | null {
  const balanceAfter = save.wallet.coins + delta;
  if (balanceAfter < 0) return null;

  return {
    ...save,
    wallet: { coins: balanceAfter },
    coinTransactions: appendCoinTransaction(save.coinTransactions, {
      id: createCoinTransactionId(),
      kind: meta.kind,
      amount: delta,
      balanceAfter,
      at: Date.now(),
      itemId: meta.itemId,
      productId: meta.productId,
      transactionId: meta.transactionId,
      priceString: meta.priceString,
      label: meta.label,
    }),
  };
}
