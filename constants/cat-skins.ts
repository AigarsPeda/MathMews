/** Cat color variants — separate Blender animation textures per coat. */
export const CAT_SKIN_IDS = ["orange", "grey", "white"] as const;

export type CatSkinId = (typeof CAT_SKIN_IDS)[number];

export const DEFAULT_CAT_SKIN_ID: CatSkinId = "orange";

/** Original Blender renders. */
export const CAT_SKIN_SHEET = {
  width: 1536,
  height: 2304,
  frameSize: 192,
  cols: 8,
  rows: 12,
} as const;

export const CAT_SKIN_SOURCES: Record<CatSkinId, number> = {
  orange: require("@/assets/3d/atlases/cat-orange-idle.png"),
  grey: require("@/assets/3d/atlases/cat-grey-idle.png"),
  white: require("@/assets/3d/atlases/cat-white-idle.png"),
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
