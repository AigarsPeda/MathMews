import type { MathOperator, Puzzle } from "@/types/puzzle";
import type { LearningLesson, LearningLevel } from "@/types/curriculum";
import { isOptionalChallengePuzzle, getRouteValue, type ChallengeAnswer } from "@/utils/challenge-puzzles";
import { evaluateExpression, runOperationPath } from "@/utils/puzzle-math";
import { getOperatorSlotCount, getValidPairs, type PuzzleAnswer } from "@/utils/puzzle-type";

export type PuzzleDraft = {
  choice: number | null;
  operators: (MathOperator | null)[];
  shaded: number;
  numberLine: number | null;
  pairIndices: number[];
  order: number[];
  matchedCount: number;
  pairs: [number, number][];
  challenge: ChallengeAnswer | null;
};

/** A complete draft enables the shared Check button, regardless of puzzle type. */
export function getPuzzleDraftAnswer(puzzle: Puzzle, draft: PuzzleDraft): PuzzleAnswer | null {
  if (isOptionalChallengePuzzle(puzzle)) return draft.challenge;
  switch (puzzle.type) {
    case "fraction_build": return draft.shaded > 0 ? { kind: "fraction", shaded: draft.shaded } : null;
    case "operation_path":
    case "target_build":
      return draft.operators.length === getOperatorSlotCount(puzzle) && draft.operators.every(op => op !== null)
        ? { kind: "operators", operators: draft.operators as MathOperator[] } : null;
    case "number_line": return draft.numberLine === null ? null : { kind: "value", value: draft.numberLine };
    case "pair_sum": return draft.pairIndices.length === 2 ? { kind: "pair", indices: [draft.pairIndices[0], draft.pairIndices[1]] } : null;
    case "order_numbers": return draft.order.length === puzzle.payload.numbers.length ? { kind: "order", numbers: draft.order } : null;
    case "fraction_match": return draft.matchedCount === puzzle.payload.pairs.length ? { kind: "fraction_match", matchedCount: draft.matchedCount } : null;
    case "find_all_pairs": return draft.pairs.length === getValidPairs(puzzle.payload.numbers, puzzle.payload.target).length
      ? { kind: "pairs", pairs: draft.pairs } : null;
    default: return draft.choice === null ? null : { kind: "choice", index: draft.choice };
  }
}

export function getPuzzlePosition(lesson: LearningLesson, level: LearningLevel, phase: number) {
  const practice = lesson.levels.filter(item => item.kind === "practice");
  return level.kind === "practice"
    ? { current: practice.findIndex(item => item.id === level.id) + 1, total: practice.length }
    : { current: phase + 1, total: level.puzzleIds.length };
}

export type AttemptHint = { key: string };

/** Describe the attempt without exposing an unselected answer or the solution. */
export function getPuzzleAttemptHint(puzzle: Puzzle, answer: PuzzleAnswer): AttemptHint | null {
  const direction = (value: number, target: number, low: string, high: string): AttemptHint => ({
    key: value < target ? low : high,
  });
  if (puzzle.type === "fraction_build" && answer.kind === "fraction") {
    return direction(answer.shaded, puzzle.payload.numerator, "fractionTooFew", "fractionTooMany");
  }
  if (puzzle.type === "pair_sum" && answer.kind === "pair") {
    const sum = answer.indices.reduce((total, index) => total + puzzle.payload.numbers[index], 0);
    return direction(sum, puzzle.payload.target, "totalTooLow", "totalTooHigh");
  }
  if (puzzle.type === "number_line" && answer.kind === "value") {
    return direction(answer.value, puzzle.payload.correctValue, "moveRight", "moveLeft");
  }
  if (answer.kind === "operators" && (puzzle.type === "operation_path" || puzzle.type === "target_build")) {
    const value = puzzle.type === "operation_path"
      ? runOperationPath(puzzle.payload.start, puzzle.payload.steps, answer.operators)
      : evaluateExpression(puzzle.payload.numbers, answer.operators);
    if (value === null) return { key: "divisionWhole" };
    return direction(value, puzzle.payload.target, "totalTooLow", "totalTooHigh");
  }
  if (puzzle.type === "order_numbers") {
    return { key: puzzle.payload.correctOrder[0] < puzzle.payload.correctOrder.at(-1)! ? "orderAscending" : "orderDescending" };
  }
  if (puzzle.type === "sort_buckets") return { key: "sortingRule" };
  if (puzzle.type === "repair_pattern") return { key: "patternRule" };
  if (puzzle.type === "route_grid" && answer.kind === "route") {
    const value = getRouteValue(puzzle, answer.cells);
    return value === null ? { key: "routeSteps" } : direction(value, puzzle.payload.target, "totalTooLow", "totalTooHigh");
  }
  if (puzzle.type === "budget_plan" && answer.kind === "budget") {
    const { items, budget, remaining } = puzzle.payload;
    const spent = answer.indices.reduce((sum, index) => sum + items[index].price * (100 - items[index].discountPercent) / 100, 0);
    return direction(budget - spent, remaining, "budgetTooMuch", "budgetTooLittle");
  }
  return null;
}
