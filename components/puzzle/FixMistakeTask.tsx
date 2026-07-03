import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { GameColors } from "@/constants/game";
import type { FixMistakePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

type FixMistakeTaskProps = {
  puzzle: FixMistakePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  onSelect: (index: number) => void;
};

export function FixMistakeTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  onSelect,
}: FixMistakeTaskProps) {
  const { t } = useTranslation();
  const { wrongWork, choices } = puzzle.payload;

  return (
    <View style={styles.wrap}>
      <View style={styles.wrongCard}>
        <Text style={styles.wrongLabel}>{t("puzzleTypes.minkaTried")}</Text>
        {wrongWork.map((line) => (
          <Text key={line} style={styles.wrongLine}>
            {line}
          </Text>
        ))}
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
  wrongCard: {
    backgroundColor: "rgba(255, 159, 67, 0.1)",
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: "#FF9F43",
    padding: moderateScale(16),
    gap: moderateScale(6),
  },
  wrongLabel: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#C2700A",
  },
  wrongLine: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  choices: {
    gap: moderateScale(12),
  },
});
