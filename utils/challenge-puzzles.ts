import type { OptionalChallengePuzzle, Puzzle, RouteGridPuzzle, SortBucketsPuzzle } from "@/types/puzzle";

export type ChallengeAnswer =
  | { kind: "sort"; buckets: number[] }
  | { kind: "sequence"; values: number[] }
  | { kind: "route"; cells: number[] }
  | { kind: "budget"; indices: number[] };

export function isOptionalChallengePuzzle(puzzle: Puzzle): puzzle is OptionalChallengePuzzle {
  return puzzle.type === "sort_buckets" || puzzle.type === "repair_pattern" || puzzle.type === "route_grid" || puzzle.type === "budget_plan";
}

export function getSortBucket(puzzle: SortBucketsPuzzle, index: number): number {
  const p = puzzle.payload;
  if (p.rule === "range") return p.numbers[index] < p.boundary ? 0 : 1;
  const [n, d] = p.fractions[index];
  return p.targets.findIndex(([a, b]) => n * b === a * d);
}

/** A route starts in the top-left cell and only enters adjacent, unused cells. */
export function getRouteValue(puzzle: RouteGridPuzzle, cells: readonly number[]): number | null {
  const p = puzzle.payload;
  if (cells[0] !== 0 || cells.length > p.moves + 1 || new Set(cells).size !== cells.length) return null;
  let value = p.start;
  for (let i = 1; i < cells.length; i++) {
    const index = cells[i], previous = cells[i - 1];
    if (!Number.isInteger(index) || index < 0 || index >= p.cells.length) return null;
    if (Math.abs(Math.floor(index / p.columns) - Math.floor(previous / p.columns)) + Math.abs(index % p.columns - previous % p.columns) !== 1) return null;
    const step = p.cells[index];
    if (!step) return null;
    switch (step.operator) {
      case "+": value += step.operand; break;
      case "-": value -= step.operand; break;
      case "×": value *= step.operand; break;
      case "÷": value /= step.operand; break;
    }
    if (!Number.isSafeInteger(value) || value < 0) return null;
  }
  return value;
}

export function checkChallengeAnswer(puzzle: OptionalChallengePuzzle, answer: ChallengeAnswer): boolean {
  if (puzzle.type === "sort_buckets" && answer.kind === "sort") {
    const count = puzzle.payload.rule === "range" ? puzzle.payload.numbers.length : puzzle.payload.fractions.length;
    return answer.buckets.length === count && answer.buckets.every((bucket, i) => bucket >= 0 && bucket === getSortBucket(puzzle, i));
  }
  if (puzzle.type === "repair_pattern" && answer.kind === "sequence") {
    const { solution, tiles } = puzzle.payload;
    return answer.values.length === solution.length && answer.values.every((n, i) => n === solution[i])
      && answer.values.every(n => answer.values.filter(v => v === n).length <= tiles.filter(v => v === n).length);
  }
  if (puzzle.type === "route_grid" && answer.kind === "route") {
    return answer.cells.length === puzzle.payload.moves + 1 && answer.cells.at(-1) === puzzle.payload.cells.length - 1
      && getRouteValue(puzzle, answer.cells) === puzzle.payload.target;
  }
  if (puzzle.type === "budget_plan" && answer.kind === "budget") {
    const { indices } = answer, { items, budget, remaining, pickCount } = puzzle.payload;
    if (indices.length !== pickCount || new Set(indices).size !== indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= items.length)) return false;
    const spent = indices.reduce((sum, i) => sum + items[i].price * (100 - items[i].discountPercent) / 100, 0);
    return Math.abs(budget - spent - remaining) < 0.000001;
  }
  return false;
}
