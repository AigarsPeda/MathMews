/** Cat color variants — separate Blender animation textures per coat. */
export const CAT_SKIN_IDS = ["orange", "grey", "white"] as const;

export type CatSkinId = (typeof CAT_SKIN_IDS)[number];

export const DEFAULT_CAT_SKIN_ID: CatSkinId = "orange";

export function isCatSkinId(value: string): value is CatSkinId {
  return (CAT_SKIN_IDS as readonly string[]).includes(value);
}

export function resolveCatSkinId(value: string | undefined): CatSkinId {
  if (value && isCatSkinId(value)) {
    return value;
  }
  return DEFAULT_CAT_SKIN_ID;
}
