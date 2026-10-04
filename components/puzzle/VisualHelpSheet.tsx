import { VisualExplanationPlayer } from "@/components/puzzle/VisualExplanationPlayer";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { GameColors } from "@/constants/game";
import { getVisualExplanation } from "@/constants/visual-explanations";
import type { Puzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  visible,
  puzzle,
  onClose,
}: VisualHelpSheetProps) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const explanation = getVisualExplanation(puzzle);
  const key = `${visible}-${puzzle.id}`;
  const [previousKey, setPreviousKey] = useState(key);
  if (key !== previousKey) { setPreviousKey(key); setProgress(0); }
  return (
    <AppBottomSheet visible={visible} onClose={onClose} expanded>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={Platform.OS === "android"}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.emoji}>🎬</Text>
          <Text style={styles.title}>{t("visualHelp.title")}</Text>
          <Text style={styles.subtitle}>{t("visualHelp.subtitle")}</Text>

          <VisualExplanationPlayer explanation={explanation} progress={progress} onProgressChange={setProgress} />

          <Pressable
            style={[styles.closeBtn, styles.closeBtnPrimary]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Text
              style={[
                styles.closeBtnText,
                styles.closeBtnTextPrimary,
              ]}
            >
              {t("common.gotIt")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: moderateScale(8),
  },
  card: {
    alignItems: "center",
    gap: moderateScale(10),
    paddingTop: moderateScale(12),
    paddingHorizontal: moderateScale(4),
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
