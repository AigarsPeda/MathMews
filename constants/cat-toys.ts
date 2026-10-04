/** Cat toy items — animated balls and mouse, with larger scratching posts. */
import { clampDecorationScale } from "@/constants/decoration-variants";
import type { PlacedToy } from "@/types/game";

const CAT_SMALL_TOY_SOURCES = {
  orangeBall: require("@/assets/3d/atlases/toy-orangeBall.png"),
  blueBall: require("@/assets/3d/atlases/toy-blueBall.png"),
  pinkBall: require("@/assets/3d/atlases/toy-pinkBall.png"),
  mouse: require("@/assets/3d/atlases/toy-mouse.png"),
} as const;

export const CAT_LARGE_TOY_FRAMES = {
  scratchPostGreen: { col: 0, row: 0 },
  scratchPostBlue: { col: 1, row: 0 },
  scratchPostPurple: { col: 0, row: 1 },
  scratchPostRed: { col: 1, row: 1 },
} as const;

export const CAT_TOY_SOURCES = {
  ...CAT_SMALL_TOY_SOURCES,
  scratchPostGreen: require("@/assets/3d/toy/toy-scratchPostGreen.png"),
  scratchPostBlue: require("@/assets/3d/toy/toy-scratchPostBlue.png"),
  scratchPostPurple: require("@/assets/3d/toy/toy-scratchPostPurple.png"),
  scratchPostRed: require("@/assets/3d/toy/toy-scratchPostRed.png"),
} as const;

export type CatSmallToyId = keyof typeof CAT_SMALL_TOY_SOURCES;
export type CatLargeToyId = keyof typeof CAT_LARGE_TOY_FRAMES;
export type CatToyId = CatSmallToyId | CatLargeToyId;

export const CAT_SMALL_TOY_IDS = Object.keys(CAT_SMALL_TOY_SOURCES) as CatSmallToyId[];
export const CAT_LARGE_TOY_IDS = Object.keys(CAT_LARGE_TOY_FRAMES) as CatLargeToyId[];
export const CAT_TOY_IDS = [...CAT_SMALL_TOY_IDS, ...CAT_LARGE_TOY_IDS] as CatToyId[];

/** Logical room display size before `moderateScale`. */
export const CAT_TOY_DISPLAY_SIZES: Record<CatToyId, number> = {
  orangeBall: 22,
  blueBall: 22,
  pinkBall: 22,
  mouse: 30,
  scratchPostGreen: 48,
  scratchPostBlue: 48,
  scratchPostPurple: 48,
  scratchPostRed: 48,
};

export function isCatToyId(value: string): value is CatToyId {
  return value in CAT_TOY_SOURCES || value in CAT_LARGE_TOY_FRAMES;
}

export function isLargeToyId(value: string): value is CatLargeToyId {
  return value in CAT_LARGE_TOY_FRAMES;
}

export function resolveCatToyId(toyId: string | undefined): CatToyId | undefined {
  if (toyId && isCatToyId(toyId)) {
    return toyId;
  }
  return undefined;
}

export function getLargeToyFrame(
  toyId: string | undefined,
): { col: number; row: number } | undefined {
  const resolved = resolveCatToyId(toyId);
  if (!resolved || !isLargeToyId(resolved)) {
    return undefined;
  }
  return CAT_LARGE_TOY_FRAMES[resolved];
}

export function getCatToySource(toyId: string | undefined): number | undefined {
  const resolved = resolveCatToyId(toyId);
  if (!resolved) {
    return undefined;
  }
  return CAT_TOY_SOURCES[resolved];
}

export function getToyDisplaySize(toyId: string | undefined): number {
  const resolved = resolveCatToyId(toyId);
  return resolved ? CAT_TOY_DISPLAY_SIZES[resolved] : 22;
}

export function getPlacedToyScale(placed: PlacedToy): number {
  return typeof placed.scale === "number" && Number.isFinite(placed.scale)
    ? clampDecorationScale(placed.scale) : 1;
}

export function getPlacedToyDisplaySize(placed: PlacedToy): number {
  return getToyDisplaySize(placed.toyId) * getPlacedToyScale(placed);
}

/** Slightly larger than room size so store cards stay readable without filling the tile. */
export function getToyStorePreviewSize(toyId: string | undefined): number {
  return Math.round(getToyDisplaySize(toyId) * 1.35);
}
