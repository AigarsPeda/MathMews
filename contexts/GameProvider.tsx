import type { HomeRoomId } from "@/constants/home-rooms";
import { changeWorldClock, createWorldClock, normalizeWorldClock, normalizeWeather, type WorldClock, type WeatherMode } from '@/utils/world-clock';
import { removeRoomNavigationDoors, sendCatToRoom as moveCatToRoom, switchHomeRoom } from "@/utils/home-rooms";
import { switchRoomLayout } from "@/utils/room-layout";
import { setRoomItemRotation } from "@/utils/room-rotation";
import { applyPuzzleAnswer, applyFeed } from "@/utils/game-operations";
import type { Puzzle } from "@/types/puzzle";
import { isCurtainDecorationId, isPoweredDecorationId } from "@/constants/decoration-motion";
import { LIFE_BUY_COST } from "@/constants/game";
import {
  DEFAULT_BED_SCALE,
  resolveCatBedId,
  type CatBedId,
  canFlipBed,
  canScaleBedDown,
  canScaleBedUp,
  getEquippedBedScale,
  scaleBedBy,
} from "@/constants/cat-beds";
import { getPlacedToyScale, getPlacedToyRotationIndex, TOY_ROTATION_COUNT, resolveCatToyId, type CatToyId } from "@/constants/cat-toys";
import { resolveCatDecorationId,
  type CatDecorationId,
} from "@/constants/cat-decorations";
import {
  canRotateDecoration,
  canScaleDecorationDown,
  canScaleDecorationUp,
  canFlipWallDecoration,
  getDecorationRotationCount,
  getNextRotationIndex,
  getPlacedDecorationScale,
  getPlacedDecorationWallFlipped,
  resolveDecorationPlacement,
  scaleDecorationBy,
} from "@/constants/decoration-variants";
import { resolveCatSkinId, type CatSkinId } from "@/constants/cat-skins";
import type { CatRoomId } from "@/constants/cat-rooms";
import { resolveCatRoomId } from "@/constants/cat-rooms";
import { resolveAsleepOnLoad } from "@/pet-display/engine/derive-mood";
import type { PetProfile, Progress, RoomLayerItem, Wallet } from "@/types/game";
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
  getToyOwnedCount,
} from "@/utils/toy-store";
import {
  isDecorationUnlocked,
  tryPurchaseDecoration,
  getDecorationOwnedCount,
} from "@/utils/decoration-store";
import {
  isSkinUnlocked,
  tryPurchaseSkin,
} from "@/utils/skin-store";
import {
  appendPlacedDecoration,
  appendPlacedToy,
  countPlacedDecorations,
  countPlacedToys,
  findPlacedDecorationByInstance,
  findPlacedToyByInstance,
  removeOnePlacedDecoration,
  removeOnePlacedToy,
  removePlacedDecorationByInstance,
  removePlacedToyByInstance,
  togglePlacedDecorationPowerByInstance,
  togglePlacedCurtainByInstance,
  updatePlacedDecorationRotationByInstance,
  updatePlacedDecorationScaleByInstance,
  updatePlacedToyScaleByInstance,
  updatePlacedToyRotationByInstance,
  updatePlacedDecorationWallFlipByInstance,
} from "@/utils/room-placement";
import {
  moveRoomLayerItem as shiftRoomLayerItem,
  normalizeRoomLayerOrder,
  syncPetLayerOrder,
} from "@/utils/room-layer-order";
import { PET_NAME_MAX_LENGTH } from "@/types/save";
import { useAuth } from "@/contexts/AuthProvider";
import { useCloudSaveSync } from "@/hooks/use-cloud-save-sync";
import { pullRemoteSave, pushRemoteSave, listRemoteSaveSnapshots } from "@/services/cloud-save/cloud-save";
import type { CloudSaveSummary } from "@/services/cloud-save/merge-game-save";
import { listRestorableCloudSaves, listSwitchableCloudSaves } from "@/services/cloud-save/restorable-cloud-save";
import type { CoinTransaction, CoinTransactionInput, CoinTransactionKind } from "@/types/coin-transaction";
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
  worldClock: WorldClock;
  setWorldClock: (speed: number, minuteOfDay?: number) => void;
  setWorldWeather: (weather: WeatherMode) => void;
  answerPuzzle: (puzzle: Puzzle, correct: boolean, attemptId: string) => number;
  feedPet: () => boolean;
  isReady: boolean;
  hasCompletedOnboarding: boolean;
  pet: PetProfile;
  wallet: Wallet;
  progress: Progress;
  coinTransactions: CoinTransaction[];
  creditedPurchaseIds: string[];
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
  visitHomeRoom: (roomId: HomeRoomId) => void;
  sendCatToRoom: (roomId: HomeRoomId) => void;
  purchaseBed: (bedId: CatBedId) => BedPurchaseResult;
  equipBed: (bedId: CatBedId) => boolean;
  removeBedFromRoom: () => boolean;
  flipEquippedBed: () => boolean;
  scaleEquippedBed: (direction: "up" | "down") => boolean;
  purchaseToy: (toyId: CatToyId) => ToyPurchaseResult;
  placeToyInRoom: (toyId: CatToyId) => boolean;
  removeToyFromRoom: (toyId: CatToyId, instanceId?: string) => boolean;
  scalePlacedToy: (instanceId: string, direction: "up" | "down") => boolean;
  rotatePlacedToy: (instanceId: string) => boolean;
  setRoomItemRotation: (item: RoomLayerItem, degrees: number) => boolean;
  purchaseDecoration: (decorationId: CatDecorationId) => DecorationPurchaseResult;
  placeDecorationInRoom: (decorationId: CatDecorationId) => boolean;
  removeDecorationFromRoom: (
    decorationId: CatDecorationId,
    instanceId?: string,
  ) => boolean;
  rotatePlacedDecoration: (instanceId: string) => boolean;
  flipPlacedDecorationWall: (instanceId: string) => boolean;
  togglePlacedDecorationPower: (instanceId: string) => boolean;
  togglePlacedCurtain: (instanceId: string) => boolean;
  scalePlacedDecoration: (
    instanceId: string,
    direction: "up" | "down",
  ) => boolean;
  moveRoomLayerItem: (item: RoomLayerItem, direction: "up" | "down") => boolean;
  purchaseSkin: (skinId: CatSkinId) => SkinPurchaseResult;
  equipSkin: (skinId: CatSkinId) => boolean;
  completeOnboarding: (options: {
    name: string;
    catSkinId: CatSkinId;
  }) => Promise<boolean>;
  recordInteraction: () => number;
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
  const [save, setSaveState] = useState<GameSave>(createDefaultGameSave);
  const [initialWorldClock] = useState(createWorldClock);
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
  // Commands read and commit the latest snapshot before React renders it.
  const setSave = useCallback((update: GameSave | ((current: GameSave) => GameSave)) => {
    const candidate = typeof update === "function" ? update(saveRef.current) : update;
    const pet = removeRoomNavigationDoors(candidate.pet);
    const next = { ...candidate, pet, worldClock: normalizeWorldClock(candidate.worldClock ?? initialWorldClock) };
    saveRef.current = next;
    setSaveState(next);
  }, [initialWorldClock]);
  const setWorldClock = useCallback((speed: number, minuteOfDay?: number) => {
    setSave(current => ({ ...current, worldClock: changeWorldClock(normalizeWorldClock(current.worldClock ?? initialWorldClock), speed, minuteOfDay) }));
  }, [initialWorldClock, setSave]);
  const setWorldWeather = useCallback((weather: WeatherMode) => {
    setSave(current => ({ ...current, worldClock: {
      ...normalizeWorldClock(current.worldClock ?? initialWorldClock), weather: normalizeWeather(weather),
    } }));
  }, [initialWorldClock, setSave]);
  const answerPuzzle = useCallback((puzzle: Puzzle, correct: boolean, attemptId: string) => {
    const result = applyPuzzleAnswer(saveRef.current, puzzle, correct, attemptId);
    setSave(result.save);
    return result.coins;
  }, [setSave]);
  const feedPet = useCallback(() => {
    const next = applyFeed(saveRef.current);
    if (!next) return false;
    setSave(next);
    return true;
  }, [setSave]);
  const activeSaveIdRef = useRef<string | null>(null);
  const getSave = useCallback(() => saveRef.current, []);
  const cloudSyncRef = useRef<(() => Promise<void>) | null>(null);
  const blockCloudPushRef = useRef(false);

  const commitPurchase = useCallback((current: GameSave, next: GameSave, kind: CoinTransactionKind, itemId: string) => {
    if (current.progress.storeGoal?.kind === kind.replace("store_", "") && current.progress.storeGoal.id === itemId) next = { ...next, progress: { ...next.progress, storeGoal: undefined } };
    const delta = next.wallet.coins - current.wallet.coins;
    const funded = delta ? withCoinDelta({ ...next, wallet: current.wallet }, delta, { kind, itemId }) : next;
    if (funded) setSave(funded);
  }, [setSave]);

  const handleRestorableCloudSaves = useCallback((saves: CloudSaveSummary[]) => {
    setCloudRestoreCandidates(saves);
  }, []);

  const handleInitialCloudCheckComplete = useCallback(() => {
    setCloudRestoreCheckComplete(true);
  }, []);

  useEffect(() => {
    // Account changes invalidate restore candidates belonging to the previous account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    getSave,
    setSave,
    skipNextPersist,
    activeSaveIdRef,
    cloudSyncRef,
    onRestorableCloudSaves: handleRestorableCloudSaves,
    onInitialCloudCheckComplete: handleInitialCloudCheckComplete,
    blockCloudPushRef,
  });


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
  }, [setSave]);

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
  }, [setSave]);

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
  }, [setSave]);

  const setWallet = useCallback((updater: (current: Wallet) => Wallet) => {
    setSave((current) => ({ ...current, wallet: updater(current.wallet) }));
  }, [setSave]);

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
    [setSave],
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
  }, [userId, setSave]);

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
  }, [userId, setSave]);

  const setProgress = useCallback(
    (updater: (current: Progress) => Progress) => {
      setSave((current) => ({
        ...current,
        progress: updater(current.progress),
      }));
    },
    [setSave],
  );

  const recordInteraction = useCallback(() => {
    const now = Date.now();
    setSave((current) => ({
      ...current,
      pet: { ...current.pet, lastInteractionAt: now },
    }));
    return now;
  }, [setSave]);

  const buyLife = useCallback(() => {
    const current = saveRef.current;
    if (!canBuyLife(current.progress.lives, current.wallet.coins)) return false;
    const funded = withCoinDelta(current, -LIFE_BUY_COST, { kind: "life_purchase" });
    if (!funded) return false;
    setSave({ ...funded, progress: { ...funded.progress, lives: buyOneLife(current.progress.lives) } });
    return true;
  }, [setSave]);

  const purchaseVisualHelp = useCallback((puzzleId: string, _cost: number) => {
    const current = saveRef.current;
    if (!current.progress.visualHelpsUnlocked.includes(puzzleId)) {
      setSave({ ...current, progress: { ...current.progress, visualHelpsUnlocked: [...current.progress.visualHelpsUnlocked, puzzleId] } });
    }
    return true;
  }, [setSave]);

  const visitHomeRoom = useCallback((roomId: HomeRoomId) => {
    setPet(current => switchHomeRoom(current, roomId));
  }, [setPet]);

  const sendCatToRoom = useCallback((roomId: HomeRoomId) => {
    setPet(current => moveCatToRoom(current, roomId));
  }, [setPet]);

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
      commitPurchase(current, {
        ...current,
        wallet: { coins: attempt.walletCoins },
        progress: {
          ...current.progress,
          roomsUnlocked: attempt.roomsUnlocked,
        },
        pet: switchRoomLayout(current.pet, resolvedId),
      }, "store_room", resolvedId);
    }

    return attempt.result;
  }, [commitPurchase]);

  const equipRoom = useCallback((roomId: CatRoomId) => {
    const resolvedId = resolveCatRoomId(roomId);
    const current = saveRef.current;
    const unlocked = current.progress.roomsUnlocked as CatRoomId[];

    if (!isRoomUnlocked(resolvedId, unlocked)) {
      return false;
    }

    setSave({
      ...current,
      pet: switchRoomLayout(current.pet, resolvedId),
    });

    return true;
  }, [setSave]);

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
      commitPurchase(current, {
        ...current,
        wallet: { coins: attempt.walletCoins },
        progress: {
          ...current.progress,
          bedsUnlocked: attempt.bedsUnlocked,
        },
        pet: syncPetLayerOrder({
          ...current.pet,
          bedId: resolvedId,
          roomBedOffset: current.pet.roomBedOffset ?? { x: -0.15, y: 0.3 },
          bedFlipped:
            current.pet.bedId === resolvedId ? current.pet.bedFlipped : undefined,
          bedRotationDegrees: current.pet.bedId === resolvedId ? current.pet.bedRotationDegrees : undefined,
          bedScale:
            current.pet.bedId === resolvedId ? current.pet.bedScale : undefined,
        }),
      }, "store_bed", resolvedId);
    }

    return attempt.result;
  }, [commitPurchase]);

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
      pet: syncPetLayerOrder({
        ...current.pet,
        bedId: resolvedId,
        roomBedOffset: current.pet.roomBedOffset ?? { x: -0.15, y: 0.3 },
        bedFlipped:
          current.pet.bedId === resolvedId ? current.pet.bedFlipped : undefined,
        bedRotationDegrees: current.pet.bedId === resolvedId ? current.pet.bedRotationDegrees : undefined,
        bedScale:
          current.pet.bedId === resolvedId ? current.pet.bedScale : undefined,
      }),
    });

    return true;
  }, [setSave]);

  const removeBedFromRoom = useCallback(() => {
    const current = saveRef.current;
    if (!current.pet.bedId) {
      return false;
    }

    setSave({
      ...current,
      pet: syncPetLayerOrder({
        ...current.pet,
        bedId: undefined,
        bedFlipped: undefined,
        bedRotationDegrees: undefined,
        bedScale: undefined,
      }),
    });

    return true;
  }, [setSave]);

  const flipEquippedBed = useCallback(() => {
    const current = saveRef.current;
    const resolvedId = resolveCatBedId(current.pet.bedId);
    if (!resolvedId || !canFlipBed(resolvedId)) {
      return false;
    }

    setSave({
      ...current,
      pet: {
        ...current.pet,
        bedFlipped: current.pet.bedFlipped ? undefined : true,
      },
    });

    return true;
  }, [setSave]);

  const scaleEquippedBed = useCallback((direction: "up" | "down") => {
    const current = saveRef.current;
    const resolvedId = resolveCatBedId(current.pet.bedId);
    if (!resolvedId) {
      return false;
    }

    const currentScale = getEquippedBedScale(current.pet.bedScale);
    if (
      (direction === "up" && !canScaleBedUp(currentScale)) ||
      (direction === "down" && !canScaleBedDown(currentScale))
    ) {
      return false;
    }

    const nextScale = scaleBedBy(currentScale, direction);

    setSave({
      ...current,
      pet: {
        ...current.pet,
        bedScale: nextScale !== DEFAULT_BED_SCALE ? nextScale : undefined,
      },
    });

    return true;
  }, [setSave]);

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
      const ownedCount = getToyOwnedCount(resolvedId, current.progress);
      commitPurchase(current, {
        ...current,
        wallet: { coins: attempt.walletCoins },
        progress: {
          ...current.progress,
          toysUnlocked: attempt.toysUnlocked,
          toyQuantities: {
            ...current.progress.toyQuantities,
            [resolvedId]: ownedCount + 1,
          },
        },
        pet: syncPetLayerOrder({
          ...current.pet,
          placedToys: appendPlacedToy(current.pet.placedToys, resolvedId),
        }),
      }, "store_toy", resolvedId);
    }

    return attempt.result;
  }, [commitPurchase]);

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

    const ownedCount = getToyOwnedCount(resolvedId, current.progress);
    const placedCount = countPlacedToys(resolvedId, current.pet.placedToys);
    if (placedCount >= ownedCount) {
      return false;
    }

    setSave({
      ...current,
      pet: syncPetLayerOrder({
        ...current.pet,
        placedToys: appendPlacedToy(current.pet.placedToys, resolvedId),
      }),
    });

    return true;
  }, [setSave]);

  const removeToyFromRoom = useCallback((toyId: CatToyId, instanceId?: string) => {
    const resolvedId = resolveCatToyId(toyId);
    if (!resolvedId) {
      return false;
    }

    const current = saveRef.current;
    const nextPlacedToys = instanceId
      ? removePlacedToyByInstance(current.pet.placedToys, instanceId)
      : removeOnePlacedToy(current.pet.placedToys, resolvedId);

    if (nextPlacedToys.length === (current.pet.placedToys ?? []).length) {
      return false;
    }

    setSave({
      ...current,
      pet: syncPetLayerOrder({
        ...current.pet,
        placedToys: nextPlacedToys,
      }),
    });

    return true;
  }, [setSave]);

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
        const ownedCount = getDecorationOwnedCount(resolvedId, current.progress);
        commitPurchase(current, {
          ...current,
          wallet: { coins: attempt.walletCoins },
          progress: {
            ...current.progress,
            decorationsUnlocked: attempt.decorationsUnlocked,
            decorationQuantities: {
              ...current.progress.decorationQuantities,
              [resolvedId]: ownedCount + 1,
            },
          },
          pet: syncPetLayerOrder({
            ...current.pet,
            placedDecorations: appendPlacedDecoration(
              current.pet.placedDecorations,
              resolvedId,
            ),
          }),
        }, "store_decoration", resolvedId);
      }

      return attempt.result;
    },
    [commitPurchase],
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

    const ownedCount = getDecorationOwnedCount(resolvedId, current.progress);
    const placedCount = countPlacedDecorations(
      resolvedId,
      current.pet.placedDecorations,
    );
    if (placedCount >= ownedCount) {
      return false;
    }

    setSave({
      ...current,
      pet: syncPetLayerOrder({
        ...current.pet,
        placedDecorations: appendPlacedDecoration(
          current.pet.placedDecorations,
          resolvedId,
        ),
      }),
    });

    return true;
  }, [setSave]);

  const removeDecorationFromRoom = useCallback(
    (decorationId: CatDecorationId, instanceId?: string) => {
      const resolvedId = resolveCatDecorationId(decorationId);
      if (!resolvedId) {
        return false;
      }

      const current = saveRef.current;
      const nextPlacedDecorations = instanceId
        ? removePlacedDecorationByInstance(
            current.pet.placedDecorations,
            instanceId,
          )
        : removeOnePlacedDecoration(
            current.pet.placedDecorations,
            resolvedId,
          );

      if (
        nextPlacedDecorations.length ===
        (current.pet.placedDecorations ?? []).length
      ) {
        return false;
      }

      setSave({
        ...current,
        pet: syncPetLayerOrder({
          ...current.pet,
          placedDecorations: nextPlacedDecorations,
        }),
      });

      return true;
    },
    [setSave],
  );

  const rotatePlacedDecoration = useCallback((instanceId: string) => {
    const current = saveRef.current;
    const placed = findPlacedDecorationByInstance(
      current.pet.placedDecorations,
      instanceId,
    );
    if (!placed) {
      return false;
    }

    const placement = resolveDecorationPlacement(placed.decorationId);
    if (!placement || !canRotateDecoration(placement.decorationId)) {
      return false;
    }

    const canonicalId = placement.decorationId;
    const rotationCount = getDecorationRotationCount(canonicalId);
    if (rotationCount < 2) {
      return false;
    }

    const currentIndex = placed.rotationIndex ?? 0;
    const nextIndex = getNextRotationIndex(currentIndex, rotationCount);

    setSave({
      ...current,
      pet: {
        ...current.pet,
        placedDecorations: updatePlacedDecorationRotationByInstance(
          current.pet.placedDecorations,
          instanceId,
          nextIndex,
        ),
      },
    });

    return true;
  }, [setSave]);

  const flipPlacedDecorationWall = useCallback((instanceId: string) => {
    const current = saveRef.current;
    const placed = findPlacedDecorationByInstance(
      current.pet.placedDecorations,
      instanceId,
    );
    if (!placed) {
      return false;
    }

    const placement = resolveDecorationPlacement(placed.decorationId);
    if (!placement || !canFlipWallDecoration(placement.decorationId)) {
      return false;
    }

    setSave({
      ...current,
      pet: {
        ...current.pet,
        placedDecorations: updatePlacedDecorationWallFlipByInstance(
          current.pet.placedDecorations,
          instanceId,
          !getPlacedDecorationWallFlipped(placed),
        ),
      },
    });

    return true;
  }, [setSave]);

  const togglePlacedCurtain = useCallback((instanceId: string) => {
    const current = saveRef.current;
    const placed = findPlacedDecorationByInstance(current.pet.placedDecorations, instanceId);
    if (!placed || !isCurtainDecorationId(placed.decorationId)) return false;
    setSave({ ...current, pet: { ...current.pet,
      placedDecorations: togglePlacedCurtainByInstance(current.pet.placedDecorations, instanceId),
    } });
    return true;
  }, [setSave]);

  const togglePlacedDecorationPower = useCallback((instanceId: string) => {
    const current = saveRef.current;
    const placed = findPlacedDecorationByInstance(current.pet.placedDecorations, instanceId);
    if (!placed || !isPoweredDecorationId(placed.decorationId)) return false;

    setSave({
      ...current,
      pet: {
        ...current.pet,
        placedDecorations: togglePlacedDecorationPowerByInstance(current.pet.placedDecorations, instanceId),
      },
    });
    return true;
  }, [setSave]);

  const rotatePlacedToy = useCallback((instanceId: string) => {
    const current = saveRef.current;
    const placed = findPlacedToyByInstance(current.pet.placedToys, instanceId);
    if (!placed) return false;
    const nextIndex = getNextRotationIndex(getPlacedToyRotationIndex(placed), TOY_ROTATION_COUNT);
    setSave({ ...current, pet: { ...current.pet,
      placedToys: updatePlacedToyRotationByInstance(current.pet.placedToys, instanceId, nextIndex),
    } });
    return true;
  }, [setSave]);

  const changeRoomItemRotation = useCallback((item: RoomLayerItem, degrees: number) => {
    const current = saveRef.current;
    const pet = setRoomItemRotation(current.pet, item, degrees);
    if (pet === current.pet) return false;
    setSave({ ...current, pet });
    return true;
  }, [setSave]);

  const scalePlacedToy = useCallback((instanceId: string, direction: "up" | "down") => {
    const current = saveRef.current;
    const placed = findPlacedToyByInstance(current.pet.placedToys, instanceId);
    if (!placed) return false;
    const scale = getPlacedToyScale(placed);
    if ((direction === "up" && !canScaleDecorationUp(scale)) ||
      (direction === "down" && !canScaleDecorationDown(scale))) return false;
    setSave({ ...current, pet: { ...current.pet,
      placedToys: updatePlacedToyScaleByInstance(current.pet.placedToys, instanceId, scaleDecorationBy(scale, direction)),
    } });
    return true;
  }, [setSave]);

  const scalePlacedDecoration = useCallback(
    (instanceId: string, direction: "up" | "down") => {
      const current = saveRef.current;
      const placed = findPlacedDecorationByInstance(
        current.pet.placedDecorations,
        instanceId,
      );
      if (!placed) {
        return false;
      }

      const currentScale = getPlacedDecorationScale(placed);
      if (
        (direction === "up" && !canScaleDecorationUp(currentScale)) ||
        (direction === "down" && !canScaleDecorationDown(currentScale))
      ) {
        return false;
      }

      const nextScale = scaleDecorationBy(currentScale, direction);

      setSave({
        ...current,
        pet: {
          ...current.pet,
          placedDecorations: updatePlacedDecorationScaleByInstance(
            current.pet.placedDecorations,
            instanceId,
            nextScale,
          ),
        },
      });

      return true;
    },
    [setSave],
  );

  const moveRoomLayerItem = useCallback(
    (item: RoomLayerItem, direction: "up" | "down") => {
      const current = saveRef.current;
      const order = normalizeRoomLayerOrder(current.pet);
      const next = shiftRoomLayerItem(order, item, direction);
      if (next === order) {
        return false;
      }

      setSave({
        ...current,
        pet: {
          ...current.pet,
          roomLayerOrder: next,
        },
      });

      return true;
    },
    [setSave],
  );

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
      commitPurchase(current, {
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
      }, "store_skin", skinId);
    }

    return attempt.result;
  }, [commitPurchase]);

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
  }, [setSave]);

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
  }, [setSave]);

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
        const clientUpdatedAt = await saveGameSave(remote.save);
        await pushRemoteSave(userId, saveId, {
          save: remote.save,
          clientUpdatedAt,
        });
        return true;
      } catch {
        return false;
      }
    },
    [userId, setSave],
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
      const clientUpdatedAt = await saveGameSave(nextSave);
      await pushRemoteSave(userId, saveId, {
        save: nextSave,
        clientUpdatedAt,
      });
      return true;
    },
    [userId, setSave],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      worldClock: save.worldClock ?? initialWorldClock,
      setWorldClock,
      setWorldWeather,
      answerPuzzle,
      feedPet,
      isReady,
      hasCompletedOnboarding: save.hasCompletedOnboarding,
      pet: save.pet,
      wallet: save.wallet,
      progress: save.progress,
      coinTransactions: save.coinTransactions ?? [],
      creditedPurchaseIds: save.creditedPurchaseIds ?? [],
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
      visitHomeRoom,
      sendCatToRoom,
      purchaseBed,
      equipBed,
      removeBedFromRoom,
      flipEquippedBed,
      scaleEquippedBed,
      purchaseToy,
      placeToyInRoom,
      removeToyFromRoom,
      scalePlacedToy,
      rotatePlacedToy,
      setRoomItemRotation: changeRoomItemRotation,
      purchaseDecoration,
      placeDecorationInRoom,
      removeDecorationFromRoom,
      rotatePlacedDecoration,
      flipPlacedDecorationWall,
      togglePlacedDecorationPower,
      togglePlacedCurtain,
      scalePlacedDecoration,
      moveRoomLayerItem,
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
      answerPuzzle,
      feedPet,
      save.coinTransactions,
      save.creditedPurchaseIds,
      save.progress,
      save.wallet,
      save.worldClock,
      initialWorldClock,
      setWorldClock,
      setWorldWeather,
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
      visitHomeRoom,
      sendCatToRoom,
      purchaseBed,
      equipBed,
      removeBedFromRoom,
      flipEquippedBed,
      scaleEquippedBed,
      purchaseToy,
      placeToyInRoom,
      removeToyFromRoom,
      scalePlacedToy,
      rotatePlacedToy,
      changeRoomItemRotation,
      purchaseDecoration,
      placeDecorationInRoom,
      removeDecorationFromRoom,
      rotatePlacedDecoration,
      flipPlacedDecorationWall,
      togglePlacedDecorationPower,
      togglePlacedCurtain,
      scalePlacedDecoration,
      moveRoomLayerItem,
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
