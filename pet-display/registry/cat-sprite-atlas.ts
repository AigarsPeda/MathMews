import { CAT_SPRITE_CATALOG, type CatSpriteAnimationId } from "@/constants/cat-sprite-catalog";
import { CAT_3D_ANIMATION_PAGES, CAT_SPRITE_PAGE_LAYOUT } from "@/constants/cat-3d-animation-pages";
import { resolveCatSkinId, type CatSkinId } from "@/constants/cat-skins";
import type { SpriteSheetConfig } from "@/pet-display/types";

const cache = new Map<CatSkinId, Record<CatSpriteAnimationId, SpriteSheetConfig>>();
export function getCatSpriteAnimations(skinId: CatSkinId | string | undefined) {
  const skin = resolveCatSkinId(skinId);
  const cached = cache.get(skin);
  if (cached) return cached;
  const animations = {} as Record<CatSpriteAnimationId, SpriteSheetConfig>;
  for (const id of Object.keys(CAT_SPRITE_CATALOG) as CatSpriteAnimationId[]) {
    const { frameCount, fps } = CAT_SPRITE_CATALOG[id];
    animations[id] = {
      source: CAT_3D_ANIMATION_PAGES[skin][id][0],
      pages: CAT_3D_ANIMATION_PAGES[skin][id],
      framesPerPage: CAT_SPRITE_PAGE_LAYOUT.framesPerPage,
      frameWidth: 768, frameHeight: 768,
      sheetWidth: 1536, sheetHeight: 1536,
      frames: Array.from({ length: frameCount }, (_, i) => ({ col: i % 2, row: Math.floor((i % 4) / 2) })),
      fps, anchor: "bottom-center",
    };
  }
  cache.set(skin, animations);
  return animations;
}
export const CAT_SPRITE_ANIMATIONS = getCatSpriteAnimations("orange");
export type { CatSpriteAnimationId };
