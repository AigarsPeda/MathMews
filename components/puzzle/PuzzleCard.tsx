import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { PuzzleContextObjects } from '@/components/puzzle/PuzzleContextObjects';
import { PuzzleColors } from "@/constants/puzzle-theme";
import type { Puzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

export function PuzzleCard({ puzzle }: { puzzle: Puzzle }) {
  const { t } = useTranslation();
  // Budget prompts otherwise repeat a generic request and put the actual givens below it.
  const question = puzzle.type === 'budget_plan'
    ? t('challenges.budgetGoal', { budget: puzzle.payload.budget, count: puzzle.payload.pickCount, remaining: puzzle.payload.remaining })
    : puzzle.question;
  return (
    <View style={styles.card}>
      <Text testID="puzzle-question" style={styles.question} accessibilityRole="header">{question}</Text>
      {puzzle.contextObjects?.length ? <PuzzleContextObjects objects={puzzle.contextObjects} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: moderateScale(6) },
  question: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: PuzzleColors.text,
    lineHeight: moderateScale(32),
  },
});
