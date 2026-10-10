import { ROOM_DEPTH_ANCHORS } from "@/constants/room-depth-anchors";

/** Floor-contact depth, independent of sprite height and raised paws/toys. */
export function getRoomDepthZIndex(groundY: number, tieBreaker = 0): number {
  "worklet";
  const depth = Math.max(0, Math.min(4095, Math.round((groundY + 512) * 4)));
  return 1000 + depth * 128 + Math.min(127, Math.max(0, tieBreaker));
}

/** Wall-mounted pictures and rugs belong behind things standing on the floor. */
export function isRoomBackgroundDecoration(id: string): boolean {
  return /carpet|rug|poster|window|canvas|diploma|photos|pictureframe|portrait|mirror|corkboard|aircon|^officeAc$|ClockAni|ProjectorScreen|hanging|hanger|tapwall|showertap|tapshower/i.test(id)
    || /^kitchenWallCabinet/i.test(id) || /^(door|curtain|wallSpot)/i.test(id) || id === "halloweenBatGarland" || id === "officeBoardEmpty" || id === "officeBoardFull";
}
export function getRoomObjectDepthAnchor(id: string): number {
  return ROOM_DEPTH_ANCHORS[id] ?? .38;
}
