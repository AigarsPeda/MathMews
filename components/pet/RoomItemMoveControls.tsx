import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { AppIcon } from "@/components/ui/AppIcon";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

const DIRECTIONS = [
  ["left", "arrow-left"], ["right", "arrow-right"],
  ["up", "arrow-up"], ["down", "arrow-down"],
] as const;

export type RoomMoveDirection = typeof DIRECTIONS[number][0];

/** The room stays visible while a child moves the one highlighted item. */
export function RoomItemMoveControls({ name, onMove, onDone }: {
  name: string;
  onMove: (direction: RoomMoveDirection) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  return <View style={styles.content}>
    <View style={styles.heading}>
      <Text style={styles.title}>{t("home.moveSelectedItem", { name })}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("home.finishMoving", { name })}
        onPress={onDone} style={styles.done}>
        <AppIcon name="check" size={20} />
        <Text style={styles.doneText}>{t("home.finishDecorating")}</Text>
      </Pressable>
    </View>
    <View style={styles.arrows}>
      {DIRECTIONS.map(([direction, icon]) => <Pressable key={direction}
        accessibilityRole="button" accessibilityLabel={t("home.moveItem" + direction, { name })}
        onPress={() => onMove(direction)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <AppIcon name={icon} size={24} />
        <Text style={styles.arrowText}>{t("home.nudge" + direction)}</Text>
      </Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  content: { width: "100%", paddingHorizontal: moderateScale(12), gap: 4 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, fontSize: moderateScale(16), fontWeight: "700", color: GameColors.text },
  done: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 48, paddingHorizontal: 8 },
  doneText: { color: GameColors.text, fontSize: moderateScale(15), fontWeight: "600" },
  arrows: { flexDirection: "row", gap: 8 },
  arrow: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", paddingVertical: 6, gap: 2, backgroundColor: GameColors.background, borderRadius: 12 },
  arrowText: { fontSize: moderateScale(12), color: GameColors.text, textAlign: "center" },
  pressed: { backgroundColor: GameColors.cardBorder },
});
