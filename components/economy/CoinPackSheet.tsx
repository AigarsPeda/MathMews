import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import type { CoinPackProductId } from "@/constants/iap-products";
import { GameColors } from "@/constants/game";
import { RestoreMenuContent } from "@/components/economy/RestoreMenuContent";
import { useIAP } from "@/contexts/IAPProvider";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type CoinPackSheetProps = {
  visible: boolean;
  onClose: () => void;
};

function triggerHaptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
) {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style);
  }
}

export function CoinPackSheet({ visible, onClose }: CoinPackSheetProps) {
  const { t } = useTranslation();
  const {
    isReady,
    isSupported,
    coinPackCatalog,
    purchaseCoinPack,
    refreshOfferings,
  } = useIAP();
  const [view, setView] = useState<"coins" | "restore">("coins");
  const [purchasingId, setPurchasingId] = useState<CoinPackProductId | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"success" | "error" | "info" | null>(
    null,
  );

  const displayItems = coinPackCatalog;

  useEffect(() => {
    if (!visible) {
      setView("coins");
      setStatusMessage(null);
      setStatusKind(null);
      setPurchasingId(null);
      return;
    }

    setStatusMessage(null);
    setStatusKind(null);
    void refreshOfferings();
  }, [refreshOfferings, visible]);

  const handlePurchase = useCallback(
    async (productId: CoinPackProductId) => {
      if (purchasingId) return;

      setStatusMessage(null);
      setStatusKind(null);
      setPurchasingId(productId);
      triggerHaptic();

      const result = await purchaseCoinPack(productId);
      setPurchasingId(null);

      if (result.status === "purchased") {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setStatusKind("success");
        setStatusMessage(
          t("iap.purchaseSuccess", { count: result.coins }),
        );
        return;
      }

      if (result.status === "cancelled") return;

      if (result.status === "pending") {
        setStatusKind("info");
        setStatusMessage(t("iap.purchasePending"));
        return;
      }

      setStatusKind("error");
      setStatusMessage(result.message || t("iap.purchaseFailed"));
    },
    [purchaseCoinPack, purchasingId, t],
  );

  const handleOpenRestoreMenu = useCallback(() => {
    triggerHaptic();
    setView("restore");
  }, []);

  const isLoadingOfferings = visible && isSupported && !isReady;

  return (
    <AppBottomSheet visible={visible} onClose={onClose} expanded>
      {view === "restore" ? (
        <>
          <RestoreMenuContent
            onBack={() => setView("coins")}
            onClose={onClose}
          />
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Text style={styles.closeBtnText}>{t("common.close")}</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.emoji}>🪙</Text>
          <Text style={styles.title}>{t("iap.getCoins")}</Text>
          <Text style={styles.subtitle}>{t("iap.getCoinsHint")}</Text>

          {!isSupported ? (
            <Text style={styles.hint}>{t("iap.notAvailable")}</Text>
          ) : isLoadingOfferings ? (
            <ActivityIndicator
              color={GameColors.primary}
              style={styles.loader}
            />
          ) : (
            <View style={styles.packList}>
              {displayItems.map((item) => {
                const isPurchasing = purchasingId === item.productId;
                const canBuy =
                  (item.package != null || item.storeProduct != null) &&
                  !purchasingId;

                return (
                  <Pressable
                    key={item.productId}
                    style={({ pressed }) => [
                      styles.packRow,
                      pressed && canBuy && styles.packRowPressed,
                      !canBuy && styles.packRowDisabled,
                    ]}
                    onPress={() => void handlePurchase(item.productId)}
                    disabled={!canBuy}
                    accessibilityRole="button"
                    accessibilityLabel={t("iap.a11yBuyPack", {
                      count: item.coins,
                      price: item.priceString ?? t("iap.priceLoading"),
                    })}
                  >
                    <View style={styles.packInfo}>
                      <Text style={styles.packCoins}>
                        {t("iap.packCoins", { count: item.coins })}
                      </Text>
                      <Text style={styles.packPrice}>
                        {item.priceString ?? t("iap.priceLoading")}
                      </Text>
                    </View>
                    {isPurchasing ? (
                      <ActivityIndicator color={GameColors.primary} />
                    ) : (
                      <Text style={styles.packBuyLabel}>{t("iap.buy")}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {displayItems.length > 0 &&
          displayItems.every(
            (item) => item.package == null && item.storeProduct == null,
          ) &&
          isReady &&
          isSupported ? (
            <Text style={styles.hint}>{t("iap.offeringsMissing")}</Text>
          ) : null}

          {statusMessage ? (
            <Text
              style={[
                styles.status,
                statusKind === "success" && styles.statusSuccess,
                statusKind === "error" && styles.statusError,
              ]}
            >
              {statusMessage}
            </Text>
          ) : null}

          <Pressable
            style={styles.restoreBtn}
            onPress={handleOpenRestoreMenu}
            accessibilityRole="button"
            accessibilityLabel={t("cloudRestore.openMenu")}
          >
            <Text style={styles.restoreBtnText}>{t("cloudRestore.openMenu")}</Text>
          </Pressable>

          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Text style={styles.closeBtnText}>{t("common.close")}</Text>
          </Pressable>
        </View>
      )}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingTop: moderateScale(12),
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
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    textAlign: "center",
    lineHeight: moderateScale(20),
    marginBottom: moderateScale(4),
  },
  loader: {
    marginVertical: moderateScale(24),
  },
  packList: {
    width: "100%",
    gap: moderateScale(10),
    marginTop: moderateScale(4),
  },
  packRow: {
    width: "100%",
    minHeight: moderateScale(56),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.coin,
    backgroundColor: GameColors.card,
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(12),
  },
  packRowPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  packRowDisabled: {
    opacity: 0.55,
  },
  packInfo: {
    flex: 1,
    gap: moderateScale(2),
  },
  packCoins: {
    fontSize: moderateScale(17),
    fontWeight: "800",
    color: GameColors.text,
  },
  packPrice: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
  },
  packBuyLabel: {
    fontSize: moderateScale(15),
    fontWeight: "800",
    color: GameColors.primary,
  },
  hint: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    textAlign: "center",
    lineHeight: moderateScale(20),
    marginTop: moderateScale(4),
  },
  status: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
    marginTop: moderateScale(4),
  },
  statusSuccess: {
    color: GameColors.primary,
  },
  statusError: {
    color: GameColors.primaryDark,
  },
  restoreBtn: {
    marginTop: moderateScale(4),
    minHeight: moderateScale(40),
    justifyContent: "center",
    paddingHorizontal: moderateScale(12),
  },
  restoreBtnText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.textMuted,
    textDecorationLine: "underline",
  },
  closeBtn: {
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
