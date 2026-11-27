import type { CheckedAttempt } from '@/utils/checked-attempt';
import type { ComponentType, ReactNode } from 'react';
import { BridgeTask } from "@/components/puzzle/BridgeTask";
import { PuzzleResponseTask } from '@/components/puzzle/PuzzleResponseTask';
import type { ResponseValue } from '@/utils/puzzle-response';
import { isBridgePuzzle, type BridgeState } from "@/utils/bridge-models";
import { GeometryMeasureTask } from "@/components/puzzle/GeometryMeasureTask";
import { DecimalGridTask } from "@/components/puzzle/DecimalGridTask";
import { DecimalPlaceValueTask } from "@/components/puzzle/DecimalPlaceValueTask";
import type { DecimalPlaceState } from "@/utils/decimal-models";
import { FractionNumberLineTask } from "@/components/puzzle/FractionNumberLineTask";
import { FractionStripTask } from "@/components/puzzle/FractionStripTask";
import type { FractionStripState } from "@/utils/fraction-models";
import { PlaceValueTask } from "@/components/puzzle/PlaceValueTask";
import type { PlaceValueState } from "@/utils/place-value";
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
  storyHostsAnswer?: boolean;
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  playbackOwnsControls?: boolean;
  retainPracticeDrawing?: boolean;
  checkedModel?: ReactNode;
  checkedAttempt?: CheckedAttempt;
  initialChallengeAnswer?: ChallengeAnswer | null;
  initialDistribution?: readonly number[];
  decimalCells?: readonly number[];
  onDecimalSelectionChange?: (cells: readonly number[]) => void;
  onDistributionChange?: (locations: number[]) => void;
  onSolutionShown?: () => void;
  onUseHelp?: () => void;
  puzzle: Puzzle;
  responseValue?: ResponseValue;
  onResponseChange?: (value: ResponseValue) => void;
  bridge?: BridgeState | null;
  onBridgeChange?: (value: BridgeState | null) => void;
  geometry: number | null;
  onGeometryChange: (value: number | null) => void;
  decimalGrid: number | null;
  onDecimalGridChange: (value: number | null) => void;
  decimalPlace: DecimalPlaceState | null;
  onDecimalPlaceChange: (value: DecimalPlaceState | null) => void;
  fractionStrip: FractionStripState | null;
  onFractionStripChange: (state: FractionStripState | null) => void;
  placeValue: PlaceValueState | null;
  onPlaceValueChange: (state: PlaceValueState | null) => void;
  onChallengeAnswerChange: (answer: ChallengeAnswer | null) => void;
  onDragStateChange: (dragging: boolean) => void;
  selectedIndex: number | null;
  selectedOperators: (MathOperator | null)[];
  fractionPieces: number;
  fractionSelectedSlices: readonly number[];
  numberLineValue: number | null;
  pairIndices: number[];
  foundPairs: [number, number][];
  onFoundPairsChange: (pairs: [number, number][]) => void;
  numberOrder: number[];
  selectedByPair?: readonly (readonly number[])[];
  onToggleWedge?: (pairIndex: number, wedge: number) => void;
  fractionMatchMatchedIds?: string[];
  fractionMatchSelectedId?: string | null;
  fractionMatchWrongIds?: string[];
  answered: boolean;
  incorrectAttempt?: boolean;
  isCorrect: boolean;
  hasLives?: boolean;
  onIncorrectAttempt?: () => boolean;
  onSelectChoice: (index: number | null) => void;
  onSelectOperator: (stepIndex: number, operator: MathOperator) => void;
  onChangeFractionPieces: (count: number) => void;
  onToggleFractionSlice: (index: number) => void;
  onSelectNumberLineValue: (value: number) => void;
  onTogglePairIndex: (index: number) => void;
  onPairChange: (indices: number[]) => void;
  onMoveOrder: (from: number, to: number) => void;
  onSwapOrder: (from: number, to: number) => void;
  onTapFractionMatchCard?: (cardId: string) => void;
};

export function PuzzleTaskView({
  AnswerRow, storyHostsAnswer, playbackOwnsControls = false, retainPracticeDrawing, checkedModel, checkedAttempt, initialChallengeAnswer, initialDistribution, decimalCells, onDecimalSelectionChange, onDistributionChange, onSolutionShown, onUseHelp,
  puzzle,
  responseValue = null, onResponseChange,
  bridge, onBridgeChange,
  geometry, onGeometryChange,
  decimalGrid, onDecimalGridChange, decimalPlace, onDecimalPlaceChange,
  fractionStrip, onFractionStripChange,
  placeValue, onPlaceValueChange,
  onChallengeAnswerChange,
  onDragStateChange,
  selectedIndex,
  selectedOperators,
  fractionPieces,
  fractionSelectedSlices,
  numberLineValue,
  pairIndices,
  foundPairs, onFoundPairsChange,
  numberOrder,
  selectedByPair, onToggleWedge,
  fractionMatchMatchedIds = [],
  fractionMatchSelectedId = null,
  fractionMatchWrongIds = [],
  answered,
  incorrectAttempt = false,
  isCorrect,
  hasLives = true,
  onIncorrectAttempt,
  onSelectChoice,
  onSelectOperator,
  onChangeFractionPieces,
  onToggleFractionSlice,
  onSelectNumberLineValue,
  onTogglePairIndex,
  onPairChange,
  onMoveOrder,
  onSwapOrder,
  onTapFractionMatchCard = () => {},
}: PuzzleTaskViewProps) {
  const checkedResult = checkedAttempt ? checkedAttempt.correct ? 'correct' as const : 'wrong' as const : undefined;
  if (puzzle.response && onResponseChange) {
    const rowAttempt = puzzle.type === 'geometry_measure' && puzzle.payload.mode === 'missing_area' && checkedAttempt?.answer.kind === 'response' ? checkedAttempt : undefined;
    return <PuzzleResponseTask storyHostsAnswer={storyHostsAnswer} playbackOwnsControls={playbackOwnsControls} AnswerRow={AnswerRow} checkedModel={checkedModel} initialDistribution={initialDistribution} onDistributionChange={onDistributionChange} onSolutionShown={onSolutionShown} puzzle={puzzle}
      value={rowAttempt?.answer.kind === 'response' ? rowAttempt.answer.value : responseValue} onChange={onResponseChange} answered={answered} incorrectAttempt={incorrectAttempt} isCorrect={rowAttempt?.correct ?? isCorrect} />;
  }
  if (playbackOwnsControls && !puzzle.response && isBridgePuzzle(puzzle) && checkedModel) return <>{checkedModel}</>;
  if (isBridgePuzzle(puzzle) && onBridgeChange) return <BridgeTask {...{ AnswerRow, checkedModel, checkedResult, playbackOwnsControls }} readOnly={playbackOwnsControls && !checkedModel} puzzle={puzzle} value={bridge ?? null} onChange={onBridgeChange} answered={answered} />;
  if (puzzle.type === "geometry_measure") return <GeometryMeasureTask {...{ AnswerRow, checkedModel, checkedResult, playbackOwnsControls }} readOnly={playbackOwnsControls} onSolutionShown={onSolutionShown} puzzle={puzzle} value={geometry} onChange={onGeometryChange} answered={answered} />;
  if (puzzle.type === "decimal_grid") return <DecimalGridTask selectedCells={decimalCells} onSelectionChange={onDecimalSelectionChange} puzzle={puzzle} value={decimalGrid} onChange={onDecimalGridChange} answered={answered} />;
  if (puzzle.type === "decimal_place_value") return <DecimalPlaceValueTask puzzle={puzzle} value={decimalPlace} onChange={onDecimalPlaceChange} answered={answered} />;
  if (puzzle.type === "fraction_number_line") return <FractionNumberLineTask AnswerRow={AnswerRow} puzzle={puzzle} value={numberLineValue} onChange={onSelectNumberLineValue} answered={answered} />;
  if (puzzle.type === "fraction_strip") return <FractionStripTask AnswerRow={AnswerRow} puzzle={puzzle} value={fractionStrip} onChange={onFractionStripChange} answered={answered} />;
  if (puzzle.type === "place_value") return <PlaceValueTask AnswerRow={AnswerRow} puzzle={puzzle}
    value={checkedAttempt?.answer.kind === 'place_value' ? checkedAttempt.answer.state : placeValue} onChange={onPlaceValueChange} answered={answered} retryOnly={checkedAttempt?.correct === false} />;
  if (isOptionalChallengePuzzle(puzzle)) return <ChallengeTask {...{ initialAnswer: initialChallengeAnswer, initialIndices: initialChallengeAnswer?.kind === "budget" ? initialChallengeAnswer.indices : undefined }} puzzle={puzzle} answered={answered} onAnswerChange={onChallengeAnswerChange} onDragStateChange={onDragStateChange} />;
  if (puzzle.type === "find_all_pairs") return <FindAllPairsTask AnswerRow={AnswerRow} puzzle={puzzle} pairs={foundPairs} answered={answered} canAttempt={hasLives} onIncorrectAttempt={onIncorrectAttempt} onChange={onFoundPairsChange} />;
  const fractionMatchPuzzle = asFractionMatchPuzzle(puzzle);
  if (fractionMatchPuzzle) {
    return (
      <FractionMatchTask
        canAttempt={hasLives}
        puzzle={fractionMatchPuzzle}
        selectedByPair={selectedByPair} onToggleWedge={onToggleWedge}
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
        onSwap={onSwapOrder}
        onDragStateChange={onDragStateChange}
      />
    );
  }

  const patternNextPuzzle = asPatternNextPuzzle(puzzle);
  if (patternNextPuzzle) {
    return (
      <PatternNextTask AnswerRow={AnswerRow}
        puzzle={patternNextPuzzle}
        onDragStateChange={onDragStateChange}
        selectedIndex={selectedIndex}
        incorrectAttempt={incorrectAttempt}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const functionMachinePuzzle = asFunctionMachinePuzzle(puzzle);
  if (functionMachinePuzzle) {
    return (
      <FunctionMachineTask AnswerRow={AnswerRow}
        puzzle={functionMachinePuzzle}
        selectedIndex={selectedIndex}
        incorrectAttempt={incorrectAttempt}
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
        selectedSlices={fractionSelectedSlices}
        answered={answered}
        isCorrect={isCorrect}
        onChangeShaded={onChangeFractionPieces}
        onToggleSlice={onToggleFractionSlice}
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
      <PairSumTask AnswerRow={AnswerRow}
        puzzle={pairSumPuzzle}
        selectedIndices={pairIndices}
        answered={answered}
        isCorrect={isCorrect}
        onToggleIndex={onTogglePairIndex}
        onPairChange={onPairChange}
        onDragStateChange={onDragStateChange}
      />
    );
  }

  const trueFalsePuzzle = asTrueFalsePuzzle(puzzle);
  if (trueFalsePuzzle) {
    const hostedProof = playbackOwnsControls ? checkedModel : undefined;
    return <>
      {hostedProof}
      <TrueFalseTask arithmeticModel playbackOwnsControls={playbackOwnsControls} AnswerRow={AnswerRow} hasHostedProof={hostedProof != null}
        puzzle={trueFalsePuzzle}
        selectedIndex={selectedIndex}
        incorrectAttempt={incorrectAttempt}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    </>;
  }

  const balancePuzzle = asBalancePuzzle(puzzle);
  if (balancePuzzle) {
    return (
      <BalanceTask AnswerRow={AnswerRow}
        onSolutionShown={onSolutionShown}
        puzzle={balancePuzzle}
        selectedIndex={selectedIndex}
        incorrectAttempt={incorrectAttempt}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const fixMistakePuzzle = asFixMistakePuzzle(puzzle);
  if (fixMistakePuzzle) {
    return (
      <FixMistakeTask {...{ AnswerRow, checkedModel, checkedResult }}
        puzzle={fixMistakePuzzle}
        selectedIndex={selectedIndex}
        incorrectAttempt={incorrectAttempt}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const estimatePuzzle = asEstimatePuzzle(puzzle);
  if (estimatePuzzle) {
    return (
      <EstimateTask {...{ AnswerRow, checkedModel, checkedResult }}
        puzzle={estimatePuzzle}
        selectedIndex={selectedIndex}
        incorrectAttempt={incorrectAttempt}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const fairSharePuzzle = asFairSharePuzzle(puzzle);
  if (fairSharePuzzle) {
    return (
      <FairShareTask {...{ AnswerRow, checkedModel, checkedResult, playbackOwnsControls }} initialDistribution={initialDistribution} onDistributionChange={onDistributionChange}
        puzzle={fairSharePuzzle}
        onUseHelp={onUseHelp}
        selectedIndex={selectedIndex}
        incorrectAttempt={incorrectAttempt}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const fractionEquivalentPuzzle = asFractionEquivalentPuzzle(puzzle);
  if (fractionEquivalentPuzzle) {
    return (
      <FractionEquivalentTask {...{ AnswerRow, checkedModel, checkedResult, playbackOwnsControls }}
        puzzle={fractionEquivalentPuzzle}
        selectedIndex={selectedIndex}
        incorrectAttempt={incorrectAttempt}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const comparePuzzle = asComparePuzzle(puzzle);
  if (comparePuzzle) {
    return (
      <CompareTask {...{ playbackOwnsControls, checkedModel }}
        puzzle={comparePuzzle}
        selectedIndex={selectedIndex}
        incorrectAttempt={incorrectAttempt}
        isCorrect={isCorrect}
        answered={answered}
        onSelect={onSelectChoice}
      />
    );
  }

  const operationPathPuzzle = asOperationPathPuzzle(puzzle);
  if (operationPathPuzzle) {
    return (
      <OperationPathTask AnswerRow={AnswerRow}
        puzzle={operationPathPuzzle}
        selectedOperators={selectedOperators}
        answered={answered}
        isCorrect={isCorrect}
        onSelectOperator={onSelectOperator}
      />
    );
  }

  const targetBuildPuzzle = asTargetBuildPuzzle(puzzle);
  if (targetBuildPuzzle) {
    return (
      <TargetBuildTask AnswerRow={AnswerRow}
        puzzle={targetBuildPuzzle}
        selectedOperators={selectedOperators}
        answered={answered}
        isCorrect={isCorrect}
        onSelectOperator={onSelectOperator}
      />
    );
  }

  const multipleChoicePuzzle = asMultipleChoicePuzzle(puzzle);
  if (!multipleChoicePuzzle) {
    return null;
  }

  const shapeAttempt = multipleChoicePuzzle.everyday?.model.kind === 'shapes' && checkedAttempt?.answer.kind === 'choice' ? checkedAttempt : undefined;
  return (
    <MultipleChoiceTask onClear={() => onSelectChoice(null)} retainPracticeDrawing={retainPracticeDrawing} playbackOwnsControls={playbackOwnsControls} AnswerRow={AnswerRow} checkedModel={checkedModel} initialDistribution={initialDistribution} onDistributionChange={onDistributionChange}
      onSolutionShown={onSolutionShown}
      puzzle={multipleChoicePuzzle}
      selectedIndex={shapeAttempt?.answer.kind === 'choice' ? shapeAttempt.answer.index : selectedIndex}
      incorrectAttempt={incorrectAttempt}
      isCorrect={shapeAttempt?.correct ?? isCorrect}
      answered={answered}
      onSelect={onSelectChoice}
    />
  );
}
