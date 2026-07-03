import type {
  ComparePuzzle,
  FractionBuildPuzzle,
  MathOperator,
  MultipleChoicePuzzle,
  OperationPathPuzzle,
  Puzzle,
  PuzzleType,
  TargetBuildPuzzle,
} from "@/types/puzzle";
import { evaluateExpression, runOperationPath } from "@/utils/puzzle-math";

export function getPuzzleType(puzzle: Puzzle): PuzzleType {
  return puzzle.type ?? "multiple_choice";
}

export function getPuzzlePreview(puzzle: Puzzle): string {
  return puzzle.question;
}

export type PuzzleAnswer =
  | { kind: "choice"; index: number }
  | { kind: "operators"; operators: MathOperator[] }
  | { kind: "fraction"; shaded: number };

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

  if (answer.kind !== "choice") return false;

  if (puzzle.type === "compare") {
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

export function asMultipleChoicePuzzle(
  puzzle: Puzzle,
): MultipleChoicePuzzle | null {
  if (
    puzzle.type === "compare" ||
    puzzle.type === "operation_path" ||
    puzzle.type === "target_build" ||
    puzzle.type === "fraction_build"
  ) {
    return null;
  }
  return puzzle as MultipleChoicePuzzle;
}
