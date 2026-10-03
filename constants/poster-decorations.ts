type ImageEntry = {
  source: number;
  displaySize: number;
};

/** Poster pack — shown in the dedicated store tab. */
export const POSTER_DECORATION_CATALOG = {
  poster1: { source: require("@/assets/3d/decoration/poster1.png"), displaySize: 40 },
  poster2: { source: require("@/assets/3d/decoration/poster2.png"), displaySize: 40 },
  poster3: { source: require("@/assets/3d/decoration/poster3.png"), displaySize: 40 },
  poster4: { source: require("@/assets/3d/decoration/poster4.png"), displaySize: 52 },
  poster5: { source: require("@/assets/3d/decoration/poster5.png"), displaySize: 40 },
  poster16: { source: require("@/assets/3d/decoration/poster16.png"), displaySize: 40 },
  poster17: { source: require("@/assets/3d/decoration/poster17.png"), displaySize: 40 },
  posterMap: { source: require("@/assets/3d/decoration/posterMap.png"), displaySize: 40 },
  posterFire: { source: require("@/assets/3d/decoration/posterFire.png"), displaySize: 28 },
  posterMedical: { source: require("@/assets/3d/decoration/posterMedical.png"), displaySize: 28 },
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
