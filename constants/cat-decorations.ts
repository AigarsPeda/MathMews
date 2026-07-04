/** Room decorations — sprite sheet + standalone carpets (Tiny House pack). */
import {
  BENDED_SCREEN_ANIM_FRAMES,
  MACBOOK_ANIM_FRAMES,
  PC_TOWER_ANIM_FRAMES,
} from "@/constants/computer-animation-frames";
import { LAVA_LAMP_ANIM_FRAMES } from "@/constants/lava-lamp-animation-frames";
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

export const CAT_DECORATION_SHEET = require("@/assets/pets/Cat/CatItems/Decorations/CatRoomDecorations.png");
export const CAT_DECORATION_SHEET_SIZE = 1024;

export type DecorationFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type SheetDecorationCatalogEntry = {
  frame: DecorationFrame;
  /** Max display dimension in the room before `moderateScale`. */
  displaySize: number;
};

type ImageDecorationCatalogEntry = {
  source: number;
  displaySize: number;
};

type AnimatedDecorationCatalogEntry =
  | {
      source: number;
      sheetWidth: number;
      sheetHeight: number;
      frameWidth: number;
      frameHeight: number;
      frameCount: number;
      fps?: number;
      displaySize: number;
    }
  | {
      frames: readonly number[];
      frameWidth: number;
      frameHeight: number;
      fps?: number;
      displaySize: number;
    };

export type DecorationCatalogEntry =
  | SheetDecorationCatalogEntry
  | ImageDecorationCatalogEntry
  | AnimatedDecorationCatalogEntry;

const CAT_DECORATION_SHEET_CATALOG = {
  shelfWood: { frame: { x: 191, y: 17, w: 64, h: 110 }, displaySize: 52 },
  shelfBlue: { frame: { x: 287, y: 16, w: 64, h: 110 }, displaySize: 52 },
  shelfGreen: { frame: { x: 383, y: 16, w: 64, h: 110 }, displaySize: 52 },
  tableTan: { frame: { x: 202, y: 138, w: 110, h: 82 }, displaySize: 40 },
  tablePink: { frame: { x: 329, y: 138, w: 110, h: 82 }, displaySize: 40 },
  tableBlue: { frame: { x: 202, y: 236, w: 110, h: 82 }, displaySize: 40 },
  tablePurple: { frame: { x: 329, y: 236, w: 110, h: 82 }, displaySize: 40 },
} as const satisfies Record<string, SheetDecorationCatalogEntry>;

export const SHEET_DECORATION_IDS = Object.keys(
  CAT_DECORATION_SHEET_CATALOG,
) as SheetDecorationId[];

/** Floor carpets — `assets/.../Decorations/Carpets/`. */
const CARPET_DECORATION_CATALOG = {
  carpetTile: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Carpets/carpet-tile.png"),
    displaySize: 72,
  },
  carpetSmall: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Carpets/carpet-small.png"),
    displaySize: 28,
  },
  carpetClassic: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Carpets/carpet-classic.png"),
    displaySize: 64,
  },
  carpetRound: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Carpets/carpet-round.png"),
    displaySize: 48,
  },
  carpetRed: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Carpets/carpet-red.png"),
    displaySize: 80,
  },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Chairs — `assets/.../Decorations/Chairs/`. */
const CHAIR_DECORATION_CATALOG = {
  chairOfficeA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-office-a.png"),
    displaySize: 48,
  },
  chairOfficeB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-office-b.png"),
    displaySize: 48,
  },
  chairOfficeMain: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-office-main.png"),
    displaySize: 48,
  },
  chairClassicA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-classic-a.png"),
    displaySize: 48,
  },
  chairClassicB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-classic-b.png"),
    displaySize: 48,
  },
  chairClassicC: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-classic-c.png"),
    displaySize: 48,
  },
  chairClassicD: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-classic-d.png"),
    displaySize: 48,
  },
  chairGamingA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-gaming-a.png"),
    displaySize: 50,
  },
  chairGamingB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-gaming-b.png"),
    displaySize: 50,
  },
  chairGamingC: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-gaming-c.png"),
    displaySize: 50,
  },
  chairGamingD: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Chairs/chair-gaming-d.png"),
    displaySize: 50,
  },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Desks — `assets/.../Decorations/Desks/` (128px tiles). */
const DESK_DECORATION_CATALOG = {
  deskWoodA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Desks/desk-wood-a.png"),
    displaySize: 80,
  },
  deskWoodB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Desks/desk-wood-b.png"),
    displaySize: 80,
  },
  deskOffice: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Desks/desk-office.png"),
    displaySize: 80,
  },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Computers — `assets/.../Decorations/Computers/`. */
const COMPUTER_DECORATION_CATALOG = {
  computerBendedScreen: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/bended-screen.png"),
    displaySize: 44,
  },
  computerNewImacA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/new-imac-a.png"),
    displaySize: 44,
  },
  computerNewImacB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/new-imac-b.png"),
    displaySize: 44,
  },
  computerNewKeyboard: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/new-keyboard.png"),
    displaySize: 32,
  },
  computerOldImacA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/old-imac-a.png"),
    displaySize: 44,
  },
  computerOldImacB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/old-imac-b.png"),
    displaySize: 44,
  },
  computerOldKeyboard: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/old-keyboard.png"),
    displaySize: 28,
  },
  computerOldPcA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/old-pc-a.png"),
    displaySize: 44,
  },
  computerOldPcB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/old-pc-b.png"),
    displaySize: 44,
  },
  computerPcTower: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/pc-tower.png"),
    displaySize: 44,
  },
  computerRotationScreenA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/rotation-screen-a.png"),
    displaySize: 44,
  },
  computerRotationScreenB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/rotation-screen-b.png"),
    displaySize: 44,
  },
  computerRotationScreenC: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/rotation-screen-c.png"),
    displaySize: 44,
  },
  computerVerticalScreen: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/vertical-screen.png"),
    displaySize: 44,
  },
  computerWacomTablet: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/wacom-tablet.png"),
    displaySize: 28,
  },
  computerMacbookClosed: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/macbook-closed.png"),
    displaySize: 32,
  },
  computerMacbookOpen: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Computers/macbook-open.png"),
    displaySize: 32,
  },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Game consoles — `assets/.../Decorations/Consoles/`. */
const CONSOLE_DECORATION_CATALOG = {
  consoleAtari: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/atari.png"),
    displaySize: 40,
  },
  consoleDreamcast: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/dreamcast.png"),
    displaySize: 40,
  },
  consoleGameboy: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/gameboy.png"),
    displaySize: 40,
  },
  consoleGameboyAdvance: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/gameboy-advance.png"),
    displaySize: 40,
  },
  consoleGamecube: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/gamecube.png"),
    displaySize: 40,
  },
  consoleNes: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/nes.png"),
    displaySize: 40,
  },
  consoleNes4: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/nes-4.png"),
    displaySize: 40,
  },
  consoleNes4B: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/nes-4b.png"),
    displaySize: 40,
  },
  consoleN64: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/nintendo-64.png"),
    displaySize: 40,
  },
  consoleSwitch: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/nintendo-switch.png"),
    displaySize: 40,
  },
  consolePsp: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/psp.png"),
    displaySize: 40,
  },
  consolePs1: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/playstation.png"),
    displaySize: 40,
  },
  consolePs2: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/playstation-2.png"),
    displaySize: 40,
  },
  consolePs3: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/playstation-3.png"),
    displaySize: 40,
  },
  consolePs4: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/playstation-4.png"),
    displaySize: 40,
  },
  consolePs5: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/playstation-5.png"),
    displaySize: 40,
  },
  consoleSnes: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/snes.png"),
    displaySize: 40,
  },
  consoleSegaGenesis: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/sega-genesis.png"),
    displaySize: 40,
  },
  consoleWii: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/wii.png"),
    displaySize: 40,
  },
  consoleXbox: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/xbox.png"),
    displaySize: 40,
  },
  consoleXbox360: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/xbox-360.png"),
    displaySize: 40,
  },
  consoleXboxX: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Consoles/xbox-x.png"),
    displaySize: 40,
  },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Lava lamp — animated + off state. */
const LAVA_LAMP_DECORATION_CATALOG = {
  lavaLampOff: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/LavaLamp/lava-lamp-off.png"),
    displaySize: 40,
  },
} as const satisfies Record<string, ImageDecorationCatalogEntry>;

/** Animated gadgets — horizontal sprite strips + multi-frame loops. */
const ANIMATED_DECORATION_CATALOG = {
  cleaningRobot: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/CleaningRobot/cleaning-robot-ani.png"),
    sheetWidth: 1024,
    sheetHeight: 64,
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 16,
    fps: 8,
    displaySize: 36,
  },
  computerBendedScreenAni: {
    frames: BENDED_SCREEN_ANIM_FRAMES,
    frameWidth: 64,
    frameHeight: 64,
    fps: 8,
    displaySize: 44,
  },
  computerMacbookAni: {
    frames: MACBOOK_ANIM_FRAMES,
    frameWidth: 32,
    frameHeight: 32,
    fps: 8,
    displaySize: 36,
  },
  computerPcTowerAni: {
    frames: PC_TOWER_ANIM_FRAMES,
    frameWidth: 64,
    frameHeight: 64,
    fps: 8,
    displaySize: 44,
  },
  lavaLampAni: {
    frames: LAVA_LAMP_ANIM_FRAMES,
    frameWidth: 64,
    frameHeight: 64,
    fps: 6,
    displaySize: 40,
  },
} as const satisfies Record<string, AnimatedDecorationCatalogEntry>;

export const CAT_DECORATION_CATALOG = {
  ...CAT_DECORATION_SHEET_CATALOG,
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

export type SheetDecorationId = keyof typeof CAT_DECORATION_SHEET_CATALOG;
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

export function isCatDecorationId(value: string): value is CatDecorationId {
  return value in CAT_DECORATION_CATALOG;
}

export function resolveCatDecorationId(
  decorationId: string | undefined,
): CatDecorationId | undefined {
  if (!decorationId) return undefined;

  if (isCatDecorationId(decorationId)) {
    return decorationId;
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
