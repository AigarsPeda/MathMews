import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Image, Pressable, StyleSheet, Text } from "react-native";

const STATS_ICON = require("@/assets/images/stats-icon.png");

type MathStatsChipProps = {
  onPress: () => void;
  /** Tighter look when nested above pet Fed/Happiness/Wisdom bars. */
  compact?: boolean;
};

/** Opens topic accuracy / mistake stats. */
export function MathStatsChip({ onPress, compact = false }: MathStatsChipProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      style={[styles.chip, compact && styles.chipCompact]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("stats.a11yOpen")}
    >
      <Image
        source={STATS_ICON}
        style={[styles.icon, compact && styles.iconCompact]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={[styles.text, compact && styles.textCompact]}>
        {t("stats.chip")}
      </Text>
      <Text style={[styles.chevron, compact && styles.chevronCompact]}>›</Text>
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
  chipCompact: {
    width: "100%",
    backgroundColor: GameColors.background,
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    minHeight: moderateScale(40),
    gap: moderateScale(6),
  },
  icon: {
    width: moderateScale(22),
    height: moderateScale(20),
  },
  iconCompact: {
    width: moderateScale(20),
    height: moderateScale(18),
  },
  text: {
    flex: 1,
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.text,
  },
  textCompact: {
    fontSize: moderateScale(14),
  },
  chevron: {
    fontSize: moderateScale(22),
    fontWeight: "700",
    color: GameColors.textMuted,
    lineHeight: moderateScale(24),
  },
  chevronCompact: {
    fontSize: moderateScale(20),
    lineHeight: moderateScale(22),
  },
});
