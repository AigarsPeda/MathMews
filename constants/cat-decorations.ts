/** Original Blender furniture, with stable inventory IDs. */

import { JAPANESE_DECORATION_CATALOG } from "@/constants/japanese-decorations";
import { LIVING_ROOM_DECORATION_CATALOG } from "@/constants/living-room-decorations";
import { OFFICE_DECORATION_CATALOG } from "@/constants/office-decorations";
import { BATHROOM_DECORATION_CATALOG } from "@/constants/bathroom-decorations";
import { BOOKS_DECORATION_CATALOG } from "@/constants/books-decorations";
import { CAT_SUPPLIES_DECORATION_CATALOG } from "@/constants/cat-supplies-decorations";
import {
  PLANT_DECORATION_CATALOG,
  isPlantDecorationId,
} from "@/constants/plant-decorations";
import {
  POSTER_DECORATION_CATALOG,
  isPosterDecorationId,
} from "@/constants/poster-decorations";
import { SOFA_DECORATION_CATALOG } from "@/constants/sofa-decorations";
import { TV_DECORATION_CATALOG } from "@/constants/tv-decorations";
import {
  WINDOW_DECORATION_CATALOG,
  isWindowDecorationId,
} from "@/constants/window-decorations";

type ImageDecorationCatalogEntry = {
  source: number;
  displaySize: number;
};

type AnimatedDecorationCatalogEntry = {
  source: number;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps?: number;
  displaySize: number;
};
export type DecorationCatalogEntry = ImageDecorationCatalogEntry | AnimatedDecorationCatalogEntry;

const BASIC_FURNITURE_CATALOG = {
  shelfWood: { source: require("@/assets/3d/decoration/shelfWood.png"), displaySize: 52 },
  shelfBlue: { source: require("@/assets/3d/decoration/shelfBlue.png"), displaySize: 52 },
  shelfGreen: { source: require("@/assets/3d/decoration/shelfGreen.png"), displaySize: 52 },
  tableTan: { source: require("@/assets/3d/decoration/tableTan.png"), displaySize: 40 },
  tablePink: { source: require("@/assets/3d/decoration/tablePink.png"), displaySize: 40 },
  tableBlue: { source: require("@/assets/3d/decoration/tableBlue.png"), displaySize: 40 },
  tablePurple: { source: require("@/assets/3d/decoration/tablePurple.png"), displaySize: 40 },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

export const SHEET_DECORATION_IDS = Object.keys(
  BASIC_FURNITURE_CATALOG,
) as SheetDecorationId[];

/** Floor carpets. */
const CARPET_DECORATION_CATALOG = {
  carpetTile: { source: require("@/assets/3d/decoration/carpetTile.png"), displaySize: 72 },
  carpetSmall: { source: require("@/assets/3d/decoration/carpetSmall.png"), displaySize: 28 },
  carpetClassic: { source: require("@/assets/3d/decoration/carpetClassic.png"), displaySize: 64 },
  carpetRound: { source: require("@/assets/3d/decoration/carpetRound.png"), displaySize: 48 },
  carpetRed: { source: require("@/assets/3d/decoration/carpetRed.png"), displaySize: 80 },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Chairs. */
const CHAIR_DECORATION_CATALOG = {
  chairOfficeA: { source: require("@/assets/3d/decoration/chairOfficeA.png"), displaySize: 48 },
  chairOfficeB: { source: require("@/assets/3d/decoration/chairOfficeB.png"), displaySize: 48 },
  chairOfficeMain: { source: require("@/assets/3d/decoration/chairOfficeMain.png"), displaySize: 48 },
  chairClassicA: { source: require("@/assets/3d/decoration/chairClassicA.png"), displaySize: 48 },
  chairClassicB: { source: require("@/assets/3d/decoration/chairClassicB.png"), displaySize: 48 },
  chairClassicC: { source: require("@/assets/3d/decoration/chairClassicC.png"), displaySize: 48 },
  chairClassicD: { source: require("@/assets/3d/decoration/chairClassicD.png"), displaySize: 48 },
  chairGamingA: { source: require("@/assets/3d/decoration/chairGamingA.png"), displaySize: 50 },
  chairGamingB: { source: require("@/assets/3d/decoration/chairGamingB.png"), displaySize: 50 },
  chairGamingC: { source: require("@/assets/3d/decoration/chairGamingC.png"), displaySize: 50 },
  chairGamingD: { source: require("@/assets/3d/decoration/chairGamingD.png"), displaySize: 50 },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Desks. */
const DESK_DECORATION_CATALOG = {
  deskWoodA: { source: require("@/assets/3d/decoration/deskWoodA.png"), displaySize: 80 },
  deskWoodB: { source: require("@/assets/3d/decoration/deskWoodB.png"), displaySize: 80 },
  deskOffice: { source: require("@/assets/3d/decoration/deskOffice.png"), displaySize: 80 },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Computers. */
const COMPUTER_DECORATION_CATALOG = {
  computerBendedScreen: { source: require("@/assets/3d/decoration/computerBendedScreen.png"), displaySize: 44 },
  computerNewImacA: { source: require("@/assets/3d/decoration/computerNewImacA.png"), displaySize: 44 },
  computerNewImacB: { source: require("@/assets/3d/decoration/computerNewImacB.png"), displaySize: 44 },
  computerNewKeyboard: { source: require("@/assets/3d/decoration/computerNewKeyboard.png"), displaySize: 32 },
  computerOldImacA: { source: require("@/assets/3d/decoration/computerOldImacA.png"), displaySize: 44 },
  computerOldImacB: { source: require("@/assets/3d/decoration/computerOldImacB.png"), displaySize: 44 },
  computerOldKeyboard: { source: require("@/assets/3d/decoration/computerOldKeyboard.png"), displaySize: 28 },
  computerOldPcA: { source: require("@/assets/3d/decoration/computerOldPcA.png"), displaySize: 44 },
  computerOldPcB: { source: require("@/assets/3d/decoration/computerOldPcB.png"), displaySize: 44 },
  computerPcTower: { source: require("@/assets/3d/decoration/computerPcTower.png"), displaySize: 44 },
  computerRotationScreenA: { source: require("@/assets/3d/decoration/computerRotationScreenA.png"), displaySize: 44 },
  computerRotationScreenB: { source: require("@/assets/3d/decoration/computerRotationScreenB.png"), displaySize: 44 },
  computerRotationScreenC: { source: require("@/assets/3d/decoration/computerRotationScreenC.png"), displaySize: 44 },
  computerVerticalScreen: { source: require("@/assets/3d/decoration/computerVerticalScreen.png"), displaySize: 44 },
  computerWacomTablet: { source: require("@/assets/3d/decoration/computerWacomTablet.png"), displaySize: 28 },
  computerMacbookClosed: { source: require("@/assets/3d/decoration/computerMacbookClosed.png"), displaySize: 32 },
  computerMacbookOpen: { source: require("@/assets/3d/decoration/computerMacbookOpen.png"), displaySize: 32 },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Game consoles. */
const CONSOLE_DECORATION_CATALOG = {
  consoleAtari: { source: require("@/assets/3d/decoration/consoleAtari.png"), displaySize: 40 },
  consoleDreamcast: { source: require("@/assets/3d/decoration/consoleDreamcast.png"), displaySize: 40 },
  consoleGameboy: { source: require("@/assets/3d/decoration/consoleGameboy.png"), displaySize: 40 },
  consoleGameboyAdvance: { source: require("@/assets/3d/decoration/consoleGameboyAdvance.png"), displaySize: 40 },
  consoleGamecube: { source: require("@/assets/3d/decoration/consoleGamecube.png"), displaySize: 40 },
  consoleNes: { source: require("@/assets/3d/decoration/consoleNes.png"), displaySize: 40 },
  consoleNes4: { source: require("@/assets/3d/decoration/consoleNes4.png"), displaySize: 40 },
  consoleNes4B: { source: require("@/assets/3d/decoration/consoleNes4B.png"), displaySize: 40 },
  consoleN64: { source: require("@/assets/3d/decoration/consoleN64.png"), displaySize: 40 },
  consoleSwitch: { source: require("@/assets/3d/decoration/consoleSwitch.png"), displaySize: 40 },
  consolePsp: { source: require("@/assets/3d/decoration/consolePsp.png"), displaySize: 40 },
  consolePs1: { source: require("@/assets/3d/decoration/consolePs1.png"), displaySize: 40 },
  consolePs2: { source: require("@/assets/3d/decoration/consolePs2.png"), displaySize: 40 },
  consolePs3: { source: require("@/assets/3d/decoration/consolePs3.png"), displaySize: 40 },
  consolePs4: { source: require("@/assets/3d/decoration/consolePs4.png"), displaySize: 40 },
  consolePs5: { source: require("@/assets/3d/decoration/consolePs5.png"), displaySize: 40 },
  consoleSnes: { source: require("@/assets/3d/decoration/consoleSnes.png"), displaySize: 40 },
  consoleSegaGenesis: { source: require("@/assets/3d/decoration/consoleSegaGenesis.png"), displaySize: 40 },
  consoleWii: { source: require("@/assets/3d/decoration/consoleWii.png"), displaySize: 40 },
  consoleXbox: { source: require("@/assets/3d/decoration/consoleXbox.png"), displaySize: 40 },
  consoleXbox360: { source: require("@/assets/3d/decoration/consoleXbox360.png"), displaySize: 40 },
  consoleXboxX: { source: require("@/assets/3d/decoration/consoleXboxX.png"), displaySize: 40 },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Lava lamp — animated + off state. */
const LAVA_LAMP_DECORATION_CATALOG = {
  lavaLampOff: { source: require("@/assets/3d/decoration/lavaLampOff.png"), displaySize: 40 },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Animated gadgets — horizontal sprite strips + multi-frame loops. */
const ANIMATED_DECORATION_CATALOG = {
  cleaningRobot: { source: require("@/assets/3d/atlases/cleaningRobot.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 36 },
  computerBendedScreenAni: { source: require("@/assets/3d/atlases/computerBendedScreenAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 44 },
  computerMacbookAni: { source: require("@/assets/3d/atlases/computerMacbookAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 36 },
  computerPcTowerAni: { source: require("@/assets/3d/atlases/computerPcTowerAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 44 },
  lavaLampAni: { source: require("@/assets/3d/atlases/lavaLampAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 40 },
} as const satisfies Record<string, AnimatedDecorationCatalogEntry>;

export const CAT_DECORATION_CATALOG = {
  ...BASIC_FURNITURE_CATALOG,
  ...CARPET_DECORATION_CATALOG,
  ...CHAIR_DECORATION_CATALOG,
  ...DESK_DECORATION_CATALOG,
  ...COMPUTER_DECORATION_CATALOG,
  ...CONSOLE_DECORATION_CATALOG,
  ...LAVA_LAMP_DECORATION_CATALOG,
  ...JAPANESE_DECORATION_CATALOG,
  ...LIVING_ROOM_DECORATION_CATALOG,
  ...OFFICE_DECORATION_CATALOG,
  ...BATHROOM_DECORATION_CATALOG,
  ...BOOKS_DECORATION_CATALOG,
  ...CAT_SUPPLIES_DECORATION_CATALOG,
  ...PLANT_DECORATION_CATALOG,
  ...POSTER_DECORATION_CATALOG,
  ...SOFA_DECORATION_CATALOG,
  ...TV_DECORATION_CATALOG,
  ...WINDOW_DECORATION_CATALOG,
  ...ANIMATED_DECORATION_CATALOG,
} as const;

export type SheetDecorationId = keyof typeof BASIC_FURNITURE_CATALOG;
export type CarpetDecorationId = keyof typeof CARPET_DECORATION_CATALOG;
export type ChairDecorationId = keyof typeof CHAIR_DECORATION_CATALOG;
export type DeskDecorationId = keyof typeof DESK_DECORATION_CATALOG;
export type ComputerDecorationId = keyof typeof COMPUTER_DECORATION_CATALOG;
export type ConsoleDecorationId = keyof typeof CONSOLE_DECORATION_CATALOG;
export type LavaLampDecorationId = keyof typeof LAVA_LAMP_DECORATION_CATALOG;
export type JapaneseDecorationId = keyof typeof JAPANESE_DECORATION_CATALOG;
export type AnimatedDecorationId = keyof typeof ANIMATED_DECORATION_CATALOG;
export type CatDecorationId = keyof typeof CAT_DECORATION_CATALOG;

export const CARPET_DECORATION_IDS = Object.keys(
  CARPET_DECORATION_CATALOG,
) as CarpetDecorationId[];

export const CHAIR_DECORATION_IDS = Object.keys(
  CHAIR_DECORATION_CATALOG,
) as ChairDecorationId[];

export const DESK_DECORATION_IDS = Object.keys(
  DESK_DECORATION_CATALOG,
) as DeskDecorationId[];

export const COMPUTER_DECORATION_IDS = Object.keys(
  COMPUTER_DECORATION_CATALOG,
) as ComputerDecorationId[];

export const CONSOLE_DECORATION_IDS = Object.keys(
  CONSOLE_DECORATION_CATALOG,
) as ConsoleDecorationId[];

export const LAVA_LAMP_DECORATION_IDS = Object.keys(
  LAVA_LAMP_DECORATION_CATALOG,
) as LavaLampDecorationId[];

export const ANIMATED_DECORATION_IDS = Object.keys(
  ANIMATED_DECORATION_CATALOG,
) as AnimatedDecorationId[];

/** Animated computers shown in the Computers store tab. */
export const COMPUTER_ANIMATED_DECORATION_IDS = [
  "computerBendedScreenAni",
  "computerMacbookAni",
  "computerPcTowerAni",
] as const satisfies readonly AnimatedDecorationId[];

/** Shelves, tables, lamps, and gadgets for the Furniture tab. */
export const FURNITURE_DECORATION_IDS = [
  ...SHEET_DECORATION_IDS,
  "lavaLampOff",
  "lavaLampAni",
  "cleaningRobot",
] as const satisfies readonly CatDecorationId[];

export {
  JAPANESE_DECORATION_IDS,
  isJapaneseDecorationId,
} from "@/constants/japanese-decorations";
export {
  LIVING_ROOM_DECORATION_IDS,
  isLivingRoomDecorationId,
} from "@/constants/living-room-decorations";
export {
  OFFICE_DECORATION_IDS,
  isOfficeDecorationId,
} from "@/constants/office-decorations";
export {
  BATHROOM_DECORATION_IDS,
  isBathroomDecorationId,
} from "@/constants/bathroom-decorations";
export {
  BOOKS_DECORATION_IDS,
  isBooksDecorationId,
} from "@/constants/books-decorations";
export {
  CAT_SUPPLIES_DECORATION_IDS,
  isCatSuppliesDecorationId,
} from "@/constants/cat-supplies-decorations";
export {
  PLANT_DECORATION_IDS,
  isPlantDecorationId,
} from "@/constants/plant-decorations";
export {
  POSTER_DECORATION_IDS,
  isPosterDecorationId,
} from "@/constants/poster-decorations";
export {
  SOFA_DECORATION_IDS,
  isSofaDecorationId,
} from "@/constants/sofa-decorations";
export {
  TV_DECORATION_IDS,
  isTvDecorationId,
} from "@/constants/tv-decorations";
export {
  WINDOW_DECORATION_IDS,
  isWindowDecorationId,
} from "@/constants/window-decorations";

export const CAT_DECORATION_IDS = Object.keys(
  CAT_DECORATION_CATALOG,
) as CatDecorationId[];

const CARPET_DECORATION_ID_SET = new Set<string>(CARPET_DECORATION_IDS);
const CHAIR_DECORATION_ID_SET = new Set<string>(CHAIR_DECORATION_IDS);
const DESK_DECORATION_ID_SET = new Set<string>(DESK_DECORATION_IDS);
const COMPUTER_DECORATION_ID_SET = new Set<string>(COMPUTER_DECORATION_IDS);
const CONSOLE_DECORATION_ID_SET = new Set<string>(CONSOLE_DECORATION_IDS);
const LAVA_LAMP_DECORATION_ID_SET = new Set<string>(LAVA_LAMP_DECORATION_IDS);
const ANIMATED_DECORATION_ID_SET = new Set<string>(ANIMATED_DECORATION_IDS);

export function isCarpetDecorationId(
  decorationId: string,
): decorationId is CarpetDecorationId {
  return CARPET_DECORATION_ID_SET.has(decorationId);
}

export function isChairDecorationId(
  decorationId: string,
): decorationId is ChairDecorationId {
  return CHAIR_DECORATION_ID_SET.has(decorationId);
}

export function isDeskDecorationId(
  decorationId: string,
): decorationId is DeskDecorationId {
  return DESK_DECORATION_ID_SET.has(decorationId);
}

export function isComputerDecorationId(
  decorationId: string,
): decorationId is ComputerDecorationId {
  return COMPUTER_DECORATION_ID_SET.has(decorationId);
}

export function isConsoleDecorationId(
  decorationId: string,
): decorationId is ConsoleDecorationId {
  return CONSOLE_DECORATION_ID_SET.has(decorationId);
}

export function isLavaLampDecorationId(
  decorationId: string,
): decorationId is LavaLampDecorationId {
  return LAVA_LAMP_DECORATION_ID_SET.has(decorationId);
}

export function isAnimatedDecorationId(
  decorationId: string,
): decorationId is AnimatedDecorationId {
  return ANIMATED_DECORATION_ID_SET.has(decorationId);
}

export function isImageDecorationEntry(
  entry: DecorationCatalogEntry,
): entry is ImageDecorationCatalogEntry {
  return "source" in entry && !("frameWidth" in entry);
}

export function isAnimatedDecorationEntry(
  entry: DecorationCatalogEntry,
): entry is AnimatedDecorationCatalogEntry {
  return "frameWidth" in entry;
}

/** Modern animation strips are mirrored by the renderer. */
export function hasFlippedAnimationFrames(decorationId: CatDecorationId): boolean {
  return decorationId === "bathroomWcAni";
}

export function isCatDecorationId(value: string): value is CatDecorationId {
  return value in CAT_DECORATION_CATALOG;
}

export function resolveCatDecorationId(
  decorationId: string | undefined,
): CatDecorationId | undefined {
  if (!decorationId) return undefined;

  const migrated =
    decorationId === "windowCurtains" ? "plantPotted" : decorationId;

  if (isCatDecorationId(migrated)) {
    return migrated;
  }

  return undefined;
}

export function getDecorationCatalogEntry(
  decorationId: string | undefined,
): DecorationCatalogEntry | undefined {
  const resolved = resolveCatDecorationId(decorationId);
  return resolved ? CAT_DECORATION_CATALOG[resolved] : undefined;
}

export function getDecorationDisplaySize(decorationId: string | undefined): number {
  const entry = getDecorationCatalogEntry(decorationId);
  return entry?.displaySize ?? 40;
}

/** Max dimension for store card previews. */
export function getDecorationStorePreviewSize(
  decorationId: string | undefined,
): number {
  return Math.round(getDecorationDisplaySize(decorationId) * 1.35);
}

/** Some animated items preview better on the opposite-wall frame set. */
export function getDecorationStorePreviewWallFlipped(
  decorationId: CatDecorationId,
): boolean {
  return decorationId === "bathroomWcAni";
}

/** Drag hit-box size — square large enough to cover the sprite. */
export function getDecorationDragSize(decorationId: string | undefined): number {
  return getDecorationDisplaySize(decorationId);
}

function getDecorationHitRatio(decorationId: string): number {
  if (isWindowDecorationId(decorationId)) return 0.5;
  if (isLavaLampDecorationId(decorationId)) return 0.55;
  if (isPlantDecorationId(decorationId)) return 0.6;
  if (isPosterDecorationId(decorationId)) return 0.65;
  if (isCarpetDecorationId(decorationId)) return 0.9;
  return 0.85;
}

/** Tighter tap target so overlapping wall items do not steal touches. */
export function getDecorationHitSize(decorationId: string | undefined): number {
  const display = getDecorationDisplaySize(decorationId);
  const ratio = decorationId ? getDecorationHitRatio(decorationId) : 0.72;
  return Math.max(20, Math.round(display * ratio));
}
