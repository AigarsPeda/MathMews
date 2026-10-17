import { Platform } from "react-native";

export type PlatformAuthProvider = "apple" | "google";

/** Enable only after provider credentials, redirect URLs and recovery acceptance
 * have been configured in Supabase and tested on the corresponding platform. */
export function isPlatformAuthEnabled(provider: PlatformAuthProvider | null): boolean {
  return provider === 'apple' ? process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === 'true'
    : provider === 'google' ? process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true' : false;
}

/** Parent sign-in used to move progress between devices on the same platform. */
export function getPlatformRestoreProvider(): PlatformAuthProvider | null {
  if (Platform.OS === "ios") return "apple";
  if (Platform.OS === "android") return "google";
  return null;
}

export function getPlatformRestoreProviderLabel(
  provider: PlatformAuthProvider,
): string {
  return provider === "apple" ? "Apple" : "Google";
}
