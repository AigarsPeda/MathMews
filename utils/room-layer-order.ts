import type { PetProfile, RoomLayerItem } from "@/types/game";
import { isCarpetDecorationId, resolveCatDecorationId } from "@/constants/cat-decorations";

export function roomLayerItemKey(item: RoomLayerItem): string {
  if (item.kind === "bed") return "bed";
  if (item.kind === "decoration") return `decoration:${item.instanceId}`;
  return `toy:${item.instanceId}`;
}

export function isSameRoomLayerItem(a: RoomLayerItem, b: RoomLayerItem): boolean {
  return roomLayerItemKey(a) === roomLayerItemKey(b);
}

function attachInstanceIdsToLayerOrder(
  order: RoomLayerItem[],
  pet: Pick<PetProfile, "placedDecorations" | "placedToys">,
): RoomLayerItem[] {
  const usedToyInstances = new Set<string>();
  const usedDecorationInstances = new Set<string>();

  return order.map((item) => {
    if (item.kind === "bed") return item;

    if (item.kind === "toy") {
      if (item.instanceId) {
        usedToyInstances.add(item.instanceId);
        return item;
      }

      const match = (pet.placedToys ?? []).find(
        (placed) =>
          placed.toyId === item.toyId &&
          !usedToyInstances.has(placed.instanceId),
      );
      if (!match) return item;

      usedToyInstances.add(match.instanceId);
      return { ...item, instanceId: match.instanceId };
    }

    if (item.instanceId) {
      usedDecorationInstances.add(item.instanceId);
      return item;
    }

    const match = (pet.placedDecorations ?? []).find(
      (placed) =>
        placed.decorationId === item.decorationId &&
        !usedDecorationInstances.has(placed.instanceId),
    );
    if (!match) return item;

    usedDecorationInstances.add(match.instanceId);
    return { ...item, instanceId: match.instanceId };
  });
}

function buildDefaultRoomLayerOrder(
  pet: Pick<PetProfile, "bedId" | "placedDecorations" | "placedToys">,
): RoomLayerItem[] {
  const order: RoomLayerItem[] = [];

  for (const placed of pet.placedDecorations ?? []) {
    order.push({
      kind: "decoration",
      decorationId: placed.decorationId,
      instanceId: placed.instanceId,
    });
  }

  if (pet.bedId) {
    order.push({ kind: "bed" });
  }

  for (const placed of pet.placedToys ?? []) {
    order.push({
      kind: "toy",
      toyId: placed.toyId,
      instanceId: placed.instanceId,
    });
  }

  return order;
}

function collectValidLayerKeys(
  pet: Pick<PetProfile, "bedId" | "placedDecorations" | "placedToys">,
): Set<string> {
  const keys = new Set<string>();

  for (const placed of pet.placedDecorations ?? []) {
    keys.add(
      roomLayerItemKey({
        kind: "decoration",
        decorationId: placed.decorationId,
        instanceId: placed.instanceId,
      }),
    );
  }

  if (pet.bedId) {
    keys.add(roomLayerItemKey({ kind: "bed" }));
  }

  for (const placed of pet.placedToys ?? []) {
    keys.add(
      roomLayerItemKey({
        kind: "toy",
        toyId: placed.toyId,
        instanceId: placed.instanceId,
      }),
    );
  }

  return keys;
}

function migrateRoomLayerItem(item: RoomLayerItem): RoomLayerItem {
  if (item.kind !== "decoration") return item;

  const resolved = resolveCatDecorationId(item.decorationId);
  if (!resolved || resolved === item.decorationId) return item;

  return { ...item, decorationId: resolved };
}

/** Keep saved order, drop removed items, append anything new with sensible defaults. */
export function normalizeRoomLayerOrder(
  pet: Pick<
    PetProfile,
    "bedId" | "placedDecorations" | "placedToys" | "roomLayerOrder"
  >,
): RoomLayerItem[] {
  const validKeys = collectValidLayerKeys(pet);
  const saved = pet.roomLayerOrder ?? [];
  const order = attachInstanceIdsToLayerOrder(
    saved.map(migrateRoomLayerItem).filter((item) => {
      if (item.kind === "bed") {
        return validKeys.has(roomLayerItemKey(item));
      }
      if (item.kind === "toy") {
        return Boolean(item.instanceId) && validKeys.has(roomLayerItemKey(item));
      }
      return Boolean(item.instanceId) && validKeys.has(roomLayerItemKey(item));
    }),
    pet,
  );

  for (const placed of pet.placedDecorations ?? []) {
    const item: RoomLayerItem = {
      kind: "decoration",
      decorationId: placed.decorationId,
      instanceId: placed.instanceId,
    };
    if (!order.some((entry) => isSameRoomLayerItem(entry, item))) {
      if (isCarpetDecorationId(placed.decorationId)) {
        order.unshift(item);
        continue;
      }

      const bedIndex = order.findIndex((entry) => entry.kind === "bed");
      if (bedIndex >= 0) {
        order.splice(bedIndex, 0, item);
      } else {
        order.push(item);
      }
    }
  }

  if (pet.bedId && !order.some((entry) => entry.kind === "bed")) {
    const firstToyIndex = order.findIndex((entry) => entry.kind === "toy");
    const bedItem: RoomLayerItem = { kind: "bed" };
    if (firstToyIndex >= 0) {
      order.splice(firstToyIndex, 0, bedItem);
    } else {
      order.push(bedItem);
    }
  }

  for (const placed of pet.placedToys ?? []) {
    const item: RoomLayerItem = {
      kind: "toy",
      toyId: placed.toyId,
      instanceId: placed.instanceId,
    };
    if (!order.some((entry) => isSameRoomLayerItem(entry, item))) {
      order.push(item);
    }
  }

  if (order.length === 0) {
    return buildDefaultRoomLayerOrder(pet);
  }

  return order;
}

export function syncPetLayerOrder(pet: PetProfile): PetProfile {
  return {
    ...pet,
    roomLayerOrder: normalizeRoomLayerOrder(pet),
  };
}

export function moveRoomLayerItem(
  order: RoomLayerItem[],
  item: RoomLayerItem,
  direction: "up" | "down",
): RoomLayerItem[] {
  const index = order.findIndex((entry) => isSameRoomLayerItem(entry, item));
  if (index < 0) return order;

  const targetIndex = direction === "up" ? index + 1 : index - 1;
  if (targetIndex < 0 || targetIndex >= order.length) return order;

  const next = [...order];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export function canMoveRoomLayerItem(
  order: RoomLayerItem[],
  item: RoomLayerItem,
  direction: "up" | "down",
): boolean {
  const index = order.findIndex((entry) => isSameRoomLayerItem(entry, item));
  if (index < 0) return false;
  if (direction === "up") return index < order.length - 1;
  return index > 0;
}

export const ROOM_PET_LAYER_Z_INDEX = 100;
export const ROOM_MENU_BACKDROP_Z_INDEX = 150;
export const ROOM_MENU_OPEN_Z_INDEX = 200;

export function getRoomLayerZIndex(layerIndex: number, menuOpen: boolean): number {
  return menuOpen ? ROOM_MENU_OPEN_Z_INDEX : layerIndex + 1;
}
