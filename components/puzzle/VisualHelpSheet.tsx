import { VisualExplanationPlayer } from "@/components/puzzle/VisualExplanationPlayer";
import { GameColors } from "@/constants/game";
import { getVisualExplanation } from "@/constants/visual-explanations";
import { moderateScale } from "@/utils/scale";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type VisualHelpSheetProps = {
  visible: boolean;
  puzzleId: string;
  cost: number;
  coins: number;
  unlocked: boolean;
  onPurchase: () => boolean;
  onClose: () => void;
};

export function VisualHelpSheet({
  visible,
  puzzleId,
  cost,
  coins,
  unlocked,
  onPurchase,
  onClose,
}: VisualHelpSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const explanation = getVisualExplanation(puzzleId);
  const [progress, setProgress] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(unlocked);

  useEffect(() => {
    if (visible) {
      setProgress(0);
      setIsUnlocked(unlocked);
    }
  }, [visible, unlocked, puzzleId]);

  const handlePurchase = useCallback(() => {
    const ok = onPurchase();
    if (ok) {
      setIsUnlocked(true);
    }
  }, [onPurchase]);

  if (!explanation) return null;

  const canAfford = coins >= cost;

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
          accessibilityLabel={t("visualHelp.a11yClose")}
        />
        <View style={styles.sheet}>
          <View
            style={[
              styles.card,
              { paddingBottom: insets.bottom + moderateScale(16) },
            ]}
          >
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
                <Text style={styles.lockText}>
                  {t("visualHelp.lockedHint")}
                </Text>
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
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <Text style={styles.closeBtnText}>
                {isUnlocked ? t("common.gotIt") : t("common.close")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
    maxHeight: "92%",
  },
  card: {
    paddingTop: moderateScale(20),
    paddingHorizontal: moderateScale(20),
    alignItems: "center",
    gap: moderateScale(10),
  },
  emoji: {
    fontSize: moderateScale(36),
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    textAlign: "center",
    lineHeight: moderateScale(20),
  },
  lockCard: {
    width: "100%",
    alignItems: "center",
    gap: moderateScale(8),
    backgroundColor: GameColors.background,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(20),
  },
  lockEmoji: {
    fontSize: moderateScale(40),
  },
  lockText: {
    fontSize: moderateScale(15),
    fontWeight: "600",
    color: GameColors.text,
    textAlign: "center",
    lineHeight: moderateScale(22),
  },
  lockPrice: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: GameColors.coinText,
  },
  buyBtn: {
    width: "100%",
    minHeight: moderateScale(52),
    borderRadius: moderateScale(16),
    backgroundColor: GameColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buyBtnText: {
    fontSize: moderateScale(17),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cantBuy: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
  closeBtn: {
    width: "100%",
    minHeight: moderateScale(48),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: moderateScale(4),
  },
  closeBtnText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
});
