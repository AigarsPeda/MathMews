import { AppIcon } from "@/components/ui/AppIcon";
import { CAT_PLAY_ACTIVITIES, getCatPlayActivity, type CatPlayActivity } from "@/constants/cat-play";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { NativeActionMenu } from "@/components/ui/NativeActionMenu";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  disabled: boolean;
  onSelect: (activity: CatPlayActivity) => void;
};

export function PlayMenuButton({ disabled, onSelect }: Props) {
  const { t } = useTranslation();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const actions = CAT_PLAY_ACTIVITIES.map((activity) => ({
    id: activity.id,
    title: t(`home.playStyle.${activity.id}`),
    icon: activity.icon,
    attributes: { disabled },
  }));
  const trigger = (
    <View style={[styles.button, size.width > 0 && size, disabled && styles.disabled]}>
      <AppIcon name="play" size={moderateScale(30)} />
      <View style={styles.labelRow}><Text style={styles.label}>{t("home.play")}</Text><AppIcon name="chevron-down" size={moderateScale(13)} /></View>
    </View>
  );

  return (
    <View style={styles.container} pointerEvents={disabled ? "none" : "auto"}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize(current => current.width === layout.width && current.height === layout.height
          ? current : { width: layout.width, height: layout.height });
      }}>
      {size.width > 0 ? (
        <NativeActionMenu {...size} title={t("home.choosePlay")} label={t("home.a11yPlayMenu")}
          actions={actions} blocked={disabled} onSelect={id => {
            const activity = getCatPlayActivity(id);
            if (activity) onSelect(activity);
          }}>
          {trigger}
        </NativeActionMenu>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: moderateScale(82) },
  button: {
    minHeight: moderateScale(82), borderRadius: moderateScale(16),
    backgroundColor: GameColors.card, borderWidth: 2, borderColor: GameColors.cardBorder,
    alignItems: "center", justifyContent: "center", paddingVertical: moderateScale(8), gap: 2,
  },
  disabled: { opacity: 0.55 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  label: { fontSize: moderateScale(15), fontWeight: "700", color: GameColors.text },
});
