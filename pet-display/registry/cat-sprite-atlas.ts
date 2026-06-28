import { CAT_SPRITE_FRAME_HEIGHT } from "@/constants/cat-sprites";
import {
  CAT_SPRITE_CATALOG,
  type CatSpriteAnimationId,
} from "@/constants/cat-sprite-catalog";
import {
  CAT_SKIN_SHEET,
  CAT_SKIN_SOURCES,
  resolveCatSkinId,
  type CatSkinId,
} from "@/constants/cat-skins";
import type { SpriteSheetConfig } from "@/pet-display/types";

function skinRowStrip(
  source: number,
  row: number,
  frameCount: number,
  fps: number,
  options: { reverse?: boolean } = {},
): SpriteSheetConfig {
  return {
    source,
    frameWidth: CAT_SPRITE_FRAME_HEIGHT,
    frameHeight: CAT_SPRITE_FRAME_HEIGHT,
    sheetWidth: CAT_SKIN_SHEET.width,
    sheetHeight: CAT_SKIN_SHEET.height,
    frames: Array.from({ length: frameCount }, (_, col) => ({ col, row })),
    fps,
    anchor: "bottom-center",
    reverse: options.reverse,
  };
}

function buildCatSpriteAnimations(skinId: CatSkinId) {
  const source = CAT_SKIN_SOURCES[skinId];
  const animations = {} as Record<CatSpriteAnimationId, SpriteSheetConfig>;

  for (const [id, entry] of Object.entries(CAT_SPRITE_CATALOG) as [
    CatSpriteAnimationId,
    (typeof CAT_SPRITE_CATALOG)[CatSpriteAnimationId],
  ][]) {
    animations[id] = skinRowStrip(
      source,
      entry.row,
      entry.frameCount,
      entry.fps,
    );
  }

  return animations;
}

const animationCache = new Map<CatSkinId, Record<string, SpriteSheetConfig>>();

export function getCatSpriteAnimations(
  skinId: CatSkinId | string | undefined,
): Record<CatSpriteAnimationId, SpriteSheetConfig> {
  const resolved = resolveCatSkinId(skinId);
  const cached = animationCache.get(resolved);
  if (cached) {
    return cached as Record<CatSpriteAnimationId, SpriteSheetConfig>;
  }

  const built = buildCatSpriteAnimations(resolved);
  animationCache.set(resolved, built);
  return built;
}

/** @deprecated Use `getCatSpriteAnimations(skinId)` — default orange skin. */
export const CAT_SPRITE_ANIMATIONS = getCatSpriteAnimations("orange");

export type { CatSpriteAnimationId };
