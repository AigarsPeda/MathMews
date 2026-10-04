type ImageEntry = {
  source: number;
  displaySize: number;
};

type SheetEntry = {
  frame: { x: number; y: number; w: number; h: number };
  displaySize: number;
};

/** Plants pack — shown in the dedicated store tab. */
export const PLANT_DECORATION_CATALOG = {
  plantSmall: { source: require("@/assets/3d/decoration/plantSmall.png"), displaySize: 28 },
  plantA: { source: require("@/assets/3d/decoration/plantA.png"), displaySize: 28 },
  plantB: { source: require("@/assets/3d/decoration/plantB.png"), displaySize: 44 },
  plantE: { source: require("@/assets/3d/decoration/plantE.png"), displaySize: 28 },
  plantCactusA: { source: require("@/assets/3d/decoration/plantCactusA.png"), displaySize: 28 },
  plantCactusB: { source: require("@/assets/3d/decoration/plantCactusB.png"), displaySize: 28 },
  plantSunflower: { source: require("@/assets/3d/decoration/plantSunflower.png"), displaySize: 44 },
  plantPotted: { source: require("@/assets/3d/decoration/plantPotted.png"), displaySize: 52 },
  plantTallGreen: { source: require("@/assets/3d/decoration/plantTallGreen.png"), displaySize: 44 },
  plantTallPink: { source: require("@/assets/3d/decoration/plantTallPink.png"), displaySize: 44 },
  plantTallBlue: { source: require("@/assets/3d/decoration/plantTallBlue.png"), displaySize: 44 },
  plantTallPurple: { source: require("@/assets/3d/decoration/plantTallPurple.png"), displaySize: 44 },
} as const satisfies Record<string, ImageEntry | SheetEntry>;

export type PlantDecorationId = keyof typeof PLANT_DECORATION_CATALOG;

export const PLANT_DECORATION_IDS = Object.keys(
  PLANT_DECORATION_CATALOG,
) as PlantDecorationId[];

const PLANT_DECORATION_ID_SET = new Set<string>(PLANT_DECORATION_IDS);

export function isPlantDecorationId(
  decorationId: string,
): decorationId is PlantDecorationId {
  return PLANT_DECORATION_ID_SET.has(decorationId);
}
