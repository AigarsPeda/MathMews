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
  plantSmall: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Plants/plant-small.png"),
    displaySize: 28,
  },
  plantA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Plants/plant-1.png"),
    displaySize: 28,
  },
  plantB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Plants/plant-2.png"),
    displaySize: 44,
  },
  plantE: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Plants/plant-5.png"),
    displaySize: 28,
  },
  plantCactusA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Plants/cactus-1.png"),
    displaySize: 28,
  },
  plantCactusB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Plants/cactus-2.png"),
    displaySize: 28,
  },
  plantSunflower: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Plants/sunflower.png"),
    displaySize: 44,
  },
  plantTallGreen: {
    frame: { x: 679, y: 484, w: 55, h: 92 },
    displaySize: 44,
  },
  plantTallPink: {
    frame: { x: 741, y: 484, w: 55, h: 92 },
    displaySize: 44,
  },
  plantTallBlue: {
    frame: { x: 805, y: 484, w: 55, h: 92 },
    displaySize: 44,
  },
  plantTallPurple: {
    frame: { x: 869, y: 484, w: 55, h: 92 },
    displaySize: 44,
  },
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
