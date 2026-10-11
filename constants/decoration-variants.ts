import { MODERN_KITCHEN_DECORATION_IDS } from "@/constants/modern-kitchen";
import { STORE_PLACEMENT_SCALES } from "@/constants/store-placement-scales";
import { WALL_SPOTLIGHT_DECORATION_IDS } from "@/constants/home-details-decorations";
import { isRoomDoor } from "@/constants/home-rooms";
import {
  resolveCatDecorationId,
  getDecorationDisplaySize,
  getDecorationHitSize,
  hasFlippedAnimationFrames,
  isPosterDecorationId,
  isWindowDecorationId,
  type CatDecorationId,
} from "@/constants/cat-decorations";
import { isTvDecorationId } from "@/constants/tv-decorations";
import type { PlacedDecoration } from "@/types/game";

export const DECORATION_ROTATION_GROUPS: readonly (readonly CatDecorationId[])[] =
  [
    ["chairOfficeA", "chairOfficeB"],
    ["chairClassicA", "chairClassicB", "chairClassicC", "chairClassicD"],
    ["chairGamingA", "chairGamingB", "chairGamingC", "chairGamingD"],
    ["deskWoodA", "deskWoodB"],
    ["sofaA", "sofaB"],
    ["window7A", "window7B", "window7C"],
    ["window8A", "window8B", "window8C"],
    ["window11A", "window11B", "window11C"],
    ["windowJapaneseL", "windowJapaneseR"],
    ["computerNewImacA", "computerNewImacB"],
    ["computerOldImacA", "computerOldImacB"],
    ["computerOldPcA", "computerOldPcB"],
    [
      "computerRotationScreenA",
      "computerRotationScreenB",
      "computerRotationScreenC",
      "computerVerticalScreen",
    ],
  ];

const VARIANT_TO_GROUP = new Map<CatDecorationId, readonly CatDecorationId[]>();
const ROTATION_VARIANT_ONLY_IDS = new Set<CatDecorationId>();

/** Wall mounts and furniture with a visible front can face either room wall.
 * Keep this independent of catalog category: portraitCat is sold in cat supplies.
 * Mirroring also applies to every frame of an animated item.
 */
export const WALL_FACING_DECORATION_IDS: readonly CatDecorationId[] = [
  ...WALL_SPOTLIGHT_DECORATION_IDS,
  ...MODERN_KITCHEN_DECORATION_IDS,
  "kitchenWallCabinetSage", "kitchenWallCabinetOak", "kitchenWallCabinetGlass", "kitchenIsland", "kitchenBarStoolOak", "kitchenBarStoolMetal", "kitchenBarStoolVelvet", "kitchenMixerStand", "kitchenMixerHand", "kitchenChairWindsor", "kitchenChairMint", "kitchenChairUpholstered", "kitchenChairBistro", "chairRockingOak", "livingFireplaceCream",
  "doorOakPanel", "doorMintGlass", "doorBarnSliding", "curtainRoseTieback", "curtainBlueDrape", "curtainCreamLinen", "lampFloorArc", "lampFloorTripod", "lampFloorPaper", "lampTableMushroom", "lampTableCeramic", "lampTableBanker", "sofaCornerSage",
  "sofaBlueClassic", "sofaRoseTufted", "sofaTanLeather", "sofaCreamCloud", "kitchenFridge", "kitchenRange", "kitchenSinkCabinet", "kitchenMicrowave", "bedroomDoubleBed", "bedroomDresser", "bedroomNightstand", "bedroomWardrobe", "bathroomDoubleVanity", "bathroomShowerCabin", "halloweenBatGarland",
  "portraitCat", "japaneseCanvas", "japaneseCanvasLetters",
  "livingAirCon", "officeAc", "officeClockAni", "officeDiploma",
  "officePhotosA", "officePhotosB", "officePictureFrame",
  "officeBoardEmpty", "officeBoardFull", "officeCorkboardA", "officeCorkboardB",
  "officeGlassWall", "officePartition", "officeProjectorScreenAni",
  "officeTvOff", "japaneseDoorAni", "japaneseSlidingDoorAni",
  "livingShelvingA", "livingShelvingB", "japaneseShelf",
  "bathroomLongShelf", "bathroomSmallShelf", "bathroomMirror",
  "bathroomBathWindow", "bathroomHanger", "bathroomHangingTowel",
  "bathroomShowerTap", "bathroomTapShower", "bathroomTapWall",
  "shelfWood", "shelfBlue", "shelfGreen", "officeRack", "officeLongRack",
  "japaneseCloset", "japaneseClosetBase", "japaneseClothesCase",
  "japaneseClosetDrawerClosed", "japaneseClosetDrawerOpen",
  "japaneseClosetDoor1Closed", "japaneseClosetDoor1Open",
  "japaneseClosetDoor2Closed", "japaneseClosetDoor2Open",
  "officeMetallicClosetAni", "officeWoodClosetAni", "bathroomWcFurniture",
  "bathroomBathAni", "bathroomWcAni", "bathroomWcTapAni",
  "bathroomBathOvalWhite", "bathroomBathOvalSage", "bathroomBathOvalRose", "bathroomBathOvalCharcoal",
  "bathroomBathClawfootCream", "bathroomBathClawfootNavy", "bathroomJacuzziWhite", "bathroomJacuzziSage",
  "chairOfficeMain", "deskOffice", "japaneseSeat", "officeDrawingTable",
  "officeKitchenTable", "officeProjectorStand", "japaneseToriGate",
  "livingSpeaker", "officeCopyMachineDarkAni", "officeCopyMachineWhiteAni",
  "officeDocumentShredderAni", "officePrinterAni", "officeProjectorAni",
  "officeWaterDispenserAni", "officeMedicalKitAni",
  "computerBendedScreen", "computerBendedScreenAni", "computerPcTower",
  "computerPcTowerAni", "computerMacbookOpen", "computerMacbookClosed",
  "computerMacbookAni", "computerWacomTablet",
];
const WALL_FACING_IDS = new Set(WALL_FACING_DECORATION_IDS);

for (const group of DECORATION_ROTATION_GROUPS) {
  for (let index = 1; index < group.length; index += 1) {
    ROTATION_VARIANT_ONLY_IDS.add(group[index]);
  }
  for (const id of group) {
    VARIANT_TO_GROUP.set(id, group);
  }
}

export const DECORATION_SCALE_MIN = 0.7;
export const DECORATION_SCALE_MAX = 2.2;
export const DECORATION_SCALE_STEP = 0.1;

/** Posters use one sprite mirrored horizontally for the opposite isometric wall. */
export const POSTER_WALL_ORIENTATION_COUNT = 2;

export function isDecorationRotationVariantOnly(
  decorationId: CatDecorationId,
): boolean {
  return ROTATION_VARIANT_ONLY_IDS.has(decorationId);
}

export function isCanonicalDecorationStoreId(
  decorationId: CatDecorationId,
): boolean {
  return !ROTATION_VARIANT_ONLY_IDS.has(decorationId);
}

export function getDecorationRotationGroup(
  decorationId: CatDecorationId,
): readonly CatDecorationId[] | undefined {
  return VARIANT_TO_GROUP.get(decorationId);
}

export function canFlipWallDecoration(decorationId: CatDecorationId): boolean {
  return (
    isPosterDecorationId(decorationId) ||
    isWindowDecorationId(decorationId) ||
    isTvDecorationId(decorationId) ||
    WALL_FACING_IDS.has(decorationId) ||
    hasFlippedAnimationFrames(decorationId)
  );
}

/** Posters reuse rotationIndex to store wall side (0 / 1). */
export function usesWallFlipRotation(decorationId: CatDecorationId): boolean {
  return isPosterDecorationId(decorationId);
}

export function canRotateDecoration(decorationId: CatDecorationId): boolean {
  if (usesWallFlipRotation(decorationId)) {
    return true;
  }

  const group = getDecorationRotationGroup(decorationId);
  return group !== undefined && group.length > 1;
}

export function getDecorationRotationCount(
  decorationId: CatDecorationId,
): number {
  if (usesWallFlipRotation(decorationId)) {
    return POSTER_WALL_ORIENTATION_COUNT;
  }

  const group = getDecorationRotationGroup(decorationId);
  return group?.length ?? 0;
}

export function usesStyleVariantMenu(decorationId: CatDecorationId): boolean {
  return isWindowDecorationId(decorationId);
}

export function resolveDecorationPlacement(
  decorationId: string,
  rotationIndex = 0,
): { decorationId: CatDecorationId; rotationIndex: number } | undefined {
  const resolved = resolveCatDecorationId(decorationId);
  if (!resolved) return undefined;

  const group = VARIANT_TO_GROUP.get(resolved);
  if (!group) {
    if (usesWallFlipRotation(resolved)) {
      return {
        decorationId: resolved,
        rotationIndex: Math.max(
          0,
          Math.min(rotationIndex, POSTER_WALL_ORIENTATION_COUNT - 1),
        ),
      };
    }

    return { decorationId: resolved, rotationIndex: 0 };
  }

  const variantIndex = group.indexOf(resolved);
  const canonical = group[0];
  const index =
    resolved !== canonical && variantIndex > 0
      ? variantIndex
      : rotationIndex;

  return {
    decorationId: canonical,
    rotationIndex: Math.max(0, Math.min(index, group.length - 1)),
  };
}

export function getPlacedDecorationSpriteId(
  placed: PlacedDecoration,
): CatDecorationId {
  const group = VARIANT_TO_GROUP.get(placed.decorationId as CatDecorationId);
  if (!group) {
    return placed.decorationId as CatDecorationId;
  }

  const index = placed.rotationIndex ?? 0;
  return group[Math.min(Math.max(index, 0), group.length - 1)];
}

export function clampDecorationScale(scale: number): number {
  return (
    Math.round(
      Math.max(
        DECORATION_SCALE_MIN,
        Math.min(DECORATION_SCALE_MAX, scale),
      ) * 10,
    ) / 10
  );
}

export function getPlacedDecorationScale(placed: PlacedDecoration): number {
  if (typeof placed.scale !== "number" || !Number.isFinite(placed.scale)) {
    return getDecorationDefaultScale(placed.decorationId as CatDecorationId);
  }

  return clampDecorationScale(placed.scale);
}

export function canScaleDecorationUp(scale: number): boolean {
  return scale + DECORATION_SCALE_STEP <= DECORATION_SCALE_MAX + 0.001;
}

export function canScaleDecorationDown(scale: number): boolean {
  return scale - DECORATION_SCALE_STEP >= DECORATION_SCALE_MIN - 0.001;
}

export function scaleDecorationBy(
  scale: number,
  direction: "up" | "down",
): number {
  const delta =
    direction === "up" ? DECORATION_SCALE_STEP : -DECORATION_SCALE_STEP;
  return clampDecorationScale(scale + delta);
}

export function getNextRotationIndex(
  currentIndex: number,
  groupLength: number,
): number {
  return (currentIndex + 1) % groupLength;
}

export function getPlacedDecorationWallFlipped(
  placed: PlacedDecoration,
): boolean {
  const decorationId = placed.decorationId as CatDecorationId;

  if (isPosterDecorationId(decorationId)) {
    return (placed.rotationIndex ?? 0) % 2 === 1;
  }

  if (isRoomDoor(decorationId)) return placed.wallFlipped ?? placed.offset.x < 0;
  return placed.wallFlipped === true;
}

export function getPlacedDecorationDragSize(placed: PlacedDecoration): number {
  const spriteId = getPlacedDecorationSpriteId(placed);
  const base = getDecorationDisplaySize(spriteId);
  return base * getPlacedDecorationScale(placed);
}

export function getPlacedDecorationHitSize(placed: PlacedDecoration): number {
  const spriteId = getPlacedDecorationSpriteId(placed);
  const base = getDecorationHitSize(spriteId);
  return base * getPlacedDecorationScale(placed);
}

export function getDecorationDefaultScale(id: CatDecorationId): number {
  return id === "chairRockingOak" ? 1.4 : 1;
}

/** New placements and store previews match the furniture sized in the reference rooms. */
export function getDecorationDefaultPlacementScale(id: CatDecorationId): number | undefined {
  const measured = (STORE_PLACEMENT_SCALES as Partial<Record<CatDecorationId, number>>)[id];
  if (measured !== undefined) return measured;
  // Leave a wider cat aisle while keeping matching worktops at one height.
  if (id.startsWith("kitchenModern") ||
      id === "kitchenWallCabinetSage" || id === "kitchenWallCabinetOak" ||
      id === "kitchenWallCabinetGlass" || id === "kitchenSinkCabinet" ||
      id === "kitchenRange" || id === "kitchenIsland") return .9;
  if (id === "bathroomBathAni" || id.startsWith("bathroomBathOval") ||
      id.startsWith("bathroomBathClawfoot") || id.startsWith("bathroomJacuzzi")) return 1.8;
  if (id === "bathroomWcAni") return 1.3;
  if (id === "chairRockingOak") return 1.4;
  if (id === "kitchenFridge") return 1.5;
  if (id === "windowOakWide") return 1.6;
  if (id === "lampFloorArc") return 1.8;
  return undefined;
}
