import { CatSkinPicker } from "@/components/onboarding/CatSkinPicker";
import { RestoreProgressPrompt } from "@/components/onboarding/RestoreProgressPrompt";
import { GameColors } from "@/constants/game";
import {
  DEFAULT_CAT_SKIN_ID,
  type CatSkinId,
} from "@/constants/cat-skins";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import { PET_NAME_MAX_LENGTH } from "@/types/save";
import { APP_LOCALES, type AppLocale } from "@/types/locale";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function NamePetScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const {
    isReady,
    hasCompletedOnboarding,
    completeOnboarding,
    cloudRestoreCandidates,
    cloudRestoreCheckComplete,
    cloudRestorePromptDismissed,
    acceptCloudRestore,
    declineCloudRestore,
    showCloudRestorePrompt,
  } = useGame();
  const [name, setName] = useState("");
  const [catSkinId, setCatSkinId] = useState<CatSkinId>(DEFAULT_CAT_SKIN_ID);
  const [selectedLocale, setSelectedLocale] = useState<AppLocale>(locale);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const trimmedName = name.trim();
  const canContinue = trimmedName.length > 0 && !isSubmitting;
  const showRestorePrompt =
    cloudRestoreCandidates.length > 0 && !cloudRestorePromptDismissed;
  const canRestoreLater =
    cloudRestoreCandidates.length > 0 && cloudRestorePromptDismissed;

  const handleSelectLocale = useCallback((next: AppLocale) => {
    if (next === selectedLocale) return;
    triggerHaptic();
    setSelectedLocale(next);
    void setLocale(next);
  }, [selectedLocale, setLocale]);

  const handleRestore = useCallback(
    async (saveId: string) => {
      setIsRestoring(true);
      const ok = await acceptCloudRestore(saveId);
      setIsRestoring(false);
      if (ok) {
        router.replace("/");
      }
    },
    [acceptCloudRestore, router],
  );

  const handleStartFresh = useCallback(() => {
    declineCloudRestore();
  }, [declineCloudRestore]);

  const handleContinue = useCallback(async () => {
    if (!canContinue) return;

    triggerHaptic();
    setIsSubmitting(true);

    if (selectedLocale !== locale) {
      await setLocale(selectedLocale);
    }

    const ok = await completeOnboarding({ name: trimmedName, catSkinId });
    setIsSubmitting(false);

    if (ok) {
      router.replace("/");
    }
  }, [
    canContinue,
    catSkinId,
    completeOnboarding,
    locale,
    router,
    selectedLocale,
    setLocale,
    trimmedName,
  ]);

  if (!isReady || !cloudRestoreCheckComplete) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={GameColors.primary} />
      </View>
    );
  }

  if (hasCompletedOnboarding) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.body}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.screen}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {showRestorePrompt ? (
              <RestoreProgressPrompt
                saves={cloudRestoreCandidates}
                isWorking={isRestoring}
                onRestore={(saveId) => void handleRestore(saveId)}
                onStartFresh={handleStartFresh}
              />
            ) : (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>{t("onboarding.title")}</Text>
                  <Text style={styles.subtitle}>{t("onboarding.subtitle")}</Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>{t("onboarding.language")}</Text>
                  <View style={styles.localeOptions}>
                    {APP_LOCALES.map((code) => {
                      const selected = selectedLocale === code;
                      return (
                        <Pressable
                          key={code}
                          onPress={() => handleSelectLocale(code)}
                          style={[
                            styles.localeOption,
                            selected && styles.localeOptionSelected,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={t(`locale.${code}`)}
                        >
                          <Text
                            style={[
                              styles.localeOptionText,
                              selected && styles.localeOptionTextSelected,
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

                <CatSkinPicker value={catSkinId} onChange={setCatSkinId} />

                <View style={styles.section}>
                  <Text style={styles.label}>{t("onboarding.petName")}</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder={t("onboarding.placeholder")}
                    placeholderTextColor={GameColors.textMuted}
                    maxLength={PET_NAME_MAX_LENGTH}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleContinue}
                    accessibilityLabel={t("onboarding.a11yPetName")}
                  />
                  <Text style={styles.hint}>
                    {t("onboarding.charCount", {
                      count: trimmedName.length,
                      max: PET_NAME_MAX_LENGTH,
                    })}
                  </Text>
                </View>

                {canRestoreLater ? (
                  <Pressable
                    onPress={() => {
                      triggerHaptic();
                      showCloudRestorePrompt();
                    }}
                    style={styles.restoreLaterButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.restoreLaterText}>
                      {t("onboarding.restore.restoreLaterMultiple", {
                        count: cloudRestoreCandidates.length,
                      })}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </ScrollView>

          {!showRestorePrompt ? (
            <View style={styles.footer}>
              <Pressable
                style={[
                  styles.primaryBtn,
                  !canContinue && styles.primaryBtnDisabled,
                ]}
                onPress={handleContinue}
                disabled={!canContinue}
                accessibilityRole="button"
                accessibilityLabel={t("onboarding.a11yContinue")}
                accessibilityState={{ disabled: !canContinue }}
              >
                <Text style={styles.primaryBtnText}>
                  {isSubmitting ? t("common.saving") : t("onboarding.meetPet")}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GameColors.background,
  },
  safe: {
    flex: 1,
    backgroundColor: GameColors.background,
  },
  body: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(8),
    paddingBottom: moderateScale(12),
    gap: moderateScale(14),
  },
  header: {
    alignItems: "center",
    gap: moderateScale(4),
  },
  title: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: GameColors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    textAlign: "center",
    lineHeight: moderateScale(20),
    maxWidth: moderateScale(320),
  },
  section: {
    gap: moderateScale(6),
  },
  label: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
  hint: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
  },
  localeOptions: {
    gap: moderateScale(8),
  },
  localeOption: {
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    paddingHorizontal: moderateScale(16),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  localeOptionSelected: {
    borderColor: GameColors.primary,
    backgroundColor: "#FFF8F5",
  },
  localeOptionText: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: GameColors.text,
  },
  localeOptionTextSelected: {
    color: GameColors.primary,
    fontWeight: "700",
  },
  check: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: GameColors.primary,
  },
  input: {
    minHeight: moderateScale(48),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    paddingHorizontal: moderateScale(16),
    fontSize: moderateScale(18),
    fontWeight: "600",
    color: GameColors.text,
  },
  footer: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(8),
    paddingBottom: moderateScale(8),
    borderTopWidth: 1,
    borderTopColor: GameColors.cardBorder,
    backgroundColor: GameColors.background,
  },
  primaryBtn: {
    backgroundColor: GameColors.primary,
    borderRadius: moderateScale(18),
    minHeight: moderateScale(50),
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(20),
    shadowColor: GameColors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  restoreLaterButton: {
    alignItems: "center",
    paddingVertical: moderateScale(8),
  },
  restoreLaterText: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.primary,
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
