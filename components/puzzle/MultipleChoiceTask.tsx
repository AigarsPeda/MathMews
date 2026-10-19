import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { QuantityTaskScene } from "@/components/puzzle/QuantityTaskScene";
import type { MultipleChoicePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";

type MultipleChoiceTaskProps = {
  puzzle: MultipleChoicePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  onSelect: (index: number) => void;
};

export function MultipleChoiceTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  onSelect,
}: MultipleChoiceTaskProps) {
  return (
    <View style={styles.choices}>
      {puzzle.taskVisual ? <QuantityTaskScene key={puzzle.id} model={puzzle.taskVisual} disabled={answered} showExpression={puzzle.difficulty !== "hard"} /> : null}
      {puzzle.choices.map((choice, index) => {
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
  );
}

const styles = StyleSheet.create({
  choices: {
    flexGrow: 0,
    alignSelf: "stretch",
    gap: moderateScale(12),
  },
});
