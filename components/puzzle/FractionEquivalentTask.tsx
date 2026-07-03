import { GameColors } from "@/constants/game";
import type { FractionEquivalentPuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { Pressable, StyleSheet, Text, View } from "react-native";

type FractionEquivalentTaskProps = {
  puzzle: FractionEquivalentPuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  onSelect: (index: number) => void;
};

export function FractionEquivalentTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  onSelect,
}: FractionEquivalentTaskProps) {
  const { numerator, denominator, choices } = puzzle.payload;

  return (
    <View style={styles.wrap}>
      <View style={styles.fractionCard}>
        <Text style={styles.fractionNum}>{numerator}</Text>
        <View style={styles.fractionBar} />
        <Text style={styles.fractionDen}>{denominator}</Text>
      </View>

      <View style={styles.choices}>
        {choices.map((choice, index) => {
          const selected = selectedIndex === index;
          const isCorrectOption = answered && index === puzzle.correctIndex;
          const isWrongPick = answered && !isCorrect && selected;

          return (
            <Pressable
              key={`${puzzle.id}-${choice}`}
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
              <Text style={styles.optionLabel}>{choice}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(16),
  },
  fractionCard: {
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(28),
    minWidth: moderateScale(100),
  },
  fractionNum: {
    fontSize: moderateScale(36),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  fractionBar: {
    width: moderateScale(48),
    height: moderateScale(3),
    backgroundColor: GameColors.text,
    marginVertical: moderateScale(4),
    borderRadius: moderateScale(2),
  },
  fractionDen: {
    fontSize: moderateScale(36),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(10),
    justifyContent: "center",
  },
  option: {
    minWidth: moderateScale(88),
    minHeight: moderateScale(56),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(14),
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
    fontVariant: ["tabular-nums"],
  },
});
