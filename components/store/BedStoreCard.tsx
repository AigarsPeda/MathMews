import { getCatBedSource } from "@/constants/cat-beds";
import type { CatBedId } from "@/constants/cat-beds";
import { GameColors } from "@/constants/game";
import { getBedStorePrice } from "@/utils/bed-store";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type BedStoreCardProps = {
  bedId: CatBedId;
  isOwned: boolean;
  isEquipped: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onRemove: () => void;
};

export function BedStoreCard({
  bedId,
  isOwned,
  isEquipped,
  canAfford,
  onBuy,
  onEquip,
  onRemove,
}: BedStoreCardProps) {
  const { t } = useTranslation();
  const price = getBedStorePrice(bedId);
  const source = getCatBedSource(bedId);

  return (
    <View style={[styles.card, isEquipped && styles.cardEquipped]}>
      <View style={styles.previewWrap}>
        {source ? (
          <Image
            source={source}
            style={styles.preview}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {isEquipped ? (
          <View style={styles.equippedBadge}>
            <Text style={styles.equippedBadgeText}>{t("store.equipped")}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{t(`store.bedName.${bedId}`)}</Text>

      {isOwned ? (
        isEquipped ? (
          <Pressable
            onPress={onRemove}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionRemove,
              pressed && styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("store.a11yRemoveBed", {
              name: t(`store.bedName.${bedId}`),
            })}
          >
            <Text style={styles.actionRemoveText}>{t("store.remove")}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onEquip}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionEquip,
              pressed && styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("store.a11yEquipBed", {
              name: t(`store.bedName.${bedId}`),
            })}
          >
            <Text style={styles.actionText}>{t("store.equip")}</Text>
          </Pressable>
        )
      ) : price.kind === "free" ? (
        <Pressable
          onPress={onBuy}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBuy,
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("store.a11yClaimBed", {
            name: t(`store.bedName.${bedId}`),
          })}
        >
          <Text style={styles.actionText}>{t("store.free")}</Text>
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
          accessibilityLabel={t("store.a11yBuyBed", {
            name: t(`store.bedName.${bedId}`),
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
    padding: moderateScale(8),
  },
  preview: {
    width: "100%",
    height: "100%",
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
  actionRemove: {
    backgroundColor: GameColors.background,
    borderWidth: 2,
    borderColor: GameColors.primary,
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
  actionRemoveText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.primary,
  },
});
