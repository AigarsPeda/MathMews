import { useChoiceLayout } from '@/components/puzzle/useChoiceLayout';
import { BalanceModel } from '@/components/puzzle/BalanceModel';
import { useState } from 'react';
import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import type { BalancePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";

type BalanceTaskProps = {
  onSolutionShown?: () => void;
  puzzle: BalancePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number) => void;
};

export function BalanceTask({
  puzzle, onSolutionShown,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  onSelect,
}: BalanceTaskProps) {
  const { choices } = puzzle.payload;
  const [origin, setOrigin] = useState<{ x: number; y: number } | undefined>(undefined);

  const choiceLayout = useChoiceLayout(choices);

  return (
    <View style={styles.wrap}>
      <BalanceModel model={puzzle.payload} choice={selectedIndex === null ? null : choices[selectedIndex]}
        origin={origin} checked={answered || incorrectAttempt} onSolutionShown={onSolutionShown} />

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
              onPress={event => {
                const { pageX, pageY } = event.nativeEvent;
                setOrigin(pageX || pageY ? { x: pageX, y: pageY } : undefined);
                onSelect(index);
              }}
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
});
