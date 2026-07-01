import { LIFE_BUY_COST } from "@/constants/game";
import { resolveCatBedId, type CatBedId } from "@/constants/cat-beds";
import { resolveCatToyId, type CatToyId } from "@/constants/cat-toys";
import { resolveCatDecorationId,
  type CatDecorationId,
} from "@/constants/cat-decorations";
import { resolveCatSkinId, type CatSkinId } from "@/constants/cat-skins";
import type { CatRoomId } from "@/constants/cat-rooms";
import { resolveCatRoomId } from "@/constants/cat-rooms";
import { resolveAsleepOnLoad } from "@/pet-display/engine/derive-mood";
import type { PetProfile, Progress, Wallet } from "@/types/game";
import type {
  BedPurchaseResult,
  RoomPurchaseResult,
  ToyPurchaseResult,
  DecorationPurchaseResult,
  SkinPurchaseResult,
} from "@/types/store";
import type { GameSave } from "@/types/save";
import {
  isBedUnlocked,
  tryPurchaseBed,
} from "@/utils/bed-store";
import {
  isRoomUnlocked,
  tryPurchaseRoom,
} from "@/utils/room-store";
import {
  isToyUnlocked,
  tryPurchaseToy,
} from "@/utils/toy-store";
import {
  isDecorationUnlocked,
  tryPurchaseDecoration,
} from "@/utils/decoration-store";
import {
  isSkinUnlocked,
  tryPurchaseSkin,
} from "@/utils/skin-store";
import {
  appendPlacedDecoration,
  appendPlacedToy,
  isDecorationPlacedInRoom,
  isToyPlacedInRoom,
  removePlacedDecoration,
  removePlacedToy,
} from "@/utils/room-placement";
import { PET_NAME_MAX_LENGTH } from "@/types/save";
import { useAuth } from "@/contexts/AuthProvider";
import { useCloudSaveSync } from "@/hooks/use-cloud-save-sync";
import { pullRemoteSave, pushRemoteSave, listRemoteSaveSnapshots } from "@/services/cloud-save/cloud-save";
import type { CloudSaveSummary } from "@/services/cloud-save/merge-game-save";
import { listRestorableCloudSaves, listSwitchableCloudSaves } from "@/services/cloud-save/restorable-cloud-save";
import type { CoinTransaction, CoinTransactionInput } from "@/types/coin-transaction";
import { withCoinDelta } from "@/utils/coin-ledger";
import { deleteRemoteUserData } from "@/services/cloud-save/delete-user-data";
import { clearBackedUpSession } from "@/lib/auth-session-backup";
import { supabase } from "@/lib/supabase";
import {
  clearActiveSaveId,
  createSaveId,
  getActiveSaveId,
  setActiveSaveId,
} from "@/utils/save-id";
import {
  clearGameSave,
  createDefaultGameSave,
  getLocalSaveUpdatedAt,
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
  coinTransactions: CoinTransaction[];
  setPet: (updater: (current: PetProfile) => PetProfile) => void;
  setWallet: (updater: (current: Wallet) => Wallet) => void;
  adjustCoins: (delta: number, meta: CoinTransactionInput) => boolean;
  syncToCloud: () => Promise<void>;
  reloadProgressFromCloud: () => Promise<void>;
  setProgress: (updater: (current: Progress) => Progress) => void;
  buyLife: () => boolean;
  purchaseVisualHelp: (puzzleId: string, cost: number) => boolean;
  purchaseRoom: (roomId: CatRoomId) => RoomPurchaseResult;
  equipRoom: (roomId: CatRoomId) => boolean;
  purchaseBed: (bedId: CatBedId) => BedPurchaseResult;
  equipBed: (bedId: CatBedId) => boolean;
  removeBedFromRoom: () => boolean;
  purchaseToy: (toyId: CatToyId) => ToyPurchaseResult;
  placeToyInRoom: (toyId: CatToyId) => boolean;
  removeToyFromRoom: (toyId: CatToyId) => boolean;
  purchaseDecoration: (decorationId: CatDecorationId) => DecorationPurchaseResult;
  placeDecorationInRoom: (decorationId: CatDecorationId) => boolean;
  removeDecorationFromRoom: (decorationId: CatDecorationId) => boolean;
  purchaseSkin: (skinId: CatSkinId) => SkinPurchaseResult;
  equipSkin: (skinId: CatSkinId) => boolean;
  completeOnboarding: (options: {
    name: string;
    catSkinId: CatSkinId;
  }) => Promise<boolean>;
  recordInteraction: () => void;
  cloudRestoreCandidates: CloudSaveSummary[];
  cloudRestoreCheckComplete: boolean;
  cloudRestorePromptDismissed: boolean;
  acceptCloudRestore: (saveId: string) => Promise<boolean>;
  declineCloudRestore: () => void;
  showCloudRestorePrompt: () => void;
  fetchSwitchableCloudSaves: () => Promise<CloudSaveSummary[]>;
  switchToCloudSave: (saveId: string) => Promise<boolean>;
  deleteAllUserData: () => Promise<{ ok: true } | { ok: false }>;
};

const GameContext = createContext<GameContextValue | null>(null);

function normalizePetName(name: string): string {
  return name.trim().slice(0, PET_NAME_MAX_LENGTH);
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { isAuthReady, userId } = useAuth();
  const [save, setSave] = useState<GameSave>(createDefaultGameSave);
  const [isReady, setIsReady] = useState(false);
  const [cloudRestoreCandidates, setCloudRestoreCandidates] = useState<
    CloudSaveSummary[]
  >([]);
  const [cloudRestoreCheckComplete, setCloudRestoreCheckComplete] =
    useState(false);
  const [cloudRestorePromptDismissed, setCloudRestorePromptDismissed] =
    useState(false);
  const skipNextPersist = useRef(true);
  const saveRef = useRef(save);
  const activeSaveIdRef = useRef<string | null>(null);
  const cloudSyncRef = useRef<(() => Promise<void>) | null>(null);
  const blockCloudPushRef = useRef(false);

  const handleRestorableCloudSaves = useCallback((saves: CloudSaveSummary[]) => {
    setCloudRestoreCandidates(saves);
  }, []);

  const handleInitialCloudCheckComplete = useCallback(() => {
    setCloudRestoreCheckComplete(true);
  }, []);

  useEffect(() => {
    setCloudRestoreCheckComplete(false);
    setCloudRestoreCandidates([]);
    setCloudRestorePromptDismissed(false);
    blockCloudPushRef.current = false;
    activeSaveIdRef.current = null;
  }, [userId]);

  useCloudSaveSync({
    isGameReady: isReady,
    isAuthReady,
    userId,
    save,
    setSave,
    skipNextPersist,
    activeSaveIdRef,
    cloudSyncRef,
    onRestorableCloudSaves: handleRestorableCloudSaves,
    onInitialCloudCheckComplete: handleInitialCloudCheckComplete,
    blockCloudPushRef,
  });

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    let active = true;

    Promise.all([loadGameSave(), getActiveSaveId()])
      .then(([loaded, saveId]) => {
        if (!active) return;
        if (saveId) {
          activeSaveIdRef.current = saveId;
        }
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

  const adjustCoins = useCallback(
    (delta: number, meta: CoinTransactionInput): boolean => {
      let applied = false;

      setSave((current) => {
        const next = withCoinDelta(current, delta, meta);
        if (!next) return current;
        applied = true;
        return next;
      });

      return applied;
    },
    [],
  );

  const syncToCloud = useCallback(async () => {
    await cloudSyncRef.current?.();
  }, []);

  const reloadProgressFromCloud = useCallback(async () => {
    if (!userId) return;

    const saveId = activeSaveIdRef.current ?? (await getActiveSaveId());
    if (!saveId) return;

    const remote = await pullRemoteSave(userId, saveId);
    if (!remote) return;

    skipNextPersist.current = false;
    setSave(remote.save);
    await saveGameSave(remote.save);
    await cloudSyncRef.current?.();
  }, [userId]);

  const deleteAllUserData = useCallback(async (): Promise<
    { ok: true } | { ok: false }
  > => {
    try {
      const currentUserId = userId;
      if (currentUserId) {
        await deleteRemoteUserData(currentUserId);
      }

      await clearGameSave();
      await clearActiveSaveId();
      await clearBackedUpSession();

      if (supabase) {
        await supabase.auth.signOut({ scope: "global" });
        await supabase.auth.signInAnonymously();
      }

      const fresh = createDefaultGameSave();
      skipNextPersist.current = true;
      activeSaveIdRef.current = null;
      setSave(fresh);

      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, [userId]);

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

  const purchaseRoom = useCallback((roomId: CatRoomId): RoomPurchaseResult => {
    const resolvedId = resolveCatRoomId(roomId);
    const current = saveRef.current;
    const unlocked = current.progress.roomsUnlocked as CatRoomId[];
    const attempt = tryPurchaseRoom({
      roomId: resolvedId,
      walletCoins: current.wallet.coins,
      roomsUnlocked: unlocked,
    });

    if (attempt.result === "purchased") {
      setSave({
        ...current,
        wallet: { coins: attempt.walletCoins },
        progress: {
          ...current.progress,
          roomsUnlocked: attempt.roomsUnlocked,
        },
        pet: { ...current.pet, roomId: resolvedId },
      });
    }

    return attempt.result;
  }, []);

  const equipRoom = useCallback((roomId: CatRoomId) => {
    const resolvedId = resolveCatRoomId(roomId);
    const current = saveRef.current;
    const unlocked = current.progress.roomsUnlocked as CatRoomId[];

    if (!isRoomUnlocked(resolvedId, unlocked)) {
      return false;
    }

    setSave({
      ...current,
      pet: { ...current.pet, roomId: resolvedId },
    });

    return true;
  }, []);

  const purchaseBed = useCallback((bedId: CatBedId): BedPurchaseResult => {
    const resolvedId = resolveCatBedId(bedId);
    if (!resolvedId) {
      return "invalid_item";
    }

    const current = saveRef.current;
    const unlocked = current.progress.bedsUnlocked as CatBedId[];
    const attempt = tryPurchaseBed({
      bedId: resolvedId,
      walletCoins: current.wallet.coins,
      bedsUnlocked: unlocked,
    });

    if (attempt.result === "purchased") {
      setSave({
        ...current,
        wallet: { coins: attempt.walletCoins },
        progress: {
          ...current.progress,
          bedsUnlocked: attempt.bedsUnlocked,
        },
        pet: {
          ...current.pet,
          bedId: resolvedId,
          roomBedOffset: current.pet.roomBedOffset ?? { x: -0.15, y: 0.3 },
        },
      });
    }

    return attempt.result;
  }, []);

  const equipBed = useCallback((bedId: CatBedId) => {
    const resolvedId = resolveCatBedId(bedId);
    if (!resolvedId) {
      return false;
    }

    const current = saveRef.current;
    const unlocked = current.progress.bedsUnlocked as CatBedId[];

    if (!isBedUnlocked(resolvedId, unlocked)) {
      return false;
    }

    setSave({
      ...current,
      pet: {
        ...current.pet,
        bedId: resolvedId,
        roomBedOffset: current.pet.roomBedOffset ?? { x: -0.15, y: 0.3 },
      },
    });

    return true;
  }, []);

  const removeBedFromRoom = useCallback(() => {
    const current = saveRef.current;
    if (!current.pet.bedId) {
      return false;
    }

    setSave({
      ...current,
      pet: {
        ...current.pet,
        bedId: undefined,
      },
    });

    return true;
  }, []);

  const purchaseToy = useCallback((toyId: CatToyId): ToyPurchaseResult => {
    const resolvedId = resolveCatToyId(toyId);
    if (!resolvedId) {
      return "invalid_item";
    }

    const current = saveRef.current;
    const unlocked = current.progress.toysUnlocked as CatToyId[];
    const attempt = tryPurchaseToy({
      toyId: resolvedId,
      walletCoins: current.wallet.coins,
      toysUnlocked: unlocked,
    });

    if (attempt.result === "purchased") {
      setSave({
        ...current,
        wallet: { coins: attempt.walletCoins },
        progress: {
          ...current.progress,
          toysUnlocked: attempt.toysUnlocked,
        },
        pet: {
          ...current.pet,
          placedToys: appendPlacedToy(current.pet.placedToys, resolvedId),
        },
      });
    }

    return attempt.result;
  }, []);

  const placeToyInRoom = useCallback((toyId: CatToyId) => {
    const resolvedId = resolveCatToyId(toyId);
    if (!resolvedId) {
      return false;
    }

    const current = saveRef.current;
    const unlocked = current.progress.toysUnlocked as CatToyId[];

    if (!isToyUnlocked(resolvedId, unlocked)) {
      return false;
    }

    if (isToyPlacedInRoom(resolvedId, current.pet.placedToys)) {
      return false;
    }

    setSave({
      ...current,
      pet: {
        ...current.pet,
        placedToys: appendPlacedToy(current.pet.placedToys, resolvedId),
      },
    });

    return true;
  }, []);

  const removeToyFromRoom = useCallback((toyId: CatToyId) => {
    const resolvedId = resolveCatToyId(toyId);
    if (!resolvedId) {
      return false;
    }

    const current = saveRef.current;
    if (!isToyPlacedInRoom(resolvedId, current.pet.placedToys)) {
      return false;
    }

    setSave({
      ...current,
      pet: {
        ...current.pet,
        placedToys: removePlacedToy(current.pet.placedToys, resolvedId),
      },
    });

    return true;
  }, []);

  const purchaseDecoration = useCallback(
    (decorationId: CatDecorationId): DecorationPurchaseResult => {
      const resolvedId = resolveCatDecorationId(decorationId);
      if (!resolvedId) {
        return "invalid_item";
      }

      const current = saveRef.current;
      const unlocked = current.progress.decorationsUnlocked as CatDecorationId[];
      const attempt = tryPurchaseDecoration({
        decorationId: resolvedId,
        walletCoins: current.wallet.coins,
        decorationsUnlocked: unlocked,
      });

      if (attempt.result === "purchased") {
        setSave({
          ...current,
          wallet: { coins: attempt.walletCoins },
          progress: {
            ...current.progress,
            decorationsUnlocked: attempt.decorationsUnlocked,
          },
          pet: {
            ...current.pet,
            placedDecorations: appendPlacedDecoration(
              current.pet.placedDecorations,
              resolvedId,
            ),
          },
        });
      }

      return attempt.result;
    },
    [],
  );

  const placeDecorationInRoom = useCallback((decorationId: CatDecorationId) => {
    const resolvedId = resolveCatDecorationId(decorationId);
    if (!resolvedId) {
      return false;
    }

    const current = saveRef.current;
    const unlocked = current.progress.decorationsUnlocked as CatDecorationId[];

    if (!isDecorationUnlocked(resolvedId, unlocked)) {
      return false;
    }

    if (isDecorationPlacedInRoom(resolvedId, current.pet.placedDecorations)) {
      return false;
    }

    setSave({
      ...current,
      pet: {
        ...current.pet,
        placedDecorations: appendPlacedDecoration(
          current.pet.placedDecorations,
          resolvedId,
        ),
      },
    });

    return true;
  }, []);

  const removeDecorationFromRoom = useCallback((decorationId: CatDecorationId) => {
    const resolvedId = resolveCatDecorationId(decorationId);
    if (!resolvedId) {
      return false;
    }

    const current = saveRef.current;
    if (!isDecorationPlacedInRoom(resolvedId, current.pet.placedDecorations)) {
      return false;
    }

    setSave({
      ...current,
      pet: {
        ...current.pet,
        placedDecorations: removePlacedDecoration(
          current.pet.placedDecorations,
          resolvedId,
        ),
      },
    });

    return true;
  }, []);

  const purchaseSkin = useCallback((skinId: CatSkinId): SkinPurchaseResult => {
    const resolvedId = resolveCatSkinId(skinId);
    if (!resolvedId) {
      return "invalid_item";
    }

    const current = saveRef.current;
    const unlocked = current.progress.skinsUnlocked as CatSkinId[];
    const attempt = tryPurchaseSkin({
      skinId: resolvedId,
      walletCoins: current.wallet.coins,
      skinsUnlocked: unlocked,
    });

    if (attempt.result === "purchased") {
      setSave({
        ...current,
        wallet: { coins: attempt.walletCoins },
        progress: {
          ...current.progress,
          skinsUnlocked: attempt.skinsUnlocked,
        },
        pet: {
          ...current.pet,
          catSkinId: resolvedId,
        },
      });
    }

    return attempt.result;
  }, []);

  const equipSkin = useCallback((skinId: CatSkinId) => {
    const resolvedId = resolveCatSkinId(skinId);
    if (!resolvedId) {
      return false;
    }

    const current = saveRef.current;
    const unlocked = current.progress.skinsUnlocked as CatSkinId[];

    if (!isSkinUnlocked(resolvedId, unlocked)) {
      return false;
    }

    setSave({
      ...current,
      pet: {
        ...current.pet,
        catSkinId: resolvedId,
      },
    });

    return true;
  }, []);

  const startNewGameSlot = useCallback(async () => {
    const newId = createSaveId();
    await setActiveSaveId(newId);
    activeSaveIdRef.current = newId;
    blockCloudPushRef.current = true;

    const fresh = createDefaultGameSave();
    skipNextPersist.current = false;
    setSave(fresh);
    await clearGameSave();
    await saveGameSave(fresh);
    setCloudRestorePromptDismissed(true);
  }, []);

  const switchToCloudSave = useCallback(
    async (saveId: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        const remote = await pullRemoteSave(userId, saveId);
        if (!remote) return false;

        blockCloudPushRef.current = false;
        await setActiveSaveId(saveId);
        activeSaveIdRef.current = saveId;
        skipNextPersist.current = false;
        setSave(remote.save);
        await saveGameSave(remote.save);
        await pushRemoteSave(userId, saveId, {
          save: remote.save,
          clientUpdatedAt: (await getLocalSaveUpdatedAt()) || Date.now(),
        });
        return true;
      } catch {
        return false;
      }
    },
    [userId],
  );

  const acceptCloudRestore = useCallback(
    async (saveId: string): Promise<boolean> => {
      const ok = await switchToCloudSave(saveId);
      if (ok) {
        setCloudRestoreCandidates([]);
        setCloudRestorePromptDismissed(false);
      }
      return ok;
    },
    [switchToCloudSave],
  );

  const fetchSwitchableCloudSaves = useCallback(async (): Promise<
    CloudSaveSummary[]
  > => {
    if (!userId) return [];

    const remotes = await listRemoteSaveSnapshots(userId);
    const activeId = activeSaveIdRef.current ?? (await getActiveSaveId());
    return listSwitchableCloudSaves(remotes, activeId);
  }, [userId]);

  const declineCloudRestore = useCallback(() => {
    void startNewGameSlot();
  }, [startNewGameSlot]);

  const showCloudRestorePrompt = useCallback(() => {
    if (!userId) {
      setCloudRestorePromptDismissed(false);
      return;
    }

    void (async () => {
      const remotes = await listRemoteSaveSnapshots(userId);
      const activeId = activeSaveIdRef.current ?? (await getActiveSaveId());
      const candidates = listRestorableCloudSaves(
        {
          save: saveRef.current,
          clientUpdatedAt: (await getLocalSaveUpdatedAt()) || 0,
        },
        remotes,
        activeId,
      );
      setCloudRestoreCandidates(candidates);
      setCloudRestorePromptDismissed(false);
    })();
  }, [userId]);

  const completeOnboarding = useCallback(
    async (options: { name: string; catSkinId: CatSkinId }) => {
      const trimmed = normalizePetName(options.name);
      if (!trimmed || !userId) return false;

      const skinId = resolveCatSkinId(options.catSkinId);
      blockCloudPushRef.current = false;

      let saveId = activeSaveIdRef.current ?? (await getActiveSaveId());
      if (!saveId) {
        saveId = createSaveId();
        await setActiveSaveId(saveId);
        activeSaveIdRef.current = saveId;
      }

      const nextSave: GameSave = {
        ...createDefaultGameSave(),
        pet: {
          ...createDefaultGameSave().pet,
          name: trimmed,
          type: "cat",
          catSkinId: skinId,
          lastCareAt: Date.now(),
        },
        progress: {
          ...createDefaultGameSave().progress,
          skinsUnlocked: [skinId],
        },
        hasCompletedOnboarding: true,
        startedAt: Date.now(),
      };

      setSave(nextSave);
      await saveGameSave(nextSave);
      await pushRemoteSave(userId, saveId, {
        save: nextSave,
        clientUpdatedAt: (await getLocalSaveUpdatedAt()) || Date.now(),
      });
      return true;
    },
    [userId],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      isReady,
      hasCompletedOnboarding: save.hasCompletedOnboarding,
      pet: save.pet,
      wallet: save.wallet,
      progress: save.progress,
      coinTransactions: save.coinTransactions ?? [],
      setPet,
      setWallet,
      adjustCoins,
      syncToCloud,
      reloadProgressFromCloud,
      setProgress,
      buyLife,
      purchaseVisualHelp,
      purchaseRoom,
      equipRoom,
      purchaseBed,
      equipBed,
      removeBedFromRoom,
      purchaseToy,
      placeToyInRoom,
      removeToyFromRoom,
      purchaseDecoration,
      placeDecorationInRoom,
      removeDecorationFromRoom,
      purchaseSkin,
      equipSkin,
      completeOnboarding,
      recordInteraction,
      cloudRestoreCandidates,
      cloudRestoreCheckComplete,
      cloudRestorePromptDismissed,
      acceptCloudRestore,
      declineCloudRestore,
      showCloudRestorePrompt,
      fetchSwitchableCloudSaves,
      switchToCloudSave,
      deleteAllUserData,
    }),
    [
      acceptCloudRestore,
      cloudRestoreCandidates,
      cloudRestoreCheckComplete,
      cloudRestorePromptDismissed,
      completeOnboarding,
      declineCloudRestore,
      fetchSwitchableCloudSaves,
      showCloudRestorePrompt,
      switchToCloudSave,
      deleteAllUserData,
      isReady,
      recordInteraction,
      save.hasCompletedOnboarding,
      save.pet,
      save.coinTransactions,
      save.progress,
      save.wallet,
      adjustCoins,
      reloadProgressFromCloud,
      setPet,
      setWallet,
      syncToCloud,
      setProgress,
      buyLife,
      purchaseVisualHelp,
      purchaseRoom,
      equipRoom,
      purchaseBed,
      equipBed,
      removeBedFromRoom,
      purchaseToy,
      placeToyInRoom,
      removeToyFromRoom,
      purchaseDecoration,
      placeDecorationInRoom,
      removeDecorationFromRoom,
      purchaseSkin,
      equipSkin,
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
