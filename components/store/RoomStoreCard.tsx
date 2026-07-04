import { getCatRoomSource, type CatRoomId } from "@/constants/cat-rooms";
import { GameColors } from "@/constants/game";
import { getRoomStorePrice } from "@/utils/room-store";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type RoomStoreCardProps = {
  roomId: CatRoomId;
  isOwned: boolean;
  isEquipped: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onEquip: () => void;
};

export function RoomStoreCard({
  roomId,
  isOwned,
  isEquipped,
  canAfford,
  onBuy,
  onEquip,
}: RoomStoreCardProps) {
  const { t } = useTranslation();
  const price = getRoomStorePrice(roomId);
  const roomNumber = Number.parseInt(roomId.replace("room", ""), 10);

  return (
    <View
      style={[
        styles.card,
        isEquipped && styles.cardEquipped,
      ]}
    >
      <View style={styles.previewWrap}>
        <Image
          source={getCatRoomSource(roomId)}
          style={styles.preview}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        {isEquipped ? (
          <View style={styles.equippedBadge}>
            <Text style={styles.equippedBadgeText}>{t("store.equipped")}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>
        {t("store.roomName", { number: roomNumber })}
      </Text>

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
          accessibilityLabel={t("store.a11yEquip", { number: roomNumber })}
        >
          <Text
            style={[
              styles.actionText,
              isEquipped && styles.actionTextMuted,
            ]}
          >
            {isEquipped ? t("store.equipped") : t("store.equip")}
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
          accessibilityLabel={t("store.a11yClaim", { number: roomNumber })}
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
          accessibilityLabel={t("store.a11yBuy", {
            number: roomNumber,
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
