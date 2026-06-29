import { useGame } from "@/contexts/GameProvider";
import type { CoinPackProductId } from "@/constants/iap-products";
import { applyCoinGrant } from "@/services/iap/apply-coin-grant";
import {
  configureRevenueCat,
  fetchCoinPackCatalog,
  isRevenueCatSupported,
  purchaseCoinPack,
  restorePurchases as restoreRevenueCatPurchases,
  type CoinPackCatalogEntry,
  type CoinPackPurchaseResult,
} from "@/services/iap/revenuecat";
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
  restorePurchases: () => Promise<void>;
  refreshOfferings: () => Promise<void>;
};

const IAPContext = createContext<IAPContextValue | null>(null);

export function IAPProvider({ children }: { children: ReactNode }) {
  const { setWallet } = useGame();
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

    // Intentionally not caught — release builds must fail if keys are misconfigured.
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

  const handlePurchaseCoinPack = useCallback(
    async (productId: CoinPackProductId): Promise<CoinPackPurchaseResult> => {
      const result = await purchaseCoinPack(productId);

      if (result.status === "purchased") {
        setWallet((wallet) => applyCoinGrant(wallet, result.coins));
      }

      return result;
    },
    [setWallet],
  );

  const handleRestorePurchases = useCallback(async () => {
    await restoreRevenueCatPurchases();
  }, []);

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
