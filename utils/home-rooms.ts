import { DEFAULT_HOME_ROOM_ID, isHomeRoomId, isRoomDoor, type HomeRoomId } from "@/constants/home-rooms";
import type { PetProfile, PlacedDecoration } from "@/types/game";
import { captureRoomLayout, type RoomLayout } from "@/utils/room-layout";
import { createPlacementInstanceId } from "@/utils/room-placement";
import { syncPetLayerOrder } from "@/utils/room-layer-order";

export type HomeRoomState = RoomLayout & Pick<PetProfile, "roomId" | "roomLayouts" | "savedRoomLayouts">;
const EMPTY_HOME_ROOM: HomeRoomState = {
  roomPetOffset: { x: 0, y: .12 }, bedId: undefined, roomBedOffset: undefined,
  bedFlipped: undefined, bedScale: undefined, placedToys: [], placedDecorations: [], roomLayerOrder: [],
  roomId: 'room1', roomLayouts: undefined, savedRoomLayouts: undefined,
};

/** Render another room without changing or saving the viewed room. */
export function previewHomeRoom(pet: PetProfile, destination: HomeRoomId): PetProfile {
  if ((pet.homeRoomId ?? DEFAULT_HOME_ROOM_ID) === destination) return pet;
  return { ...pet, ...(pet.homeRooms?.[destination] ?? EMPTY_HOME_ROOM),
    homeRoomId: destination, catHomeRoomId: getCatHomeRoomId(pet) };
}

export function captureHomeRoom(pet: PetProfile): HomeRoomState {
  return { ...captureRoomLayout(pet), roomId: pet.roomId ?? "room1",
    roomLayouts: pet.roomLayouts, savedRoomLayouts: pet.savedRoomLayouts };
}

/** Retire travel doors without touching owned furniture or its saved placement. */
export function removeRoomNavigationDoors(pet: PetProfile): PetProfile {
  const cleanLayout = <T extends RoomLayout>(layout: T): T => {
    const doors = layout.placedDecorations?.filter(item => isRoomDoor(item.decorationId) && item.doorDestination);
    if (!doors?.length) return layout;
    const ids = new Set(doors.map(item => item.instanceId));
    return { ...layout, placedDecorations: layout.placedDecorations?.filter(item => !ids.has(item.instanceId)),
      roomLayerOrder: layout.roomLayerOrder?.filter(item => item.kind !== 'decoration' || !ids.has(item.instanceId)) };
  };
  const cleanLayouts = (layouts: PetProfile['roomLayouts']) => {
    if (!layouts) return layouts;
    const entries = Object.entries(layouts).map(([id, layout]) => [id, cleanLayout(layout)] as const);
    return entries.some(([id, layout]) => layout !== layouts[id]) ? Object.fromEntries(entries) : layouts;
  };
  const cleanRoom = <T extends HomeRoomState>(room: T): T => {
    const layout = cleanLayout(room), roomLayouts = cleanLayouts(room.roomLayouts), savedRoomLayouts = cleanLayouts(room.savedRoomLayouts);
    return layout !== room || roomLayouts !== room.roomLayouts || savedRoomLayouts !== room.savedRoomLayouts
      ? { ...layout, roomLayouts, savedRoomLayouts } : room;
  };
  const current = cleanRoom(pet);
  if (!pet.homeRooms) return current;
  const entries = Object.entries(pet.homeRooms).map(([id, room]) => [id, cleanRoom(room)] as const);
  return entries.some(([id, room]) => room !== pet.homeRooms?.[id as HomeRoomId])
    ? { ...current, homeRooms: Object.fromEntries(entries) } : current;
}

export function createRoomDoor(destination: HomeRoomId, index = 0): PlacedDecoration {
  return { decorationId: "japaneseDoorAni", instanceId: createPlacementInstanceId(),
    doorDestination: destination, offset: { x: -0.55 + (index % 3) * 0.5, y: -0.28 }, scale: 1.4 };
}

export function getCatHomeRoomId(pet: PetProfile): HomeRoomId {
  return pet.catHomeRoomId ?? pet.homeRoomId ?? DEFAULT_HOME_ROOM_ID;
}

/** Follow an explicit cat journey in the same saved update as its arrival. */
export function sendCatToRoom(pet: PetProfile, destination: HomeRoomId): PetProfile {
  if (!isHomeRoomId(destination)) return pet;
  const moved = getCatHomeRoomId(pet) === destination ? pet
    : { ...pet, catHomeRoomId: destination, isAsleep: false, lastInteractionAt: Date.now() };
  return switchHomeRoom(moved, destination);
}

export function switchHomeRoom(pet: PetProfile, destination: HomeRoomId): PetProfile {
  const origin = pet.homeRoomId ?? DEFAULT_HOME_ROOM_ID;
  if (!isHomeRoomId(destination) || origin === destination) return pet;
  const homeRooms = { ...pet.homeRooms, [origin]: captureHomeRoom(pet) };
  // Room navigation lives in the scene controls, so new spaces start empty.
  const next = homeRooms[destination] ?? EMPTY_HOME_ROOM;
  return syncPetLayerOrder({ ...pet, ...next, homeRoomId: destination, homeRooms,
    catHomeRoomId: getCatHomeRoomId(pet) });
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
