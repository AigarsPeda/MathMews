type SheetDecorationCatalogEntry = {
  source: number;
  displaySize: number;
};

/** Cat trees, bowls, toys, and food — dedicated store tab (Blender renders). */
export const CAT_SUPPLIES_DECORATION_CATALOG = {
  catTreeTan: { source: require("@/assets/3d/decoration/catTreeTan.png"), displaySize: 64 },
  catTreeBlue: { source: require("@/assets/3d/decoration/catTreeBlue.png"), displaySize: 64 },
  catTreePink: { source: require("@/assets/3d/decoration/catTreePink.png"), displaySize: 64 },
  portraitCat: { source: require("@/assets/3d/decoration/portraitCat.png"), displaySize: 30 },
  bowlTan: { source: require("@/assets/3d/decoration/bowlTan.png"), displaySize: 24 },
  bowlBlue: { source: require("@/assets/3d/decoration/bowlBlue.png"), displaySize: 24 },
  bowlPurple: { source: require("@/assets/3d/decoration/bowlPurple.png"), displaySize: 24 },
  bowlPink: { source: require("@/assets/3d/decoration/bowlPink.png"), displaySize: 24 },
  yarnRed: { source: require("@/assets/3d/decoration/yarnRed.png"), displaySize: 20 },
  yarnBlue: { source: require("@/assets/3d/decoration/yarnBlue.png"), displaySize: 20 },
  foodBag: { source: require("@/assets/3d/decoration/foodBag.png"), displaySize: 50 },
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
