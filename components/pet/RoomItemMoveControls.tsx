import { GameColors } from "@/constants/game";
import type { AppIconName } from "@/constants/app-icons";
import { moderateScale } from "@/utils/scale";
import { AppIcon } from "@/components/ui/AppIcon";
import { RoomActionMenu, type RoomItemMenuAction } from "@/components/pet/RoomActionMenu";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

const DIRECTIONS = [
  ["left", "arrow-left"], ["right", "arrow-right"],
  ["up", "arrow-up"], ["down", "arrow-down"],
] as const;
export type RoomMoveDirection = typeof DIRECTIONS[number][0];

type Props = {
  name: string;
  picture?: ReactNode;
  feedback?: string;
  actions?: RoomItemMenuAction[];
  onMove: (direction: RoomMoveDirection) => void;
  onDone: () => void;
  rotationDegrees?: number;
  onRotate?: () => void;
  onFaceWall?: () => void;
};

/** Dragging is primary; size and precise movement each get their own small tool. */
export function RoomItemMoveControls({ name, picture, actions = [], onMove, onDone, onRotate, onFaceWall, feedback }: Props) {
  const { t } = useTranslation();
  const [tool, setTool] = useState<"size" | "move" | null>(null);
  const bigger = actions.find(action => action.id === "size-up");
  const smaller = actions.find(action => action.id === "size-down");
  const putAway = actions.find(action => action.id === "put-away");
  const wallAction = actions.find(action => action.id === "face-wall");
  const faceWall = onFaceWall ?? wallAction?.onPress;
  const turn = onFaceWall ? undefined : onRotate ?? actions.find(action => action.id === "turn")?.onPress;
  const more = actions.filter(action => !["turn", "size-up", "size-down", "put-away", "face-wall"].includes(action.id ?? ""));
  const button = (label: string, icon: AppIconName, onPress: () => void, disabled = false, accessibilityLabel = label) =>
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.action, disabled && styles.disabled, pressed && styles.pressed]}>
      <AppIcon name={icon} size={24} /><Text style={styles.actionText}>{label}</Text>
    </Pressable>;
  const backButton = <Pressable accessibilityRole="button" onPress={() => setTool(null)} style={styles.back}>
    <AppIcon name="arrow-left" size={18} /><Text style={styles.placeText}>{t("common.back")}</Text>
  </Pressable>;
  return <View style={styles.content}>
    <View style={styles.heading}>
      {tool !== "size" && picture && <View style={styles.picture} pointerEvents="none" accessible={false}
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{picture}</View>}
      <Text style={styles.title}>{name}</Text>
      {tool === "size" ? backButton : <Pressable accessibilityRole="button" accessibilityLabel={t("home.finishMoving", { name })}
        onPress={onDone} style={({ pressed }) => [styles.place, pressed && styles.placePressed]}>
        <AppIcon name="check" size={20} style={{ tintColor: GameColors.card }} /><Text style={[styles.placeText, styles.placeLabel]}>{t("home.placeHere")}</Text>
      </Pressable>}
    </View>
    {tool !== "size" && <Text style={styles.hint}>{t("home.dragSelectedHint")}</Text>}
    {feedback && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text>}
    {tool !== "size" && faceWall && <Pressable accessibilityRole="button" accessibilityLabel={t("home.flipWall")}
      accessibilityState={{ disabled: !!wallAction?.disabled }} disabled={wallAction?.disabled}
      onPress={faceWall} style={({ pressed }) => [styles.wall, wallAction?.disabled && styles.disabled, pressed && styles.pressed]}>
      <AppIcon name="rotate" size={24} /><Text style={styles.wallText}>{t("home.flipWall")}</Text>
    </Pressable>}
    {tool ? <>
      {tool === "move" && <View style={styles.toolHeading}>
        <Text style={styles.toolTitle}>{t("home.moveALittle")}</Text>
        {backButton}
      </View>}
      <View style={styles.actions}>
        {tool === "size" ? <>
          {smaller && button(smaller.label, "subtraction", smaller.onPress, smaller.disabled)}
          {bigger && button(bigger.label, "addition", bigger.onPress, bigger.disabled)}
        </> : DIRECTIONS.map(([direction, icon]) => button(t("home.nudge" + direction), icon,
          () => onMove(direction), false, t("home.moveItem" + direction, { name })))}
      </View>
    </> : <View style={styles.actions}>
      {turn && button(t("home.turnItem"), "rotate", turn)}
      {(bigger || smaller) && button(t("home.itemSize"), "addition", () => setTool("size"))}
      {putAway && button(t("home.putAway"), "box", () => { putAway.onPress(); onDone(); }, putAway.disabled)}
      <RoomActionMenu style={styles.more} label={t("home.itemOptions", { name })}
        actions={[{ label: t("home.moveALittle"), icon: "arrow-right", onPress: () => setTool("move") }, ...more]}>
        <View style={styles.action}>
          <AppIcon name="chevron-down" size={24} /><Text style={styles.actionText}>{t("home.moreItemTools")}</Text>
        </View>
      </RoomActionMenu>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  content: { width: "100%", paddingHorizontal: moderateScale(12), paddingVertical: 10, gap: 8 },
  heading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  picture: { width: moderateScale(44), height: moderateScale(44), alignItems: "center", justifyContent: "center" },
  title: { flex: 1, minWidth: 110, fontSize: moderateScale(15), fontWeight: "700", color: GameColors.text },
  hint: { color: GameColors.textMuted, fontSize: moderateScale(13), lineHeight: moderateScale(18) },
  feedback: { color: GameColors.primaryDark, fontSize: moderateScale(13), fontWeight: "600" },
  place: { flexDirection: "row", flexShrink: 1, maxWidth: "100%", marginLeft: "auto", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 48, paddingHorizontal: 10, borderRadius: 12, backgroundColor: GameColors.secondaryDark },
  placeLabel: { color: GameColors.card },
  placePressed: { backgroundColor: "#06645F" },
  placeText: { color: GameColors.text, fontSize: moderateScale(14), fontWeight: "700", flexShrink: 1 },
  actions: { flexDirection: "row", gap: 6 },
  wall: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: GameColors.background, borderRadius: 12 },
  wallText: { flexShrink: 1, color: GameColors.text, fontSize: moderateScale(14), fontWeight: "600", textAlign: "center" },
  action: { flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 4, gap: 4, backgroundColor: GameColors.background, borderRadius: 12 },
  actionText: { fontSize: moderateScale(13), fontWeight: "600", color: GameColors.text, textAlign: "center" },
  more: { flex: 1 },
  toolHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  toolTitle: { fontSize: moderateScale(15), color: GameColors.text, fontWeight: "700", flex: 1 },
  back: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8 },
  pressed: { backgroundColor: GameColors.cardBorder },
  disabled: { opacity: .4 },
});
