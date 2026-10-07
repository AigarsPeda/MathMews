import { isFoodBowlDecorationId } from "@/constants/cat-supplies-decorations";
import { DEFAULT_HOME_ROOM_ID, isHomeRoomId, isRoomDoor } from "@/constants/home-rooms";
import { captureHomeRoom, removeRoomNavigationDoors, type HomeRoomState } from "@/utils/home-rooms";
import { captureRoomLayout } from "@/utils/room-layout";
import { getCompletedPuzzleIds, getSolvedCounts } from "@/utils/game-operations";
import { DEFAULT_CAT_ROOM_ID, resolveCatRoomId } from "@/constants/cat-rooms";
import { resolveCatSkinId } from "@/constants/cat-skins";
import { resolveCatBedId, canFlipBed, clampBedScale } from "@/constants/cat-beds";
import type { CatDecorationId } from "@/constants/cat-decorations";
import type { CatToyId } from "@/constants/cat-toys";
import {
  migrateLegacyPlacedDecorations,
  migrateLegacyPlacedToys,
} from "@/utils/room-placement";
import { normalizeRoomLayerOrder } from "@/utils/room-layer-order";
import {
  DEFAULT_PET,
  DEFAULT_PROGRESS,
  DEFAULT_WALLET,
} from "@/constants/game";
import { resolveAsleepOnLoad } from "@/pet-display/engine/derive-mood";
import type {
  LivesState,
  PetProfile,
  Progress,
  PuzzleProgress,
} from "@/types/game";
import {
  GAME_SAVE_STORAGE_KEY,
  GAME_SAVE_VERSION,
  type GameSave,
} from "@/types/save";
import { applyLifeRegen, createDefaultLives } from "@/utils/lives";
import { applyPetTimeDecay } from "@/utils/pet-care";
import { normalizeRoomsUnlocked } from "@/utils/room-store";
import { normalizeBedsUnlocked } from "@/utils/bed-store";
import { normalizeToysUnlocked, normalizeToyQuantities } from "@/utils/toy-store";
import {
  normalizeDecorationsUnlocked,
  normalizeDecorationQuantities,
} from "@/utils/decoration-store";
import { normalizeSkinsUnlocked } from "@/utils/skin-store";
import { normalizeTopicStats } from "@/utils/topic-stats";
import { normalizeCoinTransactions } from "@/utils/coin-ledger";
import AsyncStorage from "@react-native-async-storage/async-storage";

function createStarterFoodBowl() {
  return { decorationId: "bowlBlue", instanceId: "starter-bowl", offset: { x: 0.25, y: 0.15 } };
}

export function createDefaultGameSave(): GameSave {
  return {
    version: GAME_SAVE_VERSION,
    pet: { ...DEFAULT_PET, lastCareAt: Date.now(), lastInteractionAt: Date.now(), bedId: "brown", placedDecorations: [createStarterFoodBowl()], placedToys: [{ toyId: "orangeBall", instanceId: "starter-ball", offset: { x: 0.5, y: 0.4 } }] },
    wallet: DEFAULT_WALLET,
    progress: { ...DEFAULT_PROGRESS, bedsUnlocked: ["brown"], toysUnlocked: ["orangeBall"], toyQuantities: { orangeBall: 1 }, decorationsUnlocked: ["bowlBlue"], decorationQuantities: { bowlBlue: 1 }, completedPuzzleIds: [], processedAttemptIds: [] },
    hasCompletedOnboarding: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePuzzleProgress(value: unknown): PuzzleProgress {
  if (typeof value === "number") {
    return { easy: value, medium: 0, hard: 0 };
  }
  if (!isRecord(value)) {
    return { easy: 0, medium: 0, hard: 0 };
  }

  return {
    easy: typeof value.easy === "number" ? value.easy : 0,
    medium: typeof value.medium === "number" ? value.medium : 0,
    hard: typeof value.hard === "number" ? value.hard : 0,
  };
}

function clampOffsetAxis(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function normalizeRoomOffset(
  value: unknown,
): { x: number; y: number } | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.x !== "number" || typeof value.y !== "number") {
    return undefined;
  }
  return {
    x: clampOffsetAxis(value.x),
    y: clampOffsetAxis(value.y),
  };
}

const normalizeRoomPetOffset = normalizeRoomOffset;
const normalizeRoomBedOffset = normalizeRoomOffset;

function filterPlacedToysForUnlocked(
  placedToys: PetProfile["placedToys"],
  toysUnlocked: string[],
): PetProfile["placedToys"] {
  return (placedToys ?? []).filter((item) => toysUnlocked.includes(item.toyId));
}

function filterPlacedDecorationsForUnlocked(
  placedDecorations: PetProfile["placedDecorations"],
  decorationsUnlocked: string[],
): PetProfile["placedDecorations"] {
  return (placedDecorations ?? []).filter((item) =>
    decorationsUnlocked.includes(item.decorationId) || (isRoomDoor(item.decorationId) && isHomeRoomId(item.doorDestination)),
  );
}

function normalizeRoomLayouts(value: unknown): PetProfile["roomLayouts"] {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([id]) => resolveCatRoomId(id) === id).map(([id, layout]) => {
    const normalized = normalizePetProfile({ ...(isRecord(layout) ? layout : {}), type: "cat", roomLayouts: undefined, savedRoomLayouts: undefined });
    return [id, captureRoomLayout(normalized)];
  }));
}

function normalizeHomeRooms(value: unknown): PetProfile["homeRooms"] {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([id, room]) => isHomeRoomId(id) && isRecord(room)).map(([id, room]) => {
    const normalized = normalizePetProfile({ ...room as Record<string, unknown>, type: "cat", homeRooms: undefined });
    return [id, captureHomeRoom(normalized)];
  }));
}

function normalizePetProfile(pet: Record<string, unknown>): PetProfile {
  const stats = isRecord(pet.stats) ? pet.stats : {};
  const type = pet.type === "cat" ? "cat" : "dog";
  return {
    type,
    homeRoomId: isHomeRoomId(pet.homeRoomId) ? pet.homeRoomId : DEFAULT_HOME_ROOM_ID,
    catHomeRoomId: isHomeRoomId(pet.catHomeRoomId) ? pet.catHomeRoomId
      : isHomeRoomId(pet.homeRoomId) ? pet.homeRoomId : DEFAULT_HOME_ROOM_ID,
    homeRooms: normalizeHomeRooms(pet.homeRooms),
    name: typeof pet.name === "string" ? pet.name : DEFAULT_PET.name,
    stats: {
      hunger:
        typeof stats.hunger === "number"
          ? stats.hunger
          : DEFAULT_PET.stats.hunger,
      happiness:
        typeof stats.happiness === "number"
          ? stats.happiness
          : DEFAULT_PET.stats.happiness,
      cleanliness:
        typeof stats.cleanliness === "number"
          ? stats.cleanliness
          : DEFAULT_PET.stats.cleanliness,
      level:
        typeof stats.level === "number" ? stats.level : DEFAULT_PET.stats.level,
    },
    lastCareAt:
      typeof pet.lastCareAt === "number" ? pet.lastCareAt : Date.now(),
    lastInteractionAt:
      typeof pet.lastInteractionAt === "number"
        ? pet.lastInteractionAt
        : typeof pet.lastCareAt === "number"
          ? pet.lastCareAt
          : Date.now(),
    isAsleep: pet.isAsleep === true,
    roomId:
      typeof pet.roomId === "string"
        ? resolveCatRoomId(pet.roomId)
        : DEFAULT_CAT_ROOM_ID,
    roomLayouts: normalizeRoomLayouts(pet.roomLayouts),
    savedRoomLayouts: normalizeRoomLayouts(pet.savedRoomLayouts),
    roomPetOffset: normalizeRoomPetOffset(pet.roomPetOffset),
    bedId: resolveCatBedId(
      typeof pet.bedId === "string" ? pet.bedId : undefined,
    ),
    roomBedOffset: normalizeRoomBedOffset(pet.roomBedOffset),
    bedFlipped:
      canFlipBed(typeof pet.bedId === "string" ? pet.bedId : undefined) &&
      pet.bedFlipped === true
        ? true
        : undefined,
    bedScale:
      typeof pet.bedScale === "number"
        ? (() => {
            const scaled = clampBedScale(pet.bedScale);
            return scaled !== 1 ? scaled : undefined;
          })()
        : undefined,
    placedToys: migrateLegacyPlacedToys(pet),
    placedDecorations: migrateLegacyPlacedDecorations(pet),
    roomLayerOrder: normalizeRoomLayerOrder({
      bedId: resolveCatBedId(
        typeof pet.bedId === "string" ? pet.bedId : undefined,
      ),
      placedToys: migrateLegacyPlacedToys(pet),
      placedDecorations: migrateLegacyPlacedDecorations(pet),
      roomLayerOrder: Array.isArray(pet.roomLayerOrder)
        ? (pet.roomLayerOrder as PetProfile["roomLayerOrder"])
        : undefined,
    }),
    catSkinId: resolveCatSkinId(
      typeof pet.catSkinId === "string" ? pet.catSkinId : undefined,
    ),
  };
}

function normalizeLives(value: unknown): LivesState {
  if (!isRecord(value) || typeof value.current !== "number") {
    return createDefaultLives();
  }

  const nextRegenAt =
    value.nextRegenAt === null || typeof value.nextRegenAt === "number"
      ? value.nextRegenAt
      : null;

  return applyLifeRegen(
    {
      current: value.current,
      nextRegenAt,
    },
    Date.now(),
  );
}

function parseGameSave(
  raw: string,
): { save: GameSave; awayMsAtSessionStart: number } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== GAME_SAVE_VERSION) return null;
    if (typeof parsed.hasCompletedOnboarding !== "boolean") return null;
    if (!isRecord(parsed.pet) || typeof parsed.pet.name !== "string") {
      return null;
    }
    if (!isRecord(parsed.wallet) || typeof parsed.wallet.coins !== "number") {
      return null;
    }
    if (!isRecord(parsed.progress)) return null;
    if (typeof parsed.progress.streak !== "number") return null;

    const legacySolved = normalizePuzzleProgress(
      parsed.progress.puzzlesSolved,
    );
    const completedPuzzleIds = getCompletedPuzzleIds({ puzzlesSolved: legacySolved, completedPuzzleIds: Array.isArray(parsed.progress.completedPuzzleIds) ? parsed.progress.completedPuzzleIds.filter((id): id is string => typeof id === "string") : undefined });
    const puzzlesSolved = getSolvedCounts(completedPuzzleIds);
    const lives = normalizeLives(parsed.progress.lives);
    const visualHelpsUnlocked = Array.isArray(
      parsed.progress.visualHelpsUnlocked,
    )
      ? parsed.progress.visualHelpsUnlocked.filter(
          (id): id is string => typeof id === "string",
        )
      : [];
    const rawLastCareAt =
      isRecord(parsed.pet) && typeof parsed.pet.lastCareAt === "number"
        ? parsed.pet.lastCareAt
        : Date.now();
    const awayMs = Math.max(0, Date.now() - rawLastCareAt);
    const normalizedPet = normalizePetProfile(parsed.pet);
    const roomsUnlocked = normalizeRoomsUnlocked(
      parsed.progress.roomsUnlocked,
      resolveCatRoomId(normalizedPet.roomId),
    );
    const bedsUnlocked = normalizeBedsUnlocked(
      parsed.progress.bedsUnlocked,
      resolveCatBedId(normalizedPet.bedId),
    );
    const placedToyIds = (normalizedPet.placedToys ?? []).map(
      (item) => item.toyId,
    ) as CatToyId[];
    const placedDecorationIds = (normalizedPet.placedDecorations ?? []).map(
      (item) => item.decorationId,
    ) as CatDecorationId[];
    const toysUnlocked = normalizeToysUnlocked(
      parsed.progress.toysUnlocked,
      placedToyIds,
    );
    const decorationsUnlocked = normalizeDecorationsUnlocked(
      parsed.progress.decorationsUnlocked,
      placedDecorationIds,
    );
    // Existing players receive the same free bowl once if they do not own one.
    if (normalizedPet.type === "cat" && !decorationsUnlocked.some(isFoodBowlDecorationId)) {
      decorationsUnlocked.push("bowlBlue");
      normalizedPet.placedDecorations = [...normalizedPet.placedDecorations ?? [], createStarterFoodBowl()];
    }
    const toyQuantities = normalizeToyQuantities(
      parsed.progress.toyQuantities,
      toysUnlocked,
      normalizedPet.placedToys ?? [],
    );
    const decorationQuantities = normalizeDecorationQuantities(
      parsed.progress.decorationQuantities,
      decorationsUnlocked,
      normalizedPet.placedDecorations ?? [],
    );
    const equippedSkinId = resolveCatSkinId(normalizedPet.catSkinId);
    const skinsUnlocked = normalizeSkinsUnlocked(
      parsed.progress.skinsUnlocked,
      equippedSkinId,
    );
    const equippedRoomId = resolveCatRoomId(normalizedPet.roomId);
    const equippedBedId = resolveCatBedId(normalizedPet.bedId);
    const pet = resolveAsleepOnLoad(
      applyPetTimeDecay(
        {
          ...normalizedPet,
          homeRooms: normalizedPet.homeRooms && Object.fromEntries(Object.entries(normalizedPet.homeRooms).map(([id, room]) => [id, {
            ...room, roomId: roomsUnlocked.includes(resolveCatRoomId(room.roomId)) ? resolveCatRoomId(room.roomId) : DEFAULT_CAT_ROOM_ID,
            bedId: room.bedId && bedsUnlocked.includes(resolveCatBedId(room.bedId)!) ? resolveCatBedId(room.bedId) : undefined,
            placedToys: filterPlacedToysForUnlocked(room.placedToys, toysUnlocked),
            placedDecorations: filterPlacedDecorationsForUnlocked(room.placedDecorations, decorationsUnlocked),
          } satisfies HomeRoomState])),
          roomId: roomsUnlocked.includes(equippedRoomId)
            ? equippedRoomId
            : DEFAULT_CAT_ROOM_ID,
          bedId:
            equippedBedId && bedsUnlocked.includes(equippedBedId)
              ? equippedBedId
              : undefined,
          catSkinId: skinsUnlocked.includes(equippedSkinId)
            ? equippedSkinId
            : skinsUnlocked[0] ?? equippedSkinId,
          placedToys: filterPlacedToysForUnlocked(
            normalizedPet.placedToys,
            toysUnlocked,
          ),
          placedDecorations: filterPlacedDecorationsForUnlocked(
            normalizedPet.placedDecorations,
            decorationsUnlocked,
          ),
        },
        Date.now(),
      ),
      awayMs,
    );

    return {
      save: {
        ...(parsed as GameSave),
        pet: removeRoomNavigationDoors(pet),
        wallet: { coins: Math.max(0, Math.floor(parsed.wallet.coins)) },
        coinTransactions: normalizeCoinTransactions(parsed.coinTransactions),
        creditedPurchaseIds: [...new Set([...(Array.isArray(parsed.creditedPurchaseIds) ? parsed.creditedPurchaseIds.filter((id): id is string => typeof id === "string") : []), ...normalizeCoinTransactions(parsed.coinTransactions).filter(tx => tx.kind === "iap_purchase" && tx.transactionId).map(tx => tx.transactionId!)])],
        progress: {
          ...(parsed.progress as Progress),
          puzzleStreak:
            typeof parsed.progress.puzzleStreak === "number"
              ? parsed.progress.puzzleStreak
              : 0,
          puzzlesSolved,
        completedPuzzleIds,
        processedAttemptIds: Array.isArray(parsed.progress.processedAttemptIds) ? parsed.progress.processedAttemptIds.filter((id): id is string => typeof id === "string").slice(-200) : [],
        lastPuzzleDay: typeof parsed.progress.lastPuzzleDay === "string" ? parsed.progress.lastPuzzleDay : undefined,
          lives,
          visualHelpsUnlocked,
          roomsUnlocked,
          bedsUnlocked,
          toysUnlocked,
          toyQuantities,
          decorationsUnlocked,
          decorationQuantities,
          skinsUnlocked,
          topicStats: normalizeTopicStats(parsed.progress.topicStats),
        },
      },
      awayMsAtSessionStart: awayMs,
    };
  } catch {
    return null;
  }
}

export type LoadedGameSave = {
  save: GameSave;
  awayMsAtSessionStart: number;
};

const GAME_SAVE_UPDATED_AT_KEY = "@mathmews/game-save-updated-at";

export function parseGameSaveFromValue(value: unknown): LoadedGameSave | null {
  if (value === null || value === undefined) return null;
  try {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    return parseGameSave(raw);
  } catch {
    return null;
  }
}

export async function getLocalSaveUpdatedAt(): Promise<number> {
  const raw = await AsyncStorage.getItem(GAME_SAVE_UPDATED_AT_KEY);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadGameSave(): Promise<LoadedGameSave | null> {
  const raw = await AsyncStorage.getItem(GAME_SAVE_STORAGE_KEY);
  if (!raw) return null;
  return parseGameSave(raw);
}

let persistQueue: Promise<void> = Promise.resolve();
let lastQueuedAt = 0;
export function saveGameSave(save: GameSave): Promise<number> {
  const updatedAt = Math.max(Date.now(), lastQueuedAt + 1);
  lastQueuedAt = updatedAt;
  const raw = JSON.stringify(save);
  const write = persistQueue.catch(() => undefined).then(() => AsyncStorage.multiSet([
    [GAME_SAVE_STORAGE_KEY, raw], [GAME_SAVE_UPDATED_AT_KEY, String(updatedAt)],
  ]));
  persistQueue = write;
  return write.then(() => updatedAt);
}

export function clearGameSave(): Promise<void> {
  const write = persistQueue.catch(() => undefined).then(() => AsyncStorage.multiRemove([
    GAME_SAVE_STORAGE_KEY,
    GAME_SAVE_UPDATED_AT_KEY,
  ]));
  persistQueue = write;
  return write;
}
