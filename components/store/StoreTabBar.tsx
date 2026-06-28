import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type StoreTab = "rooms" | "beds" | "colors" | "toys" | "decorations";

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
      <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StoreTabBar({ active, onChange }: StoreTabBarProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      <StoreTabButton
        tab="rooms"
        emoji="🏠"
        label={t("store.tabRooms")}
        isActive={active === "rooms"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="colors"
        emoji="🐱"
        label={t("store.tabColors")}
        isActive={active === "colors"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="beds"
        emoji="🛏️"
        label={t("store.tabBeds")}
        isActive={active === "beds"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="toys"
        emoji="🧸"
        label={t("store.tabToys")}
        isActive={active === "toys"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="decorations"
        emoji="🪴"
        label={t("store.tabDecorations")}
        isActive={active === "decorations"}
        onPress={onChange}
      />
    </ScrollView>
  );
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
    width: moderateScale(76),
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
