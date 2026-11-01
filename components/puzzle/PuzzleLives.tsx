import { PuzzleText } from "@/components/puzzle/PuzzleText";
import { PuzzleColors } from "@/constants/puzzle-theme";
import { AppIcon } from "@/components/ui/AppIcon";
import { MAX_LIVES } from "@/constants/game";
import type { LivesState } from "@/types/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";

export function PuzzleLives({ lives, onPress }: { lives: LivesState; onPress: () => void }) {
  const { t } = useTranslation();
  return <Pressable onPress={onPress} accessibilityRole="button"
    accessibilityLabel={t("lives.a11yLives", { current: lives.current, max: MAX_LIVES })}
    accessibilityHint={t("lives.mistakeCost")}
    accessibilityLiveRegion="polite" style={styles.row}>
    <AppIcon name="heart" size={moderateScale(24)} />
    <PuzzleText style={styles.count}>{lives.current}</PuzzleText>
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: moderateScale(5), minWidth: 44, minHeight: 44, paddingHorizontal: moderateScale(4) },
  count: { fontSize: moderateScale(18), fontWeight: "800", color: PuzzleColors.text, fontVariant: ["tabular-nums"] },
});
