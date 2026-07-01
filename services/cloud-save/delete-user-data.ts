import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function deleteRemoteUserData(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return true;
  }

  const { error } = await supabase
    .from("game_saves")
    .delete()
    .eq("user_id", userId);

  if (error && __DEV__) {
    console.warn("[MathMews cloud] delete game_saves failed", error.message);
  }

  return !error;
}
