import {
  getPlatformRestoreProvider,
  type PlatformAuthProvider,
} from "@/constants/platform-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import type { User } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

export type PlatformAccountResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; error?: string };

export function getOAuthRedirectUri(): string {
  return makeRedirectUri({
    scheme: "mathmews",
    path: "auth/callback",
  });
}

export function hasPlatformAccountLinked(user: User | null): boolean {
  if (!user) return false;

  const providers = new Set(
    (user.identities ?? []).map((identity) => identity.provider),
  );

  return providers.has("apple") || providers.has("google");
}

export function getLinkedPlatformProvider(
  user: User | null,
): PlatformAuthProvider | null {
  if (!user) return null;

  const providers = new Set(
    (user.identities ?? []).map((identity) => identity.provider),
  );

  if (providers.has("apple")) return "apple";
  if (providers.has("google")) return "google";
  return null;
}

export async function finishOAuthFromUrl(
  url: string,
): Promise<PlatformAccountResult> {
  if (!supabase) {
    return { ok: false, error: "supabase_not_configured" };
  }

  // Only an active browser sign-in calls this function. PKCE binds the returned
  // authorization code to the verifier on this phone; never accept URL tokens.
  let callback: URL;
  try { callback = new URL(url); } catch { return { ok: false, error: 'invalid_callback' }; }
  if (callback.protocol !== 'mathmews:' || `${callback.hostname}${callback.pathname}`.replace(/^\/+|\/+$/g, '') !== 'auth/callback') {
    return { ok: false, error: 'invalid_callback' };
  }

  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    return { ok: false, error: errorCode };
  }

  if (typeof params.code !== 'string' || !params.code || params.access_token || params.refresh_token) {
    return { ok: false, error: "missing_auth_code" };
  }

  const { error } = await supabase.auth.exchangeCodeForSession(params.code);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

async function openOAuthSession(authUrl: string): Promise<PlatformAccountResult> {
  const redirectTo = getOAuthRedirectUri();
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);

  if (result.type === "cancel" || result.type === "dismiss") {
    return { ok: false, cancelled: true };
  }

  if (result.type !== "success") {
    return { ok: false, error: "oauth_failed" };
  }

  return finishOAuthFromUrl(result.url);
}

export async function linkPlatformAccount(): Promise<PlatformAccountResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: "supabase_not_configured" };
  }

  const provider = getPlatformRestoreProvider();
  if (!provider) {
    return { ok: false, error: "unsupported_platform" };
  }

  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: {
      redirectTo: getOAuthRedirectUri(),
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data?.url) {
    return { ok: false, error: "missing_oauth_url" };
  }

  return openOAuthSession(data.url);
}

export async function restorePlatformAccount(): Promise<PlatformAccountResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: "supabase_not_configured" };
  }

  const provider = getPlatformRestoreProvider();
  if (!provider) {
    return { ok: false, error: "unsupported_platform" };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getOAuthRedirectUri(),
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data?.url) {
    return { ok: false, error: "missing_oauth_url" };
  }

  return openOAuthSession(data.url);
}
