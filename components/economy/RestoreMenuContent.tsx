import { CloudSaveList } from "@/components/cloud-save/CloudSaveList";
import { GameColors } from "@/constants/game";
import { useGame } from "@/contexts/GameProvider";
import { useIAP } from "@/contexts/IAPProvider";
import { isCloudSaveAvailable } from "@/services/cloud-save/cloud-save";
import type { CloudSaveSummary } from "@/services/cloud-save/merge-game-save";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type RestoreMenuContentProps = {
  onBack?: () => void;
  onClose: () => void;
};

function triggerHaptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
) {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style);
  }
}

export function RestoreMenuContent({
  onBack,
  onClose,
}: RestoreMenuContentProps) {
  const { t } = useTranslation();
  const { fetchSwitchableCloudSaves, switchToCloudSave } = useGame();
  const { isSupported, restorePurchases } = useIAP();
  const [saves, setSaves] = useState<CloudSaveSummary[]>([]);
  const [isLoadingSaves, setIsLoadingSaves] = useState(true);
  const [isSwitchingSave, setIsSwitchingSave] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"success" | "error" | "info" | null>(
    null,
  );

  const loadSaves = useCallback(async () => {
    if (!isCloudSaveAvailable()) {
      setSaves([]);
      setIsLoadingSaves(false);
      return;
    }

    setIsLoadingSaves(true);
    try {
      const next = await fetchSwitchableCloudSaves();
      setSaves(next);
    } catch {
      setSaves([]);
    } finally {
      setIsLoadingSaves(false);
    }
  }, [fetchSwitchableCloudSaves]);

  useEffect(() => {
    void loadSaves();
  }, [loadSaves]);

  const handleSwitchSave = useCallback(
    async (saveId: string) => {
      if (isSwitchingSave) return;

      setIsSwitchingSave(true);
      setStatusMessage(null);
      setStatusKind(null);
      triggerHaptic();

      const target = saves.find((save) => save.saveId === saveId);
      const ok = await switchToCloudSave(saveId);
      setIsSwitchingSave(false);

      if (ok) {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setStatusKind("success");
        setStatusMessage(
          t("cloudRestore.gameSwitched", {
            name: target?.petName ?? t("cloudRestore.defaultPetName"),
          }),
        );
        onClose();
        return;
      }

      setStatusKind("error");
      setStatusMessage(t("cloudRestore.switchFailed"));
    },
    [isSwitchingSave, onClose, saves, switchToCloudSave, t],
  );

  const handleRestorePurchases = useCallback(async () => {
    if (isRestoringPurchases || !isSupported) return;

    setIsRestoringPurchases(true);
    setStatusMessage(null);
    setStatusKind(null);
    triggerHaptic();

    try {
      const restoredCoins = await restorePurchases();
      setStatusKind(restoredCoins > 0 ? "success" : "info");
      setStatusMessage(
        restoredCoins > 0
          ? t("iap.restoreCoinsRestored", { count: restoredCoins })
          : t("iap.restoreDone"),
      );
    } catch {
      setStatusKind("error");
      setStatusMessage(t("iap.purchaseFailed"));
    } finally {
      setIsRestoringPurchases(false);
    }
  }, [isRestoringPurchases, isSupported, restorePurchases, t]);

  return (
    <View style={styles.card}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Text style={styles.backBtnText}>{t("common.back")}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.emoji}>🐱</Text>
      <Text style={styles.title}>{t("cloudRestore.menuTitle")}</Text>
      <Text style={styles.subtitle}>{t("cloudRestore.menuHint")}</Text>

      {isLoadingSaves ? (
        <ActivityIndicator color={GameColors.primary} style={styles.loader} />
      ) : saves.length > 0 ? (
        <CloudSaveList
          saves={saves}
          isWorking={isSwitchingSave}
          onRestore={(saveId) => void handleSwitchSave(saveId)}
        />
      ) : (
        <Text style={styles.empty}>{t("cloudRestore.empty")}</Text>
      )}

      {statusMessage ? (
        <Text
          style={[
            styles.status,
            statusKind === "success" && styles.statusSuccess,
            statusKind === "error" && styles.statusError,
          ]}
        >
          {statusMessage}
        </Text>
      ) : null}

      {isSupported ? (
        <Pressable
          style={styles.restorePurchasesBtn}
          onPress={() => void handleRestorePurchases()}
          disabled={isRestoringPurchases}
          accessibilityRole="button"
          accessibilityLabel={t("iap.restorePurchases")}
        >
          <Text style={styles.restorePurchasesText}>
            {isRestoringPurchases ? t("iap.restoring") : t("iap.restorePurchases")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingTop: moderateScale(4),
    paddingHorizontal: moderateScale(20),
    gap: moderateScale(8),
    width: "100%",
  },
  backBtn: {
    alignSelf: "flex-start",
    minHeight: moderateScale(36),
    justifyContent: "center",
    marginBottom: moderateScale(4),
  },
  backBtnText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.primary,
  },
  emoji: {
    fontSize: moderateScale(32),
  },
  title: {
    fontSize: moderateScale(22),
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
    marginBottom: moderateScale(4),
  },
  loader: {
    marginVertical: moderateScale(20),
  },
  empty: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    textAlign: "center",
    lineHeight: moderateScale(20),
    marginVertical: moderateScale(12),
  },
  status: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
  statusSuccess: {
    color: GameColors.primary,
  },
  statusError: {
    color: GameColors.primaryDark,
  },
  restorePurchasesBtn: {
    marginTop: moderateScale(8),
    minHeight: moderateScale(40),
    justifyContent: "center",
    paddingHorizontal: moderateScale(12),
  },
  restorePurchasesText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.textMuted,
    textDecorationLine: "underline",
  },
});
