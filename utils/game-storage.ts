import {
  DEFAULT_PET,
  DEFAULT_PROGRESS,
  DEFAULT_WALLET,
} from "@/constants/game";
import type { Progress, PuzzleProgress } from "@/types/game";
import {
  GAME_SAVE_STORAGE_KEY,
  GAME_SAVE_VERSION,
  type GameSave,
} from "@/types/save";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function createDefaultGameSave(): GameSave {
  return {
    version: GAME_SAVE_VERSION,
    pet: DEFAULT_PET,
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

function parseGameSave(raw: string): GameSave | null {
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

    const puzzlesSolved = normalizePuzzleProgress(parsed.progress.puzzlesSolved);

    return {
      ...(parsed as GameSave),
      progress: {
        ...(parsed.progress as Progress),
        puzzlesSolved,
      },
    };
  } catch {
    return null;
  }
}

export async function loadGameSave(): Promise<GameSave | null> {
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
