import { useChoiceLayout } from '@/components/puzzle/useChoiceLayout';
import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { QuantityTaskScene } from "@/components/puzzle/QuantityTaskScene";
import type { FairSharePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, useWindowDimensions, View } from "react-native";

type FairShareTaskProps = {
  puzzle: FairSharePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number) => void;
};

export function FairShareTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  onSelect,
}: FairShareTaskProps) {
  const { items, people, choices } = puzzle.payload;

  const choiceLayout = useChoiceLayout(choices);
  const { width, fontScale } = useWindowDimensions();
  const answerCards = choices.length === 3 && choices.some(choice => choice.length > 4) && width >= 360 && fontScale <= 1.1;

  return (
    <View style={styles.wrap}>
      <QuantityTaskScene key={puzzle.id} model={{ kind: "share", items, groups: people, object: puzzle.payload.object }} disabled={answered} showExpression={false} />

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
              style={[choiceLayout.item, answerCards && styles.answerCard]}
              labelStyle={answerCards ? styles.answerLabel : undefined}
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
  answerCard: { width: "30%", paddingHorizontal: 8, minHeight: 72 },
  answerLabel: { fontSize: 16, lineHeight: 22 },
  wrap: {
    gap: moderateScale(8),
  },
  choices: {
    gap: moderateScale(12),
  },
});
