import {
  COIN_PACK_PRODUCT_IDS,
  COIN_PACK_PRODUCTS,
  type CoinPackProductId,
} from "@/constants/iap-products";
import {
  assertValidReleaseRevenueCatKey,
  resolveRevenueCatApiKey,
} from "@/utils/revenuecat-keys";
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  type PurchasesOfferings,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from "react-native-purchases";

let isConfigured = false;

export type CoinPackPurchaseResult =
  | { status: "purchased"; coins: number; productId: CoinPackProductId }
  | { status: "cancelled" }
  | { status: "pending" }
  | { status: "error"; message: string };

export type CoinPackCatalogEntry = {
  productId: CoinPackProductId;
  coins: number;
  priceString: string | null;
  package: PurchasesPackage | null;
  storeProduct: PurchasesStoreProduct | null;
};

function isCoinPackProductId(value: string): value is CoinPackProductId {
  return value in COIN_PACK_PRODUCTS;
}

export function isRevenueCatSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export function configureRevenueCat(): void {
  if (!isRevenueCatSupported() || isConfigured) return;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  }

  const apiKey = resolveRevenueCatApiKey();
  assertValidReleaseRevenueCatKey(apiKey);

  Purchases.configure({ apiKey });
  isConfigured = true;
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (!isRevenueCatSupported() || !isConfigured) return null;
  try {
    return await Purchases.getOfferings();
  } catch (error) {
    if (__DEV__) {
      console.warn("[BrainPet IAP] getOfferings failed", error);
    }
    return null;
  }
}

/** Collect coin packs from current + all offerings (not only `offerings.current`). */
export function getCoinPackPackages(
  offerings: PurchasesOfferings | null,
): PurchasesPackage[] {
  if (!offerings) return [];

  const byProductId = new Map<CoinPackProductId, PurchasesPackage>();

  const addPackages = (packages: PurchasesPackage[]) => {
    for (const pkg of packages) {
      const id = pkg.product.identifier;
      if (isCoinPackProductId(id) && !byProductId.has(id)) {
        byProductId.set(id, pkg);
      }
    }
  };

  if (offerings.current) {
    addPackages(offerings.current.availablePackages);
  }

  for (const offering of Object.values(offerings.all)) {
    addPackages(offering.availablePackages);
  }

  return COIN_PACK_PRODUCT_IDS.map((id) => byProductId.get(id)).filter(
    (pkg): pkg is PurchasesPackage => pkg != null,
  );
}

function catalogEntryFromPackage(pkg: PurchasesPackage): CoinPackCatalogEntry {
  const productId = pkg.product.identifier as CoinPackProductId;
  return {
    productId,
    coins: COIN_PACK_PRODUCTS[productId].coins,
    priceString: pkg.product.priceString,
    package: pkg,
    storeProduct: pkg.product,
  };
}

function catalogEntryFromStoreProduct(
  product: PurchasesStoreProduct,
): CoinPackCatalogEntry {
  const productId = product.identifier as CoinPackProductId;
  return {
    productId,
    coins: COIN_PACK_PRODUCTS[productId].coins,
    priceString: product.priceString,
    package: null,
    storeProduct: product,
  };
}

function emptyCatalogEntry(productId: CoinPackProductId): CoinPackCatalogEntry {
  return {
    productId,
    coins: COIN_PACK_PRODUCTS[productId].coins,
    priceString: null,
    package: null,
    storeProduct: null,
  };
}

export async function fetchCoinPackCatalog(): Promise<CoinPackCatalogEntry[]> {
  if (!isRevenueCatSupported() || !isConfigured) {
    return COIN_PACK_PRODUCT_IDS.map(emptyCatalogEntry);
  }

  const offerings = await getOfferings();
  const packages = getCoinPackPackages(offerings);
  const byId = new Map<CoinPackProductId, CoinPackCatalogEntry>();

  for (const pkg of packages) {
    const entry = catalogEntryFromPackage(pkg);
    byId.set(entry.productId, entry);
  }

  if (__DEV__ && offerings) {
    const currentIds =
      offerings.current?.availablePackages.map((pkg) => pkg.product.identifier) ??
      [];
    console.log("[BrainPet IAP] offerings.current packages:", currentIds);
    console.log(
      "[BrainPet IAP] resolved coin packs:",
      packages.map((pkg) => pkg.product.identifier),
    );
  }

  const missingIds = COIN_PACK_PRODUCT_IDS.filter((id) => !byId.has(id));
  if (missingIds.length > 0) {
    try {
      const products = await Purchases.getProducts(
        missingIds,
        PRODUCT_CATEGORY.NON_SUBSCRIPTION,
      );
      for (const product of products) {
        if (!isCoinPackProductId(product.identifier)) continue;
        byId.set(product.identifier, catalogEntryFromStoreProduct(product));
      }
    } catch (error) {
      if (__DEV__) {
        console.warn("[BrainPet IAP] getProducts fallback failed", error);
      }
    }
  }

  return COIN_PACK_PRODUCT_IDS.map(
    (productId) => byId.get(productId) ?? emptyCatalogEntry(productId),
  );
}

async function resolveCatalogEntry(
  productId: CoinPackProductId,
): Promise<CoinPackCatalogEntry | null> {
  const catalog = await fetchCoinPackCatalog();
  const entry = catalog.find((item) => item.productId === productId) ?? null;
  if (!entry?.package && !entry?.storeProduct) return null;
  return entry;
}

export async function purchaseCoinPack(
  productId: CoinPackProductId,
): Promise<CoinPackPurchaseResult> {
  if (!isRevenueCatSupported() || !isConfigured) {
    return {
      status: "error",
      message: "Purchases not available on this platform",
    };
  }

  const grant = COIN_PACK_PRODUCTS[productId];
  if (!grant) {
    return { status: "error", message: `Unknown product: ${productId}` };
  }

  try {
    const entry = await resolveCatalogEntry(productId);
    if (!entry) {
      return {
        status: "error",
        message: `Product not found: ${productId}. Check RevenueCat offering.`,
      };
    }

    if (entry.package) {
      await Purchases.purchasePackage(entry.package);
    } else if (entry.storeProduct) {
      await Purchases.purchaseStoreProduct(entry.storeProduct);
    } else {
      return {
        status: "error",
        message: `Product not available: ${productId}`,
      };
    }

    return { status: "purchased", coins: grant.coins, productId };
  } catch (error) {
    if (isPurchasesError(error)) {
      if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { status: "cancelled" };
      }
      if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        return { status: "pending" };
      }
      return { status: "error", message: error.message };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Purchase failed",
    };
  }
}

export async function restorePurchases(): Promise<void> {
  if (!isRevenueCatSupported() || !isConfigured) return;
  await Purchases.restorePurchases();
}

function isPurchasesError(
  error: unknown,
): error is { code: PURCHASES_ERROR_CODE; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}
