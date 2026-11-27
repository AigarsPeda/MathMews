import { Fragment, memo, type ComponentType, type ReactNode } from 'react';
import { ClockResponseHint } from './ClockResponseHint';
import { fractionChoiceMechanic } from '@/utils/puzzle-type';
import { FractionChoiceHint } from './fraction/FractionChoiceHint';
import { useLocale } from '@/contexts/LocaleProvider';
import { PuzzleColors } from '@/constants/puzzle-theme';
import { formatPuzzleMoney } from '@/utils/puzzle-money';
import { useChoiceLayout } from '@/components/puzzle/useChoiceLayout';
import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { EverydayDiagram } from "@/components/puzzle/EverydayDiagram";
import { GridAnswerChoices } from "./everyday/GridAnswerChoices";
import { QuantityTaskScene } from "@/components/puzzle/QuantityTaskScene";
import type { MultipleChoicePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";

type MultipleChoiceTaskProps = {
  spokenChoices?: readonly string[];
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  playbackOwnsControls?: boolean;
  retainPracticeDrawing?: boolean;
  checkedModel?: ReactNode;
  onSolutionShown?: () => void;
  initialDistribution?: readonly number[];
  onDistributionChange?: (locations: number[]) => void;
  puzzle: MultipleChoicePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onClear?: () => void;
  onSelect: (index: number) => void;
};

// Removing the frozen editor should not repaint an identical checked board.
const QuantityScene = memo(QuantityTaskScene);

export function MultipleChoiceTask({
  AnswerRow, spokenChoices, playbackOwnsControls = false, retainPracticeDrawing = false, checkedModel, onSolutionShown, initialDistribution, onDistributionChange,
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  onSelect, onClear,
}: MultipleChoiceTaskProps) {
  const { locale } = useLocale();
  const model = puzzle.everyday?.model;
  const displayChoices = puzzle.choices.map(choice => {
    if (model?.kind === 'clock') return choice.replace(/^0(\d:\d{2})$/, '$1');
    if (model?.kind !== 'money' || model.task === 'afford' || !/^\d+(?:[.,]\d+)?$/.test(choice)) return choice;
    const amount = Number(choice.replace(',', '.'));
    return formatPuzzleMoney(Math.round(amount * (model.unit === 'euros' ? 100 : 1)), model.unit, locale);
  });
  const choiceLayout = useChoiceLayout(displayChoices, model?.kind === 'clock' || model?.kind === 'money');
  const textChoices = !puzzle.everyday && !puzzle.taskVisual && !puzzle.fractionExample && !puzzle.percentageExample && !spokenChoices;
  const compactMath = !!spokenChoices && displayChoices.length <= 3 && displayChoices.every(choice => choice.length <= 13);
  const hint = fractionChoiceMechanic(puzzle);
  const Row = AnswerRow ?? Fragment;
  // Spatial choices mark the authored destinations directly on the board.
  if (model?.kind === 'grid') return <GridAnswerChoices mode={playbackOwnsControls ? isCorrect ? 'worked' : 'attempt' : undefined} model={model} choices={puzzle.choices} selectedIndex={selectedIndex}
    correctIndex={puzzle.correctIndex} {...{ answered, isCorrect, incorrectAttempt, onSelect, onSolutionShown }} />;
  const quantity = puzzle.taskVisual;
  const elapsedUnit = puzzle.difficulty === 'easy' ? 'hours' : 'minutes';
  const keepPracticeScene = quantity?.kind === 'array' || quantity?.kind === 'join' || quantity?.kind === 'take_away'
    || model?.kind === 'shapes' && model.task !== 'symmetry' || model?.kind === 'solid' || model?.kind === 'clock' || model?.kind === 'money';
  const modelScene = (solved: boolean) => {
    const completed = solved ? onSolutionShown : undefined;
    if (model) return <EverydayDiagram model={model} onSolutionShown={completed}
      moneyInput={model.kind === 'money' && (solved || retainPracticeDrawing || (!answered && !playbackOwnsControls))
        ? { choices: puzzle.choices, selectedIndex, onSelect, onClear } : undefined}
      moneyAttempt={model.kind === 'money' && solved && answered && !isCorrect ? { choice: selectedIndex == null ? undefined : puzzle.choices[selectedIndex] } : undefined}
      capacityInput={model.kind === 'capacity' && !answered && !playbackOwnsControls ? { choices: puzzle.choices, selectedIndex, onSelect } : undefined}
      capacityAttempt={model.kind === 'capacity' && solved && answered && !isCorrect ? { choice: selectedIndex == null ? undefined : puzzle.choices[selectedIndex] } : undefined}
      elapsedUnit={model.kind === 'clock' ? elapsedUnit : undefined}
      clockInput={model.kind === 'clock' && !solved && !answered && !playbackOwnsControls
        ? { choices: puzzle.choices, selectedIndex, onSelect, elapsedUnit } : undefined}
      clockAttempt={model.kind === 'clock' && solved && answered && !isCorrect && selectedIndex != null
        ? { choice: puzzle.choices[selectedIndex], elapsedUnit } : undefined}
      selectedGroup={selectedIndex == null ? undefined : puzzle.choices[selectedIndex]}
      submitted={(model.kind === 'bars' || model.kind === 'solid' || model.kind === 'shapes') &&
        answered && !isCorrect && selectedIndex != null ? puzzle.choices[selectedIndex] : undefined}
      onSelectGroup={!answered && model.kind === 'bars' && (model.task === 'most' || model.task === 'least') ? letter => {
        const index = puzzle.choices.indexOf(letter);
        if (index >= 0) onSelect(index);
      } : undefined} />;
    return quantity && <QuantityScene model={quantity} solved={solved}
      disabled={quantity.kind === 'join' || quantity.kind === 'take_away' || (answered && (solved || !retainPracticeDrawing))} showExpression={puzzle.difficulty !== 'hard'}
      selectedGroups={puzzle.fractionExample?.numerator} initialDistribution={initialDistribution}
      onDistributionChange={onDistributionChange} onSolutionShown={completed} />;
  };
  return (
    <View style={styles.choices}>
      {checkedModel ?? (keepPracticeScene ? <View>
        {(!onSolutionShown || retainPracticeDrawing) && <View pointerEvents={answered ? 'none' : 'auto'}
          accessibilityElementsHidden={!!onSolutionShown} importantForAccessibility={onSolutionShown ? 'no-hide-descendants' : 'auto'}
          style={onSolutionShown ? styles.retainedDrawing : undefined}>{modelScene(false)}</View>}
        {onSolutionShown && modelScene(true)}
      </View> : modelScene(!!onSolutionShown))}
      {!playbackOwnsControls && <Row><View onLayout={choiceLayout.onLayout} style={compactMath ? styles.symbolRow : choiceLayout.container}>
        {puzzle.choices.map((choice, index) => {
        let result: "correct" | "wrong" | null = null;
        if (answered || incorrectAttempt) {
          if (isCorrect && index === puzzle.correctIndex) {
            result = "correct";
          } else if (!isCorrect && index === selectedIndex) {
            result = "wrong";
          }
        }

        return (
          <ChoiceButton
            key={`${puzzle.id}-${choice}`}
            label={displayChoices[index]}
            accessibilityAnswer={spokenChoices?.[index]}
            selected={selectedIndex === index}
            disabled={answered}
            result={result}
            fitLabel={compactMath}
            style={compactMath ? styles.compactMathChoice : spokenChoices ? [choiceLayout.item, styles.symbolChoice] : [choiceLayout.item, textChoices && styles.textChoice]}
            labelStyle={spokenChoices ? styles.symbolLabel : textChoices && styles.textLabel}
            onPress={() => onSelect(index)}
          />
        );
        })}
        {!answered && !incorrectAttempt && !puzzle.response && model?.kind === 'clock' && model.task === 'read' &&
          <ClockResponseHint kind="read" interacted={selectedIndex !== null} />}
        {!answered && !incorrectAttempt && hint && <FractionChoiceHint mechanic={hint} width={choiceLayout.measuredWidth ?? 0} interacted={selectedIndex !== null} />}
      </View></Row>}
    </View>
  );
}

const styles = StyleSheet.create({
  retainedDrawing: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1, backgroundColor: PuzzleColors.background },
  textChoice: { minHeight: 56 },
  textLabel: { fontSize: 20 },
  symbolChoice: { paddingVertical: 2 },
  symbolRow: { flexDirection: 'row', gap: 8 },
  compactMathChoice: { flex: 1, minWidth: 44, minHeight: 52, paddingVertical: 4, paddingHorizontal: 4 },
  symbolLabel: { fontSize: moderateScale(16), fontVariant: ['tabular-nums'] },
  choices: {
    flexGrow: 0,
    alignSelf: "stretch",
    gap: moderateScale(12),
  },
});
