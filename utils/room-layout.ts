import type { PetProfile } from "@/types/game";

export const ROOM_LAYOUT_KEYS = ["roomPetOffset", "bedId", "roomBedOffset", "bedFlipped", "bedRotationDegrees", "bedScale", "placedToys", "placedDecorations", "roomLayerOrder"] as const;
export type RoomLayout = Pick<PetProfile, typeof ROOM_LAYOUT_KEYS[number]>;

export function captureRoomLayout(pet: PetProfile): RoomLayout {
  return Object.fromEntries(ROOM_LAYOUT_KEYS.map(key => [key, pet[key]])) as RoomLayout;
}

export function switchRoomLayout(pet: PetProfile, roomId: string): PetProfile {
  if (pet.roomId === roomId) return pet;
  const layouts = { ...pet.roomLayouts, [pet.roomId ?? "room1"]: captureRoomLayout(pet) };
  return { ...pet, ...(layouts[roomId] ?? captureRoomLayout(pet)), roomId, roomLayouts: layouts };
}
