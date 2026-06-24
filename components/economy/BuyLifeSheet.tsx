import { LifeRegenClock } from "@/components/economy/LifeRegenClock";
import { GameColors, LIFE_BUY_COST, MAX_LIVES } from "@/constants/game";
import type { LivesState } from "@/types/game";
import { applyLifeRegen, canBuyLife, msUntilNextLife } from "@/utils/lives";
import { moderateScale } from "@/utils/scale";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BuyLifeSheetProps = {
  visible: boolean;
  lives: LivesState;
  coins: number;
  onBuyLife: () => boolean;
  onClose: () => void;
};

function useRegenNow(active: boolean) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);

  return now;
}

export function BuyLifeSheet({
  visible,
  lives,
  coins,
  onBuyLife,
  onClose,
}: BuyLifeSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const now = useRegenNow(visible);

  const synced = applyLifeRegen(lives, now);
  const regenMs = msUntilNextLife(synced, now);
  const canBuy = canBuyLife(lives, coins, now);
  const isFull = synced.current >= MAX_LIVES;

  const handleBuy = () => {
    if (!canBuy) return;
    onBuyLife();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("lives.a11yCloseMenu")}
        />
        <View style={styles.sheet}>
          <View
            style={[
              styles.card,
              { paddingBottom: insets.bottom + moderateScale(16) },
            ]}
          >
            <Text style={styles.emoji}>❤️</Text>
            <Text style={styles.title}>{t("lives.title")}</Text>
            <Text style={styles.count}>
              {t("lives.count", { current: synced.current, max: MAX_LIVES })}
            </Text>

            {!isFull && regenMs !== null ? (
              <View style={styles.regenWrap}>
                <Text style={styles.regenLabel}>{t("lives.nextFreeLife")}</Text>
                <LifeRegenClock
                  regenMs={regenMs}
                  compact={false}
                  showProgress
                />
              </View>
            ) : null}

            {isFull ? (
              <Text style={styles.hint}>{t("lives.fullLives")}</Text>
            ) : canBuy ? (
              <Pressable
                style={styles.buyBtn}
                onPress={handleBuy}
                accessibilityRole="button"
                accessibilityLabel={t("lives.a11yBuy", { cost: LIFE_BUY_COST })}
              >
                <Text style={styles.buyBtnText}>
                  {t("lives.buyLife", { cost: LIFE_BUY_COST })}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>
                {t("lives.needCoinsBuy", { cost: LIFE_BUY_COST, coins })}
              </Text>
            )}

            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <Text style={styles.closeBtnText}>{t("common.close")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(45, 52, 54, 0.35)",
  },
  sheet: {
    width: "100%",
    backgroundColor: GameColors.card,
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: GameColors.cardBorder,
    overflow: "hidden",
  },
  card: {
    alignItems: "center",
    paddingTop: moderateScale(20),
    paddingHorizontal: moderateScale(20),
    gap: moderateScale(8),
  },
  emoji: {
    fontSize: moderateScale(32),
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.text,
  },
  count: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: GameColors.primary,
    fontVariant: ["tabular-nums"],
  },
  regenWrap: {
    width: "100%",
    alignItems: "center",
    gap: moderateScale(6),
    marginTop: moderateScale(4),
    marginBottom: moderateScale(4),
  },
  regenLabel: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
  },
  hint: {
    fontSize: moderateScale(15),
    fontWeight: "500",
    color: GameColors.textMuted,
    textAlign: "center",
    lineHeight: moderateScale(22),
    marginTop: moderateScale(4),
  },
  buyBtn: {
    marginTop: moderateScale(8),
    width: "100%",
    minHeight: moderateScale(52),
    borderRadius: moderateScale(16),
    backgroundColor: GameColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(20),
  },
  buyBtnText: {
    fontSize: moderateScale(17),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  closeBtn: {
    marginTop: moderateScale(4),
    minHeight: moderateScale(44),
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
  },
  closeBtnText: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.text,
  },
});
