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
  isPlaced: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onPlace: () => void;
};

export function ToyStoreCard({
  toyId,
  isOwned,
  isPlaced,
  canAfford,
  onBuy,
  onPlace,
}: ToyStoreCardProps) {
  const { t } = useTranslation();
  const price = getToyStorePrice(toyId);
  const previewSize = moderateScale(getToyStorePreviewSize(toyId));
  const toyLabel = t(`store.toyName.${toyId}`);
  const toyLabelInline = toyLabel.replace(/\n/g, " ");

  return (
    <View style={[styles.card, isPlaced && styles.cardEquipped]}>
      <View style={styles.previewWrap}>
        <ToySpriteImage toyId={toyId} size={previewSize} />
        {isPlaced ? (
          <View style={styles.equippedBadge}>
            <Text style={styles.equippedBadgeText}>{t("store.placed")}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>{toyLabel}</Text>
      </View>

      {isOwned ? (
        <Pressable
          onPress={onPlace}
          disabled={isPlaced}
          style={({ pressed }) => [
            styles.actionBtn,
            isPlaced ? styles.actionEquipped : styles.actionEquip,
            pressed && !isPlaced && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("store.a11yPlaceToy", {
            name: toyLabelInline,
          })}
        >
          <Text
            style={[styles.actionText, isPlaced && styles.actionTextMuted]}
          >
            {isPlaced ? t("store.placed") : t("store.place")}
          </Text>
        </Pressable>
      ) : price.kind === "free" ? (
        <Pressable
          onPress={onBuy}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBuy,
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("store.a11yClaimToy", {
            name: toyLabelInline,
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
          accessibilityLabel={t("store.a11yBuyToy", {
            name: toyLabelInline,
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
