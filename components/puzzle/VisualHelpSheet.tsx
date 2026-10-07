import { AppIcon } from "@/components/ui/AppIcon";
import { VisualExplanationPlayer } from "@/components/puzzle/VisualExplanationPlayer";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { GameColors } from "@/constants/game";
import { getVisualExplanation, NUMBER_LINE_EXAMPLES } from "@/constants/visual-explanations";
import type { Puzzle } from "@/types/puzzle";
import { getPuzzleType } from "@/utils/puzzle-type";
import { moderateScale } from "@/utils/scale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const isNumberLine = getPuzzleType(puzzle) === "number_line";
  const explanation = getVisualExplanation(puzzle);
  if (isNumberLine) explanation.keyframes = NUMBER_LINE_EXAMPLES[direction];
  const key = `${visible}-${puzzle.id}`;
  const [previousKey, setPreviousKey] = useState(key);
  if (key !== previousKey) { setPreviousKey(key); setProgress(0); setDirection("forward"); }
  return (
    <AppBottomSheet visible={visible} onClose={onClose} expanded>
      <ScrollView
        style={[styles.scroll, { maxHeight: height * 0.88 - insets.top - insets.bottom - moderateScale(48) }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={Platform.OS === "android"}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {!isNumberLine ? <AppIcon name="film" size={moderateScale(36) * 1.2} /> : null}
          <Text style={styles.title}>
            {t(isNumberLine ? "visualHelp.numberLine.title" : "visualHelp.title")}
          </Text>
          <Text style={styles.subtitle}>
            {t(isNumberLine ? "visualHelp.numberLine.subtitle" : "visualHelp.subtitle")}
          </Text>

          {isNumberLine ? (
            <View style={styles.directions}>
              {(["forward", "back"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: direction === value }}
                  onPress={() => { setDirection(value); setProgress(0); }}
                  style={[styles.directionButton, direction === value && styles.directionSelected]}
                >
                  <Text style={[styles.directionText, direction === value && styles.directionTextSelected]}>
                    {t(`visualHelp.numberLine.${value}.label`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <VisualExplanationPlayer explanation={explanation} progress={progress} onProgressChange={setProgress} stepByStep={isNumberLine} />

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
  directions: {
    width: "100%",
    flexDirection: "row",
    gap: moderateScale(8),
  },
  directionButton: {
    flex: 1,
    minHeight: moderateScale(44),
    padding: moderateScale(10),
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  directionSelected: {
    borderColor: GameColors.primary,
    backgroundColor: GameColors.primary,
  },
  directionText: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.text,
  },
  directionTextSelected: {
    color: "#FFFFFF",
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
