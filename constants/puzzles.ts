import easyPuzzles from '@/assets/puzzles/easy.json';
import hardPuzzles from '@/assets/puzzles/hard.json';
import mediumPuzzles from '@/assets/puzzles/medium.json';
import type { Puzzle, PuzzleDifficulty } from '@/types/puzzle';

export const PUZZLE_DIFFICULTIES: PuzzleDifficulty[] = ['easy', 'medium', 'hard'];

export const DIFFICULTY_LABELS: Record<PuzzleDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const PUZZLES_BY_DIFFICULTY: Record<PuzzleDifficulty, Puzzle[]> = {
  easy: easyPuzzles as Puzzle[],
  medium: mediumPuzzles as Puzzle[],
  hard: hardPuzzles as Puzzle[],
};

export function isPuzzleDifficulty(value: string): value is PuzzleDifficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

export function getPuzzleForSession(
  difficulty: PuzzleDifficulty,
  puzzleIndex: number,
): Puzzle {
  const puzzles = PUZZLES_BY_DIFFICULTY[difficulty];
  return puzzles[puzzleIndex];
}

export type PuzzlePathState = 'completed' | 'current' | 'locked';

export function getPuzzlePathState(
  puzzleIndex: number,
  solvedCount: number,
): PuzzlePathState {
  if (puzzleIndex < solvedCount) return 'completed';
  if (puzzleIndex === solvedCount) return 'current';
  return 'locked';
}

export function canPlayPuzzleIndex(
  puzzleIndex: number,
  solvedCount: number,
): boolean {
  return puzzleIndex >= 0 && puzzleIndex <= solvedCount;
}
