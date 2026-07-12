import type { CatDecorationId } from "@/constants/cat-decorations";
import { isCatDecorationId, resolveCatDecorationId } from "@/constants/cat-decorations";
import {
  clampDecorationScale,
  resolveDecorationPlacement,
} from "@/constants/decoration-variants";
import type { CatToyId } from "@/constants/cat-toys";
import { isCatToyId, resolveCatToyId } from "@/constants/cat-toys";
import type { PlacedDecoration, PlacedToy, RoomItemOffset } from "@/types/game";

function clampOffsetAxis(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function createPlacementInstanceId(): string {
  return `pi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeRoomItemOffset(
  value: unknown,
): RoomItemOffset | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.x !== "number" || typeof record.y !== "number") {
    return undefined;
  }
  return {
    x: clampOffsetAxis(record.x),
    y: clampOffsetAxis(record.y),
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
      placed.push({
        toyId,
        instanceId: resolvePlacementInstanceId(record, toyId, index),
        offset,
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
      const offset = normalizeRoomItemOffset(record.offset);
      if (!placement || !offset) continue;

      const scale =
        typeof record.scale === "number"
          ? clampDecorationScale(record.scale)
          : undefined;

      placed.push({
        decorationId: placement.decorationId,
        instanceId: resolvePlacementInstanceId(
          record,
          placement.decorationId,
          index,
        ),
        offset,
        rotationIndex:
          placement.rotationIndex > 0 ? placement.rotationIndex : undefined,
        wallFlipped: record.wallFlipped === true ? true : undefined,
        scale: scale !== undefined && scale !== 1 ? scale : undefined,
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
  return [
    ...(placedDecorations ?? []),
    {
      decorationId,
      instanceId: createPlacementInstanceId(),
      offset: defaultPlacementOffset(
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
  return (placedDecorations ?? []).map((item) =>
    item.instanceId === instanceId ? { ...item, offset } : item,
  );
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
      scale: nextScale !== 1 ? nextScale : undefined,
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
      wallFlipped: wallFlipped ? true : undefined,
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
