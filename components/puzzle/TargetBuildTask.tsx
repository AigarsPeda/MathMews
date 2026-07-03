import { GameColors } from "@/constants/game";
import type { MathOperator, TargetBuildPuzzle } from "@/types/puzzle";
import { MATH_OPERATORS } from "@/types/puzzle";
import { evaluateExpression } from "@/utils/puzzle-math";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type TargetBuildTaskProps = {
  puzzle: TargetBuildPuzzle;
  selectedOperators: (MathOperator | null)[];
  answered: boolean;
  isCorrect: boolean;
  onSelectOperator: (slotIndex: number, operator: MathOperator) => void;
  onCheck: () => void;
};

export function TargetBuildTask({
  puzzle,
  selectedOperators,
  answered,
  isCorrect,
  onSelectOperator,
  onCheck,
}: TargetBuildTaskProps) {
  const { t } = useTranslation();
  const { numbers, target } = puzzle.payload;
  const slotCount = numbers.length - 1;

  const filledOperators = useMemo(
    () =>
      selectedOperators.filter(
        (operator): operator is MathOperator => operator !== null,
      ),
    [selectedOperators],
  );

  const previewValue = useMemo(() => {
    if (filledOperators.length !== slotCount) return null;
    return evaluateExpression(numbers, filledOperators);
  }, [filledOperators, numbers, slotCount]);

  const allSelected = selectedOperators.every((operator) => operator !== null);
  const activeSlot = selectedOperators.findIndex((operator) => operator === null);

  return (
    <View style={styles.wrap}>
      <View style={styles.goalRow}>
        <Text style={styles.goalLabel}>{t("puzzleTypes.make")}</Text>
        <View style={styles.targetBubble}>
          <Text style={styles.targetText}>{target}</Text>
        </View>
      </View>

      <View style={styles.buildCard}>
        <View style={styles.expressionRow}>
          {numbers.map((number, index) => (
            <View key={`${puzzle.id}-num-${index}`} style={styles.tokenWrap}>
              <View style={styles.numberBubble}>
                <Text style={styles.numberText}>{number}</Text>
              </View>
              {index < slotCount ? (
                <Pressable
                  style={[
                    styles.operatorSlot,
                    activeSlot === index && !answered && styles.operatorSlotActive,
                    answered &&
                      selectedOperators[index] === puzzle.payload.solution[index] &&
                      isCorrect &&
                      styles.operatorSlotCorrect,
                    answered &&
                      selectedOperators[index] !== null &&
                      selectedOperators[index] !== puzzle.payload.solution[index] &&
                      styles.operatorSlotWrong,
                  ]}
                  disabled={answered}
                  onPress={() => {
                    const current = selectedOperators[index];
                    if (current === null) {
                      onSelectOperator(index, "+");
                      return;
                    }
                    const nextIndex =
                      (MATH_OPERATORS.indexOf(current) + 1) % MATH_OPERATORS.length;
                    onSelectOperator(index, MATH_OPERATORS[nextIndex]);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.operatorText}>
                    {selectedOperators[index] ?? "?"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        {!answered ? (
          <>
            <Text style={styles.tapHint}>{t("puzzleTypes.tapToChangeOp")}</Text>
            {activeSlot >= 0 ? (
              <View style={styles.operatorPicker}>
                {MATH_OPERATORS.map((operator) => (
                  <Pressable
                    key={operator}
                    style={({ pressed }) => [
                      styles.operatorBtn,
                      pressed && styles.operatorBtnPressed,
                    ]}
                    onPress={() => onSelectOperator(activeSlot, operator)}
                  >
                    <Text style={styles.operatorBtnText}>{operator}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {previewValue !== null ? (
        <Text style={styles.previewText}>
          {t("puzzleTypes.yourResult", { value: previewValue })}
        </Text>
      ) : null}

      {!answered && allSelected ? (
        <Pressable style={styles.checkBtn} onPress={onCheck}>
          <Text style={styles.checkBtnText}>{t("puzzleTypes.checkAnswer")}</Text>
        </Pressable>
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
  targetBubble: {
    minWidth: moderateScale(52),
    minHeight: moderateScale(52),
    borderRadius: moderateScale(14),
    backgroundColor: GameColors.background,
    borderWidth: 2,
    borderColor: GameColors.coin,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(12),
  },
  targetText: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: GameColors.coinText,
  },
  buildCard: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(16),
    gap: moderateScale(12),
  },
  expressionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
  },
  tokenWrap: {
    flexDirection: "row",
    alignItems: "center",
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
  numberText: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: GameColors.text,
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
  },
  operatorSlotCorrect: {
    borderColor: GameColors.success,
  },
  operatorSlotWrong: {
    borderColor: "#FF9F43",
  },
  operatorText: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.text,
  },
  tapHint: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
  operatorPicker: {
    flexDirection: "row",
    justifyContent: "center",
    gap: moderateScale(8),
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
  },
  operatorBtnText: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: GameColors.text,
  },
  previewText: {
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
  },
  checkBtnText: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
