import STORE_PRICES from "@/data/store-prices.json";
import {
  CAT_ROOM_IDS,
  DEFAULT_CAT_ROOM_ID,
  isCatRoomId,
  resolveCatRoomId,
  type CatRoomId,
} from "@/constants/cat-rooms";
import type { RoomPurchaseResult, StorePrice } from "@/types/store";



/** Catalog pricing — change amounts here; swap kind to `iap` per room later. */
export function getRoomStorePrice(roomId: CatRoomId): StorePrice {
  const amount = STORE_PRICES.room[roomId];
  return amount === 0 ? { kind: "free" } : { kind: "coins", amount };
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

export function tryPurchaseRoom(params: {
  roomId: CatRoomId;
  walletCoins: number;
  roomsUnlocked: CatRoomId[];
}): {
  result: RoomPurchaseResult;
  walletCoins: number;
  roomsUnlocked: CatRoomId[];
} {
  const roomId = resolveCatRoomId(params.roomId);
  const price = getRoomStorePrice(roomId);

  if (price.kind === "iap") {
    return {
      result: "not_for_sale",
      walletCoins: params.walletCoins,
      roomsUnlocked: params.roomsUnlocked,
    };
  }

  if (isRoomUnlocked(roomId, params.roomsUnlocked)) {
    return {
      result: "already_owned",
      walletCoins: params.walletCoins,
      roomsUnlocked: params.roomsUnlocked,
    };
  }

  if (price.kind === "free") {
    return {
      result: "purchased",
      walletCoins: params.walletCoins,
      roomsUnlocked: [...params.roomsUnlocked, roomId],
    };
  }

  if (params.walletCoins < price.amount) {
    return {
      result: "insufficient_funds",
      walletCoins: params.walletCoins,
      roomsUnlocked: params.roomsUnlocked,
    };
  }

  return {
    result: "purchased",
    walletCoins: params.walletCoins - price.amount,
    roomsUnlocked: [...params.roomsUnlocked, roomId],
  };
}
