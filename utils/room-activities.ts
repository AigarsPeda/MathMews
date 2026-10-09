import type { RoomCommandKind } from "@/constants/room-commands";
import { isCatSeatDecorationId } from "@/constants/sofa-decorations";
import { bathroomFixtureKind, type BathroomPhase } from "@/constants/bathroom-activities";
import { isPlayablePlant } from "@/constants/plant-play";
import { isFoodBowlDecorationId } from "@/constants/cat-supplies-decorations";
import { CAT_ANIMATION_CLIPS } from "@/constants/cat-animation-clips";
import type { NativeRoomWorld, NativeTravel, Vec3 } from "@/utils/native-room-world";
import { findFoodBowlApproach } from "@/utils/native-room-world";
import { isHomeRoomId, isRoomDoor, roomTravelDirection, type HomeRoomId, type RoomEntry, type RoomTravelDirection } from "@/constants/home-rooms";
import { getPlacedDecorationDragSize, getPlacedDecorationSpriteId } from "@/constants/decoration-variants";
import { getPlacedToyDisplaySize } from "@/constants/cat-toys";
import { getCatWalkMotion, SOFA_JUMP_DURATION_MS, type CatRoomAnimation } from "@/constants/cat-room-motion";
import type { PetAnimationState, PlacedDecoration, PlacedToy, RoomItemOffset } from "@/types/game";

export const ROOM_IDLE_DELAY_MS = 30_000;
export const ROOM_MEAL_DURATION_MS = 8_000;
export type RoomPoint = { x: number; y: number };
export type RoomActivityKind = RoomCommandKind | "doorTravel" | "roomTravel";
export type RoomActivityStep = {
  native?: NativeTravel;
  /** The source furnishing stays attached to exit steps after a new command. */
  targetInstanceId?: string;
  position: RoomPoint;
  mood: PetAnimationState;
  animation?: CatRoomAnimation;
  animationFps?: number;
  reverse?: boolean;
  durationMs: number;
  moveMs?: number;
  hold?: boolean;
  sofaApproach?: RoomPoint;
  /** Floor approach intent is distinct from being supported by the seat. */
  approachingSeat?: boolean;
  seatApproach?: Vec3;
  treeApproach?: Vec3;
  plantApproach?: Vec3;
  bathroomPhase?: BathroomPhase;
  bathroomApproach?: Vec3;
  bowlApproach?: boolean;
  returnHome?: boolean;
  leavingRoom?: boolean;
  enteringRoom?: boolean;
  travelDirection?: RoomTravelDirection;
  objectPosition?: RoomPoint;
  objectRotation?: number;
  objectMoveMs?: number;
  objectDelayMs?: number;
};
export type RoomActivityPlan = {
  kind: RoomActivityKind | "returnHome";
  stopForEditing?: boolean;
  destination?: HomeRoomId;
  targetInstanceId?: string;
  objectKind?: "toy" | "decoration";
  objectStart?: RoomPoint;
  sofaApproach?: RoomPoint;
  steps: RoomActivityStep[];
};
export type RoomActivityOptions = {
  nativeWorld?: NativeRoomWorld;
  /** Filament advances steps from rendered arrivals and completed clips. */
  nativeStepCompletion?: boolean;
  homeRoomId?: HomeRoomId;
  entry?: RoomEntry;
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

export function roomActivityStepKey(state: { plan: RoomActivityPlan; stepIndex: number; startedAt: number }): string {
  return `${state.plan.kind}:${state.plan.targetInstanceId}:${state.stepIndex}:${state.startedAt}`;
}

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

export function buildRoomEntry(room: RoomActivityOptions): RoomActivityPlan | null {
  if (!room.entry || room.width <= room.petSize || room.height <= room.petSize) return null;
  const home = roomOffsetToPoint(room.homeOffset, room.width, room.height, room.petSize);
  const edge = clampCatPoint({ x: -room.entry.direction * room.width * .3, y: room.height * .25 }, room);
  return { kind: "returnHome", steps: [{ ...walkTo(edge, home, room.petSize), enteringRoom: true,
    returnHome: true, travelDirection: room.entry.direction }] };
}

/** Getting up and jumping down precede the floor walk, including interruptions. */
export function buildRoomReturn(room: RoomActivityOptions, plan: RoomActivityPlan, stepIndex: number, position: RoomPoint): RoomActivityPlan {
  const home = roomOffsetToPoint(room.homeOffset, room.width, room.height, room.petSize);
  const step = plan.steps[stepIndex];
  const steps: RoomActivityStep[] = [];
  let floorStart = position;
  const approach = step.sofaApproach ?? plan.sofaApproach;
  const sourceInstanceId = step.targetInstanceId ?? plan.targetInstanceId;
  if (step.bathroomPhase && sourceInstanceId) {
    const inside = ["enter", "wash", "use"].includes(step.bathroomPhase);
    if (inside) steps.push({ position, mood: "idle", animation: "jumpOff",
      bathroomPhase: "exit", bathroomApproach: step.bathroomApproach,
      targetInstanceId: sourceInstanceId, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS });
    if (plan.kind === "toiletUse" || room.decorations.some(item => item.instanceId === sourceInstanceId && bathroomFixtureKind(item.decorationId) === "toilet"))
      steps.push({ position, mood: "idle", animation: "sit", bathroomPhase: "close",
        bathroomApproach: step.bathroomApproach, targetInstanceId: sourceInstanceId, durationMs: 700 });
  }
  if (step.sofaApproach && approach) {
    if (step.animation === "curlUp" || step.animation === "curlSleep") {
      steps.push({ position, mood: "lyingDown", animation: "curlUp", reverse: true, sofaApproach: approach, seatApproach: step.seatApproach, targetInstanceId: sourceInstanceId, durationMs: 1000 });
    }
    floorStart = approach;
    steps.push({ position: floorStart, mood: "idle", animation: "jumpOff", animationFps: 24_000 / SOFA_JUMP_DURATION_MS, sofaApproach: approach, seatApproach: step.seatApproach, treeApproach: step.treeApproach, targetInstanceId: sourceInstanceId, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS });
  }
  steps.push({ ...walkTo(floorStart, home, room.petSize), returnHome: true, objectPosition: plan.objectStart, objectRotation: 0 });
  return { kind: "returnHome", targetInstanceId: plan.targetInstanceId, objectKind: plan.objectKind, objectStart: plan.objectStart, steps };
}

/** Sofa commands continue from the cat's current location and pose. */
/** Leave a perch/fixture before editing or another command, without a detour home. */
export function buildRoomExit(room: RoomActivityOptions, plan: RoomActivityPlan, stepIndex: number, position: RoomPoint): RoomActivityPlan {
  const returning = buildRoomReturn(room, plan, stepIndex, position);
  return { ...returning, steps: returning.steps.filter(step => !step.returnHome) };
}

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
  const onSofa = Boolean(step?.sofaApproach && step.animation !== "jumpOff");
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
  return { ...next, steps: [...exit, { ...walkTo(floorStart, approach, room.petSize), approachingSeat: true }, ...next.steps.slice(1)] };
}

/** Commands and idle choices share object eligibility and rendered coordinates. */
export function buildRoomActivity(room: RoomActivityOptions, turn: number, command?: RoomActivityKind, preferredInstanceId?: string): RoomActivityPlan | null {
  if (room.width <= room.petSize || room.height <= room.petSize) return null;
  const home = roomOffsetToPoint(room.homeOffset, room.width, room.height, room.petSize);
  const candidates: RoomActivityPlan[] = [];
  if (command === "roomTravel") {
    if (!isHomeRoomId(preferredInstanceId)) return null;
    const direction = roomTravelDirection(room.homeRoomId ?? "livingRoom", preferredInstanceId);
    return { kind: "roomTravel", destination: preferredInstanceId, steps: [
      { ...walkTo(home, clampCatPoint({ x: direction * room.width * .3, y: room.height * .25 }, room), room.petSize), leavingRoom: true, travelDirection: direction },
    ] };
  }
  if (command === "doorTravel") {
    const door = room.decorations.find(item => item.instanceId === preferredInstanceId && isRoomDoor(item.decorationId) && isHomeRoomId(item.doorDestination));
    if (!door) return null;
    const size = getPlacedDecorationDragSize(door) * room.sizeScale;
    const center = roomOffsetToPoint(door.offset, room.width, room.height, size);
    const threshold = clampCatPoint({ x: center.x, y: center.y + size * 0.42 - room.petSize * 0.3 }, room);
    return { kind: "doorTravel", targetInstanceId: door.instanceId, steps: [walkTo(home, threshold, room.petSize)] };
  }
  if (command === "bowlEat") {
    const bowls = room.decorations.filter(item => isFoodBowlDecorationId(item.decorationId)
      && (preferredInstanceId === undefined || item.instanceId === preferredInstanceId));
    // The general Eat command can use another bowl when the first is enclosed.
    // A furnishing-specific command always keeps the selected bowl's identity.
    const world = room.nativeWorld;
    const bowl = world ? bowls.find(item => {
      const object = world.objects.find(object => object.instanceId === item.instanceId);
      return object && findFoodBowlApproach(world.home, object, world);
    }) : bowls[0];
    if (!bowl) return null;
    const size = getPlacedDecorationDragSize(bowl) * room.sizeScale;
    const center = roomOffsetToPoint(bowl.offset, room.width, room.height, size);
    const position = clampCatPoint({ x: center.x, y: center.y - room.petSize * 0.3 }, room);
    const [frames] = CAT_ANIMATION_CLIPS.eating;
    return { kind: "bowlEat", targetInstanceId: bowl.instanceId, steps: [
      { ...walkTo(home, position, room.petSize), bowlApproach: true },
      { position, mood: "eating", animation: "eating", animationFps: frames / (ROOM_MEAL_DURATION_MS / 1000), durationMs: ROOM_MEAL_DURATION_MS },
      { ...walkTo(position, home, room.petSize), returnHome: true },
    ] };
  }
  if (command === "bathWash" || command === "showerWash" || command === "toiletUse") {
    const kind = command === "bathWash" ? "bath" : command === "showerWash" ? "shower" : "toilet";
    const fixture = room.decorations.find(item => bathroomFixtureKind(item.decorationId) === kind
      && (preferredInstanceId === undefined || item.instanceId === preferredInstanceId));
    if (!fixture) return null;
    const size = getPlacedDecorationDragSize(fixture) * room.sizeScale;
    const center = roomOffsetToPoint(fixture.offset, room.width, room.height, size);
    const approach = clampCatPoint({ x: center.x, y: center.y + size * .45 }, room);
    const position = clampCatPoint({ x: center.x, y: center.y - room.petSize * .25 }, room);
    return { kind: command, targetInstanceId: fixture.instanceId, objectKind: "decoration", steps: [
      { ...walkTo(home, approach, room.petSize), bathroomPhase: "approach" },
      ...(kind === "toilet" ? [{ position: approach, mood: "idle" as const, animation: "sit" as const, bathroomPhase: "open" as const, durationMs: 700 }] : []),
      { position, mood: "idle", animation: "jumpOn", bathroomPhase: "enter", durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS },
      { position, mood: "idle", animation: kind === "toilet" ? "sit" : "wash", bathroomPhase: kind === "toilet" ? "use" : "wash", durationMs: kind === "toilet" ? 6000 : 8000 },
      { position: approach, mood: "idle", animation: "jumpOff", bathroomPhase: "exit", durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS },
      ...(kind === "toilet" ? [{ position: approach, mood: "idle" as const, animation: "sit" as const, bathroomPhase: "close" as const, durationMs: 700 }] : []),
      { ...walkTo(approach, home, room.petSize), returnHome: true },
    ] };
  }
  for (const sofa of room.decorations) {
    const sprite = getPlacedDecorationSpriteId(sofa);
    if (!isCatSeatDecorationId(sprite)) continue;
    const size = getPlacedDecorationDragSize(sofa) * room.sizeScale;
    const center = roomOffsetToPoint(sofa.offset, room.width, room.height, size);
    const seatSide = (sprite === "sofaB" ? 1 : -1) * (sofa.wallFlipped ? -1 : 1);
    const seat = clampCatPoint({ x: center.x + seatSide * size * 0.13, y: center.y - size * 0.02 - room.petSize * 0.31 }, room);
    const approach = clampCatPoint({ x: seat.x, y: center.y + size * 0.4 - room.petSize * 0.31 }, room);
    const arrive: RoomActivityStep[] = [
      { ...walkTo(home, approach, room.petSize), approachingSeat: true },
      { position: seat, mood: "idle", animation: "jumpOn", animationFps: 24_000 / SOFA_JUMP_DURATION_MS, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS, sofaApproach: approach },
    ];
    const leave: RoomActivityStep[] = [
      { position: approach, mood: "idle", animation: "jumpOff", animationFps: 24_000 / SOFA_JUMP_DURATION_MS, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS, sofaApproach: approach },
      { ...walkTo(approach, home, room.petSize), returnHome: true },
    ];
    if (!room.asleep || command === "sofaSit") candidates.push({ kind: "sofaSit", targetInstanceId: sofa.instanceId, sofaApproach: approach, steps: [
      ...arrive, { position: seat, mood: "idle", animation: "sit", durationMs: 12_000, sofaApproach: approach, hold: Boolean(command) }, ...leave,
    ] });
    candidates.push({ kind: "sofaSleep", targetInstanceId: sofa.instanceId, sofaApproach: approach, steps: [
      ...arrive,
      { position: seat, mood: "lyingDown", animation: "curlUp", durationMs: 1000, sofaApproach: approach },
      { position: seat, mood: "sleeping", animation: "curlSleep", durationMs: 25_000, sofaApproach: approach, hold: Boolean(command) },
      { position: seat, mood: "lyingDown", animation: "curlUp", reverse: true, durationMs: 1000, sofaApproach: approach },
      ...leave,
    ] });
  }
  if ((!room.hungry || Boolean(command)) && (!room.asleep || Boolean(command))) {
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
      steps.push({ ...walkTo(steps.at(-1)!.position, home, room.petSize), returnHome: true, objectPosition: center, objectRotation: 0 });
      candidates.push({ kind: "toyPlay", targetInstanceId: instanceId, objectKind: kind, objectStart: center, steps });
    };
    const addTreePlay = (instanceId: string, kind: "toy" | "decoration", center: RoomPoint) => {
      const approach = clampCatPoint({ x: center.x + room.petSize * .4, y: center.y }, room);
      const seat = { x: center.x, y: center.y - room.petSize * .4 };
      const bat = (position: RoomPoint, onPlatform = false): RoomActivityStep => ({ position, mood: "playBall",
        animation: "batToy", durationMs: 2000, sofaApproach: onPlatform ? approach : undefined });
      const object = room.nativeWorld!.objects.find(o => o.instanceId === instanceId);
      const fitsPlatform = object && object.scale >= room.nativeWorld!.catScale;
      const platform: RoomActivityStep[] = fitsPlatform ? [
        { position: seat, mood: "idle", animation: "jumpOn", durationMs: SOFA_JUMP_DURATION_MS,
          moveMs: SOFA_JUMP_DURATION_MS, sofaApproach: approach },
        bat(seat, true), bat(seat, true),
        { position: approach, mood: "idle", animation: "jumpOff", durationMs: SOFA_JUMP_DURATION_MS,
          moveMs: SOFA_JUMP_DURATION_MS, sofaApproach: approach },
      ] : [];
      candidates.push({ kind: "toyPlay", targetInstanceId: instanceId, objectKind: kind, sofaApproach: approach, steps: [
        walkTo(home, approach, room.petSize), bat(approach), bat(approach),
        ...platform,
        { ...walkTo(approach, home, room.petSize), returnHome: true },
      ] });
    };
    for (const toy of room.toys) {
      if (toy.toyId === "mouse") continue;
      const center = roomOffsetToPoint(toy.offset, room.width, room.height, getPlacedToyDisplaySize(toy) * room.sizeScale);
      if (toy.toyId.startsWith("scratchPost") && room.nativeWorld) { addTreePlay(toy.instanceId, "toy", center); continue; }
      addPlay(toy.instanceId, "toy", center, false, toy.toyId.includes("Ball"));
    }
    for (const decoration of room.decorations) {
      if (isPlayablePlant(decoration.decorationId) && room.nativeWorld) {
        const center = roomOffsetToPoint(decoration.offset, room.width, room.height, getPlacedDecorationDragSize(decoration) * room.sizeScale);
        const approach = clampCatPoint({ x: center.x, y: center.y + room.petSize * .3 }, room);
        candidates.push({ kind: 'plantPlay', targetInstanceId: decoration.instanceId, objectKind: 'decoration', steps: [
          walkTo(home, approach, room.petSize),
          ...Array.from({ length: 3 }, () => ({ position: approach, mood: 'playBall' as const, animation: 'batToy' as const, durationMs: 2000 })),
          { ...walkTo(approach, home, room.petSize), returnHome: true },
        ] });
        continue;
      }
      if (decoration.decorationId.startsWith("catTree") && room.nativeWorld) {
        const center = roomOffsetToPoint(decoration.offset, room.width, room.height, getPlacedDecorationDragSize(decoration) * room.sizeScale);
        addTreePlay(decoration.instanceId, "decoration", center); continue;
      }
      if (decoration.decorationId !== "yarnRed" && decoration.decorationId !== "yarnBlue") continue;
      const center = roomOffsetToPoint(decoration.offset, room.width, room.height, getPlacedDecorationDragSize(decoration) * room.sizeScale);
      addPlay(decoration.instanceId, "decoration", center, true, true);
    }
    for (const mouse of room.toys.filter(toy => toy.toyId === "mouse")) {
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
      steps.push({ ...walkTo(steps.at(-1)!.position, home, room.petSize), returnHome: true, objectPosition: start });
      candidates.push({ kind: "mouseChase", targetInstanceId: mouse?.instanceId, objectKind: "toy", objectStart: start, steps });
    }
  }
  const eligible = command ? candidates.filter(plan => plan.kind === command) : candidates;
  return preferredInstanceId !== undefined ? eligible.find(plan => plan.targetInstanceId === preferredInstanceId) ?? null
    : eligible[turn % eligible.length] ?? null;
}
