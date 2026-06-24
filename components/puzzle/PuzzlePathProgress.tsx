import { GameColors, getPuzzleCoinReward } from "@/constants/game";
import {
  useDifficultyLabel,
  useDifficultyLabelLower,
} from "@/hooks/use-difficulty-label";
import type { PuzzleDifficulty } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PuzzlePathProgressSheetProps = {
  visible: boolean;
  difficulty: PuzzleDifficulty;
  solvedCount: number;
  totalCount: number;
  onClose: () => void;
};

export function PuzzlePathProgressSheet({
  visible,
  difficulty,
  solvedCount,
  totalCount,
  onClose,
}: PuzzlePathProgressSheetProps) {
  const { t } = useTranslation();
  const difficultyLabel = useDifficultyLabel(difficulty);
  const difficultyLabelLower = useDifficultyLabelLower(difficulty);
  const insets = useSafeAreaInsets();
  const clampedSolved = Math.min(solvedCount, totalCount);
  const progressPercent =
    totalCount > 0 ? Math.min(100, (clampedSolved / totalCount) * 100) : 0;
  const isComplete = clampedSolved >= totalCount && totalCount > 0;
  const firstClear = getPuzzleCoinReward(difficulty);
  const replay = getPuzzleCoinReward(difficulty, true);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("progress.a11yClose")}
        />
        <View style={styles.sheet}>
          <View
            style={[
              styles.card,
              { paddingBottom: insets.bottom + moderateScale(16) },
            ]}
          >
            <Text style={styles.emoji}>{isComplete ? "🎉" : "🥜"}</Text>
            <Text style={styles.title}>
              {t("progress.pathTitle", { difficulty: difficultyLabel })}
            </Text>
            <Text style={styles.count}>
              {t("progress.countOf", {
                solved: clampedSolved,
                total: totalCount,
              })}
            </Text>
            <Text style={styles.subtitle}>
              {isComplete
                ? t("progress.allNutsCracked", {
                    difficulty: difficultyLabelLower,
                  })
                : t("progress.nutsCracked", {
                    difficulty: difficultyLabelLower,
                  })}
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progressPercent}%` }]}
              />
            </View>
            <Text style={styles.percent}>
              {t("common.percent", { value: Math.round(progressPercent) })}
            </Text>

            <View style={styles.rewards}>
              <View style={styles.rewardRow}>
                <Text style={styles.rewardEmoji}>🪙</Text>
                <Text style={styles.rewardText}>
                  {t("progress.coinsPerNut", { count: firstClear })}
                </Text>
              </View>
              <View style={styles.rewardRow}>
                <Text style={styles.rewardEmoji}>✨</Text>
                <Text style={styles.rewardText}>
                  {t("progress.sparkleReplay", { count: replay })}
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("progress.a11yGotIt")}
            >
              <Text style={styles.closeBtnText}>{t("common.gotIt")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type PuzzlePathProgressChipProps = {
  difficulty: PuzzleDifficulty;
  solvedCount: number;
  totalCount: number;
  onPress: () => void;
};

/** Compact progress summary — tap to open full details. */
export function PuzzlePathProgressChip({
  difficulty,
  solvedCount,
  totalCount,
  onPress,
}: PuzzlePathProgressChipProps) {
  const { t } = useTranslation();
  const difficultyLabelLower = useDifficultyLabelLower(difficulty);
  const clampedSolved = Math.min(solvedCount, totalCount);
  const progressPercent =
    totalCount > 0 ? Math.min(100, (clampedSolved / totalCount) * 100) : 0;

  return (
    <Pressable
      style={styles.chip}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("progress.a11yChip", {
        solved: clampedSolved,
        total: totalCount,
        difficulty: difficultyLabelLower,
      })}
    >
      <View style={styles.chipRow}>
        <Text style={styles.chipText}>
          {t("progress.chip", {
            solved: clampedSolved,
            total: totalCount,
            difficulty: difficultyLabelLower,
          })}
        </Text>
        <Text style={styles.chipChevron}>ⓘ</Text>
      </View>
      <View style={styles.chipTrack}>
        <View style={[styles.chipFill, { width: `${progressPercent}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(45, 52, 54, 0.35)",
  },
  sheet: {
    backgroundColor: GameColors.card,
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: GameColors.cardBorder,
    overflow: "hidden",
  },
  card: {
    paddingTop: moderateScale(20),
    paddingHorizontal: moderateScale(20),
    alignItems: "center",
    gap: moderateScale(8),
  },
  emoji: {
    fontSize: moderateScale(36),
  },
  title: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  count: {
    fontSize: moderateScale(32),
    fontWeight: "800",
    color: GameColors.text,
    lineHeight: moderateScale(38),
  },
  subtitle: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: GameColors.text,
    textAlign: "center",
  },
  progressTrack: {
    width: "100%",
    height: moderateScale(10),
    borderRadius: moderateScale(5),
    backgroundColor: GameColors.background,
    overflow: "hidden",
    marginTop: moderateScale(4),
  },
  progressFill: {
    height: "100%",
    borderRadius: moderateScale(5),
    backgroundColor: GameColors.success,
  },
  percent: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: GameColors.textMuted,
  },
  rewards: {
    width: "100%",
    gap: moderateScale(8),
    marginTop: moderateScale(4),
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    backgroundColor: GameColors.background,
    borderRadius: moderateScale(12),
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
  },
  rewardEmoji: {
    fontSize: moderateScale(18),
  },
  rewardText: {
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.text,
  },
  closeBtn: {
    width: "100%",
    minHeight: moderateScale(48),
    borderRadius: moderateScale(14),
    backgroundColor: GameColors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: moderateScale(8),
  },
  closeBtnText: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  chip: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    gap: moderateScale(6),
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(8),
  },
  chipText: {
    flex: 1,
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: GameColors.text,
  },
  chipChevron: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.secondary,
  },
  chipTrack: {
    height: moderateScale(5),
    borderRadius: moderateScale(3),
    backgroundColor: GameColors.background,
    overflow: "hidden",
  },
  chipFill: {
    height: "100%",
    borderRadius: moderateScale(3),
    backgroundColor: GameColors.success,
  },
});
