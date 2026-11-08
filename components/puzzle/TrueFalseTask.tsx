import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import type { TrueFalsePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

type TrueFalseTaskProps = {
  puzzle: TrueFalsePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number) => void;
};

export function TrueFalseTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  onSelect,
}: TrueFalseTaskProps) {
  const { t } = useTranslation();
  const correctIndex = puzzle.isTrue ? 0 : 1;
  const options = [
    { label: t("puzzleTypes.trueLabel"), index: 0 },
    { label: t("puzzleTypes.falseLabel"), index: 1 },
  ];

  return (
    <View style={styles.wrap}>
      {!puzzle.payload.hideStatement || (answered && isCorrect) ? <View style={styles.statementCard}>
        <Text style={styles.statement}>{puzzle.payload.statement}</Text>
      </View> : null}
      <View style={styles.row}>
        {options.map(({ label, index }) => {
          const selected = selectedIndex === index;
          const isCorrectOption = answered && isCorrect && index === correctIndex;
          const isWrongPick = (answered || incorrectAttempt) && !isCorrect && selected;

          return (
            <View key={index} style={styles.optionShell}>
              <Pressable
                style={[
                  styles.option,
                  selected && !answered && styles.optionSelected,
                  isCorrectOption && styles.optionCorrect,
                  isWrongPick && styles.optionWrong,
                  answered && !selected && !isCorrectOption && styles.optionMuted,
                ]}
                disabled={answered}
                onPress={() => onSelect(index)}
                accessibilityRole="button"
                accessibilityState={{ disabled: answered, selected }}
              >
                <Text style={styles.optionLabel}>{label}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(14),
  },
  statementCard: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(18),
    alignItems: "center",
  },
  statement: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: GameColors.text,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: moderateScale(12),
  },
  optionShell: {
    flex: 1,
    flexShrink: 1,
  },
  option: {
    minHeight: moderateScale(72),
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(14),
  },
  optionSelected: {
    borderColor: GameColors.secondary,
    backgroundColor: GameColors.selectedSurface,
  },
  optionCorrect: {
    borderColor: GameColors.success,
    backgroundColor: "rgba(107, 203, 119, 0.15)",
  },
  optionWrong: {
    borderColor: GameColors.incorrect,
    backgroundColor: GameColors.incorrectSurface,
  },
  optionMuted: {
    opacity: 0.75,
  },
  optionLabel: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: GameColors.text,
  },
});
