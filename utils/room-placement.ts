import nativeCatalog from "@/assets/3d/native/catalog.json";
import { isWindowDecorationId } from "@/constants/window-decorations";
import { isHomeRoomId, isRoomDoor } from "@/constants/home-rooms";
import { normalizeRotationDegrees } from "@/utils/room-rotation";
import { isCurtainDecorationId, isPoweredDecorationId, isWallSpotlightDecorationId, normalizeSpotlightAngle, normalizeSpotlightSwivel } from "@/constants/decoration-motion";
import type { CatDecorationId } from "@/constants/cat-decorations";
import { getDecorationDisplaySize, isCatDecorationId, resolveCatDecorationId } from "@/constants/cat-decorations";
import {
  clampDecorationScale,
  getDecorationDefaultPlacementScale,
  getDecorationDefaultScale,
  getPlacedDecorationDragSize,
  getPlacedDecorationSpriteId,
  getPlacedDecorationWallFlipped,
  resolveDecorationPlacement,
} from "@/constants/decoration-variants";
import type { CatToyId } from "@/constants/cat-toys";
import { getDefaultToyScale, getPlacedToyRotationIndex, isCatToyId, resolveCatToyId } from "@/constants/cat-toys";
import type { PlacedDecoration, PlacedToy, RoomItemOffset } from "@/types/game";

function clampOffsetAxis(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function createPlacementInstanceId(): string {
  return `pi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeRoomItemOffset(
  value: unknown,
  constrainToRoom = true,
): RoomItemOffset | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.x !== "number" || typeof record.y !== "number" || !Number.isFinite(record.x) || !Number.isFinite(record.y)) {
    return undefined;
  }
  return {
    x: constrainToRoom ? clampOffsetAxis(record.x) : record.x,
    y: constrainToRoom ? clampOffsetAxis(record.y) : record.y,
  };
}

export function defaultPlacementOffset(
  index: number,
  kind: "toy" | "decoration",
): RoomItemOffset {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const baseX = kind === "toy" ? 0.05 : -0.35;
  const baseY = kind === "toy" ? 0.22 : 0.08;

  return {
    x: clampOffsetAxis(baseX + column * 0.2 - 0.2),
    y: clampOffsetAxis(baseY + row * 0.1),
  };
}

function resolvePlacementInstanceId(
  record: Record<string, unknown>,
  toyId: string,
  index: number,
): string {
  if (typeof record.instanceId === "string" && record.instanceId.length > 0) {
    return record.instanceId;
  }
  return `legacy-${toyId}-${index}`;
}

export function normalizePlacedToys(value: unknown): PlacedToy[] {
  const placed: PlacedToy[] = [];

  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      if (typeof entry !== "object" || entry === null) continue;
      const record = entry as Record<string, unknown>;
      const toyId =
        typeof record.toyId === "string"
          ? resolveCatToyId(record.toyId)
          : undefined;
      const offset = normalizeRoomItemOffset(record.offset);
      if (!toyId || !offset) continue;
      const scale = typeof record.scale === "number" && Number.isFinite(record.scale)
        ? clampDecorationScale(record.scale) : getDefaultToyScale(toyId);
      const rotationIndex = getPlacedToyRotationIndex({ rotationIndex: typeof record.rotationIndex === "number" ? record.rotationIndex : undefined });
      placed.push({
        toyId,
        instanceId: resolvePlacementInstanceId(record, toyId, index),
        offset,
        scale: scale !== getDefaultToyScale(toyId) ? scale : undefined,
        rotationIndex: rotationIndex > 0 ? rotationIndex : undefined,
        rotationDegrees: normalizeRotationDegrees(record.rotationDegrees),
      });
    }
    return placed;
  }

  return placed;
}

export function normalizePlacedDecorations(value: unknown): PlacedDecoration[] {
  const placed: PlacedDecoration[] = [];

  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      if (typeof entry !== "object" || entry === null) continue;
      const record = entry as Record<string, unknown>;
      if (typeof record.decorationId !== "string") continue;

      const placement = resolveDecorationPlacement(
        record.decorationId,
        typeof record.rotationIndex === "number" ? record.rotationIndex : 0,
      );
      if (!placement) continue;
      const offset = normalizeRoomItemOffset(record.offset, !isCurtainDecorationId(placement.decorationId));
      if (!offset) continue;

      const scale =
        typeof record.scale === "number"
          ? clampDecorationScale(record.scale)
          : undefined;

      placed.push({
        decorationId: placement.decorationId,
        doorDestination: isRoomDoor(placement.decorationId) && isHomeRoomId(record.doorDestination) ? record.doorDestination : undefined,
        instanceId: resolvePlacementInstanceId(
          record,
          placement.decorationId,
          index,
        ),
        offset,
        rotationIndex:
          placement.rotationIndex > 0 ? placement.rotationIndex : undefined,
        wallFlipped: isRoomDoor(placement.decorationId) && typeof record.wallFlipped === "boolean"
          ? record.wallFlipped : record.wallFlipped === true ? true : undefined,
        poweredOn: isPoweredDecorationId(placement.decorationId) && record.poweredOn === true ? true : undefined,
        spotlightAngle: isWallSpotlightDecorationId(placement.decorationId) ? normalizeSpotlightAngle(record.spotlightAngle) : undefined,
        spotlightSwivel: isWallSpotlightDecorationId(placement.decorationId) ? normalizeSpotlightSwivel(record.spotlightSwivel) : undefined,
        curtainOpen: isCurtainDecorationId(placement.decorationId) && record.curtainOpen === false ? false : undefined,
        rotationDegrees: normalizeRotationDegrees(record.rotationDegrees),
        scale: scale !== undefined && scale !== getDecorationDefaultScale(placement.decorationId) ? scale : undefined,
      });
    }
    return placed;
  }

  return placed;
}

export function migrateLegacyPlacedToys(pet: Record<string, unknown>): PlacedToy[] {
  const fromArray = normalizePlacedToys(pet.placedToys);
  if (fromArray.length > 0 || Array.isArray(pet.placedToys)) {
    return fromArray;
  }

  const legacyToyId =
    typeof pet.toyId === "string" ? resolveCatToyId(pet.toyId) : undefined;
  if (!legacyToyId) {
    return [];
  }

  return [
    {
      toyId: legacyToyId,
      instanceId: createPlacementInstanceId(),
      offset:
        normalizeRoomItemOffset(pet.roomToyOffset) ??
        defaultPlacementOffset(0, "toy"),
    },
  ];
}

export function migrateLegacyPlacedDecorations(
  pet: Record<string, unknown>,
): PlacedDecoration[] {
  const fromArray = normalizePlacedDecorations(pet.placedDecorations);
  if (fromArray.length > 0 || Array.isArray(pet.placedDecorations)) {
    return fromArray;
  }

  const legacyDecorationId =
    typeof pet.decorationId === "string"
      ? resolveCatDecorationId(pet.decorationId)
      : undefined;
  if (!legacyDecorationId) {
    return [];
  }

  return [
    {
      decorationId: legacyDecorationId,
      instanceId: createPlacementInstanceId(),
      offset:
        normalizeRoomItemOffset(pet.roomDecorationOffset) ??
        defaultPlacementOffset(0, "decoration"),
    },
  ];
}

export function countPlacedToys(
  toyId: CatToyId,
  placedToys: PlacedToy[] | undefined,
): number {
  return (placedToys ?? []).filter((item) => item.toyId === toyId).length;
}

export function countPlacedDecorations(
  decorationId: CatDecorationId,
  placedDecorations: PlacedDecoration[] | undefined,
): number {
  return (placedDecorations ?? []).filter(
    (item) => item.decorationId === decorationId,
  ).length;
}

export function isToyPlacedInRoom(
  toyId: CatToyId,
  placedToys: PlacedToy[] | undefined,
): boolean {
  return countPlacedToys(toyId, placedToys) > 0;
}

export function isDecorationPlacedInRoom(
  decorationId: CatDecorationId,
  placedDecorations: PlacedDecoration[] | undefined,
): boolean {
  return countPlacedDecorations(decorationId, placedDecorations) > 0;
}

export function appendPlacedToy(
  placedToys: PlacedToy[] | undefined,
  toyId: CatToyId,
): PlacedToy[] {
  return [
    ...(placedToys ?? []),
    {
      toyId,
      instanceId: createPlacementInstanceId(),
      offset: defaultPlacementOffset((placedToys ?? []).length, "toy"),
    },
  ];
}

export function appendPlacedDecoration(
  placedDecorations: PlacedDecoration[] | undefined,
  decorationId: CatDecorationId,
): PlacedDecoration[] {
  // Start a newly placed pair over an existing window, sized to its aperture.
  const window = isCurtainDecorationId(decorationId)
    ? placedDecorations?.find(item => isWindowDecorationId(item.decorationId)) : undefined;
  const catalog = nativeCatalog as Record<string, { renderScale: number; min: number[]; max: number[] }>;
  const windowModel = window ? catalog[getPlacedDecorationSpriteId(window)] : undefined;
  const curtainModel = catalog[decorationId];
  const curtainScale = window && windowModel && curtainModel
    ? clampDecorationScale(getPlacedDecorationDragSize(window) / windowModel.renderScale *
      (windowModel.max[0] - windowModel.min[0]) / 1.80 * curtainModel.renderScale / getDecorationDisplaySize(decorationId))
    : getDecorationDefaultPlacementScale(decorationId);
  return [
    ...(placedDecorations ?? []),
    {
      decorationId,
      scale: curtainScale,
      wallFlipped: window ? getPlacedDecorationWallFlipped(window) : undefined,
      rotationDegrees: window?.rotationDegrees,
      instanceId: createPlacementInstanceId(),
      offset: window ? { ...window.offset } : isWallSpotlightDecorationId(decorationId) ? { x: .2, y: -.70 } : defaultPlacementOffset(
        (placedDecorations ?? []).length,
        "decoration",
      ),
    },
  ];
}

export function findPlacedToyByInstance(
  placedToys: PlacedToy[] | undefined,
  instanceId: string,
): PlacedToy | undefined {
  return (placedToys ?? []).find((item) => item.instanceId === instanceId);
}

export function findPlacedDecorationByInstance(
  placedDecorations: PlacedDecoration[] | undefined,
  instanceId: string,
): PlacedDecoration | undefined {
  return (placedDecorations ?? []).find(
    (item) => item.instanceId === instanceId,
  );
}

export function updatePlacedToyOffsetByInstance(
  placedToys: PlacedToy[] | undefined,
  instanceId: string,
  offset: RoomItemOffset,
): PlacedToy[] {
  return (placedToys ?? []).map((item) =>
    item.instanceId === instanceId ? { ...item, offset } : item,
  );
}

export function updatePlacedDecorationOffsetByInstance(
  placedDecorations: PlacedDecoration[] | undefined,
  instanceId: string,
  offset: RoomItemOffset,
): PlacedDecoration[] {
  return (placedDecorations ?? []).map((item) => {
    if (item.instanceId !== instanceId) return item;
    return { ...item, offset,
      // Freeze legacy doors' inferred wall orientation before changing the anchor.
      wallFlipped: isRoomDoor(item.decorationId) ? item.wallFlipped ?? item.offset.x < 0 : item.wallFlipped };
  });
}

export function updatePlacedToyScaleByInstance(
  placedToys: PlacedToy[] | undefined,
  instanceId: string,
  scale: number,
): PlacedToy[] {
  const nextScale = clampDecorationScale(scale);
  return (placedToys ?? []).map(item => item.instanceId === instanceId
    ? { ...item, scale: nextScale !== getDefaultToyScale(item.toyId) ? nextScale : undefined } : item);
}

export function updatePlacedToyRotationByInstance(
  placedToys: PlacedToy[] | undefined,
  instanceId: string,
  rotationIndex: number,
): PlacedToy[] {
  const nextIndex = getPlacedToyRotationIndex({ rotationIndex });
  return (placedToys ?? []).map(item => item.instanceId === instanceId
    ? { ...item, rotationIndex: nextIndex > 0 ? nextIndex : undefined } : item);
}

export function togglePlacedDecorationPowerByInstance(
  placedDecorations: PlacedDecoration[] | undefined,
  instanceId: string,
): PlacedDecoration[] {
  return (placedDecorations ?? []).map((item) =>
    item.instanceId === instanceId && isPoweredDecorationId(item.decorationId)
      ? { ...item, poweredOn: !item.poweredOn }
      : item,
  );
}

export function aimPlacedSpotlightByInstance(
  placedDecorations: PlacedDecoration[] | undefined, instanceId: string, angle: number, swivel?: number,
): PlacedDecoration[] {
  return (placedDecorations ?? []).map(item => item.instanceId === instanceId && isWallSpotlightDecorationId(item.decorationId)
    ? { ...item, spotlightAngle: normalizeSpotlightAngle(angle), spotlightSwivel: normalizeSpotlightSwivel(swivel ?? item.spotlightSwivel) } : item);
}

export function togglePlacedCurtainByInstance(
  placedDecorations: PlacedDecoration[] | undefined,
  instanceId: string,
): PlacedDecoration[] {
  return (placedDecorations ?? []).map(item =>
    item.instanceId === instanceId && isCurtainDecorationId(item.decorationId)
      ? { ...item, curtainOpen: item.curtainOpen === false }
      : item);
}

export function updatePlacedDecorationScaleByInstance(
  placedDecorations: PlacedDecoration[] | undefined,
  instanceId: string,
  scale: number,
): PlacedDecoration[] {
  const nextScale = clampDecorationScale(scale);

  return (placedDecorations ?? []).map((item) => {
    if (item.instanceId !== instanceId) return item;

    return {
      ...item,
      scale: nextScale !== getDecorationDefaultScale(item.decorationId as CatDecorationId) ? nextScale : undefined,
    };
  });
}

export function updatePlacedDecorationRotationByInstance(
  placedDecorations: PlacedDecoration[] | undefined,
  instanceId: string,
  rotationIndex: number,
): PlacedDecoration[] {
  return (placedDecorations ?? []).map((item) => {
    if (item.instanceId !== instanceId) return item;

    return {
      ...item,
      rotationIndex: rotationIndex > 0 ? rotationIndex : undefined,
    };
  });
}

export function updatePlacedDecorationWallFlipByInstance(
  placedDecorations: PlacedDecoration[] | undefined,
  instanceId: string,
  wallFlipped: boolean,
): PlacedDecoration[] {
  return (placedDecorations ?? []).map((item) => {
    if (item.instanceId !== instanceId) return item;

    return {
      ...item,
      // A wall spotlight must cross to the corresponding side of the room.
      // Keeping a right-wall screen anchor on the left wall places it beyond
      // the corner, behind the opaque back wall.
      offset: isWallSpotlightDecorationId(item.decorationId) && getPlacedDecorationWallFlipped(item) !== wallFlipped
        ? { ...item.offset, x: -item.offset.x } : item.offset,
      wallFlipped: isRoomDoor(item.decorationId) ? wallFlipped : wallFlipped ? true : undefined,
    };
  });
}

export function removeOnePlacedToy(
  placedToys: PlacedToy[] | undefined,
  toyId: CatToyId,
): PlacedToy[] {
  const list = placedToys ?? [];
  let removeIndex = -1;

  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index]?.toyId === toyId) {
      removeIndex = index;
      break;
    }
  }

  if (removeIndex < 0) return list;

  return [...list.slice(0, removeIndex), ...list.slice(removeIndex + 1)];
}

export function removeOnePlacedDecoration(
  placedDecorations: PlacedDecoration[] | undefined,
  decorationId: CatDecorationId,
): PlacedDecoration[] {
  const list = placedDecorations ?? [];
  let removeIndex = -1;

  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index]?.decorationId === decorationId) {
      removeIndex = index;
      break;
    }
  }

  if (removeIndex < 0) return list;

  return [...list.slice(0, removeIndex), ...list.slice(removeIndex + 1)];
}

export function removePlacedToyByInstance(
  placedToys: PlacedToy[] | undefined,
  instanceId: string,
): PlacedToy[] {
  return (placedToys ?? []).filter((item) => item.instanceId !== instanceId);
}

export function removePlacedDecorationByInstance(
  placedDecorations: PlacedDecoration[] | undefined,
  instanceId: string,
): PlacedDecoration[] {
  return (placedDecorations ?? []).filter(
    (item) => item.instanceId !== instanceId,
  );
}

export function collectPlacedToyIds(placedToys: PlacedToy[] | undefined): CatToyId[] {
  return (placedToys ?? [])
    .map((item) => item.toyId)
    .filter((id): id is CatToyId => isCatToyId(id));
}

export function collectPlacedDecorationIds(
  placedDecorations: PlacedDecoration[] | undefined,
): CatDecorationId[] {
  return (placedDecorations ?? [])
    .map((item) => item.decorationId)
    .filter((id): id is CatDecorationId => isCatDecorationId(id));
}
