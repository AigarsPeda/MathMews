import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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

  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      <StoreTabButton
        tab="living"
        emoji="☕"
        label={t("store.tabLiving")}
        isActive={active === "living"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="catItems"
        emoji="🐾"
        label={t("store.tabCatItems")}
        isActive={active === "catItems"}
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
        tab="furniture"
        emoji="🪑"
        label={t("store.tabFurniture")}
        isActive={active === "furniture"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="plants"
        emoji="🌿"
        label={t("store.tabPlants")}
        isActive={active === "plants"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="sofas"
        emoji="🛋️"
        label={t("store.tabSofas")}
        isActive={active === "sofas"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="carpets"
        emoji="🧶"
        label={t("store.tabCarpets")}
        isActive={active === "carpets"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="chairs"
        emoji="💺"
        label={t("store.tabChairs")}
        isActive={active === "chairs"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="desks"
        emoji="🖥️"
        label={t("store.tabDesks")}
        isActive={active === "desks"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="computers"
        emoji="💻"
        label={t("store.tabComputers")}
        isActive={active === "computers"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="consoles"
        emoji="🎮"
        label={t("store.tabConsoles")}
        isActive={active === "consoles"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="windows"
        emoji="🪟"
        label={t("store.tabWindows")}
        isActive={active === "windows"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="tvs"
        emoji="📺"
        label={t("store.tabTvs")}
        isActive={active === "tvs"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="posters"
        emoji="🖼️"
        label={t("store.tabPosters")}
        isActive={active === "posters"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="office"
        emoji="💼"
        label={t("store.tabOffice")}
        isActive={active === "office"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="bathroom"
        emoji="🛁"
        label={t("store.tabBathroom")}
        isActive={active === "bathroom"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="books"
        emoji="📚"
        label={t("store.tabBooks")}
        isActive={active === "books"}
        onPress={onChange}
      />
      <StoreTabButton
        tab="japanese"
        emoji="⛩️"
        label={t("store.tabJapanese")}
        isActive={active === "japanese"}
        onPress={onChange}
      />
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
    width: moderateScale(80),
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
