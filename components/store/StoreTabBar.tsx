import { AppIcon } from "@/components/ui/AppIcon";
import type { AppIconName } from "@/constants/app-icons";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import type { StoreSale } from "@/utils/store-catalog";
import { STORE_SALE_CATEGORIES } from "@/utils/store-promotion";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type StoreTab =
  | "rooms"
  | "beds"
  | "colors"
  | "toys"
  | "catItems"
  | "tables"
  | "appliances"
  | "accessories"
  | "furniture"
  | "carpets"
  | "chairs"
  | "desks"
  | "computers"
  | "consoles"
  | "windows"
  | "doors"
  | "lamps"
  | "curtains"
  | "tvs"
  | "sofas"
  | "posters"
  | "plants"
  | "living"
  | "office"
  | "kitchen"
  | "bedroom"
  | "halloween"
  | "bathroom"
  | "books"
  | "japanese";

type StoreTabBarProps = {
  active: StoreTab;
  onChange: (tab: StoreTab) => void;
  sales?: StoreSale[];
};

function StoreTabButton({
  tab,
  label,
  icon,
  isActive,
  onPress,
  saleLabel,
}: {
  tab: StoreTab;
  label: string;
  icon: AppIconName;
  isActive: boolean;
  onPress: (tab: StoreTab) => void;
  saleLabel?: string;
}) {
  return (
    <Pressable
      onPress={() => onPress(tab)}
      style={[styles.tab, isActive && styles.tabActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={saleLabel ? `${label}, ${saleLabel}` : label}
    >
      {saleLabel ? <View style={styles.saleBadge}><Text style={styles.saleText}>{saleLabel}</Text></View> : null}
      <AppIcon name={icon} size={moderateScale(26)} />
      <Text
        style={[styles.tabText, isActive && styles.tabTextActive]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function StoreTabBar({ active, onChange, sales = [] }: StoreTabBarProps) {
  const { t } = useTranslation();

  const tabs = [
    ["rooms", "home", "store.tabRooms"], ["beds", "bed", "store.tabBeds"],
    ["toys", "play", "store.tabToys"], ["living", "plant", "store.tabDecorations"],
    ["colors", "cat", "store.tabColors"],
  ] as const;
  const primary = ["rooms", "beds", "toys", "colors"].includes(active) ? active : "living";
  return <ScrollView
    horizontal
    style={styles.scroll}
    contentContainerStyle={styles.row}
    showsHorizontalScrollIndicator={false}
    directionalLockEnabled
    accessibilityRole="tablist"
  >
    {tabs.map(([tab, icon, key]) => <StoreTabButton key={tab} tab={tab} icon={icon}
      saleLabel={sales.some(sale => STORE_SALE_CATEGORIES[sale.kind].tab === tab) ? t('store.sale') : undefined}
      label={t(key)} isActive={primary === tab} onPress={onChange} />)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
    paddingRight: moderateScale(4),
    paddingTop: moderateScale(8),
    paddingBottom: moderateScale(2),
  },
  tab: {
    flexShrink: 0,
    minWidth: moderateScale(76),
    minHeight: moderateScale(48),
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(2),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    paddingHorizontal: moderateScale(6),
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(8),
  },
  saleBadge: { position: 'absolute', top: -moderateScale(7), right: moderateScale(4), backgroundColor: '#23766F', borderRadius: moderateScale(6), paddingHorizontal: moderateScale(6), paddingVertical: moderateScale(2) },
  saleText: { color: GameColors.card, fontSize: moderateScale(10), fontWeight: '800' },
  tabActive: {
    borderColor: GameColors.secondary,
    backgroundColor: "#E8FAF8",
  },
  tabText: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: GameColors.textMuted,
    textAlign: "center",
  },
  tabTextActive: {
    color: GameColors.text,
  },
});
