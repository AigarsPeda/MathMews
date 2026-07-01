import type { GameSave } from "@/types/save";

export type SaveSnapshot = {
  save: GameSave;
  /** Unix ms — device time when this copy was written. */
  clientUpdatedAt: number;
};

export type RemoteSaveSnapshot = SaveSnapshot & {
  saveId: string;
  /** ISO timestamp from Supabase `updated_at`. */
  serverUpdatedAt: string;
  /** ISO timestamp from Supabase `created_at` (row first synced). */
  createdAt?: string;
};

export type CloudSaveSummary = {
  saveId: string;
  petName: string;
  coins: number;
  /** Best estimate of when this game was started (unix ms). */
  startedAtMs: number;
  clientUpdatedAt: number;
  serverUpdatedAt: string;
};

function resolveStartedAtMs(remote: RemoteSaveSnapshot): number {
  if (
    typeof remote.save.startedAt === "number" &&
    remote.save.startedAt > 0
  ) {
    return remote.save.startedAt;
  }

  if (remote.createdAt) {
    const createdAtMs = Date.parse(remote.createdAt);
    if (Number.isFinite(createdAtMs)) return createdAtMs;
  }

  if (remote.clientUpdatedAt > 0) return remote.clientUpdatedAt;

  const serverAtMs = Date.parse(remote.serverUpdatedAt);
  return Number.isFinite(serverAtMs) ? serverAtMs : 0;
}

export function toCloudSaveSummary(remote: RemoteSaveSnapshot): CloudSaveSummary {
  return {
    saveId: remote.saveId,
    petName: remote.save.pet.name || "Pet",
    coins: remote.save.wallet.coins,
    startedAtMs: resolveStartedAtMs(remote),
    clientUpdatedAt: remote.clientUpdatedAt,
    serverUpdatedAt: remote.serverUpdatedAt,
  };
}

export function pickNewerSave(
  local: SaveSnapshot,
  remote: RemoteSaveSnapshot | null,
): GameSave {
  if (!remote) return local.save;

  const remoteClientAt = remote.clientUpdatedAt;
  const remoteServerAt = Date.parse(remote.serverUpdatedAt);
  const remoteAt = Number.isFinite(remoteClientAt)
    ? remoteClientAt
    : Number.isFinite(remoteServerAt)
      ? remoteServerAt
      : 0;

  if (remoteAt > local.clientUpdatedAt) {
    return remote.save;
  }

  return local.save;
}

export function shouldUploadLocal(
  local: SaveSnapshot,
  remote: RemoteSaveSnapshot | null,
): boolean {
  if (!remote) return true;
  const remoteAt = remote.clientUpdatedAt || Date.parse(remote.serverUpdatedAt);
  return local.clientUpdatedAt >= remoteAt;
}
