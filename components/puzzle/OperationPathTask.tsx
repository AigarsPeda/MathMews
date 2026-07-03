import { GameColors } from "@/constants/game";
import type { MathOperator, OperationPathPuzzle } from "@/types/puzzle";
import { MATH_OPERATORS } from "@/types/puzzle";
import { applyMathOperator, runOperationPath } from "@/utils/puzzle-math";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type OperationPathTaskProps = {
  puzzle: OperationPathPuzzle;
  selectedOperators: (MathOperator | null)[];
  answered: boolean;
  isCorrect: boolean;
  onSelectOperator: (stepIndex: number, operator: MathOperator) => void;
  onCheck: () => void;
};

function NumberBubble({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <View style={[styles.numberBubble, large && styles.numberBubbleLarge]}>
      <Text style={[styles.numberText, large && styles.numberTextLarge]}>
        {value}
      </Text>
    </View>
  );
}

export function OperationPathTask({
  puzzle,
  selectedOperators,
  answered,
  isCorrect,
  onSelectOperator,
  onCheck,
}: OperationPathTaskProps) {
  const { t } = useTranslation();
  const { start, target, steps } = puzzle.payload;

  const filledOperators = useMemo(
    () =>
      selectedOperators.filter(
        (operator): operator is MathOperator => operator !== null,
      ),
    [selectedOperators],
  );

  const currentValue = useMemo(() => {
    if (filledOperators.length === 0) return start;
    return runOperationPath(start, steps.slice(0, filledOperators.length), filledOperators);
  }, [filledOperators, start, steps]);

  const allSelected = selectedOperators.every((operator) => operator !== null);
  const activeStepIndex = selectedOperators.findIndex((operator) => operator === null);
  const previewStepIndex =
    activeStepIndex === -1 ? steps.length - 1 : activeStepIndex;

  const runningValues = useMemo(() => {
    const values: number[] = [start];
    let value = start;
    for (let i = 0; i < steps.length; i++) {
      const operator = selectedOperators[i];
      if (!operator) break;
      const next = applyMathOperator(value, steps[i].operand, operator);
      if (next === null) break;
      value = next;
      values.push(value);
    }
    return values;
  }, [selectedOperators, start, steps]);

  return (
    <View style={styles.wrap}>
      <View style={styles.goalRow}>
        <Text style={styles.goalLabel}>{t("puzzleTypes.goal")}</Text>
        <NumberBubble value={target} large />
      </View>

      <View style={styles.pathCard}>
        {steps.map((step, index) => {
          const leftValue = runningValues[index] ?? start;
          const selected = selectedOperators[index];
          const isActive = !answered && index === activeStepIndex;
          const isDone = selected !== null;
          const rightValue = runningValues[index + 1];

          return (
            <View key={`${puzzle.id}-step-${index}`} style={styles.stepBlock}>
              <View style={styles.stepRow}>
                <NumberBubble value={leftValue} />
                <View style={styles.operatorSlotWrap}>
                  <View
                    style={[
                      styles.operatorSlot,
                      isActive && styles.operatorSlotActive,
                      answered &&
                        selected === step.operator &&
                        isCorrect &&
                        styles.operatorSlotCorrect,
                      answered &&
                        selected !== null &&
                        selected !== step.operator &&
                        styles.operatorSlotWrong,
                    ]}
                  >
                    <Text style={styles.operatorSlotText}>
                      {selected ?? "?"}
                    </Text>
                  </View>
                </View>
                <NumberBubble value={step.operand} />
                {isDone && rightValue !== undefined ? (
                  <>
                    <Text style={styles.equals}>=</Text>
                    <NumberBubble value={rightValue} />
                  </>
                ) : null}
              </View>

              {isActive ? (
                <View style={styles.operatorPicker}>
                  {MATH_OPERATORS.map((operator) => (
                    <Pressable
                      key={operator}
                      style={({ pressed }) => [
                        styles.operatorBtn,
                        pressed && styles.operatorBtnPressed,
                      ]}
                      onPress={() => onSelectOperator(index, operator)}
                      accessibilityRole="button"
                      accessibilityLabel={t("puzzleTypes.pickOperator", {
                        operator,
                      })}
                    >
                      <Text style={styles.operatorBtnText}>{operator}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {currentValue !== null && filledOperators.length > 0 ? (
        <Text style={styles.progressText}>
          {t("puzzleTypes.currentTotal", { value: currentValue })}
        </Text>
      ) : null}

      {!answered && allSelected ? (
        <Pressable
          style={styles.checkBtn}
          onPress={onCheck}
          accessibilityRole="button"
          accessibilityLabel={t("puzzleTypes.checkAnswer")}
        >
          <Text style={styles.checkBtnText}>{t("puzzleTypes.checkAnswer")}</Text>
        </Pressable>
      ) : null}

      {answered && !isCorrect ? (
        <Text style={styles.retryHint}>{t("puzzleTypes.tryDifferentOps")}</Text>
      ) : null}

      {!answered && activeStepIndex === previewStepIndex && !allSelected ? (
        <Text style={styles.stepHint}>
          {t("puzzleTypes.pickForStep", { step: previewStepIndex + 1 })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(14),
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(10),
  },
  goalLabel: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  pathCard: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(14),
    gap: moderateScale(16),
  },
  stepBlock: {
    gap: moderateScale(10),
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: moderateScale(8),
  },
  numberBubble: {
    minWidth: moderateScale(44),
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    backgroundColor: GameColors.background,
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(8),
  },
  numberBubbleLarge: {
    minWidth: moderateScale(52),
    minHeight: moderateScale(52),
    borderColor: GameColors.coin,
  },
  numberText: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  numberTextLarge: {
    fontSize: moderateScale(22),
    color: GameColors.coinText,
  },
  operatorSlotWrap: {
    alignItems: "center",
  },
  operatorSlot: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: GameColors.secondary,
    backgroundColor: "rgba(78, 205, 196, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  operatorSlotActive: {
    borderColor: GameColors.primary,
    backgroundColor: "rgba(255, 107, 107, 0.12)",
  },
  operatorSlotCorrect: {
    borderColor: GameColors.success,
    backgroundColor: "rgba(107, 203, 119, 0.15)",
  },
  operatorSlotWrong: {
    borderColor: "#FF9F43",
    backgroundColor: "rgba(255, 159, 67, 0.12)",
  },
  operatorSlotText: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.text,
  },
  equals: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: GameColors.textMuted,
  },
  operatorPicker: {
    flexDirection: "row",
    gap: moderateScale(8),
    justifyContent: "center",
  },
  operatorBtn: {
    minWidth: moderateScale(52),
    minHeight: moderateScale(52),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  operatorBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  operatorBtnText: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: GameColors.text,
  },
  progressText: {
    fontSize: moderateScale(15),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
  checkBtn: {
    minHeight: moderateScale(52),
    borderRadius: moderateScale(16),
    backgroundColor: GameColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
  },
  checkBtnText: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  stepHint: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
  retryHint: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
});
