import { VisualExplanationPlayer } from "@/components/puzzle/VisualExplanationPlayer";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { GameColors } from "@/constants/game";
import { getVisualExplanation } from "@/constants/visual-explanations";
import type { Puzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type VisualHelpSheetProps = {
  cost: number;
  coins: number;
  visible: boolean;
  puzzle: Puzzle;
  unlocked: boolean;
  onClose: () => void;
  onPurchase: () => boolean;
};

export function VisualHelpSheet({
  cost,
  coins,
  visible,
  puzzle,
  unlocked,
  onClose,
  onPurchase,
}: VisualHelpSheetProps) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const explanation = getVisualExplanation(puzzle);
  const [isUnlocked, setIsUnlocked] = useState(unlocked);

  useEffect(() => {
    if (visible) {
      setProgress(0);
      setIsUnlocked(unlocked);
    }
  }, [visible, unlocked, puzzle.id]);

  const handlePurchase = useCallback(() => {
    const ok = onPurchase();
    if (ok) {
      setIsUnlocked(true);
    }
  }, [onPurchase]);

  if (!explanation) return null;

  const canAfford = coins >= cost;

  return (
    <AppBottomSheet visible={visible} onClose={onClose} expanded>
      <View style={styles.card}>
        <Text style={styles.emoji}>🎬</Text>
        <Text style={styles.title}>{t("visualHelp.title")}</Text>
        <Text style={styles.subtitle}>{t("visualHelp.subtitle")}</Text>

        {isUnlocked ? (
          <VisualExplanationPlayer
            explanation={explanation}
            progress={progress}
            onProgressChange={setProgress}
          />
        ) : (
          <View style={styles.lockCard}>
            <Text style={styles.lockEmoji}>🔒</Text>
            <Text style={styles.lockText}>{t("visualHelp.lockedHint")}</Text>
            <Text style={styles.lockPrice}>
              {t("visualHelp.unlockPrice", { cost })}
            </Text>
          </View>
        )}

        {!isUnlocked ? (
          canAfford ? (
            <Pressable
              style={styles.buyBtn}
              onPress={handlePurchase}
              accessibilityRole="button"
              accessibilityLabel={t("visualHelp.a11yUnlock", { cost })}
            >
              <Text style={styles.buyBtnText}>
                {t("visualHelp.unlockButton", { cost })}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.cantBuy}>
              {t("visualHelp.needCoins", { cost, coins })}
            </Text>
          )
        ) : null}

        <Pressable
          style={[styles.closeBtn, isUnlocked && styles.closeBtnPrimary]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        >
          <Text
            style={[
              styles.closeBtnText,
              isUnlocked && styles.closeBtnTextPrimary,
            ]}
          >
            {isUnlocked ? t("common.gotIt") : t("common.close")}
          </Text>
        </Pressable>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: moderateScale(10),
    paddingTop: moderateScale(20),
    paddingHorizontal: moderateScale(20),
  },
  emoji: {
    fontSize: moderateScale(36),
  },
  title: {
    fontWeight: "800",
    textAlign: "center",
    color: GameColors.text,
    fontSize: moderateScale(22),
  },
  subtitle: {
    fontWeight: "500",
    textAlign: "center",
    fontSize: moderateScale(14),
    color: GameColors.textMuted,
    lineHeight: moderateScale(20),
  },
  lockCard: {
    width: "100%",
    alignItems: "center",
    gap: moderateScale(8),
    padding: moderateScale(20),
    borderRadius: moderateScale(16),
    backgroundColor: GameColors.background,
  },
  lockEmoji: {
    fontSize: moderateScale(40),
  },
  lockText: {
    fontWeight: "600",
    textAlign: "center",
    color: GameColors.text,
    fontSize: moderateScale(15),
    lineHeight: moderateScale(22),
  },
  lockPrice: {
    fontWeight: "800",
    color: GameColors.coinText,
    fontSize: moderateScale(18),
  },
  buyBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: moderateScale(52),
    borderRadius: moderateScale(16),
    backgroundColor: GameColors.primary,
  },
  buyBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: moderateScale(17),
  },
  cantBuy: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: moderateScale(14),
    color: GameColors.textMuted,
  },
  closeBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: moderateScale(4),
    minHeight: moderateScale(48),
    borderRadius: moderateScale(14),
  },
  closeBtnPrimary: {
    backgroundColor: GameColors.primary,
  },
  closeBtnText: {
    fontWeight: "700",
    fontSize: moderateScale(16),
    color: GameColors.textMuted,
  },
  closeBtnTextPrimary: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
