import { prefetchGameAssets, type AssetPrefetchProgress } from "@/utils/prefetch-game-assets";
import { reportAppError } from "@/lib/app-diagnostics";

const PREFETCH_MAX_WAIT_MS = 12_000;

type AssetLoadingSnapshot = AssetPrefetchProgress & { finished: boolean; mayContinue: boolean };
let snapshot: AssetLoadingSnapshot = { completed: 0, total: 0, failed: 0, finished: false, mayContinue: false };
const listeners = new Set<() => void>();

function publish(update: Partial<AssetLoadingSnapshot>) {
  snapshot = { ...snapshot, ...update };
  listeners.forEach(listener => listener());
}
export const getGameAssetLoadingSnapshot = () => snapshot;
export function subscribeGameAssetLoading(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Actual counts continue advancing after the bounded startup wait expires. */
const deadline = setTimeout(() => publish({ mayContinue: true }), PREFETCH_MAX_WAIT_MS);
export const gameAssetsPrefetchPromise = prefetchGameAssets(progress => publish(progress))
  .catch(error => {
    reportAppError("startup-asset-prefetch", error);
    publish({ failed: snapshot.failed + 1 });
  })
  .finally(() => {
    clearTimeout(deadline);
    publish({ finished: true, mayContinue: true });
  });
