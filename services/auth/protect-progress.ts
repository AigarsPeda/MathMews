import { clearBackedUpSession } from "@/lib/auth-session-backup";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  getNativeAppleIdToken,
  linkAppleIdToken,
  signInWithAppleIdToken,
} from "@/services/auth/apple-native";
import {
  getPlatformRestoreProvider,
  type PlatformAuthProvider,
} from "@/constants/platform-auth";
import {
  finishOAuthFromUrl,
  getOAuthRedirectUri,
  hasPlatformAccountLinked,
  type PlatformAccountResult,
} from "@/services/auth/platform-account";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export type ProgressAuthResult = PlatformAccountResult;

async function openGoogleOAuthSession(
  mode: "link" | "restore",
): Promise<ProgressAuthResult> {
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  if (mode === "restore") {
    await supabase.auth.signOut({ scope: "local" });
    await clearBackedUpSession();
  }

  const redirectTo = getOAuthRedirectUri();
  const request =
    mode === "link"
      ? await supabase.auth.linkIdentity({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: true },
        })
      : await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: true },
        });

  if (request.error) {
    return { ok: false, error: request.error.message };
  }

  if (!request.data?.url) {
    return { ok: false, error: "missing_oauth_url" };
  }

  const result = await WebBrowser.openAuthSessionAsync(request.data.url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss") {
    return { ok: false, cancelled: true };
  }
  if (result.type !== "success") {
    return { ok: false, error: "oauth_failed" };
  }

  return finishOAuthFromUrl(result.url);
}

async function protectWithApple(): Promise<ProgressAuthResult> {
  const apple = await getNativeAppleIdToken();
  if (!apple.ok) {
    return {
      ok: false,
      cancelled: apple.cancelled,
      error: apple.error,
    };
  }

  const { data: userData } = await supabase!.auth.getUser();
  const alreadyLinked = hasPlatformAccountLinked(userData.user ?? null);

  if (alreadyLinked) {
    return { ok: true };
  }

  const linked = await linkAppleIdToken(apple.idToken);
  if (!linked.ok) {
    return { ok: false, error: linked.error };
  }

  return { ok: true };
}

async function restoreWithApple(): Promise<ProgressAuthResult> {
  await supabase!.auth.signOut({ scope: "local" });
  await clearBackedUpSession();

  const apple = await getNativeAppleIdToken();
  if (!apple.ok) {
    return {
      ok: false,
      cancelled: apple.cancelled,
      error: apple.error,
    };
  }

  const signedIn = await signInWithAppleIdToken(apple.idToken);
  if (!signedIn.ok) {
    return { ok: false, error: signedIn.error };
  }

  return { ok: true };
}

/** Save progress so it can be found on another phone (same platform). */
export async function protectProgress(): Promise<ProgressAuthResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: "supabase_not_configured" };
  }

  const provider = getPlatformRestoreProvider();
  if (provider === "apple") {
    return protectWithApple();
  }
  if (provider === "google") {
    return openGoogleOAuthSession("link");
  }

  return { ok: false, error: "unsupported_platform" };
}

/** Load progress from a previous phone (same platform). */
export async function restoreProgress(): Promise<ProgressAuthResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: "supabase_not_configured" };
  }

  const provider = getPlatformRestoreProvider();
  if (provider === "apple") {
    return restoreWithApple();
  }
  if (provider === "google") {
    return openGoogleOAuthSession("restore");
  }

  return { ok: false, error: "unsupported_platform" };
}

export async function sendParentEmailCode(
  email: string,
  mode: "protect" | "restore",
): Promise<ProgressAuthResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: "supabase_not_configured" };
  }

  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@")) {
    return { ok: false, error: "invalid_email" };
  }

  if (mode === "restore") {
    await supabase.auth.signOut({ scope: "local" });
    await clearBackedUpSession();

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: false },
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  }

  const { error } = await supabase.auth.updateUser({ email: trimmed });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function verifyParentEmailCode(
  email: string,
  code: string,
): Promise<ProgressAuthResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: "supabase_not_configured" };
  }

  const trimmed = email.trim().toLowerCase();
  const token = code.trim();

  const attempts: Array<"email" | "email_change" | "signup"> = [
    "email",
    "email_change",
    "signup",
  ];

  for (const type of attempts) {
    const { error } = await supabase.auth.verifyOtp({
      email: trimmed,
      token,
      type,
    });

    if (!error) {
      return { ok: true };
    }
  }

  return { ok: false, error: "invalid_code" };
}

export function getPlatformAccountName(provider: PlatformAuthProvider | null): string {
  if (provider === "apple") return "Apple ID";
  if (provider === "google") return "Google account";
  return "account";
}

export { makeRedirectUri };
