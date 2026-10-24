import easyEn from "@/assets/puzzles/easy.json";
import hardEn from "@/assets/puzzles/hard.json";
import easyLv from "@/assets/puzzles/lv/easy.json";
import hardLv from "@/assets/puzzles/lv/hard.json";
import mediumLv from "@/assets/puzzles/lv/medium.json";
import mediumEn from "@/assets/puzzles/medium.json";
import type { PuzzleProgress } from "@/types/game";
import type { AppLocale } from "@/types/locale";
import type { Puzzle, PuzzleDifficulty } from "@/types/puzzle";

export const PUZZLE_DIFFICULTIES: PuzzleDifficulty[] = [
  "easy",
  "medium",
  "hard",
];

const AUTHORED_PUZZLES: Record<
  AppLocale,
  Record<PuzzleDifficulty, Puzzle[]>
> = {
  en: {
    easy: easyEn as unknown as Puzzle[],
    medium: mediumEn as unknown as Puzzle[],
    hard: hardEn as unknown as Puzzle[],
  },
  lv: {
    easy: easyLv as unknown as Puzzle[],
    medium: mediumLv as unknown as Puzzle[],
    hard: hardLv as unknown as Puzzle[],
  },
};

export { PUZZLE_CONTENT_VERSION } from "@/constants/puzzle-content-version";

const PUZZLES_BY_LOCALE = AUTHORED_PUZZLES;

export function getPuzzlesByDifficulty(
  locale: AppLocale,
  difficulty: PuzzleDifficulty,
): Puzzle[] {
  return PUZZLES_BY_LOCALE[locale][difficulty];
}

export function isPuzzleDifficulty(value: string): value is PuzzleDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

export type PuzzlePathState = "completed" | "current" | "locked";

export function isDifficultyComplete(
  locale: AppLocale,
  difficulty: PuzzleDifficulty,
  puzzlesSolved: PuzzleProgress,
): boolean {
  const total = getPuzzlesByDifficulty(locale, difficulty).length;
  return puzzlesSolved[difficulty] >= total;
}

export function hasIncompletePuzzles(
  locale: AppLocale,
  puzzlesSolved: PuzzleProgress,
): boolean {
  return PUZZLE_DIFFICULTIES.some(
    (difficulty) => !isDifficultyComplete(locale, difficulty, puzzlesSolved),
  );
}

const LOCALES = Object.keys(PUZZLES_BY_LOCALE) as AppLocale[];

/** Max puzzle count per tier — grows when new puzzles ship in any locale. */
export function getTotalPuzzleCountByDifficulty(): Record<
  PuzzleDifficulty,
  number
> {
  return PUZZLE_DIFFICULTIES.reduce(
    (totals, difficulty) => {
      totals[difficulty] = Math.max(
        ...LOCALES.map((locale) => getPuzzlesByDifficulty(locale, difficulty).length),
      );
      return totals;
    },
    { easy: 0, medium: 0, hard: 0 } as Record<PuzzleDifficulty, number>,
  );
}

/**
 * Puzzle mastery (0–100). Only rises when new nuts are cracked; drops when
 * new puzzles are added and the player has not solved them yet.
 */
export function computePetWisdom(puzzlesSolved: PuzzleProgress, completedPuzzleIds?: readonly string[]): number {
  const totals = getTotalPuzzleCountByDifficulty();
  let solved = 0;
  let available = 0;
  const completed = completedPuzzleIds ? new Set(completedPuzzleIds) : null;

  for (const difficulty of PUZZLE_DIFFICULTIES) {
    available += totals[difficulty];
    solved += completed
      ? getPuzzlesByDifficulty("en", difficulty).filter(puzzle => completed.has(puzzle.id)).length
      : Math.min(puzzlesSolved[difficulty], totals[difficulty]);
  }

  if (available === 0) return 0;
  return Math.round((solved / available) * 100);
}
