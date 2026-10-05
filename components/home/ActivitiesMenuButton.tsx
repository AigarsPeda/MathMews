import { HomeActionContent, homeActionStyles } from "@/components/home/HomeActionContent";
import type { RoomItemMenuAction } from "@/components/pet/RoomActionMenu";
import { CAT_PLAY_ACTIVITIES, getCatPlayActivity, type CatPlayActivity } from "@/constants/cat-play";
import { NativeActionMenu } from "@/components/ui/NativeActionMenu";
import type { NativeActionMenuProps } from "@/components/ui/NativeActionMenu.types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

type Props = {
  disabled: boolean;
  onSelect: (activity: CatPlayActivity) => void;
  roomActions: RoomItemMenuAction[];
};

export function ActivitiesMenuButton({ disabled, onSelect, roomActions }: Props) {
  const { t } = useTranslation();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const actions: NativeActionMenuProps["actions"] = CAT_PLAY_ACTIVITIES.map((activity) => ({
    id: `play:${activity.id}`,
    title: t(`home.playStyle.${activity.id}`),
    icon: activity.icon,
    attributes: { disabled },
  }));
  actions.push(...roomActions.map((action, index) => ({
    id: `room:${index}`, title: action.label, icon: action.icon,
    attributes: { disabled: disabled || action.disabled === true },
  })));
  const trigger = (
    <View onLayout={({ nativeEvent: { layout } }) => {
      setSize(current => current.height === layout.height ? current : { ...current, height: layout.height });
    }} style={[homeActionStyles.button, { width: size.width || "100%" }, disabled && styles.disabled]}>
      <HomeActionContent icon="play" label={t("home.activities")} dropdown />
    </View>
  );

  return (
    <View style={styles.container} pointerEvents={disabled ? "none" : "auto"}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize(current => current.width === layout.width ? current : { ...current, width: layout.width });
      }}>
      {size.width > 0 && size.height > 0 ? (
        <NativeActionMenu {...size} title={t("home.activities")} label={t("home.a11yActivitiesMenu")}
          actions={actions} blocked={disabled} onSelect={id => {
            if (disabled) return;
            if (id.startsWith("play:")) {
              const activity = getCatPlayActivity(id.slice(5));
              if (activity) onSelect(activity);
            } else {
              const action = roomActions.find((_, index) => id === `room:${index}`);
              if (action && !action.disabled) action.onPress();
            }
          }}>
          {trigger}
        </NativeActionMenu>
      ) : trigger}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: homeActionStyles.button.minHeight },
  disabled: { opacity: 0.55 },
});
