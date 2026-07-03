import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { GameColors } from "@/constants/game";
import type { FairSharePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

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
  const { t } = useTranslation();
  const { items, people, emoji, choices } = puzzle.payload;
  const emojiRow = Array.from({ length: Math.min(items, 12) }, () => emoji);
  if (items > 12) {
    emojiRow.push("…");
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.sceneCard}>
        <View style={styles.itemsRow}>
          {emojiRow.map((char, index) => (
            <Text key={`${puzzle.id}-item-${index}`} style={styles.emoji}>
              {char}
            </Text>
          ))}
        </View>
        <Text style={styles.peopleLine}>
          {t("puzzleTypes.shareAmong", { count: people })}
        </Text>
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
  sceneCard: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(16),
    alignItems: "center",
    gap: moderateScale(10),
  },
  itemsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: moderateScale(4),
  },
  emoji: {
    fontSize: moderateScale(28),
  },
  peopleLine: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  choices: {
    gap: moderateScale(12),
  },
});
