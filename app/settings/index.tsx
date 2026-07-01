import { PrivacyLink } from "@/components/settings/PrivacyLink";
import { DataManagementSection } from "@/components/settings/DataManagementSection";
import { LicensesLink } from "@/components/settings/LicensesLink";
import { GameColors } from "@/constants/game";
import { useLocale } from "@/contexts/LocaleProvider";
import { APP_LOCALES, type AppLocale } from "@/types/locale";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  const handleBack = useCallback(() => {
    triggerHaptic();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }, [router]);

  const handleSelectLocale = useCallback(
    async (next: AppLocale) => {
      if (next === locale) return;
      triggerHaptic();
      await setLocale(next);
    },
    [locale, setLocale],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>

        <Text style={styles.title}>{t("settings.title")}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
          <Text style={styles.sectionHint}>{t("settings.languageHint")}</Text>

          <View style={styles.options}>
            {APP_LOCALES.map((code) => {
              const selected = locale === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => handleSelectLocale(code)}
                  style={[styles.option, selected && styles.optionSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(`locale.${code}`)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {t(`locale.${code}`)}
                  </Text>
                  {selected ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <DataManagementSection />

        <PrivacyLink />

        <LicensesLink />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: GameColors.background,
  },
  scroll: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(24),
    gap: moderateScale(16),
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
  section: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(16),
    gap: moderateScale(10),
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
  options: {
    gap: moderateScale(8),
    marginTop: moderateScale(4),
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: moderateScale(52),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.background,
    paddingHorizontal: moderateScale(14),
  },
  optionSelected: {
    borderColor: GameColors.secondary,
    backgroundColor: "#E8FAF8",
  },
  optionText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  optionTextSelected: {
    color: GameColors.text,
  },
  check: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: GameColors.secondary,
  },
});
