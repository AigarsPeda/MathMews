export type PuzzleDifficulty = "easy" | "medium" | "hard";

export type PuzzleTopic =
  | "addition"
  | "subtraction"
  | "multiplication"
  | "logic"
  | "patterns"
  | "comparison"
  | "mental_math"
  | "operations";

export type PuzzleType =
  | "multiple_choice"
  | "compare"
  | "operation_path"
  | "target_build";

export type MathOperator = "+" | "-" | "×" | "÷";

export type OperationPathStep = {
  operand: number;
  operator: MathOperator;
};

export type OperationPathPayload = {
  start: number;
  target: number;
  steps: OperationPathStep[];
};

export type TargetBuildPayload = {
  numbers: number[];
  target: number;
  /** One operator between each pair of numbers. */
  solution: MathOperator[];
};

export type ComparePayload = {
  optionA: string;
  optionB: string;
};

type PuzzleBase = {
  id: string;
  difficulty: PuzzleDifficulty;
  question: string;
  hint: string;
  explanation: string;
  topic: PuzzleTopic;
  ageRange: [number, number];
};

export type MultipleChoicePuzzle = PuzzleBase & {
  type?: "multiple_choice";
  choices: string[];
  correctIndex: number;
};

export type ComparePuzzle = PuzzleBase & {
  type: "compare";
  payload: ComparePayload;
  correctIndex: 0 | 1;
};

export type OperationPathPuzzle = PuzzleBase & {
  type: "operation_path";
  payload: OperationPathPayload;
};

export type TargetBuildPuzzle = PuzzleBase & {
  type: "target_build";
  payload: TargetBuildPayload;
};

export type Puzzle =
  | MultipleChoicePuzzle
  | ComparePuzzle
  | OperationPathPuzzle
  | TargetBuildPuzzle;

export const MATH_OPERATORS: MathOperator[] = ["+", "-", "×", "÷"];
