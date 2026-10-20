import { AppIcon } from "@/components/ui/AppIcon";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";

export function AchievementsLink() {
  const router = useRouter(), { t } = useTranslation();
  return <Pressable onPress={() => router.push("/achievements")} accessibilityRole="button"
    accessibilityLabel={t("achievements.open")} style={styles.link}>
    <AppIcon name="boss-badge" size={moderateScale(24)} />
    <Text style={styles.label}>{t("achievements.title")}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  link: { minHeight: moderateScale(48), flexDirection: "row", alignItems: "center", gap: moderateScale(6), paddingHorizontal: moderateScale(8) },
  label: { color: GameColors.coinText, fontSize: moderateScale(14), fontWeight: "700", flexShrink: 1 },
});
