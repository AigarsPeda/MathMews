import { CloudSaveList } from "@/components/cloud-save/CloudSaveList";
import { GameColors } from "@/constants/game";
import type { CloudSaveSummary } from "@/services/cloud-save/merge-game-save";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type RestoreProgressPromptProps = {
  saves: CloudSaveSummary[];
  isWorking: boolean;
  onRestore: (saveId: string) => void;
  onStartFresh: () => void;
};

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function RestoreProgressPrompt({
  saves,
  isWorking,
  onRestore,
  onStartFresh,
}: RestoreProgressPromptProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>🐱</Text>
      <Text style={styles.title}>{t("onboarding.restore.title")}</Text>
      <Text style={styles.message}>{t("onboarding.restore.messageMultiple")}</Text>

      <CloudSaveList
        saves={saves}
        isWorking={isWorking}
        onRestore={(saveId) => {
          triggerHaptic();
          onRestore(saveId);
        }}
      />

      <Pressable
        onPress={() => {
          triggerHaptic();
          onStartFresh();
        }}
        disabled={isWorking}
        style={styles.secondaryButton}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>
          {t("onboarding.restore.startFreshAction")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(16),
    gap: moderateScale(12),
  },
  emoji: {
    fontSize: moderateScale(32),
    textAlign: "center",
  },
  title: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: GameColors.text,
    textAlign: "center",
  },
  message: {
    fontSize: moderateScale(15),
    fontWeight: "500",
    color: GameColors.textMuted,
    lineHeight: moderateScale(22),
    textAlign: "center",
  },
  secondaryButton: {
    minHeight: moderateScale(44),
    borderRadius: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(14),
  },
  secondaryButtonText: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.textMuted,
    textAlign: "center",
  },
});
