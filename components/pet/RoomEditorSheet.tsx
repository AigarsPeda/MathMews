import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { GameColors } from "@/constants/game";
import type { RoomLayerItem } from "@/types/game";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type RoomEditorControls = {
  undo: () => void; canUndo: boolean; saveLayout: () => void; restoreLayout: () => void;
  canRestore: boolean; tidy: () => void;
};

export function RoomEditorSheet({ visible, onClose, controls, items, onSelect, onMove, snap, onSnap }: {
  visible: boolean; onClose: () => void; controls?: RoomEditorControls;
  items: { item: RoomLayerItem; label: string }[];
  onSelect: (item: RoomLayerItem) => void;
  onMove: (item: RoomLayerItem, direction: "left" | "right" | "up" | "down") => void;
  snap: boolean; onSnap: () => void;
}) {
  const { t } = useTranslation();
  const button = (label: string, onPress: () => void, disabled = false, accessibilityLabel = label) => (
    <Pressable key={label} accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
      onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.label}>{label}</Text></Pressable>
  );
  return <AppBottomSheet visible={visible} onClose={onClose} expanded>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("home.roomTools")}</Text>
      <Text style={styles.label}>{t("home.decorateHint")}</Text>
      <View style={styles.row}>
        {controls && button(t("home.undo"), controls.undo, !controls.canUndo)}
        {controls && button(t("home.saveLayout"), controls.saveLayout)}
        {controls && button(t("home.restoreLayout"), controls.restoreLayout, !controls.canRestore)}
        {controls && button(t("home.tidyRoom"), controls.tidy)}
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: snap }} style={styles.button} onPress={onSnap}>
          <Text style={styles.label}>{t(snap ? "home.snapOn" : "home.snapOff")}</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>{t("home.roomObjects")}</Text>
      {items.length === 0 && <Text style={styles.label}>{t("home.noRoomObjects")}</Text>}
      {items.map(({ item, label }, index) => <View key={index} style={styles.object}>
        {button(label, () => { onClose(); onSelect(item); })}
        <View style={styles.row}>{(["left", "right", "up", "down"] as const).map(direction =>
          button(t(`home.nudge${direction}`), () => onMove(item, direction), false, `${label}: ${t(`home.nudge${direction}`)}`))}</View>
      </View>)}
      {button(t("common.close"), onClose)}
    </ScrollView>
  </AppBottomSheet>;
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 }, title: { fontSize: 20, fontWeight: "800", color: GameColors.text },
  label: { fontSize: 16, color: GameColors.text }, row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: GameColors.background, borderRadius: 12, justifyContent: "center" },
  disabled: { opacity: 0.45 }, object: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: GameColors.cardBorder },
});
