import { DEFAULT_HOME_ROOM_ID, isHomeRoomId, isRoomDoor, type HomeRoomId } from "@/constants/home-rooms";
import type { PetProfile, PlacedDecoration } from "@/types/game";
import { captureRoomLayout, type RoomLayout } from "@/utils/room-layout";
import { createPlacementInstanceId } from "@/utils/room-placement";
import { syncPetLayerOrder } from "@/utils/room-layer-order";

export type HomeRoomState = RoomLayout & Pick<PetProfile, "roomId" | "roomLayouts" | "savedRoomLayouts">;

export function captureHomeRoom(pet: PetProfile): HomeRoomState {
  return { ...captureRoomLayout(pet), roomId: pet.roomId ?? "room1",
    roomLayouts: pet.roomLayouts, savedRoomLayouts: pet.savedRoomLayouts };
}

export function createRoomDoor(destination: HomeRoomId, index = 0): PlacedDecoration {
  return { decorationId: "japaneseDoorAni", instanceId: createPlacementInstanceId(),
    doorDestination: destination, offset: { x: -0.55 + (index % 3) * 0.5, y: -0.28 }, scale: 1.4 };
}

export function switchHomeRoom(pet: PetProfile, destination: HomeRoomId): PetProfile {
  const origin = pet.homeRoomId ?? DEFAULT_HOME_ROOM_ID;
  if (!isHomeRoomId(destination) || origin === destination) return pet;
  const homeRooms = { ...pet.homeRooms, [origin]: captureHomeRoom(pet) };
  // New spaces start empty with a door back to the room we came from.
  const next: HomeRoomState = homeRooms[destination] ?? {
    ...captureRoomLayout({ ...pet, roomPetOffset: { x: 0, y: 0.12 }, bedId: undefined,
      roomBedOffset: undefined, bedFlipped: undefined, bedScale: undefined,
      placedToys: [], placedDecorations: [createRoomDoor(origin)], roomLayerOrder: [] }),
    roomId: "room1", roomLayouts: undefined, savedRoomLayouts: undefined,
  };
  return syncPetLayerOrder({ ...pet, ...next, homeRoomId: destination, homeRooms,
    isAsleep: false, lastInteractionAt: Date.now() });
}

export function addRoomDoor(pet: PetProfile, destination: HomeRoomId): PetProfile {
  if (!isHomeRoomId(destination) || destination === (pet.homeRoomId ?? DEFAULT_HOME_ROOM_ID)) return pet;
  const doors = pet.placedDecorations?.filter(item => isRoomDoor(item.decorationId)) ?? [];
  return syncPetLayerOrder({ ...pet,
    placedDecorations: [...pet.placedDecorations ?? [], createRoomDoor(destination, doors.length)] });
}

export function setDoorDestination(pet: PetProfile, instanceId: string, destination: HomeRoomId): PetProfile {
  if (!isHomeRoomId(destination) || destination === (pet.homeRoomId ?? DEFAULT_HOME_ROOM_ID)) return pet;
  const door = pet.placedDecorations?.find(item => item.instanceId === instanceId && isRoomDoor(item.decorationId));
  if (!door) return pet;
  return { ...pet, placedDecorations: pet.placedDecorations?.map(item => item === door ? { ...item, doorDestination: destination } : item) };
}
