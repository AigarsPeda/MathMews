import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { GameColors } from "@/constants/game";
import type { RoomLayerItem } from "@/types/game";
import { roomLayerItemKey } from "@/utils/room-layer-order";
import { moderateScale } from "@/utils/scale";
import { AppIcon } from "@/components/ui/AppIcon";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

export type RoomEditorControls = {
  undo: () => void;
  canUndo: boolean;
  saveLayout: () => void;
  restoreLayout: () => void;
  canRestore: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  controls?: RoomEditorControls;
  items: { item: RoomLayerItem; label: string; picture: ReactNode }[];
  onSelect: (item: RoomLayerItem) => void;
  snap: boolean;
  onSnap: () => void;
};

export function RoomEditorSheet({ visible, onClose, controls, items, onSelect, snap, onSnap }: Props) {
  const { t } = useTranslation();
  // Opening the picker always starts with its simple view.
  return <AppBottomSheet visible={visible} onClose={onClose} expanded>
    {visible && <RoomPicker controls={controls} items={items} onSelect={onSelect}
      onClose={onClose} snap={snap} onSnap={onSnap} t={t} />}
  </AppBottomSheet>;
}

function RoomPicker({ controls, items, onSelect, onClose, snap, onSnap, t }: Omit<Props, "visible"> & {
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [moreOptions, setMoreOptions] = useState(false);
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>{t("home.roomTools")}</Text>
    <Text style={styles.hint}>{t("home.chooseItemHint")}</Text>
    {controls && <Pressable style={styles.undo} accessibilityRole="button" accessibilityLabel={t("home.undo")}
      accessibilityState={{ disabled: !controls.canUndo }} disabled={!controls.canUndo}
      onPress={controls.undo}>
      <AppIcon name="undo" size={22} style={{ opacity: controls.canUndo ? 1 : 0.4 }} />
      <Text style={[styles.label, !controls.canUndo && styles.muted]}>{t("home.undo")}</Text>
    </Pressable>}
    {items.length === 0 && <Text style={styles.hint}>{t("home.noRoomObjects")}</Text>}
    <View style={styles.items}>
      {items.map(({ item, label, picture }) => <Pressable key={roomLayerItemKey(item)}
        accessibilityRole="button" accessibilityLabel={t("home.chooseItem", { name: label })}
        onPress={() => onSelect(item)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
        <View style={styles.picture} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
          {picture}
        </View>
        <Text style={styles.itemName}>{label}</Text>
      </Pressable>)}
    </View>
    <Pressable style={styles.more} accessibilityRole="button" accessibilityLabel={t("home.moreRoomOptions")} accessibilityState={{ expanded: moreOptions }}
      onPress={() => setMoreOptions(current => !current)}>
      <Text style={styles.label}>{t("home.moreRoomOptions")}</Text>
      <AppIcon name={moreOptions ? "chevron-up" : "chevron-down"} size={24} />
    </Pressable>
    {moreOptions && <View style={styles.options}>
      <View style={styles.snapRow}>
        <View style={styles.snapCopy}>
          <Text style={styles.label}>{t("home.lineThingsUp")}</Text>
          <Text style={styles.hint}>{t("home.lineThingsUpHint")}</Text>
        </View>
        <Switch value={snap} onValueChange={onSnap} accessibilityLabel={t("home.lineThingsUp")}
          trackColor={{ true: GameColors.secondary }} />
      </View>
      {controls && <>
        <Text style={styles.hint}>{t("home.savedRoomHint")}</Text>
        <Pressable style={styles.optionButton} accessibilityRole="button" accessibilityLabel={t("home.saveLayout")} onPress={controls.saveLayout}>
          <Text style={styles.label}>{t("home.saveLayout")}</Text>
          <AppIcon name="save" size={22} />
        </Pressable>
        {controls.canRestore && <Pressable style={styles.optionButton} accessibilityRole="button" accessibilityLabel={t("home.restoreLayout")}
          onPress={() => { controls.restoreLayout(); onClose(); }}>
          <Text style={styles.label}>{t("home.restoreLayout")}</Text>
          <AppIcon name="restore" size={22} />
        </Pressable>}
      </>}
    </View>}
    <Pressable style={styles.close} accessibilityRole="button" onPress={onClose}>
      <Text style={styles.label}>{t("common.close")}</Text>
    </Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: moderateScale(20), gap: moderateScale(12) },
  title: { fontSize: moderateScale(24), fontWeight: "800", color: GameColors.text },
  label: { fontSize: moderateScale(16), fontWeight: "600", color: GameColors.text, flexShrink: 1 },
  hint: { fontSize: moderateScale(15), lineHeight: moderateScale(21), color: GameColors.textMuted },
  muted: { color: GameColors.textMuted },
  undo: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, alignSelf: "flex-start" },
  items: { flexDirection: "row", flexWrap: "wrap", gap: moderateScale(12) },
  item: { flexGrow: 1, flexBasis: "45%", maxWidth: "49%", alignItems: "center", justifyContent: "center", padding: moderateScale(12), gap: 8, backgroundColor: GameColors.background, borderRadius: moderateScale(14) },
  picture: { width: moderateScale(72), height: moderateScale(72), alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: moderateScale(15), fontWeight: "600", color: GameColors.text, textAlign: "center" },
  pressed: { backgroundColor: GameColors.cardBorder },
  more: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, marginTop: 8 },
  options: { gap: 12 },
  snapRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  snapCopy: { flex: 1, gap: 4 },
  optionButton: { minHeight: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  close: { minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: GameColors.background, borderRadius: 14, marginTop: 8 },
});
