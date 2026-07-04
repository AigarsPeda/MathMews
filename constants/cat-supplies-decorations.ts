type SheetDecorationCatalogEntry = {
  frame: { x: number; y: number; w: number; h: number };
  displaySize: number;
};

/** Cat trees, bowls, toys, and food — dedicated store tab (sprite sheet). */
export const CAT_SUPPLIES_DECORATION_CATALOG = {
  catTreeTan: { frame: { x: 582, y: 16, w: 85, h: 175 }, displaySize: 64 },
  catTreeBlue: { frame: { x: 681, y: 16, w: 85, h: 175 }, displaySize: 64 },
  catTreePink: { frame: { x: 771, y: 15, w: 85, h: 175 }, displaySize: 64 },
  portraitCat: { frame: { x: 132, y: 193, w: 23, h: 29 }, displaySize: 30 },
  bowlTan: { frame: { x: 332, y: 438, w: 43, h: 37 }, displaySize: 24 },
  bowlBlue: { frame: { x: 267, y: 438, w: 43, h: 37 }, displaySize: 24 },
  bowlPurple: { frame: { x: 396, y: 438, w: 43, h: 37 }, displaySize: 24 },
  bowlPink: { frame: { x: 461, y: 438, w: 43, h: 37 }, displaySize: 24 },
  yarnRed: { frame: { x: 551, y: 614, w: 18, h: 18 }, displaySize: 20 },
  yarnBlue: { frame: { x: 582, y: 614, w: 18, h: 18 }, displaySize: 20 },
  foodBag: { frame: { x: 14, y: 289, w: 100, h: 128 }, displaySize: 50 },
} as const satisfies Record<string, SheetDecorationCatalogEntry>;

export type CatSuppliesDecorationId = keyof typeof CAT_SUPPLIES_DECORATION_CATALOG;

export const CAT_SUPPLIES_DECORATION_IDS = Object.keys(
  CAT_SUPPLIES_DECORATION_CATALOG,
) as CatSuppliesDecorationId[];

const CAT_SUPPLIES_DECORATION_ID_SET = new Set<string>(
  CAT_SUPPLIES_DECORATION_IDS,
);

export function isCatSuppliesDecorationId(
  decorationId: string,
): decorationId is CatSuppliesDecorationId {
  return CAT_SUPPLIES_DECORATION_ID_SET.has(decorationId);
}
