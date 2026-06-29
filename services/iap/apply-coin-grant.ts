import type { Wallet } from "@/types/game";

export function applyCoinGrant(wallet: Wallet, coins: number): Wallet {
  if (coins <= 0) return wallet;
  return { ...wallet, coins: wallet.coins + coins };
}
