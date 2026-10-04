import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type StoreTab =
  | "rooms"
  | "beds"
  | "colors"
  | "toys"
  | "catItems"
  | "furniture"
  | "carpets"
  | "chairs"
  | "desks"
  | "computers"
  | "consoles"
  | "windows"
  | "tvs"
  | "sofas"
  | "posters"
  | "plants"
  | "living"
  | "office"
  | "bathroom"
  | "books"
  | "japanese";

type StoreTabBarProps = {
  active: StoreTab;
  onChange: (tab: StoreTab) => void;
};

function StoreTabButton({
  tab,
  label,
  emoji,
  isActive,
  onPress,
}: {
  tab: StoreTab;
  label: string;
  emoji: string;
  isActive: boolean;
  onPress: (tab: StoreTab) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(tab)}
      style={[styles.tab, isActive && styles.tabActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
    >
      <Text style={styles.tabEmoji}>{emoji}</Text>
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

export function StoreTabBar({ active, onChange }: StoreTabBarProps) {
  const { t } = useTranslation();

  const tabs = [
    ["rooms", "🏠", "store.tabRooms"], ["beds", "🛏️", "store.tabBeds"],
    ["toys", "🧸", "store.tabToys"], ["living", "🪴", "store.tabDecorations"],
    ["colors", "🐱", "store.tabColors"],
  ] as const;
  const primary = ["rooms", "beds", "toys", "colors"].includes(active) ? active : "living";
  return <View style={styles.row} accessibilityRole="tablist">
    {tabs.map(([tab, emoji, key]) => <StoreTabButton key={tab} tab={tab} emoji={emoji}
      label={t(key)} isActive={primary === tab} onPress={onChange} />)}
  </View>;
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
  },
  tab: {
    flex: 1,
    minWidth: 0,
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
    paddingVertical: moderateScale(8),
  },
  tabActive: {
    borderColor: GameColors.secondary,
    backgroundColor: "#E8FAF8",
  },
  tabEmoji: {
    fontSize: moderateScale(18),
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
