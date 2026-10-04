import { IconText as Text } from "@/components/ui/IconText";
import { BackButtonLabel } from "@/components/ui/BackButtonLabel";
import { LicenseList } from "@/components/settings/LicenseList";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function LicensesScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const handleBack = useCallback(() => {
    triggerHaptic();
    router.back();
  }, [router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <Pressable
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <BackButtonLabel style={styles.backText} />
        </Pressable>

        <Text style={styles.title}>{t("settings.licenses")}</Text>
        <Text style={styles.subtitle}>{t("settings.licensesHint")}</Text>

        <LicenseList style={styles.list} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: GameColors.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(16),
    gap: moderateScale(8),
  },
  backBtn: {
    minHeight: moderateScale(48),
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: GameColors.text,
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    lineHeight: moderateScale(20),
    marginBottom: moderateScale(4),
  },
  list: {
    flex: 1,
  },
});
