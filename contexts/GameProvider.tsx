import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { PetProfile, Progress, Wallet } from '@/types/game';
import type { GameSave } from '@/types/save';
import { PET_NAME_MAX_LENGTH } from '@/types/save';
import {
  createDefaultGameSave,
  loadGameSave,
  saveGameSave,
} from '@/utils/game-storage';

type GameContextValue = {
  isReady: boolean;
  hasCompletedOnboarding: boolean;
  pet: PetProfile;
  wallet: Wallet;
  progress: Progress;
  setPet: (updater: (current: PetProfile) => PetProfile) => void;
  setWallet: (updater: (current: Wallet) => Wallet) => void;
  setProgress: (updater: (current: Progress) => Progress) => void;
  completeOnboarding: (name: string) => Promise<boolean>;
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
        setSave(loaded ?? createDefaultGameSave());
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

  const setPet = useCallback(
    (updater: (current: PetProfile) => PetProfile) => {
      setSave((current) => ({ ...current, pet: updater(current.pet) }));
    },
    [],
  );

  const setWallet = useCallback((updater: (current: Wallet) => Wallet) => {
    setSave((current) => ({ ...current, wallet: updater(current.wallet) }));
  }, []);

  const setProgress = useCallback((updater: (current: Progress) => Progress) => {
    setSave((current) => ({ ...current, progress: updater(current.progress) }));
  }, []);

  const completeOnboarding = useCallback(async (name: string) => {
    const trimmed = normalizePetName(name);
    if (!trimmed) return false;

    const nextSave: GameSave = {
      ...createDefaultGameSave(),
      pet: {
        ...createDefaultGameSave().pet,
        name: trimmed,
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
      completeOnboarding,
    }),
    [
      completeOnboarding,
      isReady,
      save.hasCompletedOnboarding,
      save.pet,
      save.progress,
      save.wallet,
      setPet,
      setProgress,
      setWallet,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
