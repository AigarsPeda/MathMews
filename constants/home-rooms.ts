import type { AppIconName } from "@/constants/app-icons";

export const HOME_ROOM_IDS = ["bedroom", "livingRoom", "kitchen", "bathroom"] as const;
export type HomeRoomId = typeof HOME_ROOM_IDS[number];
export const HOME_ROOM_ICONS = {
  bedroom: "bedroom-bed", livingRoom: "sofa", kitchen: "cooking-pot", bathroom: "bathtub",
} as const satisfies Record<HomeRoomId, AppIconName>;
export const DEFAULT_HOME_ROOM_ID: HomeRoomId = "livingRoom";

export type RoomTravelDirection = -1 | 1;
export type RoomEntry = { id: number; direction: RoomTravelDirection };

export function roomTravelDirection(origin: HomeRoomId, destination: HomeRoomId): RoomTravelDirection {
  return HOME_ROOM_IDS.indexOf(destination) < HOME_ROOM_IDS.indexOf(origin) ? -1 : 1;
}

export function isHomeRoomId(value: unknown): value is HomeRoomId {
  return typeof value === "string" && HOME_ROOM_IDS.some(id => id === value);
}

export function isRoomDoor(decorationId: string): boolean {
  return decorationId === "japaneseDoorAni" || decorationId === "japaneseSlidingDoorAni";
}
