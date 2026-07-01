import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function PrivacyLink() {
  const router = useRouter();
  const { t } = useTranslation();

  const handlePress = useCallback(() => {
    triggerHaptic();
    router.push("/settings/privacy");
  }, [router]);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.section}
      accessibilityRole="button"
      accessibilityLabel={t("settings.privacy")}
    >
      <View style={styles.textWrap}>
        <Text style={styles.sectionTitle}>{t("settings.privacy")}</Text>
        <Text style={styles.sectionHint}>{t("settings.privacyHint")}</Text>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={moderateScale(24)}
        color={GameColors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(12),
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(16),
  },
  textWrap: {
    flex: 1,
    gap: moderateScale(4),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: GameColors.text,
  },
  sectionHint: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    lineHeight: moderateScale(20),
  },
});
