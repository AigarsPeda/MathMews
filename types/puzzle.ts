export type PuzzleDifficulty = "easy" | "medium" | "hard";

export type PuzzleTopic =
  | "addition"
  | "subtraction"
  | "multiplication"
  | "logic"
  | "patterns"
  | "comparison"
  | "mental_math"
  | "operations"
  | "fractions"
  | "equality"
  | "estimation"
  | "division";

export type PuzzleType =
  | "multiple_choice"
  | "compare"
  | "operation_path"
  | "target_build"
  | "fraction_build"
  | "true_false"
  | "balance"
  | "number_line"
  | "pair_sum"
  | "fix_mistake"
  | "estimate"
  | "fair_share"
  | "fraction_equivalent";

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

export type FractionBuildPayload = {
  numerator: number;
  denominator: number;
};

export type TrueFalsePayload = {
  statement: string;
};

export type BalancePayload = {
  leftDisplay: string;
  rightValue: number;
  choices: string[];
};

export type NumberLinePayload = {
  start: number;
  jump: number;
  min: number;
  max: number;
  correctValue: number;
};

export type PairSumPayload = {
  numbers: number[];
  target: number;
  correctIndices: [number, number];
};

export type FixMistakePayload = {
  wrongWork: string[];
  choices: string[];
};

export type EstimatePayload = {
  expression: string;
  choices: string[];
};

export type FairSharePayload = {
  items: number;
  people: number;
  emoji: string;
  choices: string[];
};

export type FractionEquivalentPayload = {
  numerator: number;
  denominator: number;
  choices: string[];
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

export type FractionBuildPuzzle = PuzzleBase & {
  type: "fraction_build";
  payload: FractionBuildPayload;
};

export type TrueFalsePuzzle = PuzzleBase & {
  type: "true_false";
  payload: TrueFalsePayload;
  isTrue: boolean;
};

export type BalancePuzzle = PuzzleBase & {
  type: "balance";
  payload: BalancePayload;
  correctIndex: number;
};

export type NumberLinePuzzle = PuzzleBase & {
  type: "number_line";
  payload: NumberLinePayload;
};

export type PairSumPuzzle = PuzzleBase & {
  type: "pair_sum";
  payload: PairSumPayload;
};

export type FixMistakePuzzle = PuzzleBase & {
  type: "fix_mistake";
  payload: FixMistakePayload;
  correctIndex: number;
};

export type EstimatePuzzle = PuzzleBase & {
  type: "estimate";
  payload: EstimatePayload;
  correctIndex: number;
};

export type FairSharePuzzle = PuzzleBase & {
  type: "fair_share";
  payload: FairSharePayload;
  correctIndex: number;
};

export type FractionEquivalentPuzzle = PuzzleBase & {
  type: "fraction_equivalent";
  payload: FractionEquivalentPayload;
  correctIndex: number;
};

export type Puzzle =
  | MultipleChoicePuzzle
  | ComparePuzzle
  | OperationPathPuzzle
  | TargetBuildPuzzle
  | FractionBuildPuzzle
  | TrueFalsePuzzle
  | BalancePuzzle
  | NumberLinePuzzle
  | PairSumPuzzle
  | FixMistakePuzzle
  | EstimatePuzzle
  | FairSharePuzzle
  | FractionEquivalentPuzzle;

export const MATH_OPERATORS: MathOperator[] = ["+", "-", "×", "÷"];
