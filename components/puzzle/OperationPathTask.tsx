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

function NumberBubble({
  value,
  large = false,
  placeholder = false,
}: {
  value: number | "?";
  large?: boolean;
  placeholder?: boolean;
}) {
  return (
    <View
      style={[
        styles.numberBubble,
        large && styles.numberBubbleLarge,
        placeholder && styles.numberBubblePlaceholder,
      ]}
    >
      <Text
        style={[
          styles.numberText,
          large && styles.numberTextLarge,
          placeholder && styles.numberTextPlaceholder,
        ]}
      >
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
        <View style={styles.startRow}>
          <Text style={styles.startLabel}>{t("puzzleTypes.operationPathStart")}</Text>
          <NumberBubble value={start} />
        </View>

        {steps.map((step, index) => {
          const selected = selectedOperators[index];
          const isDone = selected !== null;
          const isActive = !answered && index === activeStepIndex;
          const isFuture = !answered && !isDone && index > activeStepIndex;
          if (isFuture) return null;

          const leftValue = runningValues[index] ?? start;
          const rightValue = runningValues[index + 1];

          return (
            <View key={`${puzzle.id}-step-${index}`} style={styles.stepBlock}>
              <Text style={styles.stepLabel}>
                {t("puzzleTypes.operationPathStep", {
                  step: index + 1,
                  total: steps.length,
                })}
              </Text>

              <View style={styles.stepRow}>
                <NumberBubble value={leftValue} />
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
                  <Text style={styles.operatorSlotText}>{selected ?? "?"}</Text>
                </View>
                <NumberBubble value={step.operand} />
                {isDone && rightValue !== undefined ? (
                  <>
                    <Text style={styles.equals}>=</Text>
                    <NumberBubble value={rightValue} />
                  </>
                ) : (
                  <>
                    <Text style={styles.equals}>=</Text>
                    <NumberBubble value="?" placeholder />
                  </>
                )}
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

        {!answered &&
        activeStepIndex >= 0 &&
        activeStepIndex < steps.length - 1 ? (
          <Text style={styles.futureHint}>
            {t("puzzleTypes.operationPathKeepGoing")}
          </Text>
        ) : null}
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

      {!answered && activeStepIndex >= 0 && !allSelected ? (
        <Text style={styles.stepHint}>
          {t("puzzleTypes.pickForStep", { step: activeStepIndex + 1 })}
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
    gap: moderateScale(14),
  },
  startRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(10),
    paddingBottom: moderateScale(4),
    borderBottomWidth: 1,
    borderBottomColor: GameColors.cardBorder,
  },
  startLabel: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  stepBlock: {
    gap: moderateScale(10),
  },
  stepLabel: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: GameColors.secondary,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
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
  numberBubblePlaceholder: {
    borderStyle: "dashed",
    backgroundColor: "transparent",
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
  numberTextPlaceholder: {
    color: GameColors.textMuted,
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
  futureHint: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
    fontStyle: "italic",
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
