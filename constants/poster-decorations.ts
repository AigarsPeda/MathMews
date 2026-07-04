type ImageEntry = {
  source: number;
  displaySize: number;
};

/** Poster pack — shown in the dedicated store tab. */
export const POSTER_DECORATION_CATALOG = {
  poster1: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Posters/poster-1.png"),
    displaySize: 40,
  },
  poster2: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Posters/poster-2.png"),
    displaySize: 40,
  },
  poster3: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Posters/poster-3.png"),
    displaySize: 40,
  },
  poster4: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Posters/poster-4.png"),
    displaySize: 52,
  },
  poster5: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Posters/poster-5.png"),
    displaySize: 40,
  },
  poster16: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Posters/poster-16.png"),
    displaySize: 40,
  },
  poster17: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Posters/poster-17.png"),
    displaySize: 40,
  },
  posterMap: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Posters/poster-map.png"),
    displaySize: 40,
  },
  posterFire: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Posters/poster-fire.png"),
    displaySize: 28,
  },
  posterMedical: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Posters/poster-medical.png"),
    displaySize: 28,
  },
} as const satisfies Record<string, ImageEntry>;

export type PosterDecorationId = keyof typeof POSTER_DECORATION_CATALOG;

export const POSTER_DECORATION_IDS = Object.keys(
  POSTER_DECORATION_CATALOG,
) as PosterDecorationId[];

const POSTER_DECORATION_ID_SET = new Set<string>(POSTER_DECORATION_IDS);

export function isPosterDecorationId(
  decorationId: string,
): decorationId is PosterDecorationId {
  return POSTER_DECORATION_ID_SET.has(decorationId);
}
