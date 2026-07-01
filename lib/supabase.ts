import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function resolveSupabaseConfig(): { url: string; anonKey: string } {
  const extra = Constants.expoConfig?.extra as SupabaseExtra | undefined;

  const url = (
    extra?.supabaseUrl ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).trim();

  const anonKey = (
    extra?.supabaseAnonKey ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();

  return { url, anonKey };
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig();

export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

if (__DEV__) {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[BrainPet] Supabase not configured — add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart Expo.",
    );
  } else {
    console.log("[BrainPet] Supabase configured:", supabaseUrl);
  }
}

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
