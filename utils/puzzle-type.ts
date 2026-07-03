import type {
  BalancePuzzle,
  ComparePuzzle,
  FixMistakePuzzle,
  FractionBuildPuzzle,
  FractionEquivalentPuzzle,
  MathOperator,
  MultipleChoicePuzzle,
  NumberLinePuzzle,
  OperationPathPuzzle,
  PairSumPuzzle,
  Puzzle,
  PuzzleType,
  TargetBuildPuzzle,
  TrueFalsePuzzle,
  EstimatePuzzle,
  FairSharePuzzle,
} from "@/types/puzzle";
import { evaluateExpression, runOperationPath } from "@/utils/puzzle-math";

const INTERACTIVE_TYPES = new Set<PuzzleType>([
  "compare",
  "operation_path",
  "target_build",
  "fraction_build",
  "true_false",
  "balance",
  "number_line",
  "pair_sum",
  "fix_mistake",
  "estimate",
  "fair_share",
  "fraction_equivalent",
]);

export function getPuzzleType(puzzle: Puzzle): PuzzleType {
  return puzzle.type ?? "multiple_choice";
}

export function getPuzzlePreview(puzzle: Puzzle): string {
  return puzzle.question;
}

export type PuzzleAnswer =
  | { kind: "choice"; index: number }
  | { kind: "operators"; operators: MathOperator[] }
  | { kind: "fraction"; shaded: number }
  | { kind: "value"; value: number }
  | { kind: "pair"; indices: [number, number] };

export function checkPuzzleAnswer(puzzle: Puzzle, answer: PuzzleAnswer): boolean {
  if (puzzle.type === "fraction_build") {
    if (answer.kind !== "fraction") return false;
    return answer.shaded === puzzle.payload.numerator;
  }

  if (puzzle.type === "operation_path") {
    if (answer.kind !== "operators") return false;
    const result = runOperationPath(
      puzzle.payload.start,
      puzzle.payload.steps,
      answer.operators,
    );
    return result === puzzle.payload.target;
  }

  if (puzzle.type === "target_build") {
    if (answer.kind !== "operators") return false;
    const result = evaluateExpression(
      puzzle.payload.numbers,
      answer.operators,
    );
    return result === puzzle.payload.target;
  }

  if (puzzle.type === "number_line") {
    if (answer.kind !== "value") return false;
    return answer.value === puzzle.payload.correctValue;
  }

  if (puzzle.type === "pair_sum") {
    if (answer.kind !== "pair") return false;
    const [a, b] = answer.indices;
    const nums = puzzle.payload.numbers;
    const [correctA, correctB] = puzzle.payload.correctIndices;
    const matchesCorrect =
      (a === correctA && b === correctB) || (a === correctB && b === correctA);
    if (!matchesCorrect) return false;
    return nums[a] + nums[b] === puzzle.payload.target;
  }

  if (puzzle.type === "true_false") {
    if (answer.kind !== "choice") return false;
    const pickedTrue = answer.index === 0;
    return pickedTrue === puzzle.isTrue;
  }

  if (answer.kind !== "choice") return false;

  if (puzzle.type === "compare") {
    return answer.index === puzzle.correctIndex;
  }

  if (
    puzzle.type === "balance" ||
    puzzle.type === "fix_mistake" ||
    puzzle.type === "estimate" ||
    puzzle.type === "fair_share" ||
    puzzle.type === "fraction_equivalent"
  ) {
    return answer.index === puzzle.correctIndex;
  }

  return answer.index === (puzzle as MultipleChoicePuzzle).correctIndex;
}

export function getCorrectOperators(puzzle: Puzzle): MathOperator[] | null {
  if (puzzle.type === "operation_path") {
    return puzzle.payload.steps.map((step) => step.operator);
  }

  if (puzzle.type === "target_build") {
    return puzzle.payload.solution;
  }

  return null;
}

export function getOperatorSlotCount(puzzle: Puzzle): number {
  if (puzzle.type === "operation_path") {
    return puzzle.payload.steps.length;
  }

  if (puzzle.type === "target_build") {
    return puzzle.payload.numbers.length - 1;
  }

  return 0;
}

export function asComparePuzzle(puzzle: Puzzle): ComparePuzzle | null {
  return puzzle.type === "compare" ? puzzle : null;
}

export function asOperationPathPuzzle(
  puzzle: Puzzle,
): OperationPathPuzzle | null {
  return puzzle.type === "operation_path" ? puzzle : null;
}

export function asTargetBuildPuzzle(puzzle: Puzzle): TargetBuildPuzzle | null {
  return puzzle.type === "target_build" ? puzzle : null;
}

export function asFractionBuildPuzzle(
  puzzle: Puzzle,
): FractionBuildPuzzle | null {
  return puzzle.type === "fraction_build" ? puzzle : null;
}

export function asTrueFalsePuzzle(puzzle: Puzzle): TrueFalsePuzzle | null {
  return puzzle.type === "true_false" ? puzzle : null;
}

export function asBalancePuzzle(puzzle: Puzzle): BalancePuzzle | null {
  return puzzle.type === "balance" ? puzzle : null;
}

export function asNumberLinePuzzle(puzzle: Puzzle): NumberLinePuzzle | null {
  return puzzle.type === "number_line" ? puzzle : null;
}

export function asPairSumPuzzle(puzzle: Puzzle): PairSumPuzzle | null {
  return puzzle.type === "pair_sum" ? puzzle : null;
}

export function asFixMistakePuzzle(puzzle: Puzzle): FixMistakePuzzle | null {
  return puzzle.type === "fix_mistake" ? puzzle : null;
}

export function asEstimatePuzzle(puzzle: Puzzle): EstimatePuzzle | null {
  return puzzle.type === "estimate" ? puzzle : null;
}

export function asFairSharePuzzle(puzzle: Puzzle): FairSharePuzzle | null {
  return puzzle.type === "fair_share" ? puzzle : null;
}

export function asFractionEquivalentPuzzle(
  puzzle: Puzzle,
): FractionEquivalentPuzzle | null {
  return puzzle.type === "fraction_equivalent" ? puzzle : null;
}

export function asMultipleChoicePuzzle(
  puzzle: Puzzle,
): MultipleChoicePuzzle | null {
  const type = getPuzzleType(puzzle);
  if (INTERACTIVE_TYPES.has(type)) {
    return null;
  }
  return puzzle as MultipleChoicePuzzle;
}
