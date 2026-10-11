import type { CatDecorationId } from "@/constants/cat-decorations";

/** Purchase sizes measured against the shipped room, furniture and cat.
 * These do not replace omitted scale values in existing saves.
 */
export const STORE_PLACEMENT_SCALES = {
  // Seating leaves a usable cushion without filling the room.
  sofaA: 1.3, sofaB: 1.3,
  sofaBlueClassic: 1.3, sofaRoseTufted: 1.3,
  sofaTanLeather: 1.3, sofaCreamCloud: 1.3, sofaCornerSage: 1.2,
  catTreeTan: 1.6, catTreeBlue: 1.6, catTreePink: 1.6,

  // Tall furniture follows the fridge and human-bed proportions.
  bedroomDoubleBed: 1.6, bedroomWardrobe: 1.6,
  japaneseCloset: 1.6, japaneseClosetBase: 1.6,
  officeMetallicClosetAni: 1.6, officeWoodClosetAni: 1.6,
  officeRack: 1.3, officeLongRack: 1.7,
  shelfWood: 1.6, shelfBlue: 1.6, shelfGreen: 1.6,
  bathroomShowerCabin: 1.8,
  bathroomShowerFloor: 1.8, bathroomShowerTray: 1.8,
  bathroomShowerTap: 1.7, bathroomTapShower: 2.2,

  // Doors fit beneath the wall top; windows remain smaller than doors.
  doorOakPanel: 1.6, doorMintGlass: 1.6, doorBarnSliding: 1.6,
  japaneseDoorAni: 2.2, japaneseSlidingDoorAni: 2.2,
  windowWhiteClassic: 1.5, windowArched: 1.4,
  windowPlain: 1.5, windowBlinds: 1.5,
  window7A: 1.5, window7B: 1.5, window7C: 1.5,
  window8A: 1.5, window8B: 1.5, window8C: 1.5,
  window11A: 1.5, window11B: 1.5, window11C: 1.5,
  windowJapaneseL: 1.5, windowJapaneseR: 1.5,
  curtainRoseTieback: 1.5, curtainBlueDrape: 1.5, curtainCreamLinen: 1.5,
  japaneseToriGate: 2.2,

  // Floor lights have standing height; table lights fit the small tables.
  lampFloorTripod: 1.8, lampFloorPaper: 1.8, bedroomFloorLamp: 2,
  lampTableMushroom: .8, lampTableCeramic: .8, lampTableBanker: .8,
  lavaLampOff: .8, lavaLampAni: .8,
  halloweenGhostLantern: .7,
  plantTallGreen: 1.8, plantTallPink: 1.8,
  plantTallBlue: 1.8, plantTallPurple: 1.8,
  plantB: 1.5, plantPotted: 1.5, japanesePlant: 1.4, japaneseBonsai: .7,

  // Rugs sit beneath seating; the small mat and carpet tile stay small.
  rugBraidedRound: 1.3, rugGeometricTeal: 1.3,
  rugStripedRunner: 1.3, rugFlowerPink: 1.2,
  carpetClassic: 1.5, carpetRound: 1.8, carpetRed: 1.4,

  // Small electronics belong beside furniture rather than matching its size.
  tvBigOff: 2, officeTvOff: 1.8, officeProjectorScreenAni: 2,
  officeProjectorAni: .7, officePrinterAni: .7, officeHeadset: .7,
  officeCalculator: .7, officeTelephone: .7,
  computerNewKeyboard: .8, computerOldKeyboard: .8,
  consoleAtari: .7, consoleDreamcast: .7, consoleGameboy: .7,
  consoleGameboyAdvance: .7, consoleGamecube: .7,
  consoleNes: .7, consoleNes4: .7, consoleNes4B: .7, consoleN64: .7,
  consoleSwitch: .7, consolePsp: .7, consolePs1: .7, consolePs2: .7,
  consolePs3: .7, consolePs4: .7, consolePs5: .7, consoleSnes: .7,
  consoleSegaGenesis: .7, consoleWii: .7,
  consoleXbox: .7, consoleXbox360: .7, consoleXboxX: .7,

  // Tabletop supplies stay smaller than their table or shelf.
  booksPile: .7, booksNotebooks: .7,
  officeBlueprint: .7, officePencilHolder: .7,
  officeRolledPapers: .7, officeRuler: .7, officeWhiteboardEraser: .7,
  officeStickyNote2: .7,
  japaneseCandle: .7, japaneseBaseCup: .7, japaneseCup: .7, japaneseTea: .7,
  bathroomSoapGreen: .7, bathroomSoapRed: .7, bathroomSoapYellow: .7,
  bathroomTissues: .7, bathroomToiletPaper: .7,
  bathroomTowelBlue: .7, bathroomTowelGreen: .7, bathroomTowelRed: .7,
  bathroomSmallShelf: .7, bathroomMirror: 1.6,
} as const satisfies Partial<Record<CatDecorationId, number>>;
