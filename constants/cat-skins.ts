/** Cat color variants — one 512×640 sprite sheet per skin. */
export const CAT_SKIN_IDS = ["orange", "grey", "white"] as const;

export type CatSkinId = (typeof CAT_SKIN_IDS)[number];

export const DEFAULT_CAT_SKIN_ID: CatSkinId = "orange";

/** Shared layout for `assets/pets/Cat/CatPackDifferentSkins/*.png`. */
export const CAT_SKIN_SHEET = {
  width: 512,
  height: 640,
  frameSize: 32,
  cols: 16,
  rows: 20,
} as const;

export const CAT_SKIN_SOURCES: Record<CatSkinId, number> = {
  orange: require("@/assets/pets/Cat/CatPackDifferentSkins/OrangeCat.png"),
  grey: require("@/assets/pets/Cat/CatPackDifferentSkins/Grey.png"),
  white: require("@/assets/pets/Cat/CatPackDifferentSkins/WhiteCat.png"),
};

export function isCatSkinId(value: string): value is CatSkinId {
  return (CAT_SKIN_IDS as readonly string[]).includes(value);
}

export function resolveCatSkinId(value: string | undefined): CatSkinId {
  if (value && isCatSkinId(value)) {
    return value;
  }
  return DEFAULT_CAT_SKIN_ID;
}
