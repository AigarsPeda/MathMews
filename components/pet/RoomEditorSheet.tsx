import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { GameColors } from "@/constants/game";
import type { RoomLayerItem } from "@/types/game";
import type { RoomDecorationTarget } from '@/utils/room-decoration-entry';
import { roomLayerItemKey } from "@/utils/room-layer-order";
import { moderateScale } from "@/utils/scale";
import { AppIcon } from "@/components/ui/AppIcon";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Platform, Pressable, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type RoomEditorControls = {
  undo: () => void;
  canUndo: boolean;
  saveLayout: () => void;
  restoreLayout: () => void;
  canRestore: boolean;
};

type Props = {
  visible: boolean;
  onOpenStore?: () => void;
  onClose: () => void;
  controls?: RoomEditorControls;
  items: { item: RoomLayerItem; label: string; picture: ReactNode }[];
  onSelect: (item: RoomLayerItem) => void;
  storedItems?: { target: RoomDecorationTarget; label: string; picture: ReactNode; count: number }[];
  onPlaceStoredItem?: (target: RoomDecorationTarget) => void;
  onSelectGroup?: (items: RoomLayerItem[]) => void;
  snap: boolean;
  onSnap: () => void;
};

export function RoomEditorSheet({ visible, onClose, controls, items, onSelect, snap, onSnap, onOpenStore, storedItems, onPlaceStoredItem, onSelectGroup }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'placed' | 'stored'>('placed');
  const [query, setQuery] = useState('');
  const [scrollOffsets, setScrollOffsets] = useState({ placed: 0, stored: 0 });
  return <AppBottomSheet visible={visible} onClose={onClose} expanded>
    {visible && <RoomPicker scrollOffset={scrollOffsets[tab]} onScrollEnd={y => setScrollOffsets(current => ({ ...current, [tab]: y }))} tab={tab} setTab={setTab} query={query} setQuery={setQuery} controls={controls} items={items} onSelect={onSelect}
      storedItems={storedItems} onPlaceStoredItem={onPlaceStoredItem} onSelectGroup={onSelectGroup}
      onClose={onClose} snap={snap} onSnap={onSnap} t={t}
      onOpenStore={onOpenStore} />}
  </AppBottomSheet>;
}

function RoomPicker({ scrollOffset, onScrollEnd, tab, setTab, query, setQuery, controls, items, onSelect, onClose, snap, onSnap, t, onOpenStore, storedItems = [], onPlaceStoredItem, onSelectGroup }: Omit<Props, "visible"> & {
  t: ReturnType<typeof useTranslation>["t"];
  tab: 'placed' | 'stored'; setTab: (tab: 'placed' | 'stored') => void;
  scrollOffset: number; onScrollEnd: (y: number) => void;
  query: string; setQuery: (query: string) => void;
}) {
  const [moreOptions, setMoreOptions] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<RoomLayerItem[]>([]);
  type Row = { key: string; label: string; picture: ReactNode; item?: RoomLayerItem; target?: RoomDecorationTarget; count?: number };
  const rows: Row[] = tab === 'placed' ? items.map(entry => ({ ...entry, key: roomLayerItemKey(entry.item) }))
    : storedItems.map(entry => ({ ...entry, key: `${entry.target.kind}:${entry.target.id}` }));
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = height * (Platform.OS === "android" ? 1 : 0.88) - insets.top - insets.bottom - moderateScale(48);
  return <FlatList key={tab}
    contentOffset={{ x: 0, y: scrollOffset }}
    onMomentumScrollEnd={event => onScrollEnd(event.nativeEvent.contentOffset.y)}
    onScrollEndDrag={event => onScrollEnd(event.nativeEvent.contentOffset.y)}
    data={rows.filter(row => row.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))} numColumns={2} keyExtractor={row => row.key}
    initialNumToRender={6} maxToRenderPerBatch={4} windowSize={3}
    style={[styles.scroll, { maxHeight }]} contentContainerStyle={styles.content}
    columnWrapperStyle={styles.items}
    nestedScrollEnabled={Platform.OS === "android"} keyboardShouldPersistTaps="handled"
    ListEmptyComponent={<Text style={styles.hint}>{t(query ? 'home.noFurnitureMatches' : tab === 'stored' ? 'home.noStoredItems' : 'home.noRoomObjects')}</Text>}
    ListHeaderComponent={<View style={styles.header}>
    <Text style={styles.title}>{t("home.roomTools")}</Text>
    <Text style={styles.hint}>{t(tab === 'placed' ? "home.chooseItemHint" : "home.storedItemsHint")}</Text>
    <View style={styles.items}>
      {(['placed', 'stored'] as const).map(value => <Pressable key={value} accessibilityRole="tab"
        accessibilityState={{ selected: tab === value }} style={[styles.tab, tab === value && styles.pressed]}
        onPress={() => { setTab(value); setSelecting(false); setSelection([]); }}>
        <Text style={styles.label}>{t(value === 'placed' ? 'home.placedItems' : 'home.storedItems')}</Text>
      </Pressable>)}
    </View>
    <TextInput value={query} onChangeText={value => { onScrollEnd(0); setQuery(value); }} style={styles.search} placeholder={t('home.searchFurniture')}
      accessibilityLabel={t('home.searchFurniture')} autoCorrect={false}/>
    {tab === 'placed' && onSelectGroup && <Pressable style={styles.optionButton} accessibilityRole="checkbox"
      accessibilityState={{ checked: selecting }} onPress={() => { setSelecting(value => !value); setSelection([]); }}>
      <Text style={styles.label}>{t('home.selectGroup')}</Text><AppIcon name={selecting ? 'check' : 'addition'} size={22}/>
    </Pressable>}
    {selecting && <Text style={styles.hint}>{t('home.groupHint')}</Text>}
    {selection.length > 0 && <Pressable style={styles.close} accessibilityRole="button" onPress={() => onSelectGroup?.(selection)}>
      <Text style={styles.label}>{t('home.moveGroup')} ({selection.length})</Text>
    </Pressable>}
    {controls && <Pressable style={styles.undo} accessibilityRole="button" accessibilityLabel={t("home.undo")}
      accessibilityState={{ disabled: !controls.canUndo }} disabled={!controls.canUndo}
      onPress={controls.undo}>
      <AppIcon name="undo" size={22} style={{ opacity: controls.canUndo ? 1 : 0.4 }} />
      <Text style={[styles.label, !controls.canUndo && styles.muted]}>{t("home.undo")}</Text>
    </Pressable>}
    {onOpenStore && <Pressable style={styles.optionButton} accessibilityRole="button" onPress={onOpenStore}>
      <Text style={styles.label}>{t("home.furnishRoom")}</Text><AppIcon name="store" size={22} />
    </Pressable>}
    </View>}
    renderItem={({ item: { item, target, label, picture, count, key } }) => <Pressable accessibilityRole={selecting ? 'checkbox' : 'button'} accessibilityLabel={t(target ? "home.placeStoredItem" : "home.chooseItem", { name: label })}
        accessibilityState={selecting ? { checked: selection.some(selected => roomLayerItemKey(selected) === key) } : undefined}
        onPress={() => {
          if (target) onPlaceStoredItem?.(target);
          else if (item && selecting) setSelection(current => current.some(selected => roomLayerItemKey(selected) === key)
            ? current.filter(selected => roomLayerItemKey(selected) !== key) : [...current, item]);
          else if (item) onSelect(item);
        }} style={({ pressed }) => [styles.item, (pressed || selection.some(selected => roomLayerItemKey(selected) === key)) && styles.pressed]}>
        <View style={styles.picture} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
          {picture}
        </View>
        <Text style={styles.itemName}>{label}</Text>
        {count !== undefined && <Text style={styles.hint}>{t('home.storedCount', { count })}</Text>}
      </Pressable>}
    ListFooterComponent={<View style={styles.header}>
    <Text style={styles.hint}>{t("home.putAwayHint")}</Text>
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
    </View>}
  />;
}

const styles = StyleSheet.create({
  tab: { flex: 1, minHeight: 48, padding: 12, alignItems: 'center', borderRadius: 12, backgroundColor: GameColors.background },
  search: { minHeight: 48, borderWidth: 1, borderColor: GameColors.cardBorder, padding: 12, borderRadius: 12, color: GameColors.text, fontSize: 16 },
  scroll: { flex: 1 },
  content: { padding: moderateScale(20), gap: moderateScale(12) },
  header: { gap: moderateScale(12) },
  title: { fontSize: moderateScale(24), fontWeight: "800", color: GameColors.text },
  label: { fontSize: moderateScale(16), fontWeight: "600", color: GameColors.text, flexShrink: 1 },
  hint: { fontSize: moderateScale(15), lineHeight: moderateScale(21), color: GameColors.textMuted },
  muted: { color: GameColors.textMuted },
  undo: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, alignSelf: "flex-start" },
  items: { gap: moderateScale(12), flexDirection: 'row' },
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

/** A short picture choice for small overlapping targets, without opening the full catalog. */
export function RoomOverlapChooser({ items, onSelect, onClose }: Pick<Props, 'items' | 'onSelect' | 'onClose'>) {
  const { t } = useTranslation();
  return <AppBottomSheet visible={items.length > 1} onClose={onClose}>
    <View style={styles.content}>
      <Text style={styles.title}>{t('home.whichItem')}</Text>
      <Text style={styles.hint}>{t('home.whichItemHint')}</Text>
      {items.map(({ item, label, picture }) => <Pressable key={roomLayerItemKey(item)} accessibilityRole="button"
        accessibilityLabel={t('home.chooseItem', { name: label })} style={styles.optionButton} onPress={() => onSelect(item)}>
        <View accessible={false} pointerEvents="none" style={styles.picture}>{picture}</View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" style={styles.close} onPress={onClose}><Text style={styles.label}>{t('common.cancel')}</Text></Pressable>
    </View>
  </AppBottomSheet>;
}
