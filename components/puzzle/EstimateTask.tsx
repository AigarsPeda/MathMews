import { Fragment, type ComponentType, type ReactNode } from "react";
import { LandmarkLine, estimateScale } from "./number-line/LandmarkLine";
import { useChoiceLayout } from "./useChoiceLayout";
import { ValueChip } from "@/components/puzzle/kit/PuzzleKit";
import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import type { EstimatePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";

type EstimateTaskProps = {
  puzzle: EstimatePuzzle;
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  checkedModel?: ReactNode;
  checkedResult?: "correct" | "wrong";
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number) => void;
};

export function EstimateTask({
  AnswerRow = Fragment,
  puzzle,
  checkedModel,
  checkedResult,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  onSelect,
}: EstimateTaskProps) {
  const { expression, choices } = puzzle.payload;

  const layout = useChoiceLayout(choices);
  const options = choices.map((label, index) => ({ label, index, value: Number(label.match(/\d+$/)?.[0]) }))
    .sort((left, right) => left.value - right.value);
  const operands = expression.match(/^(\d+)\s*\+\s*(\d+)$/);
  const total = operands ? Number(operands[1]) + Number(operands[2]) : null;
  const start = operands ? Number(operands[1]) : 0;
  const goal = total === null ? 0 : Math.round(total / 10) * 10;
  const selected = options.find(o => o.index === selectedIndex)?.value;
  const locked = answered || checkedModel != null || checkedResult !== undefined;
  const result = checkedResult ?? (locked || incorrectAttempt ? (isCorrect ? "correct" : "wrong") : null);
  const markedIndex = checkedResult === undefined && isCorrect ? puzzle.correctIndex : selectedIndex;

  return (
    <View style={styles.wrap}>
      {checkedModel ?? (
        <>
          <ValueChip label={expression} size="lg" style={styles.expression} />
          {total !== null && <LandmarkLine scale={estimateScale(start, total, result === 'wrong' ? selected : undefined)}
            start={start} goal={goal} value={selected ?? start} submitted={result === 'wrong' ? selected : undefined} />}
        </>
      )}

      <AnswerRow>
        <View onLayout={layout.onLayout} style={layout.container}>
          {options.map(({ label: choice, index }) => (
            <ChoiceButton
              key={`${puzzle.id}-${choice}`}
              label={choice}
              style={layout.item}
              selected={selectedIndex === index}
              disabled={locked}
              result={index === markedIndex ? result : null}
              onPress={() => onSelect(index)}
            />
          ))}
        </View>
      </AnswerRow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(8),
  },
  expression: { alignSelf: "center" },
});
