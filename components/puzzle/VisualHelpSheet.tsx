import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { HelpExample } from "@/components/puzzle/HelpExample";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import { helpExampleFor } from "@/constants/help-examples";
import type { Puzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
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
  const help = helpExampleFor(puzzle);
  if (!help) return null;
  return (
    <AppBottomSheet backgroundColor={GameColors.background} visible={visible} onClose={onClose} expanded>
      {(sheetHeight) => <ScrollView
        style={[styles.scroll, { maxHeight: sheetHeight ? sheetHeight : height * 0.88 - insets.top - insets.bottom - moderateScale(48) }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={Platform.OS === "android"}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, sheetHeight ? { minHeight: sheetHeight - moderateScale(8) } : null]}>
          <HelpExample key={`${visible}-${help.key}`} helpKey={help.key} example={help.example} sheetHeight={sheetHeight} />

          <Pressable
            style={[styles.closeBtn, styles.closeBtnPrimary]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("visualHelp.tryPuzzle")}
          >
            <Text
              style={[
                styles.closeBtnText,
                styles.closeBtnTextPrimary,
              ]}
            >
              {t("visualHelp.tryPuzzle")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>}
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
    paddingHorizontal: moderateScale(20),
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
    color: GameColors.card,
    fontWeight: "800",
  },
});
