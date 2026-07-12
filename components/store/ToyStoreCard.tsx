import { ToySpriteImage } from "@/components/pet/ToySpriteImage";
import { getToyStorePreviewSize } from "@/constants/cat-toys";
import type { CatToyId } from "@/constants/cat-toys";
import { GameColors } from "@/constants/game";
import { getToyStorePrice } from "@/utils/toy-store";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ToyStoreCardProps = {
  toyId: CatToyId;
  isOwned: boolean;
  placedCount: number;
  ownedCount: number;
  canAfford: boolean;
  onBuy: () => void;
  onPlace: () => void;
  onRemove: () => void;
};

export function ToyStoreCard({
  toyId,
  isOwned,
  placedCount,
  ownedCount,
  canAfford,
  onBuy,
  onPlace,
  onRemove,
}: ToyStoreCardProps) {
  const { t } = useTranslation();
  const price = getToyStorePrice(toyId);
  const previewSize = moderateScale(getToyStorePreviewSize(toyId));
  const toyLabel = t(`store.toyName.${toyId}`);
  const toyLabelInline = toyLabel.replace(/\n/g, " ");
  const canPlace = isOwned && placedCount < ownedCount;
  const canBuyAgain =
    price.kind === "free" || (price.kind === "coins" && canAfford);
  const showBuy = !isOwned ? price.kind !== "iap" : canBuyAgain;

  return (
    <View style={[styles.card, placedCount > 0 && styles.cardEquipped]}>
      <View style={styles.previewWrap}>
        <ToySpriteImage toyId={toyId} size={previewSize} />
        {placedCount > 0 ? (
          <View style={styles.equippedBadge}>
            <Text style={styles.equippedBadgeText}>
              {t("store.inRoomCount", { count: placedCount })}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>{toyLabel}</Text>
      </View>

      <View style={styles.actions}>
        {showBuy ? (
          <Pressable
            onPress={onBuy}
            disabled={price.kind === "coins" && !canAfford}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBuy,
              price.kind === "coins" && !canAfford && styles.actionDisabled,
              pressed &&
                (price.kind !== "coins" || canAfford) &&
                styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isOwned
                ? t("store.a11yBuyAnotherToy", {
                    name: toyLabelInline,
                    cost: price.kind === "coins" ? price.amount : 0,
                  })
                : price.kind === "free"
                  ? t("store.a11yClaimToy", { name: toyLabelInline })
                  : t("store.a11yBuyToy", {
                      name: toyLabelInline,
                      cost: price.kind === "coins" ? price.amount : 0,
                    })
            }
          >
            <Text style={styles.actionText}>
              {!isOwned && price.kind === "free"
                ? t("store.free")
                : isOwned
                  ? price.kind === "free"
                    ? t("store.buyAnother")
                    : t("store.buyAnotherFor", { cost: price.amount })
                  : t("store.buyFor", {
                      cost: price.kind === "coins" ? price.amount : 0,
                    })}
            </Text>
          </Pressable>
        ) : price.kind === "iap" ? (
          <View style={[styles.actionBtn, styles.actionDisabled]}>
            <Text style={styles.actionTextMuted}>{t("store.comingSoon")}</Text>
          </View>
        ) : null}

        {canPlace ? (
          <Pressable
            onPress={onPlace}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionEquip,
              pressed && styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("store.a11yPlaceToy", {
              name: toyLabelInline,
            })}
          >
            <Text style={styles.actionText}>{t("store.place")}</Text>
          </Pressable>
        ) : null}

        {placedCount > 0 ? (
          <Pressable
            onPress={onRemove}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionRemove,
              pressed && styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("store.a11yRemoveToy", {
              name: toyLabelInline,
            })}
          >
            <Text style={styles.actionRemoveText}>{t("store.remove")}</Text>
          </Pressable>
        ) : null}
      </View>
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
  titleWrap: {
    minHeight: moderateScale(40),
    justifyContent: "center",
  },
  title: {
    fontSize: moderateScale(15),
    lineHeight: moderateScale(20),
    fontWeight: "700",
    color: GameColors.text,
    textAlign: "center",
  },
  actions: {
    gap: moderateScale(6),
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
