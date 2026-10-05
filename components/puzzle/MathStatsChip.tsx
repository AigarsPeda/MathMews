import { AppIcon } from "@/components/ui/AppIcon";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";


type MathStatsChipProps = {
  onPress: () => void;
  /** Circular shortcut beside the compact pet stat rings. */
  compact?: boolean;
};

/** Opens topic accuracy / mistake stats. */
export function MathStatsChip({ onPress, compact = false }: MathStatsChipProps) {
  const { t } = useTranslation();

  if (compact) return (
    <Pressable style={styles.shortcut} onPress={onPress}
      accessibilityRole="button" accessibilityLabel={t("stats.a11yOpen")}>
      <View style={styles.shortcutCircle}>
        <AppIcon name="stats" size={moderateScale(28)} />
      </View>
      <Text style={styles.shortcutLabel}>{t("stats.chip")}</Text>
    </Pressable>
  );

  return (
    <Pressable
      style={styles.chip}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("stats.a11yOpen")}
    >
      <AppIcon name="stats" size={moderateScale(26)} />
      <Text style={styles.text}>
        {t("stats.chip")}
      </Text>
      <AppIcon name="chevron-right" size={moderateScale(18)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(12),
    minHeight: moderateScale(48),
  },
  text: {
    flex: 1,
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.text,
  },
  shortcut: { alignItems: "center", minWidth: moderateScale(64), gap: moderateScale(4) },
  shortcutCircle: { width: moderateScale(48), height: moderateScale(48), borderRadius: moderateScale(24),
    borderWidth: 1, borderColor: GameColors.cardBorder, backgroundColor: GameColors.background,
    alignItems: "center", justifyContent: "center" },
  shortcutLabel: { fontSize: moderateScale(11), lineHeight: moderateScale(16), fontWeight: "600", color: GameColors.textMuted },
});
