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
  windowPlain: {
    frame: { x: 864, y: 3, w: 64, h: 123 },
    displaySize: 58,
  },
  windowBlinds: {
    frame: { x: 928, y: 4, w: 64, h: 123 },
    displaySize: 58,
  },
  windowCurtains: {
    frame: { x: 140, y: 299, w: 45, h: 108 },
    displaySize: 52,
  },
  window7A: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-7a.png"),
    displaySize: 56,
  },
  window7B: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-7b.png"),
    displaySize: 56,
  },
  window7C: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-7c.png"),
    displaySize: 56,
  },
  window8A: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-8a.png"),
    displaySize: 56,
  },
  window8B: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-8b.png"),
    displaySize: 56,
  },
  window8C: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-8c.png"),
    displaySize: 56,
  },
  window11A: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-11a.png"),
    displaySize: 56,
  },
  window11B: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-11b.png"),
    displaySize: 56,
  },
  window11C: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-11c.png"),
    displaySize: 56,
  },
  windowJapaneseL: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-japanese-l.png"),
    displaySize: 56,
  },
  windowJapaneseR: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Windows/window-japanese-r.png"),
    displaySize: 56,
  },
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
