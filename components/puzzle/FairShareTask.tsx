import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { QuantityTaskScene } from "@/components/puzzle/QuantityTaskScene";
import type { FairSharePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";

type FairShareTaskProps = {
  puzzle: FairSharePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  onSelect: (index: number) => void;
};

export function FairShareTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  onSelect,
}: FairShareTaskProps) {
  const { items, people, choices } = puzzle.payload;

  return (
    <View style={styles.wrap}>
      <QuantityTaskScene key={puzzle.id} model={{ kind: "share", items, groups: people }} disabled={answered} />

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
  choices: {
    gap: moderateScale(12),
  },
});
