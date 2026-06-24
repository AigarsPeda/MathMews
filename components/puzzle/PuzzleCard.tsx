import { GameColors } from "@/constants/game";
import type { Puzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

type PuzzleCardProps = {
  puzzle: Puzzle;
  puzzleNumber: number;
  coinReward?: number;
};

export function PuzzleCard({
  puzzle,
  puzzleNumber,
  coinReward,
}: PuzzleCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {t("play.hardNut", { number: puzzleNumber })}
          </Text>
        </View>
        {coinReward !== undefined ? (
          <View style={styles.coinBadge}>
            <Text style={styles.coinBadgeText}>🪙 +{coinReward}</Text>
          </View>
        ) : null}
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
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(8),
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
  coinBadge: {
    backgroundColor: GameColors.background,
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(10),
    borderWidth: 1,
    borderColor: GameColors.coin,
  },
  coinBadgeText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.coinText,
  },
  question: {
    fontSize: moderateScale(20),
    fontWeight: "600",
    color: GameColors.text,
    lineHeight: moderateScale(30),
  },
});
