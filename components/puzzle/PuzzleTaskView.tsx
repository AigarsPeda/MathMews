import { FindAllPairsTask } from "@/components/puzzle/FindAllPairsTask";
import { ChallengeTask } from "@/components/puzzle/ChallengeTasks";
import { isOptionalChallengePuzzle, type ChallengeAnswer } from "@/utils/challenge-puzzles";
import { BalanceTask } from "@/components/puzzle/BalanceTask";
import { CompareTask } from "@/components/puzzle/CompareTask";
import { EstimateTask } from "@/components/puzzle/EstimateTask";
import { FairShareTask } from "@/components/puzzle/FairShareTask";
import { FixMistakeTask } from "@/components/puzzle/FixMistakeTask";
import { FractionBuildTask } from "@/components/puzzle/FractionBuildTask";
import { FractionEquivalentTask } from "@/components/puzzle/FractionEquivalentTask";
import { FractionMatchTask } from "@/components/puzzle/FractionMatchTask";
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
  asFractionMatchPuzzle,
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
  onSubmitChallenge: (answer: ChallengeAnswer) => void;
  onDragStateChange: (dragging: boolean) => void;
  selectedIndex: number | null;
  selectedOperators: (MathOperator | null)[];
  fractionPieces: number;
  numberLineValue: number | null;
  pairIndices: number[];
  foundPairs: [number, number][];
  onFoundPairsChange: (pairs: [number, number][]) => void;
  onCheckPairs: () => void;
  numberOrder: number[];
  orderSubmitted: boolean;
  fractionMatchMatchedIds: string[];
  fractionMatchSelectedId: string | null;
  fractionMatchWrongIds: string[];
  fractionMatchAnswered: boolean;
  answered: boolean;
  isCorrect: boolean;
  onSelectChoice: (index: number) => void;
  onSelectOperator: (stepIndex: number, operator: MathOperator) => void;
  onCheckOperators: () => void;
  onChangeFractionPieces: (count: number) => void;
  onCheckFraction: () => void;
  onSelectNumberLineValue: (value: number) => void;
  onTogglePairIndex: (index: number) => void;
  onMoveOrder: (from: number, to: number) => void;
  onCheckOrder: () => void;
  onTapFractionMatchCard: (cardId: string) => void;
};

export function PuzzleTaskView({
  puzzle,
  onSubmitChallenge,
  onDragStateChange,
  selectedIndex,
  selectedOperators,
  fractionPieces,
  numberLineValue,
  pairIndices,
  foundPairs, onFoundPairsChange, onCheckPairs,
  numberOrder,
  orderSubmitted,
  fractionMatchMatchedIds,
  fractionMatchSelectedId,
  fractionMatchWrongIds,
  fractionMatchAnswered,
  answered,
  isCorrect,
  onSelectChoice,
  onSelectOperator,
  onCheckOperators,
  onChangeFractionPieces,
  onCheckFraction,
  onSelectNumberLineValue,
  onTogglePairIndex,
  onMoveOrder,
  onCheckOrder,
  onTapFractionMatchCard,
}: PuzzleTaskViewProps) {
  if (isOptionalChallengePuzzle(puzzle)) return <ChallengeTask puzzle={puzzle} answered={answered} onSubmit={onSubmitChallenge} onDragStateChange={onDragStateChange} />;
  if (puzzle.type === "find_all_pairs") return <FindAllPairsTask puzzle={puzzle} pairs={foundPairs} answered={answered} onChange={onFoundPairsChange} onCheck={onCheckPairs} />;
  const fractionMatchPuzzle = asFractionMatchPuzzle(puzzle);
  if (fractionMatchPuzzle) {
    return (
      <FractionMatchTask
        puzzle={fractionMatchPuzzle}
        matchedIds={fractionMatchMatchedIds}
        selectedId={fractionMatchSelectedId}
        wrongIds={fractionMatchWrongIds}
        answered={answered}
        isCorrect={isCorrect}
        onTapCard={onTapFractionMatchCard}
      />
    );
  }

  const orderNumbersPuzzle = asOrderNumbersPuzzle(puzzle);
  if (orderNumbersPuzzle) {
    return (
      <OrderNumbersTask
        puzzle={orderNumbersPuzzle}
        order={numberOrder}
        answered={answered}
        isCorrect={isCorrect}
        onMove={onMoveOrder}
        onDragStateChange={onDragStateChange}
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
