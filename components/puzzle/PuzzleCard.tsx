import { GameColors } from "@/constants/game";
import type { Puzzle } from "@/types/puzzle";
import { getPuzzleType } from "@/utils/puzzle-type";
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
  const puzzleType = getPuzzleType(puzzle);

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <View style={styles.badgeGroup}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {t("play.hardNut", { number: puzzleNumber })}
            </Text>
          </View>
          {puzzleType !== "multiple_choice" ? (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {t(`puzzleTypes.${puzzleType}`)}
              </Text>
            </View>
          ) : null}
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
  badgeGroup: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: moderateScale(6),
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: GameColors.background,
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(10),
  },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F3EEFF",
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(10),
    borderWidth: 1,
    borderColor: "#C9B6FF",
  },
  typeBadgeText: {
    fontSize: moderateScale(12),
    fontWeight: "700",
    color: "#6B4FCF",
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
