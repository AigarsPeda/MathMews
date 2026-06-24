import {
  DEFAULT_PET,
  DEFAULT_PROGRESS,
  DEFAULT_WALLET,
} from "@/constants/game";
import { resolveAsleepOnLoad } from "@/hooks/use-pet-mood";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

export function createDefaultGameSave(): GameSave {
  return {
    version: GAME_SAVE_VERSION,
    pet: { ...DEFAULT_PET, lastCareAt: Date.now() },
    wallet: DEFAULT_WALLET,
    progress: DEFAULT_PROGRESS,
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

function normalizePetProfile(pet: Record<string, unknown>): PetProfile {
  const stats = isRecord(pet.stats) ? pet.stats : {};
  return {
    type: pet.type === "cat" ? "cat" : "dog",
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

    const puzzlesSolved = normalizePuzzleProgress(
      parsed.progress.puzzlesSolved,
    );
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
    const pet = resolveAsleepOnLoad(
      applyPetTimeDecay(normalizePetProfile(parsed.pet), Date.now()),
      awayMs,
    );

    return {
      save: {
        ...(parsed as GameSave),
        pet,
        progress: {
          ...(parsed.progress as Progress),
          puzzlesSolved,
          lives,
          visualHelpsUnlocked,
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

export async function loadGameSave(): Promise<LoadedGameSave | null> {
  const raw = await AsyncStorage.getItem(GAME_SAVE_STORAGE_KEY);
  if (!raw) return null;
  return parseGameSave(raw);
}

export async function saveGameSave(save: GameSave): Promise<void> {
  await AsyncStorage.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify(save));
}

export async function clearGameSave(): Promise<void> {
  await AsyncStorage.removeItem(GAME_SAVE_STORAGE_KEY);
}
