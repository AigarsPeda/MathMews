import { useAuth } from "@/contexts/AuthProvider";
import { useGame } from "@/contexts/GameProvider";
import type { CoinPackProductId } from "@/constants/iap-products";
import { COIN_PACK_PRODUCTS } from "@/constants/iap-products";
import {
  configureRevenueCat,
  fetchCoinPackCatalog,
  isRevenueCatSupported,
  purchaseCoinPack,
  restorePurchases as restoreRevenueCatPurchases,
  type CoinPackCatalogEntry,
  type CoinPackPurchaseResult,
} from "@/services/iap/revenuecat";
import Purchases from "react-native-purchases";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type IAPContextValue = {
  isReady: boolean;
  isSupported: boolean;
  coinPackCatalog: CoinPackCatalogEntry[];
  purchaseCoinPack: (productId: CoinPackProductId) => Promise<CoinPackPurchaseResult>;
  restorePurchases: () => Promise<number>;
  refreshOfferings: () => Promise<void>;
};

const IAPContext = createContext<IAPContextValue | null>(null);

export function IAPProvider({ children }: { children: ReactNode }) {
  const { isAuthReady, userId } = useAuth();
  const { adjustCoins, syncToCloud, reloadProgressFromCloud, coinTransactions } =
    useGame();
  const [isReady, setIsReady] = useState(false);
  const [coinPackCatalog, setCoinPackCatalog] = useState<CoinPackCatalogEntry[]>(
    [],
  );
  const isSupported = isRevenueCatSupported();

  const refreshOfferings = useCallback(async () => {
    if (!isSupported) return;
    const catalog = await fetchCoinPackCatalog();
    setCoinPackCatalog(catalog);
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) {
      setIsReady(true);
      return;
    }

    let active = true;

    configureRevenueCat();

    refreshOfferings()
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [isSupported, refreshOfferings]);

  useEffect(() => {
    if (!isSupported || !isAuthReady || !userId) return;

    Purchases.logIn(userId).catch(() => undefined);
  }, [isAuthReady, isSupported, userId]);

  const creditCoinPackPurchase = useCallback(
    async (result: Extract<CoinPackPurchaseResult, { status: "purchased" }>) => {
      const alreadyCredited = coinTransactions.some(
        (tx) => tx.transactionId === result.transactionId,
      );
      if (alreadyCredited) {
        return;
      }

      const productLabel = COIN_PACK_PRODUCTS[result.productId]
        ? `${result.coins} coins`
        : result.productId;

      adjustCoins(result.coins, {
        kind: "iap_purchase",
        productId: result.productId,
        transactionId: result.transactionId,
        priceString: result.priceString ?? undefined,
        label: productLabel,
      });

      await syncToCloud();
    },
    [adjustCoins, coinTransactions, syncToCloud],
  );

  const handlePurchaseCoinPack = useCallback(
    async (productId: CoinPackProductId): Promise<CoinPackPurchaseResult> => {
      const result = await purchaseCoinPack(productId);

      if (result.status === "purchased") {
        await creditCoinPackPurchase(result);
      }

      return result;
    },
    [creditCoinPackPurchase],
  );

  const handleRestorePurchases = useCallback(async (): Promise<number> => {
    if (isSupported) {
      await restoreRevenueCatPurchases();
    }

    await reloadProgressFromCloud();
    return 0;
  }, [isSupported, reloadProgressFromCloud]);

  const value = useMemo(
    () => ({
      isReady,
      isSupported,
      coinPackCatalog,
      purchaseCoinPack: handlePurchaseCoinPack,
      restorePurchases: handleRestorePurchases,
      refreshOfferings,
    }),
    [
      coinPackCatalog,
      handlePurchaseCoinPack,
      handleRestorePurchases,
      isReady,
      isSupported,
      refreshOfferings,
    ],
  );

  return <IAPContext.Provider value={value}>{children}</IAPContext.Provider>;
}

export function useIAP(): IAPContextValue {
  const context = useContext(IAPContext);
  if (!context) {
    throw new Error("useIAP must be used within IAPProvider");
  }
  return context;
}
