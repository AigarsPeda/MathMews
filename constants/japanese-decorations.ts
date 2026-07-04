import {
  JAPANESE_DOOR_ANIM_FRAMES,
  JAPANESE_DOOR_SLIDING_FRAMES,
} from "@/constants/japanese-animation-frames";

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

/** Japanese room pack — shown in the dedicated store tab. */
export const JAPANESE_DECORATION_CATALOG = {
  japaneseBonsai: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/bonsai.png"),
    displaySize: 44,
  },
  japaneseCandle: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/candle.png"),
    displaySize: 40,
  },
  japaneseCartonBox: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/carton-box.png"),
    displaySize: 40,
  },
  japaneseClothesCase: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/clothes-case.png"),
    displaySize: 44,
  },
  japaneseCanvas: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/canvas.png"),
    displaySize: 44,
  },
  japaneseCanvasLetters: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/canvas-letters.png"),
    displaySize: 44,
  },
  japaneseLamp: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/lamp.png"),
    displaySize: 44,
  },
  japanesePlant: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/plant.png"),
    displaySize: 44,
  },
  japaneseSeat: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/seat.png"),
    displaySize: 44,
  },
  japaneseShelf: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/shelf.png"),
    displaySize: 56,
  },
  japaneseTable: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/table.png"),
    displaySize: 56,
  },
  japaneseToriGate: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/tori-gate.png"),
    displaySize: 56,
  },
  japaneseBaseCup: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/base-cup.png"),
    displaySize: 28,
  },
  japaneseCup: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/cup.png"),
    displaySize: 20,
  },
  japaneseDish: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/dish.png"),
    displaySize: 28,
  },
  japaneseTea: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/tea.png"),
    displaySize: 28,
  },
  japaneseVase: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/vase.png"),
    displaySize: 28,
  },
  japaneseCloset: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/closet.png"),
    displaySize: 64,
  },
  japaneseClosetBase: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/Closet/closet-base.png"),
    displaySize: 64,
  },
  japaneseClosetDrawerClosed: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/Closet/drawer-closed.png"),
    displaySize: 64,
  },
  japaneseClosetDrawerOpen: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/Closet/drawer-open.png"),
    displaySize: 64,
  },
  japaneseClosetDoor1Closed: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/Closet/door-1-closed.png"),
    displaySize: 64,
  },
  japaneseClosetDoor1Open: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/Closet/door-1-open.png"),
    displaySize: 64,
  },
  japaneseClosetDoor2Closed: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/Closet/door-2-closed.png"),
    displaySize: 64,
  },
  japaneseClosetDoor2Open: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Japanese/Closet/door-2-open.png"),
    displaySize: 64,
  },
  japaneseDoorAni: {
    frames: JAPANESE_DOOR_ANIM_FRAMES,
    frameWidth: 256,
    frameHeight: 256,
    fps: 6,
    displaySize: 64,
  },
  japaneseSlidingDoorAni: {
    frames: JAPANESE_DOOR_SLIDING_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 56,
  },
} as const satisfies Record<string, ImageEntry | AnimatedEntry>;

export type JapaneseDecorationId = keyof typeof JAPANESE_DECORATION_CATALOG;

export const JAPANESE_DECORATION_IDS = Object.keys(
  JAPANESE_DECORATION_CATALOG,
) as JapaneseDecorationId[];

const JAPANESE_DECORATION_ID_SET = new Set<string>(JAPANESE_DECORATION_IDS);

export function isJapaneseDecorationId(
  decorationId: string,
): decorationId is JapaneseDecorationId {
  return JAPANESE_DECORATION_ID_SET.has(decorationId);
}
