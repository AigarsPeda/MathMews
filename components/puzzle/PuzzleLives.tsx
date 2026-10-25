import { AppIcon } from "@/components/ui/AppIcon";
import { MAX_LIVES } from "@/constants/game";
import type { LivesState } from "@/types/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

export function PuzzleLives({ lives, onPress }: { lives: LivesState; onPress: () => void }) {
  const { t } = useTranslation();
  return <Pressable onPress={onPress} accessibilityRole="button"
    accessibilityLabel={t("lives.a11yLives", { current: lives.current, max: MAX_LIVES })}
    accessibilityHint={t("lives.mistakeCost")}
    accessibilityLiveRegion="polite" style={styles.row}>
    {Array.from({ length: MAX_LIVES }, (_, index) => <View key={index} style={index >= lives.current ? styles.used : undefined}>
      <AppIcon name="heart" size={moderateScale(22)} />
    </View>)}
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: moderateScale(4), minHeight: 44, paddingHorizontal: moderateScale(4) },
  used: { opacity: 0.2 },
});
