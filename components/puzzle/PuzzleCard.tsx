import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { PuzzleColors } from "@/constants/puzzle-theme";
import type { Puzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";

export function PuzzleCard({ puzzle }: { puzzle: Puzzle }) {
  return (
    <View style={styles.card}>
      <Text style={styles.question} accessibilityRole="header">{puzzle.question}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: moderateScale(12) },
  question: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: PuzzleColors.text,
    lineHeight: moderateScale(32),
  },
});
