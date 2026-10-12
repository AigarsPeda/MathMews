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
  bowlTan: { source: require("@/assets/3d/decoration/bowlTan.png"), displaySize: 40 },
  bowlBlue: { source: require("@/assets/3d/decoration/bowlBlue.png"), displaySize: 40 },
  bowlPurple: { source: require("@/assets/3d/decoration/bowlPurple.png"), displaySize: 40 },
  bowlPink: { source: require("@/assets/3d/decoration/bowlPink.png"), displaySize: 40 },
  feedingTile: { source: require("@/assets/3d/decoration/feedingTile.png"), displaySize: 40 },
  feedingPebble: { source: require("@/assets/3d/decoration/feedingPebble.png"), displaySize: 40 },
  foodTrailTray: { source: require("@/assets/3d/decoration/foodTrailTray.png"), displaySize: 48 },
  kibbleDispenser: { source: require("@/assets/3d/decoration/kibbleDispenser.png"), displaySize: 40 },
  lickingPad: { source: require("@/assets/3d/decoration/lickingPad.png"), displaySize: 40 },
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

export function isFoodBowlDecorationId(decorationId: string): boolean {
  return ["bowlTan", "bowlBlue", "bowlPurple", "bowlPink"].includes(decorationId);
}

export const CAT_FEEDER_DECORATION_IDS = [
  "feedingTile", "feedingPebble", "foodTrailTray", "kibbleDispenser", "lickingPad",
] as const satisfies readonly CatSuppliesDecorationId[];

/** Every placed surface the cat can use for the Eat action. */
export function isCatFeederDecorationId(decorationId: string): boolean {
  return isFoodBowlDecorationId(decorationId)
    || CAT_FEEDER_DECORATION_IDS.some(id => id === decorationId);
}
