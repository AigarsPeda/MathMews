import { CAT_PLAY_ACTIVITIES, getCatPlayActivity, type CatPlayActivity } from "@/constants/cat-play";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { NativePlayMenu } from "./NativePlayMenu";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  disabled: boolean;
  onSelect: (activity: CatPlayActivity) => void;
};

export function PlayMenuButton({ disabled, onSelect }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const actions = CAT_PLAY_ACTIVITIES.map((activity) => ({
    id: activity.id,
    title: `${activity.emoji} ${t(`home.playStyle.${activity.id}`)}`,
    attributes: { disabled },
  }));
  const trigger = (
    <View style={[styles.button, Platform.OS !== "web" && size.width > 0 && size, disabled && styles.disabled]}>
      <Text style={styles.emoji}>🎾</Text>
      <Text style={styles.label}>{t("home.play")} ⌄</Text>
    </View>
  );

  // Expo's native MenuView opens on a tap on iOS and Android.
  if (Platform.OS !== "web") {
    return (
      <View style={styles.container} pointerEvents={disabled ? "none" : "auto"}
        onLayout={({ nativeEvent: { layout } }) => {
          setSize(current => current.width === layout.width && current.height === layout.height
            ? current : { width: layout.width, height: layout.height });
        }}>
        {size.width > 0 ? (
          <NativePlayMenu {...size} title={t("home.choosePlay")} label={t("home.a11yPlayMenu")}
            actions={actions} blocked={disabled} onSelect={id => {
              const activity = getCatPlayActivity(id);
              if (activity) onSelect(activity);
            }}>
            {trigger}
          </NativePlayMenu>
        ) : null}
      </View>
    );
  }

  // The native menu has no web implementation; keep all choices available here.
  return (
    <View style={styles.container}>
      <Pressable disabled={disabled} onPress={() => setOpen(true)} accessibilityRole="button"
        accessibilityLabel={t("home.a11yPlayMenu")} accessibilityState={{ disabled, expanded: open }}>
        {trigger}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} accessibilityLabel={t("home.dismissPlayMenu")}>
          <View style={styles.popup} accessibilityViewIsModal>
            <Text style={styles.title}>{t("home.choosePlay")}</Text>
            {CAT_PLAY_ACTIVITIES.map((activity, i) => (
              <Pressable key={activity.id} disabled={actions[i].attributes.disabled}
                style={[styles.option, actions[i].attributes.disabled && styles.disabled]}
                accessibilityRole="button" accessibilityLabel={actions[i].title}
                onPress={() => { setOpen(false); onSelect(activity); }}>
                <Text style={styles.optionLabel}>{activity.emoji} {t(`home.playStyle.${activity.id}`)}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
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
  emoji: { fontSize: moderateScale(24) },
  label: { fontSize: moderateScale(15), fontWeight: "700", color: GameColors.text },
  overlay: { flex: 1, backgroundColor: "rgba(45,52,54,0.22)", justifyContent: "flex-end", alignItems: "flex-end", padding: moderateScale(24) },
  popup: { width: moderateScale(290), maxWidth: "100%", backgroundColor: GameColors.card, borderRadius: moderateScale(16), padding: moderateScale(12), borderWidth: 2, borderColor: GameColors.cardBorder },
  title: { fontSize: moderateScale(15), fontWeight: "700", color: GameColors.textMuted, padding: moderateScale(8) },
  option: { minHeight: moderateScale(50), flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: moderateScale(10), paddingHorizontal: moderateScale(8) },
  optionLabel: { fontSize: moderateScale(15), fontWeight: "600", color: GameColors.text, flexShrink: 1 },
});
