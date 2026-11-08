import { useChoiceLayout } from '@/components/puzzle/useChoiceLayout';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import type { EstimatePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";

type EstimateTaskProps = {
  puzzle: EstimatePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number) => void;
};

export function EstimateTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  onSelect,
}: EstimateTaskProps) {
  const { expression, choices } = puzzle.payload;

  const choiceLayout = useChoiceLayout(choices);

  return (
    <View style={styles.wrap}>
      <View style={styles.exprCard}>
        <Text style={styles.expression}>{expression}</Text>
      </View>

      <View onLayout={choiceLayout.onLayout} style={choiceLayout.container}>
        {choices.map((choice, index) => {
          let result: "correct" | "wrong" | null = null;
          if (answered || incorrectAttempt) {
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
              style={choiceLayout.item}
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
    gap: moderateScale(8),
  },
  exprCard: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(20),
    alignItems: "center",
  },
  expression: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  choices: {
    gap: moderateScale(12),
  },
});
