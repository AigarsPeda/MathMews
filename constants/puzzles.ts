import easy from "@/assets/puzzles/easy.json";
import medium from "@/assets/puzzles/medium.json";
import hard from "@/assets/puzzles/hard.json";
import { localizePuzzle, type PuzzleDefinition } from "@/utils/localize-puzzle";
import type { PuzzleProgress } from "@/types/game";
import type { AppLocale } from "@/types/locale";
import type { Puzzle, PuzzleDifficulty } from "@/types/puzzle";

export const PUZZLE_DIFFICULTIES: PuzzleDifficulty[] = [
  "easy",
  "medium",
  "hard",
];

const PUZZLE_DEFINITIONS = { easy, medium, hard } as unknown as Record<PuzzleDifficulty, PuzzleDefinition[]>;

export { PUZZLE_CONTENT_VERSION } from "@/constants/puzzle-content-version";

const PUZZLES_BY_LOCALE: Partial<Record<AppLocale, Partial<Record<PuzzleDifficulty, Puzzle[]>>>> = {};

export function getPuzzlesByDifficulty(
  locale: AppLocale,
  difficulty: PuzzleDifficulty,
): Puzzle[] {
  const localized = PUZZLES_BY_LOCALE[locale] ??= {};
  return localized[difficulty] ??= PUZZLE_DEFINITIONS[difficulty].map(puzzle => localizePuzzle(puzzle, locale));
}

export function isPuzzleDifficulty(value: string): value is PuzzleDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

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

/** All languages use the same puzzle definitions. */
export function getTotalPuzzleCountByDifficulty(): Record<
  PuzzleDifficulty,
  number
> {
  return PUZZLE_DIFFICULTIES.reduce(
    (totals, difficulty) => {
      totals[difficulty] = PUZZLE_DEFINITIONS[difficulty].length;
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
