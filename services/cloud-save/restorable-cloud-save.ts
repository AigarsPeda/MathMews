import type { CloudSaveSummary, RemoteSaveSnapshot, SaveSnapshot } from "./merge-game-save";
import { toCloudSaveSummary } from "./merge-game-save";

function sortByRecency(a: CloudSaveSummary, b: CloudSaveSummary): number {
  return b.startedAtMs - a.startedAtMs;
}

/** Cloud games the player can restore while local onboarding is not finished. */
export function listRestorableCloudSaves(
  local: SaveSnapshot,
  remotes: RemoteSaveSnapshot[],
  activeSaveId: string | null = null,
): CloudSaveSummary[] {
  if (local.save.hasCompletedOnboarding) return [];

  return listSwitchableCloudSaves(remotes, activeSaveId);
}

/** Finished cloud games on this account, excluding the active slot. */
export function listSwitchableCloudSaves(
  remotes: RemoteSaveSnapshot[],
  activeSaveId: string | null = null,
): CloudSaveSummary[] {
  return remotes
    .filter((remote) => {
      if (!remote.save.hasCompletedOnboarding) return false;
      if (activeSaveId && remote.saveId === activeSaveId) return false;
      return true;
    })
    .map(toCloudSaveSummary)
    .sort(sortByRecency);
}
