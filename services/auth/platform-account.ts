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

  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    return { ok: false, error: errorCode };
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    return { ok: false, error: "missing_tokens" };
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

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

  await supabase.auth.signOut({ scope: "local" });

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
