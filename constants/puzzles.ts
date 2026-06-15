import easyPuzzles from "@/assets/puzzles/easy.json";
import type { Puzzle } from "@/types/puzzle";

export const EASY_PUZZLES = easyPuzzles as Puzzle[];

export function getPuzzleForSession(puzzlesSolved: number): Puzzle {
  return EASY_PUZZLES[puzzlesSolved % EASY_PUZZLES.length];
}
