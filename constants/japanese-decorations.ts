

type ImageEntry = {
  source: number;
  displaySize: number;
};

type AnimatedEntry = { source: number; sheetWidth: number; sheetHeight: number; frameWidth: number; frameHeight: number; frameCount: number; fps?: number; displaySize: number };

/** Japanese room pack — shown in the dedicated store tab. */
export const JAPANESE_DECORATION_CATALOG = {
  japaneseBonsai: { source: require("@/assets/3d/decoration/japaneseBonsai.png"), displaySize: 44 },
  japaneseCandle: { source: require("@/assets/3d/decoration/japaneseCandle.png"), displaySize: 40 },
  japaneseCartonBox: { source: require("@/assets/3d/decoration/japaneseCartonBox.png"), displaySize: 40 },
  japaneseClothesCase: { source: require("@/assets/3d/decoration/japaneseClothesCase.png"), displaySize: 44 },
  japaneseCanvas: { source: require("@/assets/3d/decoration/japaneseCanvas.png"), displaySize: 44 },
  japaneseCanvasLetters: { source: require("@/assets/3d/decoration/japaneseCanvasLetters.png"), displaySize: 44 },
  japaneseLamp: { source: require("@/assets/3d/decoration/japaneseLamp.png"), displaySize: 44 },
  japanesePlant: { source: require("@/assets/3d/decoration/japanesePlant.png"), displaySize: 44 },
  japaneseSeat: { source: require("@/assets/3d/decoration/japaneseSeat.png"), displaySize: 44 },
  japaneseShelf: { source: require("@/assets/3d/decoration/japaneseShelf.png"), displaySize: 56 },
  japaneseTable: { source: require("@/assets/3d/decoration/japaneseTable.png"), displaySize: 56 },
  japaneseToriGate: { source: require("@/assets/3d/decoration/japaneseToriGate.png"), displaySize: 56 },
  japaneseBaseCup: { source: require("@/assets/3d/decoration/japaneseBaseCup.png"), displaySize: 28 },
  japaneseCup: { source: require("@/assets/3d/decoration/japaneseCup.png"), displaySize: 20 },
  japaneseDish: { source: require("@/assets/3d/decoration/japaneseDish.png"), displaySize: 28 },
  japaneseTea: { source: require("@/assets/3d/decoration/japaneseTea.png"), displaySize: 28 },
  japaneseVase: { source: require("@/assets/3d/decoration/japaneseVase.png"), displaySize: 28 },
  japaneseCloset: { source: require("@/assets/3d/decoration/japaneseCloset.png"), displaySize: 64 },
  japaneseClosetBase: { source: require("@/assets/3d/decoration/japaneseClosetBase.png"), displaySize: 64 },
  japaneseClosetDrawerClosed: { source: require("@/assets/3d/decoration/japaneseClosetDrawerClosed.png"), displaySize: 64 },
  japaneseClosetDrawerOpen: { source: require("@/assets/3d/decoration/japaneseClosetDrawerOpen.png"), displaySize: 64 },
  japaneseClosetDoor1Closed: { source: require("@/assets/3d/decoration/japaneseClosetDoor1Closed.png"), displaySize: 64 },
  japaneseClosetDoor1Open: { source: require("@/assets/3d/decoration/japaneseClosetDoor1Open.png"), displaySize: 64 },
  japaneseClosetDoor2Closed: { source: require("@/assets/3d/decoration/japaneseClosetDoor2Closed.png"), displaySize: 64 },
  japaneseClosetDoor2Open: { source: require("@/assets/3d/decoration/japaneseClosetDoor2Open.png"), displaySize: 64 },
  japaneseDoorAni: { source: require("@/assets/3d/atlases/japaneseDoorAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 64 },
  japaneseSlidingDoorAni: { source: require("@/assets/3d/atlases/japaneseSlidingDoorAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 56 },
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
