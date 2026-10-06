export const HOME_ROOM_IDS = ["livingRoom", "bedroom", "bathroom", "kitchen"] as const;
export type HomeRoomId = typeof HOME_ROOM_IDS[number];
export const DEFAULT_HOME_ROOM_ID: HomeRoomId = "livingRoom";

export function isHomeRoomId(value: unknown): value is HomeRoomId {
  return typeof value === "string" && HOME_ROOM_IDS.some(id => id === value);
}

export function isRoomDoor(decorationId: string): boolean {
  return decorationId === "japaneseDoorAni" || decorationId === "japaneseSlidingDoorAni";
}
