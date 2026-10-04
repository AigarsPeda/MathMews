import { getPlacedDecorationDragSize, getPlacedDecorationSpriteId } from "@/constants/decoration-variants";
import { getPlacedToyDisplaySize } from "@/constants/cat-toys";
import { getCatWalkMotion, SOFA_JUMP_DURATION_MS, type CatRoomAnimation } from "@/constants/cat-room-motion";
import type { PetAnimationState, PlacedDecoration, PlacedToy, RoomItemOffset } from "@/types/game";

export const ROOM_IDLE_DELAY_MS = 30_000;
export type RoomPoint = { x: number; y: number };
export type RoomActivityKind = "sofaSit" | "sofaSleep" | "toyPlay" | "mouseChase";
export type RoomActivityStep = {
  position: RoomPoint;
  mood: PetAnimationState;
  animation?: CatRoomAnimation;
  animationFps?: number;
  reverse?: boolean;
  durationMs: number;
  moveMs?: number;
  scale?: number;
  hold?: boolean;
  sofaApproach?: RoomPoint;
  objectPosition?: RoomPoint;
  objectRotation?: number;
  objectMoveMs?: number;
  objectDelayMs?: number;
};
export type RoomActivityPlan = {
  kind: RoomActivityKind | "returnHome";
  targetInstanceId?: string;
  objectKind?: "toy" | "decoration";
  objectStart?: RoomPoint;
  sofaApproach?: RoomPoint;
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

function walkTo(from: RoomPoint, position: RoomPoint, petSize: number): RoomActivityStep {
  const { durationMs } = getCatWalkMotion(from, position, petSize);
  return { position, mood: "idle", animation: "walk", durationMs, moveMs: durationMs };
}

/** Getting up and jumping down precede the floor walk, including interruptions. */
export function buildRoomReturn(room: RoomActivityOptions, plan: RoomActivityPlan, stepIndex: number, position: RoomPoint): RoomActivityPlan {
  const home = roomOffsetToPoint(room.homeOffset, room.width, room.height, room.petSize);
  const step = plan.steps[stepIndex];
  const steps: RoomActivityStep[] = [];
  let floorStart = position;
  const approach = step.sofaApproach ?? plan.sofaApproach;
  if (approach && ((step.scale ?? 1) < 1 || step.sofaApproach)) {
    if (step.animation === "curlUp" || step.animation === "curlSleep") {
      steps.push({ position, mood: "lyingDown", animation: "curlUp", reverse: true, scale: step.scale, sofaApproach: approach, durationMs: 1000 });
    }
    floorStart = approach;
    steps.push({ position: floorStart, mood: "idle", animation: "jumpOff", animationFps: 24_000 / SOFA_JUMP_DURATION_MS, sofaApproach: approach, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS });
  }
  steps.push({ ...walkTo(floorStart, home, room.petSize), objectPosition: plan.objectStart, objectRotation: 0 });
  return { kind: "returnHome", targetInstanceId: plan.targetInstanceId, objectKind: plan.objectKind, objectStart: plan.objectStart, steps };
}

/** Sofa commands continue from the cat's current location and pose. */
export function routeToSofa(
  room: RoomActivityOptions,
  next: RoomActivityPlan,
  position: RoomPoint,
  current?: { plan: RoomActivityPlan; stepIndex: number } | null,
): RoomActivityPlan {
  const seatStep = next.steps[1];
  const approach = next.sofaApproach!;
  const step = current?.plan.steps[current.stepIndex];
  const sameSofa = current?.plan.targetInstanceId === next.targetInstanceId;
  const onSofa = Boolean(step?.sofaApproach && (step.scale ?? 1) < 1);
  const curled = step?.animation === "curlUp" || step?.animation === "curlSleep";
  if (sameSofa && onSofa) {
    const distance = Math.hypot(position.x - seatStep.position.x, position.y - seatStep.position.y);
    if (distance <= 2) {
      let rest = next.steps.slice(2);
      if (next.kind === "sofaSleep" && step?.animation === "curlSleep") rest = rest.slice(1);
      if (next.kind === "sofaSit" && curled) rest = [
        { ...seatStep, mood: "lyingDown", animation: "curlUp", reverse: true, moveMs: 0, durationMs: 1000 }, ...rest,
      ];
      return { ...next, steps: rest };
    }
    // A command during the jump finishes that jump without retracing the floor walk.
    const jumpDistance = Math.hypot(approach.x - seatStep.position.x, approach.y - seatStep.position.y);
    const durationMs = Math.max(200, SOFA_JUMP_DURATION_MS * distance / Math.max(1, jumpDistance));
    return { ...next, steps: [{ ...seatStep, durationMs, moveMs: durationMs, animationFps: 24 / (durationMs / 1000) }, ...next.steps.slice(2)] };
  }
  const exit = current ? buildRoomReturn(room, current.plan, current.stepIndex, position).steps.slice(0, -1) : [];
  const floorStart = exit.at(-1)?.position ?? position;
  return { ...next, steps: [...exit, walkTo(floorStart, approach, room.petSize), ...next.steps.slice(1)] };
}

/** Commands and idle choices share object eligibility and rendered coordinates. */
export function buildRoomActivity(room: RoomActivityOptions, turn: number, command?: RoomActivityKind, preferredInstanceId?: string): RoomActivityPlan | null {
  if (room.width <= room.petSize || room.height <= room.petSize) return null;
  const home = roomOffsetToPoint(room.homeOffset, room.width, room.height, room.petSize);
  const candidates: RoomActivityPlan[] = [];
  for (const sofa of room.decorations) {
    const sprite = getPlacedDecorationSpriteId(sofa);
    if (sprite !== "sofaA" && sprite !== "sofaB") continue;
    const size = getPlacedDecorationDragSize(sofa) * room.sizeScale;
    const center = roomOffsetToPoint(sofa.offset, room.width, room.height, size);
    const scale = Math.min(0.95, Math.max(0.55, size * 0.75 / room.petSize));
    const seatSide = (sprite === "sofaA" ? -1 : 1) * (sofa.wallFlipped ? -1 : 1);
    const seat = clampCatPoint({ x: center.x + seatSide * size * 0.13, y: center.y - size * 0.02 - room.petSize * 0.31 * scale }, room);
    const approach = clampCatPoint({ x: seat.x, y: center.y + size * 0.4 - room.petSize * 0.31 }, room);
    const arrive: RoomActivityStep[] = [
      walkTo(home, approach, room.petSize),
      { position: seat, mood: "idle", animation: "jumpOn", animationFps: 24_000 / SOFA_JUMP_DURATION_MS, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS, scale, sofaApproach: approach },
    ];
    const leave: RoomActivityStep[] = [
      { position: approach, mood: "idle", animation: "jumpOff", animationFps: 24_000 / SOFA_JUMP_DURATION_MS, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS, sofaApproach: approach },
      walkTo(approach, home, room.petSize),
    ];
    if (!room.asleep || command === "sofaSit") candidates.push({ kind: "sofaSit", targetInstanceId: sofa.instanceId, sofaApproach: approach, steps: [
      ...arrive, { position: seat, mood: "idle", durationMs: 12_000, scale, sofaApproach: approach, hold: Boolean(command) }, ...leave,
    ] });
    candidates.push({ kind: "sofaSleep", targetInstanceId: sofa.instanceId, sofaApproach: approach, steps: [
      ...arrive,
      { position: seat, mood: "lyingDown", animation: "curlUp", durationMs: 1000, scale, sofaApproach: approach },
      { position: seat, mood: "sleeping", animation: "curlSleep", durationMs: 25_000, scale, sofaApproach: approach, hold: Boolean(command) },
      { position: seat, mood: "lyingDown", animation: "curlUp", reverse: true, durationMs: 1000, scale, sofaApproach: approach },
      ...leave,
    ] });
  }
  if (!room.hungry && (!room.asleep || Boolean(command))) {
    const addPlay = (instanceId: string, kind: "toy" | "decoration", center: RoomPoint, yarn: boolean, rolls: boolean) => {
      const position = clampCatPoint({ x: center.x - room.petSize * 0.22, y: center.y - room.petSize * 0.28 }, room);
      const steps = [walkTo(home, position, room.petSize)];
      let catPosition = position;
      // Each paw contact sends the placed object along the floor. Cat follows it.
      for (const direction of [1, -1, 1, -1]) {
        const objectPosition = rolls ? {
          x: Math.max(-room.width * 0.24, Math.min(room.width * 0.24, center.x + direction * room.petSize * 0.22)),
          y: Math.max(room.height * 0.08, Math.min(room.height * 0.28, center.y + direction * room.petSize * 0.03)),
        } : center;
        const next = clampCatPoint({ x: objectPosition.x - room.petSize * 0.22, y: objectPosition.y - room.petSize * 0.28 }, room);
        steps.push({ position: catPosition, mood: yarn ? "playYarn" : "playBall", animation: "batToy", durationMs: 2000,
          objectPosition, objectRotation: rolls ? direction * 150 : direction * 4, objectMoveMs: 700, objectDelayMs: 650 });
        if (rolls) steps.push(walkTo(catPosition, next, room.petSize));
        catPosition = next;
      }
      steps.push({ ...walkTo(steps.at(-1)!.position, home, room.petSize), objectPosition: center, objectRotation: 0 });
      candidates.push({ kind: "toyPlay", targetInstanceId: instanceId, objectKind: kind, objectStart: center, steps });
    };
    for (const toy of room.toys) {
      if (toy.toyId === "mouse") continue;
      const center = roomOffsetToPoint(toy.offset, room.width, room.height, getPlacedToyDisplaySize(toy) * room.sizeScale);
      addPlay(toy.instanceId, "toy", center, false, toy.toyId.includes("Ball"));
    }
    for (const decoration of room.decorations) {
      if (decoration.decorationId !== "yarnRed" && decoration.decorationId !== "yarnBlue") continue;
      const center = roomOffsetToPoint(decoration.offset, room.width, room.height, getPlacedDecorationDragSize(decoration) * room.sizeScale);
      addPlay(decoration.instanceId, "decoration", center, true, true);
    }
    const mouse = room.toys.find(toy => toy.toyId === "mouse");
    if (mouse || room.ownedToyIds.includes("mouse")) {
      const start = mouse ? roomOffsetToPoint(mouse.offset, room.width, room.height, getPlacedToyDisplaySize(mouse) * room.sizeScale) : { x: 0, y: room.height * 0.18 };
      const steps: RoomActivityStep[] = [];
      for (const direction of [-1, 1, -1, 1]) {
        const x = Math.max(-room.width * 0.24, Math.min(room.width * 0.24, start.x + direction * room.width * 0.16));
        const y = Math.min(room.height * 0.28, Math.max(room.height * 0.08 + Math.abs(x) * 0.35, start.y));
        const objectPosition = { x, y };
        const position = clampCatPoint({ x: x - direction * room.petSize * 0.22, y: y - room.petSize * 0.28 }, room);
        const walk = walkTo(steps.at(-1)?.position ?? home, position, room.petSize);
        steps.push({ ...walk, objectPosition });
      }
      steps.push({ ...walkTo(steps.at(-1)!.position, home, room.petSize), objectPosition: start });
      candidates.push({ kind: "mouseChase", targetInstanceId: mouse?.instanceId, objectKind: "toy", objectStart: start, steps });
    }
  }
  const eligible = command ? candidates.filter(plan => plan.kind === command) : candidates;
  return eligible.find(plan => preferredInstanceId !== undefined && plan.targetInstanceId === preferredInstanceId)
    ?? eligible[turn % eligible.length] ?? null;
}
