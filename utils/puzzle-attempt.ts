import { getBridgeAttemptHint } from '@/utils/bridge-attempt-hint';
import { isBridgePuzzle, bridgeComplete, type BridgeState } from "@/utils/bridge-models";
import { geometryTarget } from "@/utils/geometry-models";
import { decimalTotal, type DecimalPlaceState } from "@/utils/decimal-models";
import type { FractionStripState } from "@/utils/fraction-models";
import { placeValueTarget, type PlaceValueState } from "@/utils/place-value";
import type { MathOperator, Puzzle } from "@/types/puzzle";
import type { LearningLesson, LearningLevel } from "@/types/curriculum";
import { isOptionalChallengePuzzle, getRouteValue, type ChallengeAnswer } from "@/utils/challenge-puzzles";
import { evaluateExpression, runOperationPath } from "@/utils/puzzle-math";
import { getOperatorSlotCount, getValidPairs, type PuzzleAnswer } from "@/utils/puzzle-type";

export type PuzzleDraft = {
  bridge?: BridgeState | null;
  geometry?: number | null;
  decimalGrid?: number | null;
  decimalPlace?: DecimalPlaceState | null;
  fractionStrip?: FractionStripState | null;
  placeValue?: PlaceValueState | null;
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
  if (isBridgePuzzle(puzzle)) return bridgeComplete(puzzle, draft.bridge) ? { kind: "bridge", state: draft.bridge } : null;
  if (isOptionalChallengePuzzle(puzzle)) return draft.challenge;
  switch (puzzle.type) {
    case "geometry_measure": return draft.geometry == null ? null : { kind: "geometry", value: draft.geometry };
    case "decimal_grid": return draft.decimalGrid == null ? null : { kind: "decimal_grid", shaded: draft.decimalGrid };
    case "decimal_place_value": return draft.decimalPlace ? { kind: "decimal_place", state: draft.decimalPlace } : null;
    case "fraction_number_line": return draft.numberLine == null ? null : { kind: "fraction_point", tick: draft.numberLine };
    case "fraction_strip": return draft.fractionStrip?.shaded != null ? { kind: "fraction_strip", state: draft.fractionStrip } : null;
    case "place_value": return draft.placeValue ? { kind: "place_value", state: draft.placeValue } : null;
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

export type AttemptHint = { key: string; detailKey?: string };

/** Describe the attempt without exposing an unselected answer or the solution. */
export function getPuzzleAttemptHint(puzzle: Puzzle, answer: PuzzleAnswer, attempt = 1): AttemptHint | null {
  const direction = (value: number, target: number, low: string, high: string): AttemptHint => ({
    key: value < target ? low : high,
  });
  if (isBridgePuzzle(puzzle)) return answer.kind === "bridge" ? getBridgeAttemptHint(puzzle, answer.state, attempt) : null;
  if (puzzle.type === "geometry_measure" && answer.kind === "geometry") {
    const { mode, width, height } = puzzle.payload;
    if (mode === "compare") return { key: "geometryCompare" };
    if (mode.startsWith("missing")) return { key: mode === "missing_area" ? "geometryMissingArea" : "geometryMissingPerimeter" };
    if (mode === "area" && answer.value === 2 * (width + height)) return { key: "geometryAreaNotBoundary" };
    if (mode === "perimeter" && answer.value === width * height) return { key: "geometryBoundaryNotArea" };
    return direction(answer.value, geometryTarget(puzzle), mode === "area" ? "geometryAreaLow" : "geometryPerimeterLow", mode === "area" ? "geometryAreaHigh" : "geometryPerimeterHigh");
  }
  if (puzzle.type === "decimal_grid" && answer.kind === "decimal_grid") return direction(answer.shaded * 100 / puzzle.payload.scale, puzzle.payload.hundredths, "decimalGridFew", "decimalGridMany");
  if (puzzle.type === "decimal_place_value" && answer.kind === "decimal_place") {
    if (puzzle.payload.mode !== "build") return { key: "decimalExchange" };
    return direction(decimalTotal(answer.state), puzzle.payload.hundredths, "decimalTooSmall", "decimalTooLarge");
  }
  if (puzzle.type === "fraction_number_line" && answer.kind === "fraction_point") {
    return direction(answer.tick * puzzle.payload.denominator, puzzle.payload.numerator * puzzle.payload.divisions, "moveRight", "moveLeft");
  }
  if (puzzle.type === "fraction_strip" && answer.kind === "fraction_strip") {
    const { numerator, denominator } = puzzle.payload;
    if (numerator * answer.state.parts % denominator !== 0) return { key: "fractionDifferentParts" };
    return direction((answer.state.shaded ?? 0) * denominator, numerator * answer.state.parts, "fractionTooFew", "fractionTooMany");
  }
  if (puzzle.type === "place_value" && answer.kind === "place_value") {
    if (puzzle.payload.mode === "split") return { key: "placeValueSplit" };
    if (puzzle.payload.mode === "add" && !answer.state.added) return { key: "placeValueAdd" };
    const value = answer.state.tens * 10 + answer.state.ones, target = placeValueTarget(puzzle);
    if (value === target) return { key: "placeValueBundle" };
    return direction(value, target, "totalTooLow", "totalTooHigh");
  }
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
