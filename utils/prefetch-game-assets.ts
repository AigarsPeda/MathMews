import {
  CAT_DECORATION_CATALOG,
  type DecorationCatalogEntry,
} from "@/constants/cat-decorations";
import { CAT_SKIN_PREVIEWS } from "@/constants/cat-skins";
import { CAT_BED_SOURCES } from "@/constants/cat-beds";
import { CAT_ROOM_SOURCES } from "@/constants/cat-rooms";
import nativeCatSource from "@/assets/3d/native/cat-orange.glb";
import {
  CAT_TOY_SOURCES,
} from "@/constants/cat-toys";
import { Asset } from "expo-asset";
import { Image as ExpoImage } from "expo-image";
import { Image as NativeImage, Platform } from "react-native";

const PREFETCH_BATCH_SIZE = Platform.OS === "android" ? 8 : 12;
// Budget decoded thumbnails, rather than retaining every room/model in memory.
const MEMORY_PIXEL_BUDGET = 12_000_000;
const MAX_MEMORY_IMAGE_PIXELS = 512 * 512;

function addAssetModule(modules: Set<number>, moduleId: unknown) {
  if (typeof moduleId === "number") {
    modules.add(moduleId);
  }
}

function collectFromDecorationEntry(
  entry: DecorationCatalogEntry,
  modules: Set<number>,
) {
  if ("source" in entry) {
    addAssetModule(modules, entry.source);
  }
}

/** Static catalog thumbnails and the native startup rig. Scene models load on demand. */
export function collectGameAssetModules(): number[] {
  const modules = new Set<number>();

  for (const entry of Object.values(CAT_DECORATION_CATALOG)) {
    collectFromDecorationEntry(entry, modules);
  }

  for (const source of Object.values(CAT_ROOM_SOURCES)) {
    addAssetModule(modules, source);
  }

  for (const source of Object.values(CAT_BED_SOURCES)) {
    addAssetModule(modules, source);
  }

  for (const source of Object.values(CAT_TOY_SOURCES)) {
    addAssetModule(modules, source);
  }

  for (const source of Object.values(CAT_SKIN_PREVIEWS)) addAssetModule(modules, source);

  addAssetModule(modules, nativeCatSource);

  return [...modules];
}

async function prefetchAssetModule(moduleId: number, memory: boolean): Promise<boolean> {
  try {
    const asset = Asset.fromModule(moduleId);
    if (!asset.downloaded) {
      await asset.downloadAsync();
    }

    if (asset.type === "glb") return true;
    // Resolve the same URI that Expo Image receives for a numeric source.
    // The downloaded file and the display source can otherwise use different keys.
    const uri = NativeImage.resolveAssetSource(moduleId)?.uri ?? asset.localUri ?? asset.uri;
    if (uri) {
      return await ExpoImage.prefetch(uri, memory ? "memory-disk" : "disk");
    }

  } catch {
    // Best-effort — one missing asset should not block the app.
  }
  return false;
}

export type AssetPrefetchProgress = { completed: number; total: number; failed: number };

/** Warm the image cache while the splash screen is visible. */
export async function prefetchGameAssets(onProgress?: (progress: AssetPrefetchProgress) => void): Promise<void> {
  const moduleIds = collectGameAssetModules();
  let remainingPixels = MEMORY_PIXEL_BUDGET;
  const memoryModules = new Set(moduleIds.filter(id => {
    try {
      const asset = Asset.fromModule(id);
      const pixels = (asset.width ?? 0) * (asset.height ?? 0);
      if (!pixels || pixels > MAX_MEMORY_IMAGE_PIXELS || pixels > remainingPixels) return false;
      remainingPixels -= pixels;
      return true;
    } catch { return false; }
  }));
  let completed = 0;
  let failed = 0;
  onProgress?.({ completed, failed, total: moduleIds.length });

  for (let index = 0; index < moduleIds.length; index += PREFETCH_BATCH_SIZE) {
    const batch = moduleIds.slice(index, index + PREFETCH_BATCH_SIZE);
    await Promise.all(batch.map(async moduleId => {
      if (!await prefetchAssetModule(moduleId, memoryModules.has(moduleId))) failed++;
      completed++;
      onProgress?.({ completed, failed, total: moduleIds.length });
    }));
  }
}
