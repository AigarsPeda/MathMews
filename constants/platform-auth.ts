import { Platform } from "react-native";

export type PlatformAuthProvider = "apple" | "google";

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
