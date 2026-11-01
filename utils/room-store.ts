import { getCatalogStorePrice } from "@/utils/store-catalog";
import {
  CAT_ROOM_IDS,
  DEFAULT_CAT_ROOM_ID,
  isCatRoomId,
  type CatRoomId,
} from "@/constants/cat-rooms";
import type { StorePrice } from "@/types/store";

/** Current server price, with bundled display defaults while offline. */
export function getRoomStorePrice(roomId: CatRoomId): StorePrice {
  return getCatalogStorePrice("room", roomId);
}

export function isRoomUnlocked(
  roomId: CatRoomId,
  roomsUnlocked: CatRoomId[],
): boolean {
  return roomsUnlocked.includes(roomId);
}

export function normalizeRoomsUnlocked(
  value: unknown,
  equippedRoomId: CatRoomId,
): CatRoomId[] {
  const unlocked = new Set<CatRoomId>([DEFAULT_CAT_ROOM_ID, equippedRoomId]);

  if (Array.isArray(value)) {
    for (const id of value) {
      if (typeof id === "string" && isCatRoomId(id)) {
        unlocked.add(id);
      }
    }
  }

  return CAT_ROOM_IDS.filter((id) => unlocked.has(id));
}
