import { getWalletEnvironment } from "@/services/wallet/environment";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { GameSave } from "@/types/save";
import { parseGameSaveFromValue } from "@/utils/game-storage";
import { loadDeletionReceipt } from './deletion-receipt';
import { gameAccountOwner } from './account-game';
import { isAccountTransitionActive } from '@/services/auth/account-operation';
import {
  pickNewerSave,
  toCloudSaveSummary,
  type CloudSaveSummary,
  type RemoteSaveSnapshot,
  type SaveSnapshot,
} from "./merge-game-save";

const pausedAccounts = new Set<string>();
export function pauseAccountCloudWrites(userId: string, paused: boolean) {
  if (paused) pausedAccounts.add(userId); else pausedAccounts.delete(userId);
}

type GameSaveRow = {
  id: string;
  user_id: string;
  save: unknown;
  updated_at: string;
  created_at?: string;
  client_updated_at: number | null;
};

function rowToRemoteSnapshot(
  row: Pick<
    GameSaveRow,
    "id" | "save" | "updated_at" | "created_at" | "client_updated_at"
  >,
  userId: string,
): RemoteSaveSnapshot | null {
  const parsed = parseGameSaveFromValue(row.save);
  if (!parsed) return null;

  return {
    saveId: row.id,
    save: { ...parsed.save, accountOwnerId: userId },
    clientUpdatedAt: row.client_updated_at ?? 0,
    serverUpdatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export function isCloudSaveAvailable(): boolean {
  return isSupabaseConfigured() && supabase != null;
}

export async function listRemoteSaves(userId: string): Promise<CloudSaveSummary[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("game_saves")
    .select("id, save, updated_at, created_at, client_updated_at")
    .eq("user_id", userId)
    .eq("environment", getWalletEnvironment())
    .order("updated_at", { ascending: false });

  if (error) {
    if (__DEV__) {
      console.warn("[MathMews cloud] list failed", error.message);
    }
    throw new Error('Cloud save list unavailable');
  }

  return (data ?? [])
    .map((row) => rowToRemoteSnapshot(row as GameSaveRow, userId))
    .filter((snapshot): snapshot is RemoteSaveSnapshot => snapshot !== null)
    .map(toCloudSaveSummary);
}

export async function pullRemoteSave(
  userId: string,
  saveId: string,
): Promise<RemoteSaveSnapshot | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("game_saves")
    .select("id, save, updated_at, created_at, client_updated_at")
    .eq("user_id", userId)
    .eq("environment", getWalletEnvironment())
    .eq("id", saveId)
    .maybeSingle();

  if (error) {
    if (__DEV__) {
      console.warn("[MathMews cloud] pull failed", error.message);
    }
    throw new Error('Cloud save read unavailable');
  }

  if (!data) return null;

  return rowToRemoteSnapshot(data as GameSaveRow, userId);
}

export async function listRemoteSaveSnapshots(
  userId: string,
): Promise<RemoteSaveSnapshot[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("game_saves")
    .select("id, save, updated_at, created_at, client_updated_at")
    .eq("user_id", userId)
    .eq("environment", getWalletEnvironment())
    .order("updated_at", { ascending: false });

  if (error) {
    if (__DEV__) {
      console.warn("[MathMews cloud] list snapshots failed", error.message);
    }
    throw new Error('Cloud save list unavailable');
  }

  return (data ?? [])
    .map((row) => rowToRemoteSnapshot(row as GameSaveRow, userId))
    .filter((snapshot): snapshot is RemoteSaveSnapshot => snapshot !== null);
}

// All writers (onboarding, restores, wallet sync and lifecycle flushes) share
// this queue. A later snapshot cannot reach the server before an earlier one.
const uploadQueues = new Map<string, Promise<boolean>>();

export async function pushRemoteSave(
  userId: string,
  saveId: string,
  snapshot: SaveSnapshot,
): Promise<boolean> {
  const environment = getWalletEnvironment();
  const key = `${userId}:${environment}:${saveId}`;
  const previous = uploadQueues.get(key) ?? Promise.resolve(true);
  const upload = previous.catch(() => false).then(() => uploadRemoteSave(userId, saveId, environment, snapshot));
  uploadQueues.set(key, upload);
  try {
    return await upload;
  } finally {
    if (uploadQueues.get(key) === upload) uploadQueues.delete(key);
  }
}

async function uploadRemoteSave(userId: string, saveId: string, environment: string, snapshot: SaveSnapshot): Promise<boolean> {
  // Recheck when the queued operation starts, including deletion/auth changes.
  if (!supabase || isAccountTransitionActive() || gameAccountOwner(snapshot.save) !== userId
    || pausedAccounts.has(userId) || await loadDeletionReceipt()) return false;

  const { error } = await supabase.from("game_saves").upsert(
    {
      id: saveId,
      user_id: userId,
      environment,
      save: snapshot.save,
      client_updated_at: snapshot.clientUpdatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    if (__DEV__) {
      console.warn("[MathMews cloud] push failed", error.message, error);
    }
    return false;
  }

  if (__DEV__) {
    console.log("[MathMews cloud] push ok for save", saveId);
  }

  return true;
}

export async function mergeWithRemoteSave(options: {
  userId: string;
  saveId: string;
  local: SaveSnapshot;
}): Promise<{ save: GameSave; shouldUpload: boolean }> {
  const remote = await pullRemoteSave(options.userId, options.saveId);
  const merged = pickNewerSave(options.local, remote);

  const shouldUpload =
    !remote ||
    (merged === options.local.save &&
      options.local.clientUpdatedAt >=
        (remote.clientUpdatedAt || Date.parse(remote.serverUpdatedAt)));

  return { save: merged, shouldUpload };
}
