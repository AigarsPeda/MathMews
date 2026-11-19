import { StoreCardLayout } from '@/constants/store-card-layout';
import { StorePromotion } from "@/components/store/StorePromotion";
import { IconText as Text } from "@/components/ui/IconText";
import { DecorationSpriteImage } from "@/components/pet/DecorationSpriteImage";
import type { CatDecorationId } from "@/constants/cat-decorations";
import { getDecorationStorePreviewSize, getDecorationStorePreviewWallFlipped } from "@/constants/cat-decorations";
import { GameColors } from "@/constants/game";
import { getDecorationStorePrice } from "@/utils/decoration-store";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

type DecorationStoreCardProps = {
  decorationId: CatDecorationId;
  isOwned: boolean;
  placedCount: number;
  storedCount: number;
  availabilityLabel?: string;
  canAfford: boolean;
  onPreview: () => void;
  onBuy: () => void;
  onPlace: () => void;
  onRemove: () => void;
};

export function DecorationStoreCard({
  decorationId,
  isOwned,
  placedCount,
  storedCount,
  availabilityLabel,
  canAfford,
  onPreview,
  onBuy,
  onPlace,
  onRemove,
}: DecorationStoreCardProps) {
  const { t } = useTranslation();
  const price = getDecorationStorePrice(decorationId);
  const previewSize = moderateScale(getDecorationStorePreviewSize(decorationId));
  const decorationLabel = t(`store.decorationName.${decorationId}`);
  const decorationLabelInline = decorationLabel.replace(/\n/g, " ");
  const canPlace = storedCount > 0;

  return (
    <View style={[styles.card, placedCount > 0 && styles.cardEquipped]}>
      <Pressable style={styles.previewWrap} onPress={onPreview} accessibilityRole="button" accessibilityLabel={t("store.previewItem", { name: decorationLabelInline })}>
        <DecorationSpriteImage still
          decorationId={decorationId}
          size={previewSize}
          flipHorizontal={getDecorationStorePreviewWallFlipped(decorationId)}
        />
      </Pressable>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>{decorationLabel}</Text>
      </View>

      {!!availabilityLabel && <Text style={styles.availability}>{availabilityLabel}</Text>}
      <StorePromotion price={price} />
      <View style={styles.actions}>
        {canPlace ? (
          <Pressable
            onPress={onPlace}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionEquip,
              pressed && styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("store.a11yPlaceDecoration", {
              name: decorationLabelInline,
            })}
          >
            <Text style={styles.actionText}>{t("store.placeSpare")}</Text>
          </Pressable>
        ) : null}
        {price.kind !== "iap" ? (
          <Pressable
            onPress={onBuy}
            disabled={price.kind === "coins" && !canAfford}
            style={({ pressed }) => [
              styles.actionBtn,
              canPlace ? styles.secondaryBuy : styles.actionBuy,
              price.kind === "coins" && !canAfford && styles.actionDisabled,
              pressed &&
                (price.kind !== "coins" || canAfford) &&
                styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isOwned
                ? t("store.a11yBuyAnotherDecoration", {
                    name: decorationLabelInline,
                    cost: price.kind === "coins" ? price.amount : 0,
                  })
                : price.kind === "free"
                  ? t("store.a11yClaimDecoration", {
                      name: decorationLabelInline,
                    })
                  : t("store.a11yBuyDecoration", {
                      name: decorationLabelInline,
                      cost: price.kind === "coins" ? price.amount : 0,
                    })
            }
          >
            <Text style={canPlace ? styles.secondaryText : styles.actionText}>
              {!isOwned && price.kind === "free"
                ? t("store.free")
                : isOwned
                  ? price.kind === "free"
                    ? t("store.claimAnother")
                    : t("store.buyAnotherFor", {
                        cost: price.kind === "coins" ? price.amount : 0,
                      })
                  : t("store.buyFor", {
                      cost: price.kind === "coins" ? price.amount : 0,
                    })}
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.actionBtn, styles.actionDisabled]}>
            <Text style={styles.actionTextMuted}>{t("store.comingSoon")}</Text>
          </View>
        )}

        {placedCount > 0 ? (
          <Pressable
            onPress={onRemove}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionRemove,
              pressed && styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("store.a11yRemoveDecoration", {
              name: decorationLabelInline,
            })}
          >
            <Text style={styles.actionRemoveText}>{t("home.putAway")}</Text>
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
    borderRadius: StoreCardLayout.radius,
    borderWidth: StoreCardLayout.borderWidth,
    borderColor: GameColors.cardBorder,
    padding: StoreCardLayout.padding,
    gap: moderateScale(8),
  },
  cardEquipped: {
    borderColor: GameColors.secondary,
  },
  previewWrap: {
    aspectRatio: 1,
    borderRadius: StoreCardLayout.innerRadius,
    overflow: "hidden",
    backgroundColor: "#E8D8C8",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(8),
  },
  availability: { color: GameColors.textMuted, textAlign: "center", fontSize: moderateScale(13) },
  secondaryBuy: { backgroundColor: GameColors.background },
  secondaryText: { color: GameColors.text, textAlign: "center", fontWeight: "700", fontSize: moderateScale(14) },
  titleWrap: {
    minHeight: moderateScale(48),
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
    minHeight: moderateScale(48),
    borderRadius: StoreCardLayout.innerRadius,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(8),
  },
  actionBuy: {
    backgroundColor: GameColors.primary,
  },
  actionEquip: {
    backgroundColor: "#23766F",
  },
  actionRemove: {
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
    textAlign: "center",
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
    color: GameColors.text,
  },
});
