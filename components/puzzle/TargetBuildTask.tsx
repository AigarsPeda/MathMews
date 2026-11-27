import { useKeepModelOrigin } from './kit/ModelStage';
import { OperationEquation, OperatorPicker } from './OperationEquation';
import { Caption } from "@/components/puzzle/kit/Focus";
import { ResultMark } from "@/components/puzzle/kit/PuzzleKit";
import { useRevealBeats } from "@/components/puzzle/kit/useRevealBeats";
import { FeedbackTile, HapticTick } from "@/components/puzzle/tiles/TileMotion";
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { Ink } from "@/constants/puzzle-theme";
import type { MathOperator, TargetBuildPuzzle } from "@/types/puzzle";
import { evaluateExpression } from "@/utils/puzzle-math";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Fragment, type ComponentType, type ReactNode, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";

type TargetBuildTaskProps = {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  puzzle: TargetBuildPuzzle;
  selectedOperators: (MathOperator | null)[];
  answered: boolean;
  isCorrect: boolean;
  onSelectOperator: (slotIndex: number, operator: MathOperator) => void;
};

export function TargetBuildTask({
  AnswerRow = Fragment,
  puzzle,
  selectedOperators,
  answered,
  isCorrect,
  onSelectOperator,
}: TargetBuildTaskProps) {
  const { t } = useTranslation();
  useKeepModelOrigin(useWindowDimensions().fontScale >= 2);
  const { numbers, target } = puzzle.payload;
  const slotCount = numbers.length - 1;
  const [chosenFocus, setFocus] = useState<number | null>(null);
  const firstEmpty = selectedOperators.findIndex(operator => operator === null);
  const focus = answered ? -1 : chosenFocus ?? firstEmpty;

  const beats = useRevealBeats(answered ? slotCount : 0);
  const filledOperators = useMemo(() => selectedOperators.filter((operator): operator is MathOperator => operator !== null), [selectedOperators]);
  const previewValue = useMemo(() => filledOperators.length !== slotCount ? null : evaluateExpression(numbers, filledOperators), [filledOperators, numbers, slotCount]);

  const pick = (operator: MathOperator) => {
    if (focus < 0) return;
    onSelectOperator(focus, operator);
    // Move on to the next empty slot after this one, if any.
    const next = selectedOperators.findIndex((value, i) => i !== focus && value === null);
    setFocus(next >= 0 ? next : null);
  };

  return (
    <View style={styles.wrap}>
      <HapticTick trigger={selectedOperators.join(",")} />
      <OperationEquation entry={!answered} numbers={numbers} operators={selectedOperators} target={target} focus={focus}
        onFocus={answered ? undefined : setFocus} miss={answered && !isCorrect}
        missedSlot={selectedOperators.findIndex((op, i) => op !== puzzle.payload.solution[i])} />
      {!answered && <AnswerRow><OperatorPicker focus={focus} selected={selectedOperators[focus]} pick={pick} /></AnswerRow>}
      {answered && <View style={styles.preview}>
        {previewValue !== null ? <FeedbackTile result={answered && beats.done ? isCorrect ? "correct" : "wrong" : null} mark={false} haptic style={styles.previewChip}>
          {answered && beats.done ? <View style={styles.compare} accessibilityLiveRegion="polite" accessibilityLabel={t("puzzleTypes.yourResult", { value: previewValue })}>
            <Caption strong>{`${previewValue} ${isCorrect ? "=" : "≠"} ${target}`}</Caption>
            <ResultMark kind={isCorrect ? "correct" : "wrong"} size={moderateScale(18)} />
          </View> : <Text style={styles.previewText} accessibilityLiveRegion="polite">{t("puzzleTypes.yourResult", { value: previewValue })}</Text>}
        </FeedbackTile> : null}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: moderateScale(14) },
  compare: { flexDirection: "row", alignItems: "center", gap: moderateScale(8) },
  preview: { minHeight: moderateScale(32), alignItems: "center" },
  previewChip: { alignSelf: "center", paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(4) },
  previewText: { fontSize: moderateScale(17), fontWeight: "800", color: Ink.text, textAlign: "center", fontVariant: ["tabular-nums"] },
});
