import type { GameSave } from "@/types/save";

export type SaveSnapshot = {
  save: GameSave;
  /** Unix ms — device time when this copy was written. */
  clientUpdatedAt: number;
};

export type RemoteSaveSnapshot = SaveSnapshot & {
  /** ISO timestamp from Supabase `updated_at`. */
  serverUpdatedAt: string;
};

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
