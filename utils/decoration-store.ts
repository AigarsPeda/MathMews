import { MODERN_KITCHEN_COUNTER_IDS, MODERN_KITCHEN_FLOOR_SHELF_IDS, MODERN_KITCHEN_SINK_IDS, MODERN_KITCHEN_ISLAND_IDS, MODERN_KITCHEN_FRIDGE_IDS, MODERN_KITCHEN_INDUCTION_IDS, MODERN_KITCHEN_STORAGE_IDS } from "@/constants/modern-kitchen";
import { DOOR_DECORATION_IDS, LAMP_DECORATION_IDS, CURTAIN_DECORATION_IDS } from "@/constants/home-details-decorations";
import { KITCHEN_DECORATION_IDS, BEDROOM_DECORATION_IDS, HALLOWEEN_DECORATION_IDS } from "@/constants/room-furnishings";
import STORE_PRICES from "@/data/store-prices.json";
import {
  CARPET_DECORATION_IDS,
  CAT_DECORATION_IDS,
  CHAIR_DECORATION_IDS,
  COMPUTER_ANIMATED_DECORATION_IDS,
  COMPUTER_DECORATION_IDS,
  CONSOLE_DECORATION_IDS,
  DESK_DECORATION_IDS,
  resolveCatDecorationId,
  type CatDecorationId,
} from "@/constants/cat-decorations";
import {
  isCanonicalDecorationStoreId,
  resolveDecorationPlacement,
} from "@/constants/decoration-variants";
import {
  JAPANESE_DECORATION_IDS,
} from "@/constants/japanese-decorations";
import {
  LIVING_ROOM_DECORATION_IDS,
} from "@/constants/living-room-decorations";
import {
  OFFICE_DECORATION_IDS,
} from "@/constants/office-decorations";
import {
  BATHROOM_DECORATION_IDS,
} from "@/constants/bathroom-decorations";
import {
  BOOKS_DECORATION_IDS,
} from "@/constants/books-decorations";
import {
  CAT_SUPPLIES_DECORATION_IDS,
} from "@/constants/cat-supplies-decorations";
import {
  PLANT_DECORATION_IDS,
} from "@/constants/plant-decorations";
import {
  POSTER_DECORATION_IDS,
} from "@/constants/poster-decorations";
import {
  SOFA_DECORATION_IDS,
} from "@/constants/sofa-decorations";
import {
  TV_DECORATION_IDS,
} from "@/constants/tv-decorations";
import {
  WINDOW_DECORATION_IDS,
} from "@/constants/window-decorations";
import type { DecorationPurchaseResult, StorePrice } from "@/types/store";
import type { PlacedDecoration, Progress } from "@/types/game";
import { countPlacedDecorations } from "@/utils/room-placement";

/** Store categories follow an item's purpose, independently of its asset pack. */
function storeIds(...groups: readonly (readonly CatDecorationId[])[]): CatDecorationId[] {
  return [...new Set(groups.flat())].filter(isCanonicalDecorationStoreId);
}

export const DOOR_DECORATION_STORE_IDS = storeIds(DOOR_DECORATION_IDS, [
  "japaneseDoorAni", "japaneseSlidingDoorAni",
]);
export const LAMP_DECORATION_STORE_IDS = storeIds(LAMP_DECORATION_IDS, [
  "bedroomFloorLamp", "japaneseLamp", "lavaLampOff", "lavaLampAni", "halloweenGhostLantern",
]);
export const CURTAIN_DECORATION_STORE_IDS = storeIds(CURTAIN_DECORATION_IDS);
export const CARPET_DECORATION_STORE_IDS = storeIds(CARPET_DECORATION_IDS, ["bathroomBathCarpet"]);
export const CHAIR_DECORATION_STORE_IDS = storeIds(CHAIR_DECORATION_IDS, ["japaneseSeat"]);
export const DESK_DECORATION_STORE_IDS = storeIds(DESK_DECORATION_IDS, ["officeDrawingTable"]);
export const COMPUTER_DECORATION_STORE_IDS = storeIds(
  COMPUTER_DECORATION_IDS, COMPUTER_ANIMATED_DECORATION_IDS, [
    "officeHeadset", "officeCalculator", "officeTelephone", "officePrinterAni",
  ],
);
export const CONSOLE_DECORATION_STORE_IDS = storeIds(CONSOLE_DECORATION_IDS);

export const TABLE_DECORATION_STORE_IDS = storeIds(MODERN_KITCHEN_COUNTER_IDS, MODERN_KITCHEN_ISLAND_IDS, [
  "tableTan", "tablePink", "tableBlue", "tablePurple",
  "livingSmallTable", "livingTable", "japaneseTable", "officeKitchenTable",
  "kitchenDiningTable", "kitchenIsland", "bedroomNightstand", "officeProjectorStand",
]);

// Keep the existing tab ID while giving shelves and cabinets their own category.
export const FURNITURE_DECORATION_STORE_IDS = storeIds(MODERN_KITCHEN_STORAGE_IDS, MODERN_KITCHEN_FLOOR_SHELF_IDS, MODERN_KITCHEN_SINK_IDS, [
  "shelfWood", "shelfBlue", "shelfGreen", "livingShelvingA", "livingShelvingB",
  "japaneseShelf", "japaneseClothesCase", "japaneseCloset", "japaneseClosetBase",
  "japaneseClosetDrawerClosed", "japaneseClosetDrawerOpen",
  "japaneseClosetDoor1Closed", "japaneseClosetDoor1Open",
  "japaneseClosetDoor2Closed", "japaneseClosetDoor2Open", "japaneseCartonBox",
  "officeRack", "officeLongRack", "officeMetallicClosetAni", "officeWoodClosetAni",
  "officeCartonBox", "officeWhiteBox", "bathroomLongShelf", "bathroomSmallShelf",
  "bathroomLaundryHamper", "kitchenWallCabinetSage", "kitchenWallCabinetOak",
  "kitchenWallCabinetGlass", "kitchenSinkCabinet", "bedroomDresser", "bedroomWardrobe",
]);

export const APPLIANCE_DECORATION_STORE_IDS = storeIds(MODERN_KITCHEN_INDUCTION_IDS, MODERN_KITCHEN_FRIDGE_IDS, [
  "kitchenFridge", "kitchenRange", "kitchenMicrowave", "kitchenMixerStand", "kitchenMixerHand",
  "cleaningRobot", "officeRumbaRobot", "livingAirCon", "officeAc", "livingFireplaceCream",
  "officeWaterDispenserAni", "officeCopyMachineDarkAni", "officeCopyMachineWhiteAni",
  "officeDocumentShredderAni",
]);
export const ACCESSORY_DECORATION_STORE_IDS = storeIds([
  "sofaPillow", "japaneseCandle", "japaneseBaseCup", "japaneseCup", "japaneseDish",
  "japaneseTea", "japaneseVase", "kitchenBreadBasket", "bathroomDuck",
  "halloweenPumpkin", "halloweenWitchHat", "halloweenCauldron",
]);

export const BOOKS_DECORATION_STORE_IDS = storeIds(BOOKS_DECORATION_IDS, [
  "livingBook", "officeBlueprint", "officePencilHolder", "officeRolledPapers", "officeRuler",
  "officeWhiteboardEraser", "officePaper1", "officePaper2", "officePaper3", "officePaper4",
  "officePaper5", "officePaper6", "officeStickyNote1", "officeStickyNote2", "officeStickyNote3",
  "officeStickyNote4", "officeStickyNote5", "officeStickyNote6", "officeStickyNoteBlue",
  "officeStickyNoteGreen", "officeStickyNotePink", "officeStickyNoteRed",
]);
export const CAT_SUPPLIES_DECORATION_STORE_IDS = storeIds(CAT_SUPPLIES_DECORATION_IDS);
export const PLANT_DECORATION_STORE_IDS = storeIds(PLANT_DECORATION_IDS, ["japaneseBonsai", "japanesePlant"]);
export const POSTER_DECORATION_STORE_IDS = storeIds(POSTER_DECORATION_IDS, [
  "portraitCat", "japaneseCanvas", "japaneseCanvasLetters", "officeDiploma",
  "officePhotosA", "officePhotosB", "officePictureFrame", "officeBoardEmpty", "officeBoardFull",
  "officeCorkboardA", "officeCorkboardB", "officeClockAni", "bathroomMirror", "halloweenBatGarland",
]);
export const SOFA_DECORATION_STORE_IDS = storeIds(SOFA_DECORATION_IDS.filter(id => id !== "sofaPillow"));
export const TV_DECORATION_STORE_IDS = storeIds(TV_DECORATION_IDS, [
  "officeTvOff", "livingSpeaker", "officeProjectorAni", "officeProjectorScreenAni",
]);
export const WINDOW_DECORATION_STORE_IDS = storeIds(WINDOW_DECORATION_IDS, ["bathroomBathWindow"]);

/** Room and theme collections intentionally share items with type categories. */
export const JAPANESE_DECORATION_STORE_IDS = storeIds(JAPANESE_DECORATION_IDS, ["windowJapaneseL"]);
export const LIVING_ROOM_DECORATION_STORE_IDS = storeIds(
  LIVING_ROOM_DECORATION_IDS, SOFA_DECORATION_STORE_IDS, TV_DECORATION_STORE_IDS,
  CARPET_DECORATION_IDS, LAMP_DECORATION_IDS, CURTAIN_DECORATION_IDS, [
    "chairClassicA", "tableTan", "tablePink", "tableBlue", "tablePurple",
    "shelfWood", "shelfBlue", "shelfGreen", "lavaLampOff", "lavaLampAni", "sofaPillow",
  ],
);
export const OFFICE_DECORATION_STORE_IDS = storeIds(
  OFFICE_DECORATION_IDS, DESK_DECORATION_STORE_IDS, COMPUTER_DECORATION_STORE_IDS,
  BOOKS_DECORATION_IDS, ["chairOfficeA", "chairOfficeMain", "chairGamingA", "lampTableBanker"],
);
export const KITCHEN_DECORATION_STORE_IDS = storeIds(KITCHEN_DECORATION_IDS, ["officeKitchenTable"]);
export const BEDROOM_DECORATION_STORE_IDS = storeIds(
  BEDROOM_DECORATION_IDS, CURTAIN_DECORATION_IDS, CARPET_DECORATION_IDS, [
    "lampTableMushroom", "lampTableCeramic", "sofaPillow",
  ],
);
export const HALLOWEEN_DECORATION_STORE_IDS = storeIds(HALLOWEEN_DECORATION_IDS);
export const BATHROOM_DECORATION_STORE_IDS = storeIds(BATHROOM_DECORATION_IDS);

/** Catalog pricing — change amounts here; swap kind to `iap` per item later. */
export function getDecorationStorePrice(
  decorationId: CatDecorationId,
): StorePrice {
  const amount = STORE_PRICES.decoration[decorationId];
  return amount === 0 ? { kind: "free" } : { kind: "coins", amount };
}

export function isDecorationUnlocked(
  decorationId: CatDecorationId,
  decorationsUnlocked: CatDecorationId[],
): boolean {
  return decorationsUnlocked.includes(decorationId);
}

export function normalizeDecorationsUnlocked(
  value: unknown,
  placedDecorationIds: CatDecorationId[] = [],
): CatDecorationId[] {
  const unlocked = new Set<CatDecorationId>();

  for (const id of placedDecorationIds) {
    unlocked.add(id);
  }

  if (Array.isArray(value)) {
    for (const id of value) {
      if (typeof id === "string") {
        const resolved = resolveCatDecorationId(id);
        if (resolved) {
          const placement = resolveDecorationPlacement(resolved);
          if (placement) {
            unlocked.add(placement.decorationId);
          }
        }
      }
    }
  }

  return CAT_DECORATION_IDS.filter((id) => unlocked.has(id));
}

export function getDecorationOwnedCount(
  decorationId: CatDecorationId,
  progress: Pick<Progress, "decorationsUnlocked" | "decorationQuantities">,
): number {
  if (!isDecorationUnlocked(decorationId, progress.decorationsUnlocked as CatDecorationId[])) {
    return 0;
  }

  const saved = progress.decorationQuantities?.[decorationId];
  return typeof saved === "number" && saved > 0 ? saved : 1;
}

export function normalizeDecorationQuantities(
  value: unknown,
  decorationsUnlocked: CatDecorationId[],
  placedDecorations: PlacedDecoration[] = [],
): Record<string, number> {
  const quantities: Record<string, number> = {};

  if (value && typeof value === "object") {
    for (const [id, count] of Object.entries(value as Record<string, unknown>)) {
      const resolved = resolveCatDecorationId(id);
      if (resolved && typeof count === "number" && count > 0) {
        quantities[resolved] = count;
      }
    }
  }

  for (const id of decorationsUnlocked) {
    if ((quantities[id] ?? 0) < 1) {
      quantities[id] = 1;
    }
  }

  for (const id of decorationsUnlocked) {
    const placedCount = countPlacedDecorations(id, placedDecorations);
    if (placedCount > (quantities[id] ?? 0)) {
      quantities[id] = placedCount;
    }
  }

  return quantities;
}

export function tryPurchaseDecoration(params: {
  decorationId: CatDecorationId;
  walletCoins: number;
  decorationsUnlocked: CatDecorationId[];
}): {
  result: DecorationPurchaseResult;
  walletCoins: number;
  decorationsUnlocked: CatDecorationId[];
} {
  const decorationId = resolveCatDecorationId(params.decorationId);
  if (!decorationId) {
    return {
      result: "invalid_item",
      walletCoins: params.walletCoins,
      decorationsUnlocked: params.decorationsUnlocked,
    };
  }

  const price = getDecorationStorePrice(decorationId);

  if (price.kind === "iap") {
    return {
      result: "not_for_sale",
      walletCoins: params.walletCoins,
      decorationsUnlocked: params.decorationsUnlocked,
    };
  }

  const alreadyUnlocked = isDecorationUnlocked(
    decorationId,
    params.decorationsUnlocked,
  );

  if (price.kind === "free") {
    return {
      result: "purchased",
      walletCoins: params.walletCoins,
      decorationsUnlocked: alreadyUnlocked
        ? params.decorationsUnlocked
        : [...params.decorationsUnlocked, decorationId],
    };
  }

  if (params.walletCoins < price.amount) {
    return {
      result: "insufficient_funds",
      walletCoins: params.walletCoins,
      decorationsUnlocked: params.decorationsUnlocked,
    };
  }

  return {
    result: "purchased",
    walletCoins: params.walletCoins - price.amount,
    decorationsUnlocked: alreadyUnlocked
      ? params.decorationsUnlocked
      : [...params.decorationsUnlocked, decorationId],
  };
}
