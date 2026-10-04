import { AppIcon } from "@/components/ui/AppIcon";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";


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
      <AppIcon name="stats" size={moderateScale(compact ? 24 : 26)} />
      <Text style={[styles.text, compact && styles.textCompact]}>
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
  chipCompact: {
    width: "100%",
    backgroundColor: GameColors.background,
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    minHeight: moderateScale(40),
    gap: moderateScale(6),
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
});
