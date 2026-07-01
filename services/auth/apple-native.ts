import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

export type NativeSignInResult =
  | { ok: true; idToken: string }
  | { ok: false; cancelled?: boolean; error?: string };

export async function getNativeAppleIdToken(): Promise<NativeSignInResult> {
  if (Platform.OS !== "ios") {
    return { ok: false, error: "apple_ios_only" };
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return { ok: false, error: "apple_not_available" };
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });

    if (!credential.identityToken) {
      return { ok: false, error: "missing_apple_token" };
    }

    return { ok: true, idToken: credential.identityToken };
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;

    if (code === "ERR_REQUEST_CANCELED") {
      return { ok: false, cancelled: true };
    }

    return { ok: false, error: "apple_sign_in_failed" };
  }
}

export async function signInWithAppleIdToken(
  idToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: idToken,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function linkAppleIdToken(
  idToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const { error } = await supabase.auth.linkIdentity({
    provider: "apple",
    token: idToken,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === "ios";
}

export function isSupabaseAuthReady(): boolean {
  return isSupabaseConfigured();
}
