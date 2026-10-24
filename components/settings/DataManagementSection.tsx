import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { ParentGateSheet } from '@/components/economy/ParentGateSheet';
import { GameColors } from "@/constants/game";
import { useGameActions } from "@/contexts/GameProvider";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function DataManagementSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const { deleteAllUserData } = useGameActions();
  const [showConfirm, setShowConfirm] = useState(false);
  const [parentPassed, setParentPassed] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') setParentPassed(false);
    });
    return () => subscription.remove();
  }, []);
  const [isWorking, setIsWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"success" | "error" | null>(null);

  const goToOnboarding = useCallback(() => {
    router.replace("/onboarding/name-pet");
  }, [router]);

  const runDelete = useCallback(async () => {
    setIsWorking(true);
    setStatusMessage(null);
    setStatusKind(null);

    const result = await deleteAllUserData();

    setIsWorking(false);
    setShowConfirm(false);

    if (result.ok) {
      triggerHaptic();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      goToOnboarding();
      return;
    }

    setStatusKind("error");
    setStatusMessage(result.pending
      ? t("settings.dataManagement.pending", { id: result.requestId })
      : t("settings.dataManagement.failed"));
  }, [deleteAllUserData, goToOnboarding, t]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("settings.dataManagement.title")}</Text>
      <Text style={styles.sectionHint}>{t("settings.dataManagement.hint")}</Text>

      <Pressable
        onPress={() => {
          triggerHaptic();
          setParentPassed(false);
          setShowConfirm(true);
        }}
        disabled={isWorking}
        style={[styles.button, styles.deleteButton]}
        accessibilityRole="button"
      >
        {isWorking ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.deleteButtonText}>
            {t("settings.dataManagement.deleteAction")}
          </Text>
        )}
      </Pressable>

      {statusMessage ? (
        <Text style={[styles.status, statusKind === "error" && styles.statusError]}>
          {statusMessage}
        </Text>
      ) : null}

      {showConfirm ? (
        <AppBottomSheet
          visible
          onClose={() => setShowConfirm(false)}
        >
          {parentPassed ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('settings.dataManagement.deleteConfirmTitle')}</Text>
              <Text style={styles.sectionHint}>{t('settings.dataManagement.deleteConfirmMessage')}</Text>
              <Pressable accessibilityRole="button" disabled={isWorking} onPress={runDelete} style={[styles.button,styles.deleteButton]}>
                {isWorking ? <ActivityIndicator color="#FFFFFF"/> : <Text style={styles.deleteButtonText}>{t('settings.dataManagement.deleteConfirmAction')}</Text>}
              </Pressable>
              <Pressable accessibilityRole="button" disabled={isWorking} onPress={() => setShowConfirm(false)} style={styles.button}>
                <Text style={styles.sectionHint}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          ) : <ParentGateSheet visible embedded onPass={() => setParentPassed(true)} onClose={() => setShowConfirm(false)}/>}
        </AppBottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  button: {
    minHeight: moderateScale(50),
    borderRadius: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(14),
  },
  deleteButton: {
    backgroundColor: "#C0392B",
  },
  deleteButtonText: {
    fontSize: moderateScale(15),
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  status: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    textAlign: "center",
  },
  statusError: {
    color: GameColors.primary,
  },
});
