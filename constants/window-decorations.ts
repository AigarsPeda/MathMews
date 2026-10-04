type ImageEntry = {
  source: number;
  displaySize: number;
};

type SheetEntry = {
  frame: { x: number; y: number; w: number; h: number };
  displaySize: number;
};

/** Windows pack — shown in the dedicated store tab. */
export const WINDOW_DECORATION_CATALOG = {
  windowPlain: { source: require("@/assets/3d/decoration/windowPlain.png"), displaySize: 58 },
  windowBlinds: { source: require("@/assets/3d/decoration/windowBlinds.png"), displaySize: 58 },
  window7A: { source: require("@/assets/3d/decoration/window7A.png"), displaySize: 56 },
  window7B: { source: require("@/assets/3d/decoration/window7B.png"), displaySize: 56 },
  window7C: { source: require("@/assets/3d/decoration/window7C.png"), displaySize: 56 },
  window8A: { source: require("@/assets/3d/decoration/window8A.png"), displaySize: 56 },
  window8B: { source: require("@/assets/3d/decoration/window8B.png"), displaySize: 56 },
  window8C: { source: require("@/assets/3d/decoration/window8C.png"), displaySize: 56 },
  window11A: { source: require("@/assets/3d/decoration/window11A.png"), displaySize: 56 },
  window11B: { source: require("@/assets/3d/decoration/window11B.png"), displaySize: 56 },
  window11C: { source: require("@/assets/3d/decoration/window11C.png"), displaySize: 56 },
  windowJapaneseL: { source: require("@/assets/3d/decoration/windowJapaneseL.png"), displaySize: 56 },
  windowJapaneseR: { source: require("@/assets/3d/decoration/windowJapaneseR.png"), displaySize: 56 },
} as const satisfies Record<string, ImageEntry | SheetEntry>;

export type WindowDecorationId = keyof typeof WINDOW_DECORATION_CATALOG;

export const WINDOW_DECORATION_IDS = Object.keys(
  WINDOW_DECORATION_CATALOG,
) as WindowDecorationId[];

const WINDOW_DECORATION_ID_SET = new Set<string>(WINDOW_DECORATION_IDS);

export function isWindowDecorationId(
  decorationId: string,
): decorationId is WindowDecorationId {
  return WINDOW_DECORATION_ID_SET.has(decorationId);
}
