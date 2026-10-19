import { getStoreCoinPrice } from "@/utils/store-catalog";
import { useStoreCatalog } from "@/hooks/use-store-catalog";
import { IconText as Text } from "@/components/ui/IconText";
import { AppIcon } from "@/components/ui/AppIcon";
import { LifeRegenClock } from "@/components/economy/LifeRegenClock";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { GameColors, MAX_LIVES } from "@/constants/game";
import type { LivesState } from "@/types/game";
import { applyLifeRegen, canBuyLife, msUntilNextLife } from "@/utils/lives";
import { moderateScale } from "@/utils/scale";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

type BuyLifeSheetProps = {
  visible: boolean;
  lives: LivesState;
  coins: number;
  onBuyLife: (expectedPrice?: number) => boolean | Promise<boolean>;
  onClose: () => void;
};

function useRegenNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());

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
  useStoreCatalog();
  const lifeBuyCost = getStoreCoinPrice("life", "one")!;
  const { t } = useTranslation();
  const now = useRegenNow(visible);
  const [buying, setBuying] = useState(false);
  const buyInFlight = useRef(false);

  const synced = applyLifeRegen(lives, now);
  const regenMs = msUntilNextLife(synced, now);
  const canBuy = canBuyLife(lives, coins, now);
  const isFull = synced.current >= MAX_LIVES;

  const handleBuy = async () => {
    if (!canBuy || buyInFlight.current) return;
    buyInFlight.current = true;
    setBuying(true);
    try { if (await onBuyLife(lifeBuyCost)) onClose(); }
    finally { buyInFlight.current = false; setBuying(false); }
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.card}>
        <AppIcon name="heart" size={moderateScale(32) * 1.2} />
        <Text style={styles.title}>{t("lives.title")}</Text>
        <Text style={styles.count}>
          {t("lives.count", { current: synced.current, max: MAX_LIVES })}
        </Text>

        {!isFull && regenMs !== null ? (
          <View style={styles.regenWrap}>
            <Text style={styles.regenLabel}>{t("lives.nextFreeLife")}</Text>
            <LifeRegenClock regenMs={regenMs} compact={false} showProgress />
          </View>
        ) : null}

        {isFull ? (
          <Text style={styles.hint}>{t("lives.fullLives")}</Text>
        ) : canBuy ? (
          <Pressable
            style={styles.buyBtn}
            onPress={handleBuy}
            disabled={buying}
            accessibilityState={{ disabled: buying, busy: buying }}
            accessibilityRole="button"
            accessibilityLabel={t("lives.a11yBuy", { cost: lifeBuyCost })}
          >
            <Text style={styles.buyBtnText}>
              {t("lives.buyLife", { cost: lifeBuyCost })}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>
            {t("lives.needCoinsBuy", { cost: lifeBuyCost, coins })}
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
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingTop: moderateScale(20),
    paddingHorizontal: moderateScale(20),
    gap: moderateScale(8),
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
