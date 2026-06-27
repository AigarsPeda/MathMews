/** Room decorations — frames from `CatRoomDecorations.png` (1024×1024). */
export const CAT_DECORATION_SHEET = require("@/assets/pets/Cat/CatItems/Decorations/CatRoomDecorations.png");
export const CAT_DECORATION_SHEET_SIZE = 1024;

export type DecorationFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type DecorationCatalogEntry = {
  frame: DecorationFrame;
  /** Max display dimension in the room before `moderateScale`. */
  displaySize: number;
};

export const CAT_DECORATION_CATALOG = {
  shelfWood: { frame: { x: 191, y: 17, w: 64, h: 110 }, displaySize: 52 },
  shelfBlue: { frame: { x: 287, y: 16, w: 64, h: 110 }, displaySize: 52 },
  shelfGreen: { frame: { x: 383, y: 16, w: 64, h: 110 }, displaySize: 52 },
  tableTan: { frame: { x: 202, y: 138, w: 110, h: 82 }, displaySize: 40 },
  tablePink: { frame: { x: 329, y: 138, w: 110, h: 82 }, displaySize: 40 },
  tableBlue: { frame: { x: 202, y: 236, w: 110, h: 82 }, displaySize: 40 },
  tablePurple: { frame: { x: 329, y: 236, w: 110, h: 82 }, displaySize: 40 },
  bowlBlue: { frame: { x: 267, y: 438, w: 43, h: 37 }, displaySize: 24 },
  bowlTan: { frame: { x: 332, y: 438, w: 43, h: 37 }, displaySize: 24 },
  bowlPurple: { frame: { x: 396, y: 438, w: 43, h: 37 }, displaySize: 24 },
  bowlPink: { frame: { x: 461, y: 438, w: 43, h: 37 }, displaySize: 24 },
  plantTallGreen: { frame: { x: 679, y: 484, w: 55, h: 92 }, displaySize: 44 },
  plantTallPink: { frame: { x: 741, y: 484, w: 55, h: 92 }, displaySize: 44 },
  plantTallBlue: { frame: { x: 805, y: 484, w: 55, h: 92 }, displaySize: 44 },
  plantTallPurple: { frame: { x: 869, y: 484, w: 55, h: 92 }, displaySize: 44 },
  windowPlain: { frame: { x: 864, y: 3, w: 64, h: 123 }, displaySize: 58 },
  windowBlinds: { frame: { x: 928, y: 4, w: 64, h: 123 }, displaySize: 58 },
  windowCurtains: { frame: { x: 140, y: 299, w: 45, h: 108 }, displaySize: 52 },
  catTreeTan: { frame: { x: 582, y: 16, w: 85, h: 175 }, displaySize: 64 },
  catTreeBlue: { frame: { x: 681, y: 16, w: 85, h: 175 }, displaySize: 64 },
  catTreePink: { frame: { x: 771, y: 15, w: 85, h: 175 }, displaySize: 64 },
  portraitCat: { frame: { x: 132, y: 193, w: 23, h: 29 }, displaySize: 30 },
  yarnRed: { frame: { x: 551, y: 614, w: 18, h: 18 }, displaySize: 20 },
  yarnBlue: { frame: { x: 582, y: 614, w: 18, h: 18 }, displaySize: 20 },
  foodBag: { frame: { x: 14, y: 289, w: 100, h: 128 }, displaySize: 50 },
} as const satisfies Record<string, DecorationCatalogEntry>;

export type CatDecorationId = keyof typeof CAT_DECORATION_CATALOG;

export const CAT_DECORATION_IDS = Object.keys(
  CAT_DECORATION_CATALOG,
) as CatDecorationId[];

export function isCatDecorationId(value: string): value is CatDecorationId {
  return value in CAT_DECORATION_CATALOG;
}

export function resolveCatDecorationId(
  decorationId: string | undefined,
): CatDecorationId | undefined {
  if (decorationId && isCatDecorationId(decorationId)) {
    return decorationId;
  }
  return undefined;
}

export function getDecorationCatalogEntry(
  decorationId: string | undefined,
): DecorationCatalogEntry | undefined {
  const resolved = resolveCatDecorationId(decorationId);
  return resolved ? CAT_DECORATION_CATALOG[resolved] : undefined;
}

export function getDecorationDisplaySize(decorationId: string | undefined): number {
  const entry = getDecorationCatalogEntry(decorationId);
  return entry?.displaySize ?? 40;
}

/** Max dimension for store card previews. */
export function getDecorationStorePreviewSize(
  decorationId: string | undefined,
): number {
  return Math.round(getDecorationDisplaySize(decorationId) * 1.35);
}

/** Drag hit-box size — square large enough to cover the sprite. */
export function getDecorationDragSize(decorationId: string | undefined): number {
  return getDecorationDisplaySize(decorationId);
}
