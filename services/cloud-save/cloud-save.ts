import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { GameSave } from "@/types/save";
import { parseGameSaveFromValue } from "@/utils/game-storage";
import {
  pickNewerSave,
  type RemoteSaveSnapshot,
  type SaveSnapshot,
} from "./merge-game-save";

type GameSaveRow = {
  user_id: string;
  save: unknown;
  updated_at: string;
  client_updated_at: number | null;
};

export function isCloudSaveAvailable(): boolean {
  return isSupabaseConfigured() && supabase != null;
}

export async function pullRemoteSave(
  userId: string,
): Promise<RemoteSaveSnapshot | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("game_saves")
    .select("save, updated_at, client_updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (__DEV__) {
      console.warn("[BrainPet cloud] pull failed", error.message);
    }
    return null;
  }

  if (!data) return null;

  const row = data as Pick<
    GameSaveRow,
    "save" | "updated_at" | "client_updated_at"
  >;
  const parsed = parseGameSaveFromValue(row.save);
  if (!parsed) return null;

  return {
    save: parsed.save,
    clientUpdatedAt: row.client_updated_at ?? 0,
    serverUpdatedAt: row.updated_at,
  };
}

export async function pushRemoteSave(
  userId: string,
  snapshot: SaveSnapshot,
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.from("game_saves").upsert(
    {
      user_id: userId,
      save: snapshot.save,
      client_updated_at: snapshot.clientUpdatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (__DEV__) {
      console.warn("[BrainPet cloud] push failed", error.message, error);
    }
    return false;
  }

  if (__DEV__) {
    console.log("[BrainPet cloud] push ok for user", userId);
  }

  return true;
}

export async function mergeWithRemoteSave(options: {
  userId: string;
  local: SaveSnapshot;
}): Promise<{ save: GameSave; shouldUpload: boolean }> {
  const remote = await pullRemoteSave(options.userId);
  const merged = pickNewerSave(options.local, remote);

  const shouldUpload =
    !remote ||
    (merged === options.local.save &&
      options.local.clientUpdatedAt >=
        (remote.clientUpdatedAt || Date.parse(remote.serverUpdatedAt)));

  return { save: merged, shouldUpload };
}
