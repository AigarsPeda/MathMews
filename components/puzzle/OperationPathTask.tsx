import { OperationEquation, OperatorPicker } from './OperationEquation';
import { ResultMark } from "@/components/puzzle/kit/PuzzleKit";
import { useRevealBeats } from "@/components/puzzle/kit/useRevealBeats";
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { HapticTick } from "@/components/puzzle/tiles/TileMotion";
import { Ink } from "@/constants/puzzle-theme";
import type { MathOperator, OperationPathPuzzle } from "@/types/puzzle";
import { applyMathOperator } from "@/utils/puzzle-math";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Fragment, type ComponentType, type ReactNode, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

type OperationPathTaskProps = {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  puzzle: OperationPathPuzzle;
  selectedOperators: (MathOperator | null)[];
  answered: boolean;
  isCorrect: boolean;
  onSelectOperator: (stepIndex: number, operator: MathOperator) => void;
};

export function OperationPathTask({
  AnswerRow = Fragment,
  puzzle,
  selectedOperators,
  answered,
  isCorrect,
  onSelectOperator,
}: OperationPathTaskProps) {
  const { t } = useTranslation();
  const { start, target, steps } = puzzle.payload;
  const [chosenFocus, setFocus] = useState<number | null>(null);

  const runningValues = useMemo(() => {
    const values: (number | null)[] = [start];
    for (let i = 0; i < steps.length; i++) {
      const operator = selectedOperators[i];
      const value = values[i];
      values.push(operator && value !== null ? applyMathOperator(value, steps[i].operand, operator) : null);
    }
    return values;
  }, [selectedOperators, start, steps]);
  const currentValue = runningValues[steps.length];
  const firstEmpty = selectedOperators.findIndex(operator => operator === null);
  const focus = answered ? -1 : chosenFocus ?? (firstEmpty >= 0 ? firstEmpty : steps.length - 1);
  const beats = useRevealBeats(answered ? steps.length : 0);

  const pick = (operator: MathOperator) => {
    if (focus < 0) return;
    onSelectOperator(focus, operator);
    const next = selectedOperators.findIndex((value, i) => i !== focus && value === null);
    setFocus(next >= 0 ? next : focus);
  };

  return <View style={styles.wrap}>
    <HapticTick trigger={selectedOperators.join(",")} />
    <OperationEquation entry={!answered} numbers={[start, ...steps.map(step => step.operand)]} operators={selectedOperators}
      target={target} focus={focus} onFocus={answered ? undefined : setFocus} miss={answered && !isCorrect}
      missedSlot={selectedOperators.findIndex((op, i) => op !== steps[i].operator)} />
    {answered ? <>
      <Text style={styles.progressText}>{t("puzzleTypes.operationPathStep", { step: Math.max(1, beats.landed), total: steps.length })}</Text>
      <View style={styles.progress}>
        {answered && beats.done && currentValue !== null ? <View style={styles.compare} accessibilityLiveRegion="polite"
          accessibilityLabel={t("puzzleTypes.yourResult", { value: currentValue })}>
          {/* The checker only knows the final value, so only the comparison with the goal is marked. */}
          <Text style={styles.compareText}>{`${currentValue} ${isCorrect ? "=" : "≠"} ${target}`}</Text>
          <ResultMark kind={isCorrect ? "correct" : "wrong"} size={moderateScale(18)} />
        </View>
          : currentValue !== null ? <Text style={styles.progressText} accessibilityLiveRegion="polite">{t("puzzleTypes.yourResult", { value: currentValue })}</Text> : null}
        {answered && !isCorrect ? <Text style={styles.retryHint}>{t("puzzleTypes.tryDifferentOps")}</Text> : null}
      </View>
    </> : <AnswerRow><OperatorPicker focus={focus} selected={selectedOperators[focus]} pick={pick} /></AnswerRow>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: moderateScale(12) },
  progress: { minHeight: moderateScale(26), gap: moderateScale(4) },
  // Caption-strong size (≥16 pt, navy) for the one comparison the checker can make.
  compareText: { fontSize: Math.max(16, moderateScale(18)), lineHeight: Math.max(22, moderateScale(24)), fontWeight: "800", color: Ink.text, fontVariant: ["tabular-nums"] },
  compare: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: moderateScale(8) },
  progressText: { fontSize: moderateScale(15), fontWeight: "700", color: Ink.soft, textAlign: "center" },
  retryHint: { fontSize: moderateScale(14), fontWeight: "600", color: Ink.soft, textAlign: "center" },
});
