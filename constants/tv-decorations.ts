import {
  BIG_TV_A_ANIM_FRAMES,
  BIG_TV_B_ANIM_FRAMES,
  TV_DVD_ANIM_FRAMES,
} from "@/constants/tv-animation-frames";

type ImageEntry = {
  source: number;
  displaySize: number;
};

type AnimatedEntry = {
  frames: readonly number[];
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  displaySize: number;
};

/** Television pack — shown in the dedicated store tab. */
export const TV_DECORATION_CATALOG = {
  tvBigOff: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/TVs/big-tv-off.png"),
    displaySize: 56,
  },
  tvBigAniA: {
    frames: BIG_TV_A_ANIM_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 6,
    displaySize: 56,
  },
  tvBigAniB: {
    frames: BIG_TV_B_ANIM_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 6,
    displaySize: 56,
  },
  tvDvdAni: {
    frames: TV_DVD_ANIM_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 56,
  },
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
