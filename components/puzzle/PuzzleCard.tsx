import { GameColors } from "@/constants/game";
import type { Puzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, Text, View } from "react-native";

type PuzzleCardProps = {
  puzzle: Puzzle;
  puzzleNumber: number;
};

export function PuzzleCard({ puzzle, puzzleNumber }: PuzzleCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>🥜 Hard Nut #{puzzleNumber}</Text>
      </View>
      <Text style={styles.question}>{puzzle.question}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(20),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(16),
    gap: moderateScale(12),
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: GameColors.background,
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(10),
  },
  badgeText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  question: {
    fontSize: moderateScale(20),
    fontWeight: "600",
    color: GameColors.text,
    lineHeight: moderateScale(30),
  },
});
