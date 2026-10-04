

type ImageEntry = {
  source: number;
  displaySize: number;
};

type AnimatedEntry = { source: number; sheetWidth: number; sheetHeight: number; frameWidth: number; frameHeight: number; frameCount: number; fps?: number; displaySize: number };

/** Television pack — shown in the dedicated store tab. */
export const TV_DECORATION_CATALOG = {
  tvBigOff: { source: require("@/assets/3d/decoration/tvBigOff.png"), displaySize: 56 },
  tvBigAniA: { source: require("@/assets/3d/atlases/tvBigAniA.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 56 },
  tvBigAniB: { source: require("@/assets/3d/atlases/tvBigAniB.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 56 },
  tvDvdAni: { source: require("@/assets/3d/atlases/tvDvdAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 56 },
} as const satisfies Record<string, ImageEntry | AnimatedEntry>;

export type TvDecorationId = keyof typeof TV_DECORATION_CATALOG;

export const TV_DECORATION_IDS = Object.keys(
  TV_DECORATION_CATALOG,
) as TvDecorationId[];

const TV_DECORATION_ID_SET = new Set<string>(TV_DECORATION_IDS);

export function isTvDecorationId(
  decorationId: string,
): decorationId is TvDecorationId {
  return TV_DECORATION_ID_SET.has(decorationId);
}
