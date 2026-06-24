import { LIFE_BUY_COST } from "@/constants/game";
import { resolveAsleepOnLoad } from "@/hooks/use-pet-mood";
import type { PetProfile, Progress, Wallet } from "@/types/game";
import type { GameSave } from "@/types/save";
import { PET_NAME_MAX_LENGTH } from "@/types/save";
import {
  createDefaultGameSave,
  loadGameSave,
  saveGameSave,
} from "@/utils/game-storage";
import { applyLifeRegen, buyOneLife, canBuyLife } from "@/utils/lives";
import { applyPetTimeDecay } from "@/utils/pet-care";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

const CARE_TICK_MS = 60_000;

type GameContextValue = {
  isReady: boolean;
  hasCompletedOnboarding: boolean;
  pet: PetProfile;
  wallet: Wallet;
  progress: Progress;
  setPet: (updater: (current: PetProfile) => PetProfile) => void;
  setWallet: (updater: (current: Wallet) => Wallet) => void;
  setProgress: (updater: (current: Progress) => Progress) => void;
  buyLife: () => boolean;
  purchaseVisualHelp: (puzzleId: string, cost: number) => boolean;
  completeOnboarding: (name: string) => Promise<boolean>;
  recordInteraction: () => void;
};

const GameContext = createContext<GameContextValue | null>(null);

function normalizePetName(name: string): string {
  return name.trim().slice(0, PET_NAME_MAX_LENGTH);
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [save, setSave] = useState<GameSave>(createDefaultGameSave);
  const [isReady, setIsReady] = useState(false);
  const skipNextPersist = useRef(true);

  useEffect(() => {
    let active = true;

    loadGameSave()
      .then((loaded) => {
        if (!active) return;
        setSave(loaded?.save ?? createDefaultGameSave());
        setIsReady(true);
      })
      .catch(() => {
        if (!active) return;
        setSave(createDefaultGameSave());
        setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }

    saveGameSave(save).catch(() => {
      // Persistence failures should not block gameplay.
    });
  }, [isReady, save]);

  const tickGameTime = useCallback((resolveSleep = false) => {
    const now = Date.now();
    setSave((current) => {
      const awayMs = Math.max(0, now - current.pet.lastCareAt);
      const decayedPet = applyPetTimeDecay(current.pet, now);
      return {
        ...current,
        pet: resolveSleep
          ? resolveAsleepOnLoad(decayedPet, awayMs, now)
          : decayedPet,
        progress: {
          ...current.progress,
          lives: applyLifeRegen(current.progress.lives, now),
        },
      };
    });
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const handleAppState = (state: AppStateStatus) => {
      if (state === "active") {
        tickGameTime(true);
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);
    const interval = setInterval(() => tickGameTime(false), CARE_TICK_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [isReady, tickGameTime]);

  const setPet = useCallback((updater: (current: PetProfile) => PetProfile) => {
    setSave((current) => ({ ...current, pet: updater(current.pet) }));
  }, []);

  const setWallet = useCallback((updater: (current: Wallet) => Wallet) => {
    setSave((current) => ({ ...current, wallet: updater(current.wallet) }));
  }, []);

  const setProgress = useCallback(
    (updater: (current: Progress) => Progress) => {
      setSave((current) => ({
        ...current,
        progress: updater(current.progress),
      }));
    },
    [],
  );

  const recordInteraction = useCallback(() => {
    const now = Date.now();
    setSave((current) => ({
      ...current,
      pet: { ...current.pet, lastInteractionAt: now },
    }));
  }, []);

  const buyLife = useCallback(() => {
    const now = Date.now();
    let purchased = false;

    setSave((current) => {
      if (!canBuyLife(current.progress.lives, current.wallet.coins, now)) {
        return current;
      }

      purchased = true;
      return {
        ...current,
        wallet: { coins: current.wallet.coins - LIFE_BUY_COST },
        progress: {
          ...current.progress,
          lives: buyOneLife(current.progress.lives, now),
        },
      };
    });

    return purchased;
  }, []);

  const purchaseVisualHelp = useCallback((puzzleId: string, cost: number) => {
    let purchased = false;

    setSave((current) => {
      if (current.wallet.coins < cost) return current;
      if (current.progress.visualHelpsUnlocked.includes(puzzleId)) {
        purchased = true;
        return current;
      }

      purchased = true;
      return {
        ...current,
        wallet: { coins: current.wallet.coins - cost },
        progress: {
          ...current.progress,
          visualHelpsUnlocked: [
            ...current.progress.visualHelpsUnlocked,
            puzzleId,
          ],
        },
      };
    });

    return purchased;
  }, []);

  const completeOnboarding = useCallback(async (name: string) => {
    const trimmed = normalizePetName(name);
    if (!trimmed) return false;

    const nextSave: GameSave = {
      ...createDefaultGameSave(),
      pet: {
        ...createDefaultGameSave().pet,
        name: trimmed,
        lastCareAt: Date.now(),
      },
      hasCompletedOnboarding: true,
    };

    setSave(nextSave);
    await saveGameSave(nextSave);
    return true;
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      isReady,
      hasCompletedOnboarding: save.hasCompletedOnboarding,
      pet: save.pet,
      wallet: save.wallet,
      progress: save.progress,
      setPet,
      setWallet,
      setProgress,
      buyLife,
      purchaseVisualHelp,
      completeOnboarding,
      recordInteraction,
    }),
    [
      completeOnboarding,
      isReady,
      recordInteraction,
      save.hasCompletedOnboarding,
      save.pet,
      save.progress,
      save.wallet,
      setPet,
      setWallet,
      setProgress,
      buyLife,
      purchaseVisualHelp,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
