import { GameColors } from "@/constants/game";
import type { TrueFalsePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type TrueFalseTaskProps = {
  puzzle: TrueFalsePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  onSelect: (index: number) => void;
};

export function TrueFalseTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
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
      <View style={styles.statementCard}>
        <Text style={styles.statement}>{puzzle.payload.statement}</Text>
      </View>
      <View style={styles.row}>
        {options.map(({ label, index }) => {
          const selected = selectedIndex === index;
          const isCorrectOption = answered && index === correctIndex;
          const isWrongPick = answered && !isCorrect && selected;

          return (
            <Pressable
              key={index}
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
            >
              <Text style={styles.optionLabel}>{label}</Text>
            </Pressable>
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
    gap: moderateScale(12),
  },
  option: {
    flex: 1,
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
    backgroundColor: "rgba(78, 205, 196, 0.12)",
  },
  optionCorrect: {
    borderColor: GameColors.success,
    backgroundColor: "rgba(107, 203, 119, 0.15)",
  },
  optionWrong: {
    borderColor: "#FF9F43",
    backgroundColor: "rgba(255, 159, 67, 0.12)",
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
