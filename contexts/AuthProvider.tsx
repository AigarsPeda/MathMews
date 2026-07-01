import {
  getPlatformRestoreProvider,
  getPlatformRestoreProviderLabel,
} from "@/constants/platform-auth";
import {
  clearBackedUpSession,
  loadBackedUpSession,
  saveBackedUpSession,
} from "@/lib/auth-session-backup";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  finishOAuthFromUrl,
  getLinkedPlatformProvider,
  hasPlatformAccountLinked,
} from "@/services/auth/platform-account";
import {
  protectProgress,
  restoreProgress,
  sendParentEmailCode,
  verifyParentEmailCode,
  type ProgressAuthResult,
} from "@/services/auth/protect-progress";
import type { PlatformAuthProvider } from "@/constants/platform-auth";
import * as Linking from "expo-linking";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthContextValue = {
  isAuthReady: boolean;
  userId: string | null;
  isPlatformAccountLinked: boolean;
  linkedPlatformProvider: PlatformAuthProvider | null;
  platformRestoreProvider: PlatformAuthProvider | null;
  platformRestoreLabel: string | null;
  protectProgress: () => Promise<ProgressAuthResult>;
  restoreProgress: () => Promise<ProgressAuthResult>;
  sendParentEmailCode: (
    email: string,
    mode: "protect" | "restore",
  ) => Promise<ProgressAuthResult>;
  verifyParentEmailCode: (
    email: string,
    code: string,
  ) => Promise<ProgressAuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function restoreSessionFromSecureBackup() {
  if (!supabase) return null;

  const backup = await loadBackedUpSession();
  if (!backup) return null;

  const { data: setData, error: setError } = await supabase.auth.setSession({
    access_token: backup.access_token,
    refresh_token: backup.refresh_token,
  });

  if (!setError && setData.session) {
    return setData.session;
  }

  const { data: refreshData, error: refreshError } =
    await supabase.auth.refreshSession({
      refresh_token: backup.refresh_token,
    });

  if (refreshError || !refreshData.session) {
    if (__DEV__) {
      console.warn(
        "[MathMews auth] secure session restore failed",
        refreshError?.message ?? setError?.message,
      );
    }
    await clearBackedUpSession();
    return null;
  }

  return refreshData.session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthReady, setIsAuthReady] = useState(!isSupabaseConfigured());
  const [userId, setUserId] = useState<string | null>(null);
  const [isPlatformAccountLinked, setIsPlatformAccountLinked] = useState(false);
  const [linkedPlatformProvider, setLinkedPlatformProvider] =
    useState<PlatformAuthProvider | null>(null);

  const platformRestoreProvider = getPlatformRestoreProvider();
  const platformRestoreLabel = platformRestoreProvider
    ? getPlatformRestoreProviderLabel(platformRestoreProvider)
    : null;

  const refreshLinkedState = useCallback(async () => {
    if (!supabase) {
      setIsPlatformAccountLinked(false);
      setLinkedPlatformProvider(null);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const user = data.user ?? null;
    setIsPlatformAccountLinked(hasPlatformAccountLinked(user));
    setLinkedPlatformProvider(getLinkedPlatformProvider(user));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);

      if (session?.user) {
        setIsPlatformAccountLinked(hasPlatformAccountLinked(session.user));
        setLinkedPlatformProvider(getLinkedPlatformProvider(session.user));
      } else {
        setIsPlatformAccountLinked(false);
        setLinkedPlatformProvider(null);
      }

      if (session?.refresh_token && session.access_token) {
        saveBackedUpSession({
          refresh_token: session.refresh_token,
          access_token: session.access_token,
        }).catch(() => undefined);
      }
    });

    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      if (!url.includes("auth/callback")) return;
      finishOAuthFromUrl(url)
        .then((result) => {
          if (!result.ok && __DEV__ && result.error) {
            console.warn("[MathMews auth] oauth callback failed", result.error);
          }
        })
        .catch(() => undefined);
    });

    Linking.getInitialURL()
      .then((url) => {
        if (url?.includes("auth/callback")) {
          return finishOAuthFromUrl(url);
        }
        return null;
      })
      .catch(() => undefined);

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setIsAuthReady(true);
      return;
    }

    let active = true;

    (async () => {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (!active) return;

      if (sessionError && __DEV__) {
        console.warn("[MathMews auth] getSession failed", sessionError.message);
      }

      let session = sessionData.session;

      if (!session) {
        session = await restoreSessionFromSecureBackup();
        if (__DEV__ && session) {
          console.log(
            "[MathMews auth] restored session from secure storage:",
            session.user.id,
          );
        }
      }

      if (session?.user.id) {
        setUserId(session.user.id);
        setIsPlatformAccountLinked(hasPlatformAccountLinked(session.user));
        setLinkedPlatformProvider(getLinkedPlatformProvider(session.user));
        setIsAuthReady(true);
        return;
      }

      const { data, error } = await supabase.auth.signInAnonymously();
      if (!active) return;

      if (error) {
        if (__DEV__) {
          console.warn("[MathMews auth] anonymous sign-in failed", error.message);
        }
        setIsAuthReady(true);
        return;
      }

      const nextUserId = data.user?.id ?? null;
      if (__DEV__ && nextUserId) {
        console.log("[MathMews auth] signed in anonymously:", nextUserId);
      }

      setUserId(nextUserId);
      await refreshLinkedState();
      setIsAuthReady(true);
    })().catch((error) => {
      if (__DEV__) {
        console.warn("[MathMews auth] unexpected error", error);
      }
      if (active) setIsAuthReady(true);
    });

    return () => {
      active = false;
    };
  }, [refreshLinkedState]);

  const handleProtectProgress = useCallback(async () => {
    const result = await protectProgress();
    if (result.ok) {
      await refreshLinkedState();
    }
    return result;
  }, [refreshLinkedState]);

  const handleRestoreProgress = useCallback(async () => {
    const result = await restoreProgress();
    if (result.ok) {
      await refreshLinkedState();
    }
    return result;
  }, [refreshLinkedState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthReady,
      userId,
      isPlatformAccountLinked,
      linkedPlatformProvider,
      platformRestoreProvider,
      platformRestoreLabel,
      protectProgress: handleProtectProgress,
      restoreProgress: handleRestoreProgress,
      sendParentEmailCode,
      verifyParentEmailCode,
    }),
    [
      handleProtectProgress,
      handleRestoreProgress,
      isAuthReady,
      isPlatformAccountLinked,
      linkedPlatformProvider,
      platformRestoreLabel,
      platformRestoreProvider,
      userId,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
