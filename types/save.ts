import type { PetProfile, Progress, Wallet } from "@/types/game";
import type { CoinTransaction } from "@/types/coin-transaction";

export const GAME_SAVE_VERSION = 1 as const;
export const GAME_SAVE_STORAGE_KEY = "@brainpet/game-save";
export const PET_NAME_MAX_LENGTH = 20;

export type GameSave = {
  version: typeof GAME_SAVE_VERSION;
  pet: PetProfile;
  wallet: Wallet;
  progress: Progress;
  hasCompletedOnboarding: boolean;
  /** Unix ms when the player finished onboarding / started this game. */
  startedAt?: number;
  /** Recent coin earns/spends for history UI and cloud sync. */
  coinTransactions?: CoinTransaction[];
};
