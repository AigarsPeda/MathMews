import { GameColors } from "@/constants/game";
import type { ComparePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { Pressable, StyleSheet, Text, View } from "react-native";

type CompareTaskProps = {
  puzzle: ComparePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  onSelect: (index: number) => void;
};

export function CompareTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  onSelect,
}: CompareTaskProps) {
  const options = [
    { label: puzzle.payload.optionA, index: 0 as const },
    { label: puzzle.payload.optionB, index: 1 as const },
  ];

  return (
    <View style={styles.row}>
      {options.map(({ label, index }) => {
        const selected = selectedIndex === index;
        const isCorrectOption =
          answered && index === puzzle.correctIndex;
        const isWrongPick = answered && !isCorrect && selected;

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
  );
}

const styles = StyleSheet.create({
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
    minHeight: moderateScale(120),
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
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: GameColors.text,
    textAlign: "center",
    lineHeight: moderateScale(26),
  },
});
