import {
  CAT_DECORATION_CATALOG,
  type DecorationCatalogEntry,
} from "@/constants/cat-decorations";
import { CAT_BED_SOURCES } from "@/constants/cat-beds";
import { CAT_ROOM_SOURCES } from "@/constants/cat-rooms";
import { CAT_SPLASH_SOURCE } from "@/constants/cat-splash";
import {
  CAT_TOY_SOURCES,
} from "@/constants/cat-toys";
import { Asset } from "expo-asset";
import { Image as ExpoImage } from "expo-image";
import { Platform } from "react-native";

const PREFETCH_BATCH_SIZE = Platform.OS === "android" ? 16 : 24;

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

/** All bundled room / store sprites used by the cat home screen. */
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

  addAssetModule(modules, CAT_SPLASH_SOURCE);

  return [...modules];
}

async function prefetchAssetModule(moduleId: number): Promise<boolean> {
  try {
    const asset = Asset.fromModule(moduleId);
    if (!asset.downloaded) {
      await asset.downloadAsync();
    }

    const uri = asset.localUri ?? asset.uri;
    if (uri) {
      return await ExpoImage.prefetch(uri, "disk");
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
  let completed = 0;
  let failed = 0;
  onProgress?.({ completed, failed, total: moduleIds.length });

  for (let index = 0; index < moduleIds.length; index += PREFETCH_BATCH_SIZE) {
    const batch = moduleIds.slice(index, index + PREFETCH_BATCH_SIZE);
    await Promise.all(batch.map(async moduleId => {
      if (!await prefetchAssetModule(moduleId)) failed++;
      completed++;
      onProgress?.({ completed, failed, total: moduleIds.length });
    }));
  }
}
