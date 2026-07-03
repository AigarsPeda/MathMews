import { CompareTask } from "@/components/puzzle/CompareTask";
import { FractionBuildTask } from "@/components/puzzle/FractionBuildTask";
import { MultipleChoiceTask } from "@/components/puzzle/MultipleChoiceTask";
import { OperationPathTask } from "@/components/puzzle/OperationPathTask";
import { TargetBuildTask } from "@/components/puzzle/TargetBuildTask";
import type { MathOperator, Puzzle } from "@/types/puzzle";
import {
  asComparePuzzle,
  asFractionBuildPuzzle,
  asMultipleChoicePuzzle,
  asOperationPathPuzzle,
  asTargetBuildPuzzle,
} from "@/utils/puzzle-type";

type PuzzleTaskViewProps = {
  puzzle: Puzzle;
  selectedIndex: number | null;
  selectedOperators: (MathOperator | null)[];
  fractionPieces: number;
  answered: boolean;
  isCorrect: boolean;
  onSelectChoice: (index: number) => void;
  onSelectOperator: (stepIndex: number, operator: MathOperator) => void;
  onCheckOperators: () => void;
  onChangeFractionPieces: (count: number) => void;
  onCheckFraction: () => void;
};

export function PuzzleTaskView({
  puzzle,
  selectedIndex,
  selectedOperators,
  fractionPieces,
  answered,
  isCorrect,
  onSelectChoice,
  onSelectOperator,
  onCheckOperators,
  onChangeFractionPieces,
  onCheckFraction,
}: PuzzleTaskViewProps) {
  const fractionPuzzle = asFractionBuildPuzzle(puzzle);
  if (fractionPuzzle) {
    return (
      <FractionBuildTask
        puzzle={fractionPuzzle}
        shadedPieces={fractionPieces}
        answered={answered}
        isCorrect={isCorrect}
        onChangeShaded={onChangeFractionPieces}
        onCheck={onCheckFraction}
      />
    );
  }

  const comparePuzzle = asComparePuzzle(puzzle);
  if (comparePuzzle) {
    return (
      <CompareTask
        puzzle={comparePuzzle}
        selectedIndex={selectedIndex}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const operationPathPuzzle = asOperationPathPuzzle(puzzle);
  if (operationPathPuzzle) {
    return (
      <OperationPathTask
        puzzle={operationPathPuzzle}
        selectedOperators={selectedOperators}
        answered={answered}
        isCorrect={isCorrect}
        onSelectOperator={onSelectOperator}
        onCheck={onCheckOperators}
      />
    );
  }

  const targetBuildPuzzle = asTargetBuildPuzzle(puzzle);
  if (targetBuildPuzzle) {
    return (
      <TargetBuildTask
        puzzle={targetBuildPuzzle}
        selectedOperators={selectedOperators}
        answered={answered}
        isCorrect={isCorrect}
        onSelectOperator={onSelectOperator}
        onCheck={onCheckOperators}
      />
    );
  }

  const multipleChoicePuzzle = asMultipleChoicePuzzle(puzzle);
  if (!multipleChoicePuzzle) {
    return null;
  }

  return (
    <MultipleChoiceTask
      puzzle={multipleChoicePuzzle}
      selectedIndex={selectedIndex}
      isCorrect={isCorrect}
      answered={answered}
      onSelect={onSelectChoice}
    />
  );
}
