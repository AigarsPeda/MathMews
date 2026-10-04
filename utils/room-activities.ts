import { getPlacedDecorationDragSize, getPlacedDecorationSpriteId } from "@/constants/decoration-variants";
import { getToyDisplaySize } from "@/constants/cat-toys";
import type { PetAnimationState, PlacedDecoration, PlacedToy, RoomItemOffset } from "@/types/game";

export const ROOM_IDLE_DELAY_MS = 30_000;
export type RoomPoint = { x: number; y: number };
export type RoomActivityStep = {
  position: RoomPoint;
  mood: PetAnimationState;
  durationMs: number;
  moveMs?: number;
  scale?: number;
  jump?: boolean;
  mousePosition?: RoomPoint;
};
export type RoomActivityPlan = {
  kind: "sofaSit" | "sofaSleep" | "toyPlay" | "mouseChase";
  targetInstanceId?: string;
  mouseInstanceId?: string;
  mouseStart?: RoomPoint;
  steps: RoomActivityStep[];
};
export type RoomActivityOptions = {
  width: number;
  height: number;
  petSize: number;
  sizeScale: number;
  homeOffset: RoomItemOffset;
  decorations: PlacedDecoration[];
  toys: PlacedToy[];
  ownedToyIds: string[];
  hungry: boolean;
  asleep: boolean;
};

export function roomOffsetToPoint(offset: RoomItemOffset, width: number, height: number, size: number): RoomPoint {
  return { x: offset.x * Math.max(0, (width - size) / 2), y: offset.y * Math.max(0, (height - size) / 2) };
}

function clampCatPoint(point: RoomPoint, room: RoomActivityOptions): RoomPoint {
  const maxX = Math.max(0, (room.width - room.petSize) / 2);
  const maxY = Math.max(0, (room.height - room.petSize) / 2);
  return { x: Math.max(-maxX, Math.min(maxX, point.x)), y: Math.max(-maxY, Math.min(maxY, point.y)) };
}

/** Use rendered object coordinates, including each sprite's scale and facing. */
export function buildRoomActivity(room: RoomActivityOptions, turn: number): RoomActivityPlan | null {
  if (room.width <= room.petSize || room.height <= room.petSize) return null;
  const home = roomOffsetToPoint(room.homeOffset, room.width, room.height, room.petSize);
  const candidates: RoomActivityPlan[] = [];
  for (const sofa of room.decorations) {
    const sprite = getPlacedDecorationSpriteId(sofa);
    if (sprite !== "sofaA" && sprite !== "sofaB") continue;
    const size = getPlacedDecorationDragSize(sofa) * room.sizeScale;
    const center = roomOffsetToPoint(sofa.offset, room.width, room.height, size);
    const scale = Math.min(1, Math.max(0.55, size * 0.75 / room.petSize));
    const seatSide = (sprite === "sofaA" ? -1 : 1) * (sofa.wallFlipped ? -1 : 1);
    const seat = clampCatPoint({ x: center.x + seatSide * size * 0.13, y: center.y - size * 0.02 - room.petSize * 0.31 * scale }, room);
    const approach = clampCatPoint({ x: seat.x, y: center.y + size * 0.4 - room.petSize * 0.31 }, room);
    const arrive: RoomActivityStep[] = [
      { position: approach, mood: "idle", durationMs: 2200, moveMs: 2200 },
      { position: seat, mood: "idle", durationMs: 900, moveMs: 900, scale, jump: true },
    ];
    const leave: RoomActivityStep[] = [
      { position: approach, mood: "idle", durationMs: 800, moveMs: 800, jump: true },
      { position: home, mood: "idle", durationMs: 2200, moveMs: 2200 },
    ];
    if (!room.asleep) candidates.push({ kind: "sofaSit", targetInstanceId: sofa.instanceId, steps: [
      ...arrive, { position: seat, mood: "idle", durationMs: 12_000, scale }, ...leave,
    ] });
    candidates.push({ kind: "sofaSleep", targetInstanceId: sofa.instanceId, steps: [
      ...arrive,
      { position: seat, mood: "lyingDown", durationMs: 1500, scale },
      { position: seat, mood: "sleeping", durationMs: 25_000, scale },
      ...leave,
    ] });
  }
  if (!room.hungry && !room.asleep) {
    for (const toy of room.toys) {
      if (toy.toyId === "mouse") continue;
      const size = getToyDisplaySize(toy.toyId) * room.sizeScale;
      const center = roomOffsetToPoint(toy.offset, room.width, room.height, size);
      const position = clampCatPoint({ x: center.x - room.petSize * 0.22, y: center.y - room.petSize * 0.28 }, room);
      candidates.push({ kind: "toyPlay", targetInstanceId: toy.instanceId, steps: [
        { position, mood: "idle", durationMs: 2200, moveMs: 2200 },
        { position, mood: toy.toyId.includes("Ball") ? "playBall" : "excited", durationMs: 8000 },
        { position: home, mood: "idle", durationMs: 2200, moveMs: 2200 },
      ] });
    }
    const mouse = room.toys.find(toy => toy.toyId === "mouse");
    if (mouse || room.ownedToyIds.includes("mouse")) {
      const mouseSize = getToyDisplaySize("mouse") * room.sizeScale;
      const start = mouse ? roomOffsetToPoint(mouse.offset, room.width, room.height, mouseSize) : { x: 0, y: room.height * 0.18 };
      const steps: RoomActivityStep[] = [];
      for (const direction of [-1, 1, -1, 1]) {
        // Keep the chase on the floor diamond and inside the room at every size.
        const x = Math.max(-room.width * 0.24, Math.min(room.width * 0.24, start.x + direction * room.width * 0.16));
        const y = Math.min(room.height * 0.28, Math.max(room.height * 0.08 + Math.abs(x) * 0.35, start.y));
        const mousePosition = { x, y };
        steps.push({ position: clampCatPoint({ x: x - direction * room.petSize * 0.22, y: y - room.petSize * 0.28 }, room),
          mousePosition, mood: "idle", durationMs: 2300, moveMs: 2100 });
      }
      steps.push({ position: home, mousePosition: start, mood: "idle", durationMs: 2200, moveMs: 2200 });
      candidates.push({ kind: "mouseChase", mouseInstanceId: mouse?.instanceId, mouseStart: start, steps });
    }
  }
  return candidates[turn % candidates.length] ?? null;
}
