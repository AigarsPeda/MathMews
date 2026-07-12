import { prefetchGameAssets } from "@/utils/prefetch-game-assets";

const PREFETCH_MAX_WAIT_MS = 12_000;

/** Started as soon as the root layout module loads. */
export const gameAssetsPrefetchPromise = Promise.race([
  prefetchGameAssets(),
  new Promise<void>((resolve) => {
    setTimeout(resolve, PREFETCH_MAX_WAIT_MS);
  }),
]);
