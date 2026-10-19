import { isOpenableDecorationId } from '@/constants/item-interactions';
import { projectedWalletCoins, type WalletNotice } from "@/services/wallet/offline-orders";
import { useServerWallet, type ServerWallet } from "@/hooks/use-server-wallet";
import { getWalletEnvironment } from "@/services/wallet/environment";
import { DEFAULT_HOME_ROOM_ID, type HomeRoomId } from "@/constants/home-rooms";
import { roomDecorationEntry, type RoomDecorationEntry, type RoomDecorationTarget } from '@/utils/room-decoration-entry';
import { changeWorldClock, createWorldClock, normalizeWorldClock, normalizeWeather, type WorldClock, type WeatherMode } from '@/utils/world-clock';
import { removeRoomNavigationDoors, sendCatToRoom as moveCatToRoom, switchHomeRoom } from "@/utils/home-rooms";
import { switchRoomLayout } from "@/utils/room-layout";
import { setRoomItemRotation } from "@/utils/room-rotation";
import { applyPuzzleAnswer, applyFeed, currentPuzzleStreak } from "@/utils/game-operations";
import type { Puzzle } from "@/types/puzzle";
import { isFridgeDecorationId, isCurtainDecorationId, isPoweredDecorationId, isWallSpotlightDecorationId } from "@/constants/decoration-motion";
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
import type { PetProfile, Progress, RoomItemOffset, RoomLayerItem, Wallet } from "@/types/game";
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
} from "@/utils/bed-store";
import {
  isRoomUnlocked,
} from "@/utils/room-store";
import {
  isToyUnlocked,
  getToyOwnedCount,
} from "@/utils/toy-store";
import {
  isDecorationUnlocked,
  getDecorationOwnedCount,
} from "@/utils/decoration-store";
import {
  isSkinUnlocked,
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
  togglePlacedDecorationOpenByInstance,
  togglePlacedCurtainByInstance,
  togglePlacedFridgeByInstance,
  flipPlacedFridgeHingeByInstance,
  aimPlacedSpotlightByInstance,
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
import { clearAccountGameArchives } from '@/services/cloud-save/account-game';
import { useCloudSaveSync } from "@/hooks/use-cloud-save-sync";
import { pullRemoteSave, pushRemoteSave, listRemoteSaveSnapshots } from "@/services/cloud-save/cloud-save";
import type { CloudSaveSummary } from "@/services/cloud-save/merge-game-save";
import { listRestorableCloudSaves, listSwitchableCloudSaves } from "@/services/cloud-save/restorable-cloud-save";
import type { CoinTransaction } from "@/types/coin-transaction";
import { deleteRemoteUserData } from "@/services/cloud-save/delete-user-data";
import { clearDeletionReceipt, loadDeletionReceipt } from '@/services/cloud-save/deletion-receipt';
import { acquireAccountOperation } from '@/services/auth/account-operation';
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
import { applyLifeRegen, canBuyLife } from "@/utils/lives";
import { applyPetTimeDecay } from "@/utils/pet-care";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  answerPuzzle: (puzzle: Puzzle, correct: boolean, attemptId: string) => number | null;
  feedPet: () => boolean;
  isReady: boolean;
  hasCompletedOnboarding: boolean;
  pet: PetProfile;
  wallet: Wallet;
  progress: Progress;
  coinTransactions: CoinTransaction[];
  pendingPurchaseCount: number;
  walletNotices: WalletNotice[];
  dismissWalletNotice: (id:string) => void;
  creditedPurchaseIds: string[];
  setPet: (updater: (current: PetProfile) => PetProfile) => void;
  syncToCloud: () => Promise<void>;
  reloadProgressFromCloud: () => Promise<void>;
  setProgress: (updater: (current: Progress) => Progress) => void;
  buyLife: (expectedPrice?: number) => Promise<boolean>;
  refreshWallet: () => Promise<void>;
  isWalletReady: boolean;
  purchaseVisualHelp: (puzzleId: string, cost: number) => boolean;
  purchaseRoom: (roomId: CatRoomId, expectedPrice?: number) => Promise<RoomPurchaseResult>;
  equipRoom: (roomId: CatRoomId) => boolean;
  visitHomeRoom: (roomId: HomeRoomId) => void;
  sendCatToRoom: (roomId: HomeRoomId, follow?: boolean) => void;
  decorationEntry: RoomDecorationEntry | null;
  requestRoomDecoration: (target?: RoomDecorationTarget) => void;
  clearDecorationEntry: () => void;
  purchaseBed: (bedId: CatBedId, expectedPrice?: number) => Promise<BedPurchaseResult>;
  equipBed: (bedId: CatBedId) => boolean;
  removeBedFromRoom: () => boolean;
  flipEquippedBed: () => boolean;
  scaleEquippedBed: (direction: "up" | "down", offset?: RoomItemOffset) => boolean;
  purchaseToy: (toyId: CatToyId, expectedPrice?: number) => Promise<ToyPurchaseResult>;
  placeToyInRoom: (toyId: CatToyId) => boolean;
  removeToyFromRoom: (toyId: CatToyId, instanceId?: string) => boolean;
  scalePlacedToy: (instanceId: string, direction: "up" | "down", offset?: RoomItemOffset) => boolean;
  rotatePlacedToy: (instanceId: string) => boolean;
  setRoomItemRotation: (item: RoomLayerItem, degrees: number, offset?: RoomItemOffset) => boolean;
  purchaseDecoration: (decorationId: CatDecorationId, expectedPrice?: number) => Promise<DecorationPurchaseResult>;
  placeDecorationInRoom: (decorationId: CatDecorationId) => boolean;
  removeDecorationFromRoom: (
    decorationId: CatDecorationId,
    instanceId?: string,
  ) => boolean;
  rotatePlacedDecoration: (instanceId: string) => boolean;
  flipPlacedDecorationWall: (instanceId: string) => boolean;
  togglePlacedDecorationPower: (instanceId: string) => boolean;
  aimPlacedSpotlight: (instanceId: string, angle: number, swivel?: number) => boolean;
  togglePlacedCurtain: (instanceId: string) => boolean;
  togglePlacedDecorationOpen: (instanceId: string) => boolean;
  togglePlacedFridge: (instanceId: string, opening?: "full" | "ajar") => boolean;
  flipPlacedFridgeHinge: (instanceId: string) => boolean;
  scalePlacedDecoration: (
    instanceId: string,
    direction: "up" | "down",
    offset?: RoomItemOffset,
  ) => boolean;
  moveRoomLayerItem: (item: RoomLayerItem, direction: "up" | "down") => boolean;
  purchaseSkin: (skinId: CatSkinId, expectedPrice?: number) => Promise<SkinPurchaseResult>;
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
  deleteAllUserData: () => Promise<{ ok: true } | { ok: false; pending?: boolean; requestId?: string }>;
};

export const GameContext = createContext<GameContextValue | null>(null);

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
  const walletAuthorityRef = useRef<ServerWallet | null>(null);
  const accountRef = useRef(userId);
  useLayoutEffect(() => {
    accountRef.current = userId;
    if (walletAuthorityRef.current?.user_id !== userId) walletAuthorityRef.current = null;
  },[userId]);
  // Navigation intent is local UI state, never part of the cloud save.
  const [decorationEntry, setDecorationEntry] = useState<RoomDecorationEntry | null>(null);
  const requestRoomDecoration = useCallback((target?: RoomDecorationTarget) => {
    setDecorationEntry(roomDecorationEntry(saveRef.current.pet, target));
  }, []);
  const clearDecorationEntry = useCallback(() => setDecorationEntry(null), []);
  // Commands read and commit the latest snapshot before React renders it.
  const setSave = useCallback((update: GameSave | ((current: GameSave) => GameSave)) => {
    const candidate = typeof update === "function" ? update(saveRef.current) : update;
    const pet = removeRoomNavigationDoors(candidate.pet);
    const clock = candidate.worldClock && candidate.worldClock === saveRef.current.worldClock
      ? candidate.worldClock : normalizeWorldClock(candidate.worldClock ?? initialWorldClock);
    const streak = currentPuzzleStreak(candidate.progress);
    const progress = streak === candidate.progress.streak ? candidate.progress : { ...candidate.progress, streak };
    const authority = walletAuthorityRef.current;
    const cached = candidate.walletAuthority;
    const scoped = authority ?? ((accountRef.current === null || cached?.user_id === accountRef.current) && cached?.environment === getWalletEnvironment() ? cached : null);
    const next = { ...candidate, accountOwnerId: candidate.accountOwnerId ?? cached?.user_id, pet, progress, worldClock: clock,
      wallet: { coins: scoped ? projectedWalletCoins({...candidate,walletAuthority:scoped},scoped.user_id,scoped.environment) : cached ? 0 : candidate.wallet.coins }, walletAuthority: scoped ?? undefined };
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
    const current = saveRef.current;
    const result = applyPuzzleAnswer(current, puzzle, correct, attemptId);
    if (!result.accepted) return null;
    const pending = result.coins > 0 && accountRef.current ? [{ userId:accountRef.current,
      environment:getWalletEnvironment(), puzzleId:puzzle.id, attemptId, amount:result.coins, at:Date.now() }] : [];
    setSave({ ...result.save, wallet:current.wallet,
      pendingCoinRewards:[...(current.pendingCoinRewards ?? []),...pending] });
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
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

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
    setIsDeletingAccount(false);
    activeSaveIdRef.current = null;
  }, [userId]);

  useCloudSaveSync({
    isGameReady: isReady,
    isAuthReady,
    userId: isDeletingAccount ? null : userId,
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


  const serverWallet = useServerWallet({ userId: isDeletingAccount ? null : userId,
    enabled:isReady && isAuthReady && save.accountOwnerId===userId && cloudRestoreCheckComplete && save.hasCompletedOnboarding,
    activeSaveIdRef,getSave,setSave,authorityRef:walletAuthorityRef,syncRef:cloudSyncRef });
  const { spend:spendCoins,refresh:refreshWallet,isReady:isWalletReady } = serverWallet;


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
    if (!isReady || !isAuthReady || (userId && save.accountOwnerId !== userId)) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }

    saveGameSave(save).catch(() => {
      // Persistence failures should not block gameplay.
    });
  }, [isReady, isAuthReady, userId, save]);

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

    let dayBoundary: ReturnType<typeof setTimeout>;
    const scheduleDayBoundary = () => {
      clearTimeout(dayBoundary);
      const now = Date.now();
      const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
      dayBoundary = setTimeout(() => {
        tickGameTime(false);
        scheduleDayBoundary();
      }, midnight.getTime() - now);
    };
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active") {
        tickGameTime(true);
        scheduleDayBoundary();
      }
    };

    scheduleDayBoundary();
    const subscription = AppState.addEventListener("change", handleAppState);
    const interval = setInterval(() => tickGameTime(false), CARE_TICK_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
      clearTimeout(dayBoundary);
    };
  }, [isReady, tickGameTime]);

  const setPet = useCallback((updater: (current: PetProfile) => PetProfile) => {
    setSave((current) => ({ ...current, pet: updater(current.pet) }));
  }, [setSave]);

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
    await saveGameSave(saveRef.current);
    await cloudSyncRef.current?.();
  }, [userId, setSave]);

  const deleteAllUserData = useCallback(async (): Promise<
    { ok: true } | { ok: false; pending?: boolean; requestId?: string }
  > => {
    const release = acquireAccountOperation('auth');
    if (!release) return { ok: false };
    try {
      // Pause all local cloud writers before the request. The database also
      // rejects in-flight writes from this phone and other signed-in devices.
      setIsDeletingAccount(true);
      const result = await deleteRemoteUserData(userId);
      if (result.state === 'pending') return { ok: false, pending: true, requestId: result.id };
      if (result.state !== 'completed') {
        setIsDeletingAccount(false);
        return { ok: false };
      }

      await clearGameSave();
      const deletedUserId = userId ?? (await loadDeletionReceipt())?.userId;
      if (deletedUserId) await clearAccountGameArchives(deletedUserId);
      await clearActiveSaveId();
      await clearBackedUpSession();

      if (supabase) {
        // The server already removed the old account. Clear its local session
        // even when a global sign-out cannot reach an account that is gone.
        await supabase.auth.signOut({ scope: "local" });
      }

      const fresh = createDefaultGameSave();
      walletAuthorityRef.current = null;
      accountRef.current = null;
      skipNextPersist.current = true;
      activeSaveIdRef.current = null;
      setSave(fresh);
      await saveGameSave(fresh);
      await clearDeletionReceipt();
      if (supabase) await supabase.auth.signInAnonymously();

      return { ok: true };
    } catch {
      return { ok: false };
    } finally { release(); }
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

  const buyLife = useCallback(async (expectedPrice?: number) => {
    const current = saveRef.current;
    if (!canBuyLife(current.progress.lives,current.wallet.coins)) return false;
    const result=await spendCoins('life','one',expectedPrice);
    return result==='purchased'||result==='queued';
  },[spendCoins]);

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

  const sendCatToRoom = useCallback((roomId: HomeRoomId, follow = true) => {
    setPet(current => moveCatToRoom(current, roomId, follow));
  }, [setPet]);

  const purchaseRoom = useCallback(async (roomId: CatRoomId, expectedPrice?: number): Promise<RoomPurchaseResult> => {
    const id = resolveCatRoomId(roomId);
    if (!id) return "invalid_room";
    if (saveRef.current.progress.roomsUnlocked.includes(id)) return "already_owned";
    return spendCoins('room',id,expectedPrice);
  },[spendCoins]);

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

  const purchaseBed = useCallback(async (bedId: CatBedId, expectedPrice?: number): Promise<BedPurchaseResult> => {
    const id = resolveCatBedId(bedId);
    if (!id) return "invalid_item";
    if (saveRef.current.progress.bedsUnlocked.includes(id)) return "already_owned";
    return spendCoins('bed',id,expectedPrice);
  },[spendCoins]);

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

  const scaleEquippedBed = useCallback((direction: "up" | "down", offset?: RoomItemOffset) => {
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
        ...(offset ? { roomBedOffset: offset } : {}),
      },
    });

    return true;
  }, [setSave]);

  const purchaseToy = useCallback(async (toyId: CatToyId, expectedPrice?: number): Promise<ToyPurchaseResult> => {
    const id = resolveCatToyId(toyId);
    if (!id) return "invalid_item";
    return spendCoins('toy',id,expectedPrice);
  },[spendCoins]);

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

  const purchaseDecoration = useCallback(async (decorationId: CatDecorationId, expectedPrice?: number): Promise<DecorationPurchaseResult> => {
    const id = resolveCatDecorationId(decorationId);
    if (!id) return "invalid_item";
    return spendCoins('decoration',id,expectedPrice);
  },[spendCoins]);

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

  const aimPlacedSpotlight = useCallback((instanceId: string, angle: number, swivel?: number) => {
    const current = saveRef.current;
    const placed = findPlacedDecorationByInstance(current.pet.placedDecorations, instanceId);
    if (!placed || !isWallSpotlightDecorationId(placed.decorationId) || !Number.isFinite(angle) || (swivel !== undefined && !Number.isFinite(swivel))) return false;
    setSave({ ...current, pet: { ...current.pet,
      placedDecorations: aimPlacedSpotlightByInstance(current.pet.placedDecorations, instanceId, angle, swivel),
    } });
    return true;
  }, [setSave]);

  const flipPlacedFridgeHinge = useCallback((instanceId: string) => {
    const current = saveRef.current;
    const placed = findPlacedDecorationByInstance(current.pet.placedDecorations, instanceId);
    if (!placed || !isFridgeDecorationId(placed.decorationId)) return false;
    setSave({ ...current, pet: { ...current.pet,
      placedDecorations: flipPlacedFridgeHingeByInstance(current.pet.placedDecorations, instanceId),
    } });
    return true;
  }, [setSave]);

  const togglePlacedFridge = useCallback((instanceId: string, opening?: "full" | "ajar") => {
    const current = saveRef.current;
    const placed = findPlacedDecorationByInstance(current.pet.placedDecorations, instanceId);
    if (!placed || !isFridgeDecorationId(placed.decorationId)) return false;
    setSave({ ...current, pet: { ...current.pet,
      placedDecorations: togglePlacedFridgeByInstance(current.pet.placedDecorations, instanceId, opening),
    } });
    return true;
  }, [setSave]);

  const togglePlacedDecorationOpen = useCallback((instanceId: string) => {
    const current = saveRef.current;
    const placed = findPlacedDecorationByInstance(current.pet.placedDecorations, instanceId);
    if (placed && isOpenableDecorationId(placed.decorationId)) {
      setSave({ ...current, pet: { ...current.pet,
        placedDecorations: togglePlacedDecorationOpenByInstance(current.pet.placedDecorations, instanceId),
      } });
      return true;
    }
    // The cat can finish leaving a drawer after the player visits another room.
    const roomEntry = Object.entries(current.pet.homeRooms ?? {}).find(([roomId, room]) =>
      roomId !== (current.pet.homeRoomId ?? DEFAULT_HOME_ROOM_ID) && room.placedDecorations?.some(item => item.instanceId === instanceId && isOpenableDecorationId(item.decorationId)));
    if (!roomEntry) return false;
    const [roomId, room] = roomEntry;
    setSave({ ...current, pet: { ...current.pet, homeRooms: { ...current.pet.homeRooms,
      [roomId]: { ...room, placedDecorations: togglePlacedDecorationOpenByInstance(room.placedDecorations, instanceId) },
    } } });
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

  const changeRoomItemRotation = useCallback((item: RoomLayerItem, degrees: number, offset?: RoomItemOffset) => {
    const current = saveRef.current;
    const pet = setRoomItemRotation(current.pet, item, degrees, offset);
    if (pet === current.pet) return false;
    setSave({ ...current, pet });
    return true;
  }, [setSave]);

  const scalePlacedToy = useCallback((instanceId: string, direction: "up" | "down", offset?: RoomItemOffset) => {
    const current = saveRef.current;
    const placed = findPlacedToyByInstance(current.pet.placedToys, instanceId);
    if (!placed) return false;
    const scale = getPlacedToyScale(placed);
    if ((direction === "up" && !canScaleDecorationUp(scale)) ||
      (direction === "down" && !canScaleDecorationDown(scale))) return false;
    setSave({ ...current, pet: { ...current.pet,
      placedToys: updatePlacedToyScaleByInstance(current.pet.placedToys, instanceId, scaleDecorationBy(scale, direction), offset),
    } });
    return true;
  }, [setSave]);

  const scalePlacedDecoration = useCallback(
    (instanceId: string, direction: "up" | "down", offset?: RoomItemOffset) => {
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
        (direction === "up" && !canScaleDecorationUp(currentScale, placed.decorationId)) ||
        (direction === "down" && !canScaleDecorationDown(currentScale))
      ) {
        return false;
      }

      const nextScale = scaleDecorationBy(currentScale, direction, placed.decorationId);

      setSave({
        ...current,
        pet: {
          ...current.pet,
          placedDecorations: updatePlacedDecorationScaleByInstance(
            current.pet.placedDecorations,
            instanceId,
            nextScale,
            offset,
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

  const purchaseSkin = useCallback(async (skinId: CatSkinId, expectedPrice?: number): Promise<SkinPurchaseResult> => {
    const id = resolveCatSkinId(skinId);
    if (!id) return "invalid_item";
    if (saveRef.current.progress.skinsUnlocked.includes(id)) return "already_owned";
    return spendCoins('skin',id,expectedPrice);
  },[spendCoins]);

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

    const fresh = { ...createDefaultGameSave(), accountOwnerId: userId ?? undefined };
    skipNextPersist.current = false;
    setSave(fresh);
    await clearGameSave();
    await saveGameSave(fresh);
    setCloudRestorePromptDismissed(true);
  }, [setSave, userId]);

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
        const clientUpdatedAt = await saveGameSave(saveRef.current);
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
        accountOwnerId: userId,
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

  const dismissWalletNotice = useCallback((id:string)=>{setSave(save=>({...save,walletNotices:(save.walletNotices??[]).filter(notice=>notice.id!==id)}));},[setSave]);

  const value = useMemo<GameContextValue>(
    () => ({
      worldClock: save.worldClock ?? initialWorldClock,
      setWorldClock,
      setWorldWeather,
      answerPuzzle,
      feedPet,
      isReady: isReady && isAuthReady && (!userId || save.accountOwnerId === userId),
      hasCompletedOnboarding: save.hasCompletedOnboarding,
      pet: save.pet,
      wallet: { coins: save.walletAuthority?.user_id===userId && save.walletAuthority.environment===getWalletEnvironment() ? save.wallet.coins : 0 },
      refreshWallet,
      isWalletReady,
      progress: save.progress,
      coinTransactions: save.coinTransactions ?? [],
      pendingPurchaseCount: (save.pendingWalletPurchases??[]).filter(p=>p.userId===userId && p.environment===getWalletEnvironment() && p.status==='pending').length,
      walletNotices: save.walletNotices ?? [],
      dismissWalletNotice,
      creditedPurchaseIds: save.creditedPurchaseIds ?? [],
      setPet,
      syncToCloud,
      reloadProgressFromCloud,
      setProgress,
      buyLife,
      purchaseVisualHelp,
      purchaseRoom,
      equipRoom,
      visitHomeRoom,
      sendCatToRoom,
      decorationEntry,
      requestRoomDecoration,
      clearDecorationEntry,
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
      togglePlacedDecorationOpen,
      togglePlacedFridge,
      flipPlacedFridgeHinge,
      aimPlacedSpotlight,
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
      isAuthReady,
      save.accountOwnerId,
      recordInteraction,
      save.hasCompletedOnboarding,
      save.pet,
      answerPuzzle,
      feedPet,
      save.coinTransactions,
      save.pendingWalletPurchases,
      save.walletNotices,
      dismissWalletNotice,
      save.creditedPurchaseIds,
      save.progress,
      save.wallet,
      save.walletAuthority,
      userId,
      refreshWallet,
      isWalletReady,
      save.worldClock,
      initialWorldClock,
      setWorldClock,
      setWorldWeather,
      reloadProgressFromCloud,
      setPet,
      syncToCloud,
      setProgress,
      buyLife,
      purchaseVisualHelp,
      purchaseRoom,
      equipRoom,
      visitHomeRoom,
      sendCatToRoom,
      decorationEntry,
      requestRoomDecoration,
      clearDecorationEntry,
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
      togglePlacedDecorationOpen,
      togglePlacedFridge,
      flipPlacedFridgeHinge,
      aimPlacedSpotlight,
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
