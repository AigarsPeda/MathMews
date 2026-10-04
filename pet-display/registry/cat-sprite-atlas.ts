import { CAT_SPRITE_CATALOG, type CatSpriteAnimationId } from "@/constants/cat-sprite-catalog";
import { CAT_3D_ANIMATION_PAGES, CAT_SPRITE_PAGE_LAYOUT, CAT_ROOM_MOTION_PAGE_LAYOUT } from "@/constants/cat-3d-animation-pages";
import { resolveCatSkinId, type CatSkinId } from "@/constants/cat-skins";
import type { SpriteSheetConfig } from "@/pet-display/types";
import { CAT_PLAY_PROP_PAGES, CAT_PLAY_PROP_GROUND } from "@/constants/cat-play-prop-pages";

const cache = new Map<CatSkinId, Record<CatSpriteAnimationId, SpriteSheetConfig>>();
export function getCatSpriteAnimations(skinId: CatSkinId | string | undefined) {
  const skin = resolveCatSkinId(skinId);
  const cached = cache.get(skin);
  if (cached) return cached;
  const animations = {} as Record<CatSpriteAnimationId, SpriteSheetConfig>;
  for (const id of Object.keys(CAT_SPRITE_CATALOG) as CatSpriteAnimationId[]) {
    const { frameCount, fps } = CAT_SPRITE_CATALOG[id];
    const layout = id.startsWith("walk") || id.startsWith("jump") ? CAT_ROOM_MOTION_PAGE_LAYOUT : CAT_SPRITE_PAGE_LAYOUT;
    animations[id] = {
      source: CAT_3D_ANIMATION_PAGES[skin][id][0],
      pages: CAT_3D_ANIMATION_PAGES[skin][id],
      framesPerPage: layout.framesPerPage,
      frameWidth: layout.frameSize, frameHeight: layout.frameSize,
      sheetWidth: layout.frameSize * layout.columns, sheetHeight: layout.frameSize * Math.ceil(layout.framesPerPage / layout.columns),
      frames: Array.from({ length: frameCount }, (_, i) => ({ col: i % layout.columns, row: Math.floor((i % layout.framesPerPage) / layout.columns) })),
      fps, anchor: "bottom-center",
      ...((id === "ballToss" || id === "yarnRoll" || id === "featherChase")
        ? { playProp: { pages: CAT_PLAY_PROP_PAGES[skin][id], groundY: CAT_PLAY_PROP_GROUND[id] } } : {}),
    };
  }
  cache.set(skin, animations);
  return animations;
}
export const CAT_SPRITE_ANIMATIONS = getCatSpriteAnimations("orange");
export type { CatSpriteAnimationId };
