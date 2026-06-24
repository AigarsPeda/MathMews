import easyEn from "@/assets/puzzles/easy.json";
import hardEn from "@/assets/puzzles/hard.json";
import easyLv from "@/assets/puzzles/lv/easy.json";
import hardLv from "@/assets/puzzles/lv/hard.json";
import mediumLv from "@/assets/puzzles/lv/medium.json";
import mediumEn from "@/assets/puzzles/medium.json";
import type { AppLocale } from "@/types/locale";
import type { Puzzle, PuzzleDifficulty } from "@/types/puzzle";

export const PUZZLE_DIFFICULTIES: PuzzleDifficulty[] = [
  "easy",
  "medium",
  "hard",
];

const PUZZLES_BY_LOCALE: Record<
  AppLocale,
  Record<PuzzleDifficulty, Puzzle[]>
> = {
  en: {
    easy: easyEn as Puzzle[],
    medium: mediumEn as Puzzle[],
    hard: hardEn as Puzzle[],
  },
  lv: {
    easy: easyLv as Puzzle[],
    medium: mediumLv as Puzzle[],
    hard: hardLv as Puzzle[],
  },
};

export function getPuzzlesByDifficulty(
  locale: AppLocale,
  difficulty: PuzzleDifficulty,
): Puzzle[] {
  return PUZZLES_BY_LOCALE[locale][difficulty];
}

export function isPuzzleDifficulty(value: string): value is PuzzleDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

export function getPuzzleForSession(
  locale: AppLocale,
  difficulty: PuzzleDifficulty,
  puzzleIndex: number,
): Puzzle {
  const puzzles = getPuzzlesByDifficulty(locale, difficulty);
  return puzzles[puzzleIndex];
}

export type PuzzlePathState = "completed" | "current" | "locked";

export function getPuzzlePathState(
  puzzleIndex: number,
  solvedCount: number,
): PuzzlePathState {
  if (puzzleIndex < solvedCount) return "completed";
  if (puzzleIndex === solvedCount) return "current";
  return "locked";
}

export function canPlayPuzzleIndex(
  puzzleIndex: number,
  solvedCount: number,
): boolean {
  return puzzleIndex >= 0 && puzzleIndex <= solvedCount;
}
