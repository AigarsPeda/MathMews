/** Original Blender renders. */
export const CAT_ROOM_SOURCES = {
  room1: require("@/assets/3d/rooms/room1.png"),
  room2: require("@/assets/3d/rooms/room2.png"),
  room3: require("@/assets/3d/rooms/room3.png"),
  room4: require("@/assets/3d/rooms/room4.png"),
  room5: require("@/assets/3d/rooms/room5.png"),
  room6: require("@/assets/3d/rooms/room6.png"),
  room7: require("@/assets/3d/rooms/room7.png"),
  room8: require("@/assets/3d/rooms/room8.png"),
  room9: require("@/assets/3d/rooms/room9.png"),
  room10: require("@/assets/3d/rooms/room10.png"),
  room11: require("@/assets/3d/rooms/room11.png"),
  room12: require("@/assets/3d/rooms/room12.png"),
  room13: require("@/assets/3d/rooms/room13.png"),
  room14: require("@/assets/3d/rooms/room14.png"),
  room15: require("@/assets/3d/rooms/room15.png"),
} as const;

export type CatRoomId = keyof typeof CAT_ROOM_SOURCES;

export const CAT_ROOM_IDS = Object.keys(CAT_ROOM_SOURCES) as CatRoomId[];

export const DEFAULT_CAT_ROOM_ID: CatRoomId = "room1";

export function resolveCatRoomId(roomId: string | undefined): CatRoomId {
  if (roomId && roomId in CAT_ROOM_SOURCES) {
    return roomId as CatRoomId;
  }
  return DEFAULT_CAT_ROOM_ID;
}

export function getCatRoomSource(roomId: string | undefined): number {
  return CAT_ROOM_SOURCES[resolveCatRoomId(roomId)];
}

export function isCatRoomId(value: string): value is CatRoomId {
  return value in CAT_ROOM_SOURCES;
}
