import { useChoiceLayout } from '@/components/puzzle/useChoiceLayout';
import { BalanceScale } from '@/components/puzzle/BalanceScale';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import type { BalancePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";

type BalanceTaskProps = {
  puzzle: BalancePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number) => void;
};

export function BalanceTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  onSelect,
}: BalanceTaskProps) {
  const { leftDisplay, rightValue, choices } = puzzle.payload;

  const choiceLayout = useChoiceLayout(choices);

  return (
    <View style={styles.wrap}>
      <BalanceScale
        left={<Text style={styles.panExpr}>{leftDisplay}</Text>}
        right={<Text style={styles.panValue}>{rightValue}</Text>}
      />

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
  panExpr: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  panValue: {
    fontSize: moderateScale(26),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  choices: {
    gap: moderateScale(10),
  },
});
