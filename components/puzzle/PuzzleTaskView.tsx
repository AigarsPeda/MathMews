import { CompareTask } from "@/components/puzzle/CompareTask";
import { MultipleChoiceTask } from "@/components/puzzle/MultipleChoiceTask";
import { OperationPathTask } from "@/components/puzzle/OperationPathTask";
import { TargetBuildTask } from "@/components/puzzle/TargetBuildTask";
import type { MathOperator, Puzzle } from "@/types/puzzle";
import {
  asComparePuzzle,
  asMultipleChoicePuzzle,
  asOperationPathPuzzle,
  asTargetBuildPuzzle,
} from "@/utils/puzzle-type";

type PuzzleTaskViewProps = {
  puzzle: Puzzle;
  selectedIndex: number | null;
  selectedOperators: (MathOperator | null)[];
  answered: boolean;
  isCorrect: boolean;
  onSelectChoice: (index: number) => void;
  onSelectOperator: (stepIndex: number, operator: MathOperator) => void;
  onCheckOperators: () => void;
};

export function PuzzleTaskView({
  puzzle,
  selectedIndex,
  selectedOperators,
  answered,
  isCorrect,
  onSelectChoice,
  onSelectOperator,
  onCheckOperators,
}: PuzzleTaskViewProps) {
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
