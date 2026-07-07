import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { GameColors } from "@/constants/game";
import type { PatternNextPuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, Text, View } from "react-native";

type PatternNextTaskProps = {
  puzzle: PatternNextPuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  onSelect: (index: number) => void;
};

export function PatternNextTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  onSelect,
}: PatternNextTaskProps) {
  const { sequence, choices } = puzzle.payload;

  return (
    <View style={styles.wrap}>
      <View style={styles.sequenceRow}>
        {sequence.map((value, index) => (
          <View key={`${puzzle.id}-seq-${index}`} style={styles.sequenceChip}>
            <Text style={styles.sequenceText}>{value}</Text>
          </View>
        ))}
        <View style={[styles.sequenceChip, styles.questionChip]}>
          <Text style={styles.questionText}>?</Text>
        </View>
      </View>

      <View style={styles.choices}>
        {choices.map((choice, index) => {
          let result: "correct" | "wrong" | null = null;
          if (answered) {
            if (isCorrect && index === puzzle.correctIndex) {
              result = "correct";
            } else if (!isCorrect && index === selectedIndex) {
              result = "wrong";
            }
          }

          return (
            <ChoiceButton
              key={`${puzzle.id}-${choice}`}
              label={choice}
              selected={selectedIndex === index}
              disabled={answered}
              result={result}
              onPress={() => onSelect(index)}
            />
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
  sequenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: moderateScale(8),
  },
  sequenceChip: {
    minWidth: moderateScale(48),
    minHeight: moderateScale(48),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(10),
  },
  sequenceText: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  questionChip: {
    borderColor: GameColors.secondary,
    backgroundColor: "rgba(78, 205, 196, 0.12)",
  },
  questionText: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.secondary,
  },
  choices: {
    gap: moderateScale(12),
  },
});
