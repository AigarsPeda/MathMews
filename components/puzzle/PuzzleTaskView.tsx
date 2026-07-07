import { BalanceTask } from "@/components/puzzle/BalanceTask";
import { CompareTask } from "@/components/puzzle/CompareTask";
import { EstimateTask } from "@/components/puzzle/EstimateTask";
import { FairShareTask } from "@/components/puzzle/FairShareTask";
import { FixMistakeTask } from "@/components/puzzle/FixMistakeTask";
import { FractionBuildTask } from "@/components/puzzle/FractionBuildTask";
import { FractionEquivalentTask } from "@/components/puzzle/FractionEquivalentTask";
import { FunctionMachineTask } from "@/components/puzzle/FunctionMachineTask";
import { OrderNumbersTask } from "@/components/puzzle/OrderNumbersTask";
import { PatternNextTask } from "@/components/puzzle/PatternNextTask";
import { NumberLineTask } from "@/components/puzzle/NumberLineTask";
import { OperationPathTask } from "@/components/puzzle/OperationPathTask";
import { PairSumTask } from "@/components/puzzle/PairSumTask";
import { MultipleChoiceTask } from "@/components/puzzle/MultipleChoiceTask";
import { TargetBuildTask } from "@/components/puzzle/TargetBuildTask";
import { TrueFalseTask } from "@/components/puzzle/TrueFalseTask";
import type { MathOperator, Puzzle } from "@/types/puzzle";
import {
  asBalancePuzzle,
  asComparePuzzle,
  asEstimatePuzzle,
  asFairSharePuzzle,
  asFixMistakePuzzle,
  asFractionBuildPuzzle,
  asFractionEquivalentPuzzle,
  asFunctionMachinePuzzle,
  asMultipleChoicePuzzle,
  asNumberLinePuzzle,
  asOperationPathPuzzle,
  asOrderNumbersPuzzle,
  asPairSumPuzzle,
  asPatternNextPuzzle,
  asTargetBuildPuzzle,
  asTrueFalsePuzzle,
} from "@/utils/puzzle-type";

type PuzzleTaskViewProps = {
  puzzle: Puzzle;
  selectedIndex: number | null;
  selectedOperators: (MathOperator | null)[];
  fractionPieces: number;
  numberLineValue: number | null;
  pairIndices: number[];
  numberOrder: number[];
  orderSwapIndex: number | null;
  orderSubmitted: boolean;
  answered: boolean;
  isCorrect: boolean;
  onSelectChoice: (index: number) => void;
  onSelectOperator: (stepIndex: number, operator: MathOperator) => void;
  onCheckOperators: () => void;
  onChangeFractionPieces: (count: number) => void;
  onCheckFraction: () => void;
  onSelectNumberLineValue: (value: number) => void;
  onTogglePairIndex: (index: number) => void;
  onTapOrderIndex: (index: number) => void;
  onCheckOrder: () => void;
};

export function PuzzleTaskView({
  puzzle,
  selectedIndex,
  selectedOperators,
  fractionPieces,
  numberLineValue,
  pairIndices,
  numberOrder,
  orderSwapIndex,
  orderSubmitted,
  answered,
  isCorrect,
  onSelectChoice,
  onSelectOperator,
  onCheckOperators,
  onChangeFractionPieces,
  onCheckFraction,
  onSelectNumberLineValue,
  onTogglePairIndex,
  onTapOrderIndex,
  onCheckOrder,
}: PuzzleTaskViewProps) {
  const orderNumbersPuzzle = asOrderNumbersPuzzle(puzzle);
  if (orderNumbersPuzzle) {
    return (
      <OrderNumbersTask
        puzzle={orderNumbersPuzzle}
        order={numberOrder}
        selectedSwapIndex={orderSwapIndex}
        answered={answered}
        isCorrect={isCorrect}
        onTapIndex={onTapOrderIndex}
        onCheck={onCheckOrder}
      />
    );
  }

  const patternNextPuzzle = asPatternNextPuzzle(puzzle);
  if (patternNextPuzzle) {
    return (
      <PatternNextTask
        puzzle={patternNextPuzzle}
        selectedIndex={selectedIndex}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const functionMachinePuzzle = asFunctionMachinePuzzle(puzzle);
  if (functionMachinePuzzle) {
    return (
      <FunctionMachineTask
        puzzle={functionMachinePuzzle}
        selectedIndex={selectedIndex}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

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

  const numberLinePuzzle = asNumberLinePuzzle(puzzle);
  if (numberLinePuzzle) {
    return (
      <NumberLineTask
        puzzle={numberLinePuzzle}
        selectedValue={numberLineValue}
        answered={answered}
        isCorrect={isCorrect}
        onSelectValue={onSelectNumberLineValue}
      />
    );
  }

  const pairSumPuzzle = asPairSumPuzzle(puzzle);
  if (pairSumPuzzle) {
    return (
      <PairSumTask
        puzzle={pairSumPuzzle}
        selectedIndices={pairIndices}
        answered={answered}
        isCorrect={isCorrect}
        onToggleIndex={onTogglePairIndex}
      />
    );
  }

  const trueFalsePuzzle = asTrueFalsePuzzle(puzzle);
  if (trueFalsePuzzle) {
    return (
      <TrueFalseTask
        puzzle={trueFalsePuzzle}
        selectedIndex={selectedIndex}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const balancePuzzle = asBalancePuzzle(puzzle);
  if (balancePuzzle) {
    return (
      <BalanceTask
        puzzle={balancePuzzle}
        selectedIndex={selectedIndex}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const fixMistakePuzzle = asFixMistakePuzzle(puzzle);
  if (fixMistakePuzzle) {
    return (
      <FixMistakeTask
        puzzle={fixMistakePuzzle}
        selectedIndex={selectedIndex}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const estimatePuzzle = asEstimatePuzzle(puzzle);
  if (estimatePuzzle) {
    return (
      <EstimateTask
        puzzle={estimatePuzzle}
        selectedIndex={selectedIndex}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const fairSharePuzzle = asFairSharePuzzle(puzzle);
  if (fairSharePuzzle) {
    return (
      <FairShareTask
        puzzle={fairSharePuzzle}
        selectedIndex={selectedIndex}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const fractionEquivalentPuzzle = asFractionEquivalentPuzzle(puzzle);
  if (fractionEquivalentPuzzle) {
    return (
      <FractionEquivalentTask
        puzzle={fractionEquivalentPuzzle}
        selectedIndex={selectedIndex}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
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
