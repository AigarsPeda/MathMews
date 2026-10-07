import { clampDecorationScale } from "@/constants/decoration-variants";
/** Original Blender renders. */
const CAT_PET_BED_SOURCES = {
  brown: require("@/assets/3d/bed/bed-brown.png"),
  green: require("@/assets/3d/bed/bed-green.png"),
  blue: require("@/assets/3d/bed/bed-blue.png"),
  red: require("@/assets/3d/bed/bed-red.png"),
  pink: require("@/assets/3d/bed/bed-pink.png"),
  purple: require("@/assets/3d/bed/bed-purple.png"),
} as const;

/** Human-scale beds, rendered from the Blender models. */
const HUMAN_BED_SOURCES = {
  houseA: require("@/assets/3d/bed/bed-houseA.png"),
  houseB: require("@/assets/3d/bed/bed-houseB.png"),
  houseC: require("@/assets/3d/bed/bed-houseC.png"),
  houseD: require("@/assets/3d/bed/bed-houseD.png"),
  houseE: require("@/assets/3d/bed/bed-houseE.png"),
  houseF: require("@/assets/3d/bed/bed-houseF.png"),
  houseG: require("@/assets/3d/bed/bed-houseG.png"),
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


/** Human-scale beds can be mirrored in the room (isometric wall flip). */
export function canFlipBed(bedId: string | undefined): boolean {
  return isHumanBedId(bedId ?? "");
}

export {
  clampDecorationScale as clampBedScale,
  canScaleDecorationDown as canScaleBedDown,
  canScaleDecorationUp as canScaleBedUp,
  scaleDecorationBy as scaleBedBy,
} from "@/constants/decoration-variants";

export const DEFAULT_BED_SCALE = 1.3;

export function getEquippedBedScale(scale: number | undefined): number {
  if (typeof scale !== "number" || !Number.isFinite(scale)) {
    return DEFAULT_BED_SCALE;
  }

  return clampDecorationScale(scale);
}
