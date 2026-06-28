import { PetDisplay } from "@/pet-display/components/PetDisplay";
import type { CatSkinId } from "@/constants/cat-skins";
import { GameColors } from "@/constants/game";
import { getSkinStorePrice } from "@/utils/skin-store";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type CatSkinStoreCardProps = {
  skinId: CatSkinId;
  isOwned: boolean;
  isEquipped: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onEquip: () => void;
};

export function CatSkinStoreCard({
  skinId,
  isOwned,
  isEquipped,
  canAfford,
  onBuy,
  onEquip,
}: CatSkinStoreCardProps) {
  const { t } = useTranslation();
  const price = getSkinStorePrice(skinId);
  const skinName = t(`store.skinName.${skinId}`);

  return (
    <View style={[styles.card, isEquipped && styles.cardEquipped]}>
      <View style={styles.previewWrap}>
        <PetDisplay
          petType="cat"
          catSkinId={skinId}
          mood="idle"
          width={moderateScale(72)}
          loop
          transparentBackground
        />
        {isEquipped ? (
          <View style={styles.equippedBadge}>
            <Text style={styles.equippedBadgeText}>{t("store.equipped")}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{skinName}</Text>

      {isOwned ? (
        <Pressable
          onPress={onEquip}
          disabled={isEquipped}
          style={({ pressed }) => [
            styles.actionBtn,
            isEquipped ? styles.actionEquipped : styles.actionEquip,
            pressed && !isEquipped && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("store.a11yEquipSkin", { name: skinName })}
        >
          <Text
            style={[styles.actionText, isEquipped && styles.actionTextMuted]}
          >
            {isEquipped ? t("store.equipped") : t("store.equip")}
          </Text>
        </Pressable>
      ) : price.kind === "coins" ? (
        <Pressable
          onPress={onBuy}
          disabled={!canAfford}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBuy,
            !canAfford && styles.actionDisabled,
            pressed && canAfford && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("store.a11yBuySkin", {
            name: skinName,
            cost: price.amount,
          })}
        >
          <Text style={styles.actionText}>
            {t("store.buyFor", { cost: price.amount })}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.actionBtn, styles.actionDisabled]}>
          <Text style={styles.actionTextMuted}>{t("store.comingSoon")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(10),
    gap: moderateScale(8),
  },
  cardEquipped: {
    borderColor: GameColors.secondary,
  },
  previewWrap: {
    aspectRatio: 1,
    borderRadius: moderateScale(12),
    overflow: "hidden",
    backgroundColor: "#E8D8C8",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: moderateScale(4),
  },
  equippedBadge: {
    position: "absolute",
    top: moderateScale(6),
    right: moderateScale(6),
    backgroundColor: GameColors.secondary,
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(3),
  },
  equippedBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  title: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.text,
    textAlign: "center",
  },
  actionBtn: {
    minHeight: moderateScale(40),
    borderRadius: moderateScale(12),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(8),
  },
  actionBuy: {
    backgroundColor: GameColors.primary,
  },
  actionEquip: {
    backgroundColor: GameColors.secondary,
  },
  actionEquipped: {
    backgroundColor: GameColors.background,
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
  },
  actionDisabled: {
    opacity: 0.55,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionTextMuted: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
});
