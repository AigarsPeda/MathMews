import type { CatAnimationId } from "@/constants/cat-animation-clips";

export const PUZZLE_SUCCESS_REACTIONS = ["puzzleHighPaw", "puzzleProud", "puzzleBounce"] as const satisfies readonly CatAnimationId[];
export const PUZZLE_RETRY_REACTIONS = ["puzzleOops", "puzzleThink", "puzzleRecover"] as const satisfies readonly CatAnimationId[];
export type PuzzleCatReaction = typeof PUZZLE_SUCCESS_REACTIONS[number] | typeof PUZZLE_RETRY_REACTIONS[number];
