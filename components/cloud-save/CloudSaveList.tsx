import { GameColors } from "@/constants/game";
import { useLocale } from "@/contexts/LocaleProvider";
import type { CloudSaveSummary } from "@/services/cloud-save/merge-game-save";
import { formatGameStartedDate } from "@/utils/format-game-date";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type CloudSaveListProps = {
  saves: CloudSaveSummary[];
  isWorking: boolean;
  onRestore: (saveId: string) => void;
};

export function CloudSaveList({
  saves,
  isWorking,
  onRestore,
}: CloudSaveListProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  return (
    <View style={styles.saveList}>
      {saves.map((save) => (
        <Pressable
          key={save.saveId}
          onPress={() => onRestore(save.saveId)}
          disabled={isWorking}
          style={[styles.saveRow, isWorking && styles.buttonDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t("cloudRestore.a11yRestoreSave", {
            name: save.petName,
            date: formatGameStartedDate(save.startedAtMs, locale),
          })}
        >
          <View style={styles.saveRowText}>
            <Text style={styles.saveName}>{save.petName}</Text>
            <Text style={styles.saveMeta}>
              {t("onboarding.restore.saveMeta", {
                date: formatGameStartedDate(save.startedAtMs, locale),
                coins: save.coins,
              })}
            </Text>
          </View>
          {isWorking ? (
            <ActivityIndicator color={GameColors.primary} />
          ) : (
            <Text style={styles.saveAction}>
              {t("onboarding.restore.restoreOne")}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  saveList: {
    gap: moderateScale(8),
    width: "100%",
  },
  saveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(12),
    minHeight: moderateScale(56),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.background,
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(10),
  },
  saveRowText: {
    flex: 1,
    gap: moderateScale(2),
  },
  saveName: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: GameColors.text,
  },
  saveMeta: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
  },
  saveAction: {
    fontSize: moderateScale(14),
    fontWeight: "800",
    color: GameColors.primary,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
