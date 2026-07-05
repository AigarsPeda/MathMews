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

export function normalizePlacedToys(value: unknown): PlacedToy[] {
  const placed: PlacedToy[] = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry !== "object" || entry === null) continue;
      const record = entry as Record<string, unknown>;
      const toyId =
        typeof record.toyId === "string"
          ? resolveCatToyId(record.toyId)
          : undefined;
      const offset = normalizeRoomItemOffset(record.offset);
      if (!toyId || !offset) continue;
      if (placed.some((item) => item.toyId === toyId)) continue;
      placed.push({ toyId, offset });
    }
    return placed;
  }

  return placed;
}

export function normalizePlacedDecorations(value: unknown): PlacedDecoration[] {
  const placed: PlacedDecoration[] = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
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

      if (
        placed.some((item) => item.decorationId === placement.decorationId)
      ) {
        continue;
      }

      placed.push({
        decorationId: placement.decorationId,
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
      offset:
        normalizeRoomItemOffset(pet.roomDecorationOffset) ??
        defaultPlacementOffset(0, "decoration"),
    },
  ];
}

export function isToyPlacedInRoom(
  toyId: CatToyId,
  placedToys: PlacedToy[] | undefined,
): boolean {
  return (placedToys ?? []).some((item) => item.toyId === toyId);
}

export function isDecorationPlacedInRoom(
  decorationId: CatDecorationId,
  placedDecorations: PlacedDecoration[] | undefined,
): boolean {
  return (placedDecorations ?? []).some(
    (item) => item.decorationId === decorationId,
  );
}

export function appendPlacedToy(
  placedToys: PlacedToy[] | undefined,
  toyId: CatToyId,
): PlacedToy[] {
  if (isToyPlacedInRoom(toyId, placedToys)) {
    return placedToys ?? [];
  }

  return [
    ...(placedToys ?? []),
    {
      toyId,
      offset: defaultPlacementOffset((placedToys ?? []).length, "toy"),
    },
  ];
}

export function appendPlacedDecoration(
  placedDecorations: PlacedDecoration[] | undefined,
  decorationId: CatDecorationId,
): PlacedDecoration[] {
  if (isDecorationPlacedInRoom(decorationId, placedDecorations)) {
    return placedDecorations ?? [];
  }

  return [
    ...(placedDecorations ?? []),
    {
      decorationId,
      offset: defaultPlacementOffset(
        (placedDecorations ?? []).length,
        "decoration",
      ),
    },
  ];
}

export function updatePlacedToyOffset(
  placedToys: PlacedToy[] | undefined,
  toyId: CatToyId,
  offset: RoomItemOffset,
): PlacedToy[] {
  return (placedToys ?? []).map((item) =>
    item.toyId === toyId ? { ...item, offset } : item,
  );
}

export function updatePlacedDecorationOffset(
  placedDecorations: PlacedDecoration[] | undefined,
  decorationId: CatDecorationId,
  offset: RoomItemOffset,
): PlacedDecoration[] {
  return (placedDecorations ?? []).map((item) =>
    item.decorationId === decorationId ? { ...item, offset } : item,
  );
}

export function updatePlacedDecorationScale(
  placedDecorations: PlacedDecoration[] | undefined,
  decorationId: CatDecorationId,
  scale: number,
): PlacedDecoration[] {
  const nextScale = clampDecorationScale(scale);

  return (placedDecorations ?? []).map((item) => {
    if (item.decorationId !== decorationId) return item;

    return {
      ...item,
      scale: nextScale !== 1 ? nextScale : undefined,
    };
  });
}

export function updatePlacedDecorationRotation(
  placedDecorations: PlacedDecoration[] | undefined,
  decorationId: CatDecorationId,
  rotationIndex: number,
): PlacedDecoration[] {
  return (placedDecorations ?? []).map((item) => {
    if (item.decorationId !== decorationId) return item;

    return {
      ...item,
      rotationIndex: rotationIndex > 0 ? rotationIndex : undefined,
    };
  });
}

export function updatePlacedDecorationWallFlip(
  placedDecorations: PlacedDecoration[] | undefined,
  decorationId: CatDecorationId,
  wallFlipped: boolean,
): PlacedDecoration[] {
  return (placedDecorations ?? []).map((item) => {
    if (item.decorationId !== decorationId) return item;

    return {
      ...item,
      wallFlipped: wallFlipped ? true : undefined,
    };
  });
}

export function removePlacedDecoration(
  placedDecorations: PlacedDecoration[] | undefined,
  decorationId: CatDecorationId,
): PlacedDecoration[] {
  return (placedDecorations ?? []).filter(
    (item) => item.decorationId !== decorationId,
  );
}

export function removePlacedToy(
  placedToys: PlacedToy[] | undefined,
  toyId: CatToyId,
): PlacedToy[] {
  return (placedToys ?? []).filter((item) => item.toyId !== toyId);
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
