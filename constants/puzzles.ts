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

// Keep the authored order for migrating saves that stored counts without IDs.
// Stable IDs also let previously solved number-line puzzles remain replayable.
export function getLegacyCompletedPuzzleIds(counts: PuzzleProgress): string[] {
  return PUZZLE_DIFFICULTIES.flatMap(tier =>
    AUTHORED_PUZZLES.en[tier].slice(0, Math.max(0, counts[tier])).map(puzzle => puzzle.id));
}

const PUZZLES_BY_LOCALE = Object.fromEntries(
  (Object.keys(AUTHORED_PUZZLES) as AppLocale[]).map(locale => {
    const authored = AUTHORED_PUZZLES[locale];
    const moved = [...authored.easy, ...authored.medium]
      .filter(puzzle => puzzle.type === "number_line")
      .map(puzzle => ({ ...puzzle, difficulty: "hard" as const }));
    return [locale, {
      easy: authored.easy.filter(puzzle => puzzle.type !== "number_line"),
      medium: authored.medium.filter(puzzle => puzzle.type !== "number_line"),
      hard: [...authored.hard, ...moved],
    }];
  }),
) as Record<AppLocale, Record<PuzzleDifficulty, Puzzle[]>>;

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
  completed?: boolean,
): PuzzlePathState {
  if (completed === true || (completed === undefined && puzzleIndex < solvedCount)) return "completed";
  if (puzzleIndex === solvedCount) return "current";
  return "locked";
}

export function canPlayPuzzleIndex(
  puzzleIndex: number,
  solvedCount: number,
  completed = false,
): boolean {
  return puzzleIndex >= 0 && (completed || puzzleIndex <= solvedCount);
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

/** First difficulty after `after` that still has unsolved puzzles, if any. */
export function getNextIncompleteDifficulty(
  locale: AppLocale,
  puzzlesSolved: PuzzleProgress,
  after: PuzzleDifficulty,
): PuzzleDifficulty | null {
  const startIndex = PUZZLE_DIFFICULTIES.indexOf(after) + 1;
  for (let i = startIndex; i < PUZZLE_DIFFICULTIES.length; i++) {
    const difficulty = PUZZLE_DIFFICULTIES[i];
    if (!isDifficultyComplete(locale, difficulty, puzzlesSolved)) {
      return difficulty;
    }
  }
  return null;
}

/** Prefer `requested` when it has work left; otherwise advance to the next incomplete tier. */
export function resolvePuzzlePathDifficulty(
  locale: AppLocale,
  puzzlesSolved: PuzzleProgress,
  requested: PuzzleDifficulty,
): PuzzleDifficulty {
  if (!isDifficultyComplete(locale, requested, puzzlesSolved)) {
    return requested;
  }
  return getNextIncompleteDifficulty(locale, puzzlesSolved, requested) ?? requested;
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
