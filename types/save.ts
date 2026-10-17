import { getWalletEnvironment } from "@/services/wallet/environment";
import type { PetProfile, Progress, Wallet } from "@/types/game";
import type { CoinTransaction } from "@/types/coin-transaction";

export const GAME_SAVE_VERSION = 1 as const;
export const GAME_SAVE_STORAGE_KEY = getWalletEnvironment() === "sandbox" ? "@mathmews/game-save" : "@mathmews/production/game-save";
export const PET_NAME_MAX_LENGTH = 20;

export type GameSave = {
  /** The account that owns this local pet. Account linking keeps the same ID. */
  accountOwnerId?: string;
  walletAuthority?: { user_id: string; environment: string; balance: number; revision: number };
  appliedWalletOrderIds?: string[];
  pendingCoinRewards?: { userId: string; environment: string; puzzleId: string; attemptId: string }[];
  worldClock?: import('@/utils/world-clock').WorldClock;
  version: typeof GAME_SAVE_VERSION;
  pet: PetProfile;
  wallet: Wallet;
  progress: Progress;
  hasCompletedOnboarding: boolean;
  /** Unix ms when the player finished onboarding / started this game. */
  startedAt?: number;
  /** Recent coin earns/spends for history UI and cloud sync. */
  coinTransactions?: CoinTransaction[];
  /** Durable receipt IDs, independent of the bounded history shown in the UI. */
  creditedPurchaseIds?: string[];
};
