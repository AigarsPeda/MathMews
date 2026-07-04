/** Cat pet beds — `assets/pets/Cat/CatItems/Beds/`. */
const CAT_PET_BED_SOURCES = {
  brown: require("@/assets/pets/Cat/CatItems/Beds/CatBedBrown.png"),
  green: require("@/assets/pets/Cat/CatItems/Beds/CatBedGreen.png"),
  blue: require("@/assets/pets/Cat/CatItems/Beds/CatBedBlue.png"),
  red: require("@/assets/pets/Cat/CatItems/Beds/CatBedRed.png"),
  pink: require("@/assets/pets/Cat/CatItems/Beds/CatBedPink.png"),
  purple: require("@/assets/pets/Cat/CatItems/Beds/CatBedPurple.png"),
} as const;

/** Human-scale room beds — Tiny House pack (`assets/.../Beds/Human/`). */
const HUMAN_BED_SOURCES = {
  houseA: require("@/assets/pets/Cat/CatItems/Beds/Human/bed-a.png"),
  houseB: require("@/assets/pets/Cat/CatItems/Beds/Human/bed-b.png"),
  houseC: require("@/assets/pets/Cat/CatItems/Beds/Human/bed-c.png"),
  houseD: require("@/assets/pets/Cat/CatItems/Beds/Human/bed-d.png"),
  houseE: require("@/assets/pets/Cat/CatItems/Beds/Human/bed-e.png"),
  houseF: require("@/assets/pets/Cat/CatItems/Beds/Human/bed-f.png"),
  houseG: require("@/assets/pets/Cat/CatItems/Beds/Human/bed-g.png"),
} as const;

export const CAT_BED_SOURCES = {
  ...CAT_PET_BED_SOURCES,
  ...HUMAN_BED_SOURCES,
} as const;

export type CatPetBedId = keyof typeof CAT_PET_BED_SOURCES;
export type HumanBedId = keyof typeof HUMAN_BED_SOURCES;
export type CatBedId = keyof typeof CAT_BED_SOURCES;

export const CAT_PET_BED_IDS = Object.keys(CAT_PET_BED_SOURCES) as CatPetBedId[];
export const HUMAN_BED_IDS = Object.keys(HUMAN_BED_SOURCES) as HumanBedId[];
export const CAT_BED_IDS = Object.keys(CAT_BED_SOURCES) as CatBedId[];

const HUMAN_BED_ID_SET = new Set<string>(HUMAN_BED_IDS);

export function isHumanBedId(bedId: string): bedId is HumanBedId {
  return HUMAN_BED_ID_SET.has(bedId);
}

export function isCatBedId(value: string): value is CatBedId {
  return value in CAT_BED_SOURCES;
}

export function resolveCatBedId(bedId: string | undefined): CatBedId | undefined {
  if (bedId && bedId in CAT_BED_SOURCES) {
    return bedId as CatBedId;
  }
  return undefined;
}

export function getCatBedSource(bedId: string | undefined): number | undefined {
  const resolved = resolveCatBedId(bedId);
  return resolved ? CAT_BED_SOURCES[resolved] : undefined;
}

/** Room display size — human beds are 128px sprites vs 64px cat beds. */
export function getBedDisplaySize(bedId: string | undefined): number {
  return isHumanBedId(bedId ?? "") ? 112 : 72;
}
