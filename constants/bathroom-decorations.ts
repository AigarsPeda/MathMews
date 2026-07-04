import {
  BATHROOM_BATH_FRAMES,
  BATHROOM_WC_FRAMES,
  BATHROOM_WC_FURNITURE_DRAWERS_FRAMES,
  BATHROOM_WC_TAP_FRAMES,
} from "@/constants/bathroom-animation-frames";

type ImageEntry = { source: number; displaySize: number; };

type AnimatedEntry = {
  frames: readonly number[];
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  displaySize: number;
};

/** Bathroom pack — shown in the dedicated store tab. */
export const BATHROOM_DECORATION_CATALOG = {
  bathroomBathCarpet: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/bath-carpet.png"),
    displaySize: 48,
  },
  bathroomBathWindow: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/bath-window.png"),
    displaySize: 48,
  },
  bathroomDuck: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/duck.png"),
    displaySize: 16,
  },
  bathroomHanger: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/hanger.png"),
    displaySize: 26,
  },
  bathroomHangingTowel: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/hanging-towel.png"),
    displaySize: 48,
  },
  bathroomLongShelf: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/long-shelf.png"),
    displaySize: 48,
  },
  bathroomMirror: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/mirror.png"),
    displaySize: 48,
  },
  bathroomShowerBin: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/shower-bin.png"),
    displaySize: 26,
  },
  bathroomShowerFloor: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/shower-floor.png"),
    displaySize: 48,
  },
  bathroomShowerTap: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/shower-tap.png"),
    displaySize: 64,
  },
  bathroomShowerTray: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/shower-tray.png"),
    displaySize: 48,
  },
  bathroomSmallShelf: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/small-shelf.png"),
    displaySize: 48,
  },
  bathroomSoapGreen: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/soap-green.png"),
    displaySize: 26,
  },
  bathroomSoapRed: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/soap-red.png"),
    displaySize: 26,
  },
  bathroomSoapYellow: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/soap-yellow.png"),
    displaySize: 26,
  },
  bathroomTapShower: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/tap-shower.png"),
    displaySize: 48,
  },
  bathroomTapWall: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/tap-wall.png"),
    displaySize: 26,
  },
  bathroomTissues: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/tissues.png"),
    displaySize: 26,
  },
  bathroomToiletPaper: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/toilet-paper.png"),
    displaySize: 26,
  },
  bathroomTowelBlue: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/towel-blue.png"),
    displaySize: 26,
  },
  bathroomTowelGreen: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/towel-green.png"),
    displaySize: 26,
  },
  bathroomTowelRed: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/towel-red.png"),
    displaySize: 26,
  },
  bathroomWcFurniture: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Bathroom/wc-furniture.png"),
    displaySize: 64,
  },
  bathroomBathAni: {
    frames: BATHROOM_BATH_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 64,
  },
  bathroomWcAni: {
    frames: BATHROOM_WC_FRAMES,
    frameWidth: 64,
    frameHeight: 64,
    fps: 6,
    displaySize: 48,
  },
  bathroomWcFurnitureDrawersAni: {
    frames: BATHROOM_WC_FURNITURE_DRAWERS_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 64,
  },
  bathroomWcTapAni: {
    frames: BATHROOM_WC_TAP_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 64,
  },
} as const satisfies Record<string, ImageEntry | AnimatedEntry>;

export type BathroomDecorationId = keyof typeof BATHROOM_DECORATION_CATALOG;

export const BATHROOM_DECORATION_IDS = Object.keys(
  BATHROOM_DECORATION_CATALOG,
) as BathroomDecorationId[];

const BATHROOM_DECORATION_ID_SET = new Set<string>(BATHROOM_DECORATION_IDS);

export function isBathroomDecorationId(
  decorationId: string,
): decorationId is BathroomDecorationId {
  return BATHROOM_DECORATION_ID_SET.has(decorationId);
}