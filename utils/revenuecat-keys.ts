import { REVENUECAT_TEST_STORE_API_KEY } from "@/constants/revenuecat";
import { Platform } from "react-native";

type RevenueCatPlatform = "ios" | "android";

const PRODUCTION_KEYS: Record<RevenueCatPlatform, string> = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ?? "",
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ?? "",
};

export function isTestStoreApiKey(apiKey: string): boolean {
  return apiKey.startsWith("test_");
}

export function isUsingRevenueCatTestStore(): boolean {
  return __DEV__;
}

function getPlatform(): RevenueCatPlatform {
  return Platform.OS === "ios" ? "ios" : "android";
}

/** Dev → Test Store key. Release → platform production key from env. */
export function resolveRevenueCatApiKey(): string {
  if (__DEV__) {
    return REVENUECAT_TEST_STORE_API_KEY;
  }

  const platform = getPlatform();
  return PRODUCTION_KEYS[platform];
}

/**
 * Release builds must not ship without real platform keys.
 * Throws intentionally so misconfigured store builds fail immediately.
 */
export function assertValidReleaseRevenueCatKey(apiKey: string): void {
  if (__DEV__) return;

  const platform = getPlatform();

  if (!apiKey) {
    throw new Error(
      `[BrainPet] RevenueCat production API key missing for ${platform}. ` +
        `Set EXPO_PUBLIC_REVENUECAT_${platform.toUpperCase()}_API_KEY before shipping.`,
    );
  }

  if (isTestStoreApiKey(apiKey)) {
    throw new Error(
      "[BrainPet] RevenueCat Test Store API key cannot be used in release builds. " +
        "Set platform-specific production keys before submitting to the App Store or Play Store.",
    );
  }
}
