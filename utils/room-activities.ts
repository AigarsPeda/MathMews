import { CAT_SLEEP_POSES, sleepTransitionTiming, type CatSleepPose } from '@/constants/cat-sleep';
import type { CatGait } from '@/utils/native-cat-gaits';
import type { CatTravelMotion } from '@/utils/native-cat-locomotion';
import { itemInteraction, isDecorationOpen } from '@/constants/item-interactions';
import { isFurniturePerch } from '@/constants/cat-furniture';
import { isSleepingBed, type BedPhase } from '@/constants/bedroom-activities';
import { getBedDisplaySize, isCatPetBedId } from '@/constants/cat-beds';
import type { RoomCommandKind } from "@/constants/room-commands";
import { isCatSeatDecorationId } from "@/constants/sofa-decorations";
import { isKitchenChairDecorationId, isKitchenIslandDecorationId } from "@/constants/kitchen-activities";
import { isWindowDecorationId } from "@/constants/window-decorations";
import { isFridgeDecorationId } from "@/constants/decoration-motion";
import { bathroomFixtureKind, type BathroomPhase } from "@/constants/bathroom-activities";
import { isPlayablePlant } from "@/constants/plant-play";
import { isCatFeederDecorationId } from "@/constants/cat-supplies-decorations";
import { CAT_ANIMATION_CLIPS } from "@/constants/cat-animation-clips";
import type { NativeRoomWorld, NativeTravel, Vec3 } from "@/utils/native-room-world";
import { catFloorPoint, catScreenPoint, findFoodBowlApproach, findFurnitureTransfer, findWindowWatchPerch, findCatBrushPass, findCatCrawlPass } from "@/utils/native-room-world";
import { isHomeRoomId, isRoomDoor, roomTravelDirection, type HomeRoomId, type RoomEntry, type RoomTravelDirection } from "@/constants/home-rooms";
import { getPlacedDecorationDragSize, getPlacedDecorationSpriteId } from "@/constants/decoration-variants";
import { getPlacedToyDisplaySize } from "@/constants/cat-toys";
import { getCatWalkMotion, SOFA_JUMP_DURATION_MS, type CatRoomAnimation } from "@/constants/cat-room-motion";
import type { PetAnimationState, PlacedDecoration, PlacedToy, RoomItemOffset } from "@/types/game";
import type { WorldPeriod } from '@/utils/world-clock';
import { roomOffsetToPoint, type RoomPoint } from '@/utils/room-coordinates';
export { roomOffsetToPoint, type RoomPoint } from '@/utils/room-coordinates';

export const ROOM_IDLE_DELAY_MS = 30_000;
export const ROOM_MEAL_DURATION_MS = 8_000;
export type RoomActivityKind = RoomCommandKind | "doorTravel" | "roomTravel" | "wander";
export type RoomActivityCommand = { id: number; kind: RoomActivityKind; instanceId?: string; interactionAt?: number; ambientPeriod?: WorldPeriod };
export type RoomActivityStep = {
  native?: NativeTravel;
  sleepPose?: CatSleepPose;
  /** Keep the same passage clearance when leaving a kitchen interaction. */
  kitchenNavigation?: boolean;
  /** The source furnishing stays attached to exit steps after a new command. */
  targetInstanceId?: string;
  /** Direct flight from another furnishing, retaining both support colliders. */
  jumpFromInstanceId?: string;
  jumpLaunchHeading?: number;
  position: RoomPoint;
  mood: PetAnimationState;
  animation?: CatRoomAnimation;
  animationFps?: number;
  gait?: CatGait;
  brush?: { choice: number; instanceId: string };
  crawl?: { choice: number; instanceId: string };
  reverse?: boolean;
  durationMs: number;
  moveMs?: number;
  hold?: boolean;
  sofaApproach?: RoomPoint;
  /** Floor approach intent is distinct from being supported by the seat. */
  approachingSeat?: boolean;
  seatApproach?: Vec3;
  seatPosition?: Vec3;
  seatHeading?: number;
  treeApproach?: Vec3;
  plantApproach?: Vec3;
  bedPhase?: BedPhase;
  bathroomPhase?: BathroomPhase;
  bathroomApproach?: Vec3;
  bowlApproach?: boolean;
  returnHome?: boolean;
  leavingRoom?: boolean;
  enteringRoom?: boolean;
  entryFromCurrent?: boolean;
  entryMotion?: CatTravelMotion;
  travelDirection?: RoomTravelDirection;
  objectPosition?: RoomPoint;
  objectRotation?: number;
  objectMoveMs?: number;
  objectDelayMs?: number;
};
export type RoomActivityPlan = {
  kind: RoomActivityKind | "returnHome";
  ambientPeriod?: WorldPeriod;
  /** Only user commands show a notice when their route is blocked. */
  userRequested?: boolean;
  /** Perches already visited in this short autonomous outing. */
  exploredFurniture?: string[];
  stopForEditing?: boolean;
  destination?: HomeRoomId;
  targetInstanceId?: string;
  objectKind?: "toy" | "decoration";
  objectStart?: RoomPoint;
  sofaApproach?: RoomPoint;
  steps: RoomActivityStep[];
};
export type RoomActivityOptions = {
  /** Independent of other activities so ordinary play cannot repeat every nap. */
  napTurn?: number;
  nativeWorld?: NativeRoomWorld;
  /** Filament advances steps from rendered arrivals and completed clips. */
  nativeStepCompletion?: boolean;
  homeRoomId?: HomeRoomId;
  entry?: RoomEntry;
  width: number;
  height: number;
  petSize: number;
  sizeScale: number;
  bedId?: string;
  bedOffset?: RoomItemOffset;
  homeOffset: RoomItemOffset;
  decorations: PlacedDecoration[];
  toys: PlacedToy[];
  ownedToyIds: string[];
  hungry: boolean;
  asleep: boolean;
  period?: WorldPeriod;
};

export function roomIdleDelay(room: RoomActivityOptions): number {
  return room.period === undefined ? ROOM_IDLE_DELAY_MS : room.period === 'night' ? 30_000 : 12_000;
}

export function roomActivityStepKey(state: { plan: RoomActivityPlan; stepIndex: number; startedAt: number }): string {
  return `${state.plan.kind}:${state.plan.targetInstanceId}:${state.stepIndex}:${state.startedAt}`;
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
    returnHome: true, travelDirection: room.entry.direction, entryMotion: room.entry.motion }] };
}

function wakeStretch(step: Pick<RoomActivityStep, 'position'> & Partial<RoomActivityStep>, position = step.position): RoomActivityStep {
  return { position, mood: 'idle', animation: 'wakeStretch', durationMs: 2500,
    sofaApproach: step.sofaApproach, seatApproach: step.seatApproach,
    // Covered sleep's recorded seat is under the quilt. After uncovering use
    // the exposed mattress contact, which prepareNativeStep resolves afresh.
    seatPosition: step.bedPhase ? undefined : step.seatPosition,
    seatHeading: step.seatHeading, targetInstanceId: step.targetInstanceId };
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
  if (step.bedPhase && approach) {
    if (step.animation === 'curlUp' || step.animation === 'curlSleep') steps.push({ ...step, position,
      animation: 'curlUp', reverse: true, mood: 'lyingDown', hold: false, ...sleepTransitionTiming(step.sleepPose), moveMs: 0,
      targetInstanceId: sourceInstanceId });
    steps.push({ ...step, position, animation: 'walk', reverse: false, mood: 'idle', bedPhase: 'uncover',
      hold: false, durationMs: 1400, moveMs: 1400, targetInstanceId: sourceInstanceId });
    if (step.animation === 'curlUp' || step.animation === 'curlSleep') steps.push(wakeStretch({ ...step, targetInstanceId: sourceInstanceId }, position));
    steps.push({ position: approach, mood: 'idle', animation: 'jumpOff', sofaApproach: approach,
      seatApproach: step.seatApproach, targetInstanceId: sourceInstanceId,
      durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS });
    steps.push({ ...walkTo(approach, home, room.petSize), returnHome: true });
    return { kind: 'returnHome', targetInstanceId: sourceInstanceId, steps };
  }
  if (step.sofaApproach && approach) {
    if (step.animation === "curlUp" || step.animation === "curlSleep") {
      steps.push({ position, mood: "lyingDown", animation: "curlUp", reverse: true, sofaApproach: approach, seatApproach: step.seatApproach, seatPosition: step.seatPosition, seatHeading: step.seatHeading, targetInstanceId: sourceInstanceId, sleepPose: step.sleepPose, ...sleepTransitionTiming(step.sleepPose) });
      steps.push(wakeStretch({ ...step, targetInstanceId: sourceInstanceId }, position));
    }
    floorStart = approach;
    steps.push({ position: floorStart, mood: "idle", animation: "jumpOff", animationFps: 24_000 / SOFA_JUMP_DURATION_MS, sofaApproach: approach, seatApproach: step.seatApproach, seatPosition: step.seatPosition, seatHeading: step.seatHeading, treeApproach: step.treeApproach, targetInstanceId: sourceInstanceId, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS });
  }
  steps.push({ ...walkTo(floorStart, home, room.petSize), returnHome: true, objectPosition: plan.objectStart, objectRotation: 0 });
  return { kind: "returnHome", targetInstanceId: plan.targetInstanceId, objectKind: plan.objectKind, objectStart: plan.objectStart,
    steps: step.kitchenNavigation ? steps.map(item => ({ ...item, kitchenNavigation: true })) : steps };
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
  nativePosition?: Vec3,
): RoomActivityPlan {
  const seatStep = next.steps[1];
  const approach = next.sofaApproach!;
  const step = current?.plan.steps[current.stepIndex];
  const sameSofa = current?.plan.targetInstanceId === next.targetInstanceId;
  const onSofa = Boolean(step?.sofaApproach && step.animation !== "jumpOff");
  const curled = step?.animation === "curlUp" || step?.animation === "curlSleep";
  if (sameSofa && onSofa && (next.kind === 'bedSleep' || next.kind === 'bedSnuggle')) {
    if (current?.plan.kind === next.kind && step?.animation === 'curlSleep')
      return { ...next, steps: [{ ...step, hold: true }] };
    const exit = step?.bedPhase ? buildRoomReturn(room, current!.plan, current!.stepIndex, position).steps
      .filter(item => item.animation !== 'jumpOff' && !item.returnHome)
      : curled ? [{ ...step!, position, animation: 'curlUp' as const, reverse: true,
        hold: false, ...sleepTransitionTiming(step?.sleepPose), moveMs: 0 }] : [];
    return { ...next, steps: [...exit, ...next.steps.slice(2)] };
  }
  if (sameSofa && onSofa) {
    const supportedSeat=room.nativeWorld && room.nativeStepCompletion!==false && step?.animation!=='jumpOn' ? step?.seatPosition : undefined;
    const distance = supportedSeat ? 0 : Math.hypot(position.x - seatStep.position.x, position.y - seatStep.position.y);
    if (distance <= 2) {
      let rest = next.steps.slice(2).map(item=>supportedSeat && !item.returnHome ? {...item,seatPosition:supportedSeat,
        seatApproach:step!.seatApproach,seatHeading:step!.seatHeading,sofaApproach:step!.sofaApproach} : item);
      if ((next.kind === "sofaSleep" || next.kind === "chairNap") && step?.animation === "curlSleep") rest = rest.slice(1).map(item => item.animation === "curlSleep" || item.animation === "curlUp" ? { ...item, sleepPose: step.sleepPose } : item);
      if (seatStep.animation === "jumpOn" && next.steps[2]?.animation === "sit" && curled) rest = [
        { ...seatStep, ...(supportedSeat ? {seatPosition:supportedSeat,seatApproach:step!.seatApproach,
          seatHeading:step!.seatHeading,sofaApproach:step!.sofaApproach} : {}),
          mood: "lyingDown", animation: "curlUp", sleepPose: step?.sleepPose, reverse: true, moveMs: 0, ...sleepTransitionTiming(step?.sleepPose) }, ...rest,
      ];
      return { ...next, steps: rest };
    }
    // A command during the jump finishes that jump without retracing the floor walk.
    const jumpDistance = Math.hypot(approach.x - seatStep.position.x, approach.y - seatStep.position.y);
    const durationMs = Math.max(200, SOFA_JUMP_DURATION_MS * distance / Math.max(1, jumpDistance));
    return { ...next, steps: [{ ...seatStep, durationMs, moveMs: durationMs, animationFps: 24 / (durationMs / 1000) }, ...next.steps.slice(2)] };
  }
  const world=room.nativeWorld,sourceId=step?.targetInstanceId ?? current?.plan.targetInstanceId;
  if (world && room.nativeStepCompletion!==false && step && onSofa && step.animation!=='jumpOn' && !step.bedPhase && !step.bathroomPhase && sourceId && next.targetInstanceId) {
    const source=world.objects.find(o=>o.instanceId===sourceId);
    const from=nativePosition ?? catFloorPoint(position,world,step.native?.path.at(-1)?.[1] ?? source?.seat?.[1] ?? 0);
    const launchHeading=step.seatHeading ?? step.native?.heading ?? source?.seatHeading;
    const transfer=findFurnitureTransfer(from,sourceId,next.targetInstanceId,world,launchHeading);
    if (transfer) {
      const targetPosition=catScreenPoint(transfer.seat,world),floorApproach=catScreenPoint(transfer.approach,world);
      const contact={seatPosition:transfer.seat,seatApproach:transfer.approach,seatHeading:transfer.heading,sofaApproach:floorApproach};
      const stand: RoomActivityStep[] = curled ? [{ ...step, native: undefined, position, targetInstanceId:sourceId,
        animation:'curlUp',reverse:true,hold:false,jumpFromInstanceId:undefined,...sleepTransitionTiming(step.sleepPose),moveMs:0 }] : [];
      return { ...next,sofaApproach:floorApproach,steps:[...stand,{
        ...seatStep,...contact,position:targetPosition,targetInstanceId:next.targetInstanceId,jumpFromInstanceId:sourceId,jumpLaunchHeading:launchHeading,
        animation:transfer.seat[1]<from[1]-.08*world.catScale?'jumpOff':'jumpOn',
      },...next.steps.slice(2).map(item=>item.returnHome ? item : {...item,...contact,
        position:item.animation==='jumpOff'?floorApproach:targetPosition})] };
    }
  }
  const exit = current ? buildRoomReturn(room, current.plan, current.stepIndex, position).steps.slice(0, -1) : [];
  const floorStart = exit.at(-1)?.position ?? position;
  return { ...next, steps: [...exit, { ...next.steps[0], ...walkTo(floorStart, approach, room.petSize), approachingSeat: true }, ...next.steps.slice(1)] };
}

/** Continue an idle perch visit only when another safe, unvisited support exists. */
export function continueFurnitureExploration(
  room: RoomActivityOptions,
  current: { plan: RoomActivityPlan; stepIndex: number },
  position: Vec3,
  turn: number,
): RoomActivityPlan | null {
  const { plan, stepIndex } = current, step = plan.steps[stepIndex], world = room.nativeWorld;
  if (!world || room.nativeStepCompletion === false || room.hungry || room.asleep || room.period === 'night'
    || plan.userRequested || step.hold || step.native?.blocked || !['sofaSit','islandSit'].includes(plan.kind) || step.animation !== 'sit') return null;
  const sourceId = step.targetInstanceId ?? plan.targetInstanceId;
  if (!sourceId || !step.sofaApproach) return null;
  const visited = plan.exploredFurniture ?? [sourceId];
  // At most two transfers, without bouncing between the same two chairs.
  if (visited.length >= 3) return null;
  const nearby = world.objects.filter(object => object.seat && !visited.includes(object.instanceId))
    .sort((a, b) => Math.hypot(a.seat![0] - position[0], a.seat![2] - position[2])
      - Math.hypot(b.seat![0] - position[0], b.seat![2] - position[2]));
  for (const object of nearby) {
    const next = buildRoomActivity(room, turn, isKitchenIslandDecorationId(object.modelId) ? 'islandSit' : 'sofaSit', object.instanceId);
    if (!next) continue;
    const routed = routeToSofa(room, next, catScreenPoint(position, world), current, position);
    // Exploration never takes a floor detour just to extend the outing.
    if (!routed.steps[0]?.jumpFromInstanceId) continue;
    return { ...routed, ambientPeriod: room.period, userRequested: false,
      exploredFurniture: [...visited, object.instanceId],
      steps: routed.steps.map(item => ({ ...item, hold: false,
        durationMs: item.animation === 'sit' ? 6000 + turn % 4 * 1500 : item.durationMs })) };
  }
  return null;
}

/** Commands and idle choices share object eligibility and rendered coordinates. */
export function buildRoomActivity(room: RoomActivityOptions, turn: number, command?: RoomActivityKind, preferredInstanceId?: string): RoomActivityPlan | null {
  if (room.width <= room.petSize || room.height <= room.petSize) return null;
  if (!command && room.period !== undefined && room.hungry) return null;
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
    const bowls = room.decorations.filter(item => isCatFeederDecorationId(item.decorationId)
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
  const beds = room.decorations.filter(item => isSleepingBed(item.decorationId)).map(item => ({
    id: item.instanceId, offset: item.offset, size: getPlacedDecorationDragSize(item) * room.sizeScale, quilt: true,
  }));
  if (room.bedId && (isSleepingBed(`bed-${room.bedId}`) || isCatPetBedId(room.bedId))) beds.push({ id: 'bed',
    offset: room.bedOffset ?? { x: -.15, y: .3 }, size: getBedDisplaySize(room.bedId) * room.sizeScale,
    quilt: !isCatPetBedId(room.bedId) });
  for (const bed of beds) {
    const center = roomOffsetToPoint(bed.offset, room.width, room.height, bed.size);
    const seat = clampCatPoint({ x: center.x, y: center.y - bed.size * .1 }, room);
    const approach = clampCatPoint({ x: center.x, y: center.y + bed.size * .4 }, room);
    for (const covered of bed.quilt ? [false, true] : [false]) {
      const common = { position: seat, sofaApproach: approach };
      const bedPhase = covered ? 'covered' as const : undefined;
      const sleepPose = covered ? 'Loaf' : CAT_SLEEP_POSES[(room.napTurn ?? turn) % CAT_SLEEP_POSES.length];
      candidates.push({ kind: covered ? 'bedSnuggle' : 'bedSleep', targetInstanceId: bed.id, sofaApproach: approach, steps: [
        { ...walkTo(home, approach, room.petSize), approachingSeat: true },
        { ...common, mood: 'idle', animation: 'jumpOn', durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS },
        ...(covered ? [{ ...common, mood: 'idle' as const, animation: 'walk' as const,
          bedPhase: 'crawl' as const, durationMs: 1600, moveMs: 1600 }] : []),
        { ...common, mood: 'lyingDown', animation: 'curlUp', bedPhase, sleepPose, ...sleepTransitionTiming(sleepPose) },
        { ...common, mood: 'sleeping', animation: 'curlSleep', bedPhase, sleepPose, animationFps: 6, durationMs: 25_000, hold: Boolean(command) },
        { ...common, mood: 'lyingDown', animation: 'curlUp', bedPhase, sleepPose, reverse: true, ...sleepTransitionTiming(sleepPose) },
        ...(covered ? [{ ...common, mood: 'idle' as const, animation: 'walk' as const,
          bedPhase: 'uncover' as const, durationMs: 1400, moveMs: 1400 }] : []),
        wakeStretch(common),
        { position: approach, sofaApproach: approach, mood: 'idle', animation: 'jumpOff', durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS },
        { ...walkTo(approach, home, room.petSize), returnHome: true },
      ] });
    }
  }
  for (const sofa of room.decorations) {
    const sprite = getPlacedDecorationSpriteId(sofa);
    const chair = isKitchenChairDecorationId(sprite), island = isKitchenIslandDecorationId(sprite);
    if (!isCatSeatDecorationId(sprite) && !chair && !island && !isFurniturePerch(sprite) && !isSleepingBed(sprite)) continue;
    if(!command && isFurniturePerch(sprite) && isDecorationOpen(sofa))continue;
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
    if ((!chair || !command || command === 'sofaSit') && (!room.asleep || command === "sofaSit" || command === "islandSit")) candidates.push({ kind: island ? "islandSit" : "sofaSit", targetInstanceId: sofa.instanceId, sofaApproach: approach, steps: [
      ...arrive, { position: seat, mood: "idle" as const, animation: "sit" as const, durationMs: 12_000, sofaApproach: approach, hold: Boolean(command) }, ...leave,
    ].map(step => chair ? { ...step, kitchenNavigation: true } : step) });
    const sleepPose = chair || sprite === 'chairRockingOak' ? 'Loaf' : CAT_SLEEP_POSES[(room.napTurn ?? turn) % CAT_SLEEP_POSES.length];
    if (!island && (chair || isCatSeatDecorationId(sprite))) candidates.push({ kind: chair ? "chairNap" : "sofaSleep", targetInstanceId: sofa.instanceId, sofaApproach: approach, steps: [
      ...arrive,
      { position: seat, mood: "lyingDown", animation: "curlUp", sleepPose, ...sleepTransitionTiming(sleepPose), sofaApproach: approach },
      { position: seat, mood: "sleeping", animation: "curlSleep", sleepPose, animationFps: 6, durationMs: 25_000, sofaApproach: approach, hold: Boolean(command) },
      { position: seat, mood: "lyingDown", animation: "curlUp", sleepPose, reverse: true, ...sleepTransitionTiming(sleepPose), sofaApproach: approach },
      wakeStretch({ position: seat, mood: "idle", durationMs: 2500, sofaApproach: approach }),
      ...leave,
    ] });
  }
  for (const item of room.decorations) {
    const size = getPlacedDecorationDragSize(item) * room.sizeScale;
    const center = roomOffsetToPoint(item.offset, room.width, room.height, size);
    if ((!command || command === 'windowWatch') && isWindowDecorationId(item.decorationId) && (!room.asleep || command === 'windowWatch')) {
      const window = room.nativeWorld?.objects.find(object => object.instanceId === item.instanceId);
      const perch = window && room.nativeWorld ? findWindowWatchPerch(room.nativeWorld.home, window, room.nativeWorld) : undefined;
      const approach = perch && room.nativeWorld ? catScreenPoint(perch.approach, room.nativeWorld)
        : clampCatPoint({ x: center.x, y: center.y + size * .6 }, room);
      const position = perch && room.nativeWorld ? catScreenPoint(perch.seat, room.nativeWorld) : approach;
      const contact = perch ? { targetInstanceId: perch.object.instanceId, seatPosition: perch.seat,
        seatHeading: perch.heading, sofaApproach: approach, seatApproach: perch.approach } : {};
      candidates.push({ kind: 'windowWatch', targetInstanceId: item.instanceId, sofaApproach: perch ? approach : undefined, steps: [
        { ...walkTo(home, approach, room.petSize), ...contact, sofaApproach: undefined, approachingSeat: Boolean(perch) },
        ...(perch ? [{ position, mood: 'idle' as const, animation: 'jumpOn' as const, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS, ...contact }] : []),
        { position, mood: 'idle', animation: 'blinkSit', durationMs: 18_000, hold: Boolean(command), ...contact },
        ...(perch ? [{ position: approach, mood: 'idle' as const, animation: 'jumpOff' as const, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS, ...contact }] : []),
        { ...walkTo(approach, home, room.petSize), returnHome: true },
      ] });
    }
    if ((command === 'drawerHide' && ['drawers','drawer'].includes(itemInteraction(item.decorationId)?.open ?? '')
      || command === 'cupboardHide' && itemInteraction(item.decorationId)?.cat === 'cupboardHide') && isDecorationOpen(item)) {
      const approach = clampCatPoint({ x: center.x, y: center.y + size * .65 }, room);
      const position = clampCatPoint({ x: center.x, y: center.y - size * .12 }, room);
      candidates.push({ kind: command, targetInstanceId: item.instanceId, sofaApproach: approach, steps: [
        { ...walkTo(home, approach, room.petSize), approachingSeat: true },
        { position, mood: 'idle', animation: 'jumpOn', sofaApproach: approach, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS },
        { position, mood: 'idle', animation: 'sit', sofaApproach: approach, durationMs: 12_000, hold: true },
        { position: approach, mood: 'idle', animation: 'jumpOff', sofaApproach: approach, durationMs: SOFA_JUMP_DURATION_MS, moveMs: SOFA_JUMP_DURATION_MS },
        { ...walkTo(approach, home, room.petSize), returnHome: true },
      ] });
    }
    if (command === 'investigate' && (!preferredInstanceId || item.instanceId === preferredInstanceId)) {
      const position = clampCatPoint({ x: center.x, y: center.y + size * .4 }, room);
      candidates.push({ kind: 'investigate', targetInstanceId: item.instanceId, steps: [
        walkTo(home, position, room.petSize),
        { position, mood: 'idle', animation: 'idle2', durationMs: 4500 },
        { ...walkTo(position, home, room.petSize), returnHome: true },
      ] });
    }
    if ((!command || command === 'fridgeInvestigate') && isFridgeDecorationId(item.decorationId) && item.fridgeOpen && (!room.asleep || command === 'fridgeInvestigate')) {
      const position = clampCatPoint({ x: center.x, y: center.y + size * .4 }, room);
      candidates.push({ kind: 'fridgeInvestigate', targetInstanceId: item.instanceId, steps: [
        walkTo(home, position, room.petSize),
        { position, mood: 'idle', animation: 'idle2', durationMs: 12_000, hold: Boolean(command) },
        { ...walkTo(position, home, room.petSize), returnHome: true },
      ] });
    }
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
  if (!command && room.period !== undefined) {
    if (!room.asleep) {
      const direction = turn % 2 ? -1 : 1;
      const first = clampCatPoint({ x: direction * room.width * .2, y: room.height * .12 }, room);
      const second = clampCatPoint({ x: -direction * room.width * .16, y: room.height * .22 }, room);
      candidates.push({ kind: 'wander', steps: [walkTo(home, first, room.petSize),
        { position: first, mood: 'idle', animation: 'idle', durationMs: 2000 },
        { ...walkTo(first, second, room.petSize), gait: turn % 3 === 1 && room.period !== 'night' ? 'run' : 'walk' }, { ...walkTo(second, home, room.petSize), returnHome: true }] });
    }
    if (!room.asleep && room.period !== 'night' && room.nativeWorld && room.nativeStepCompletion !== false) {
      const crawl=findCatCrawlPass(room.nativeWorld,turn);
      if(crawl) {
        const from=catScreenPoint(crawl.from,room.nativeWorld),to=catScreenPoint(crawl.to,room.nativeWorld);
        candidates.push({kind:'wander',steps:[walkTo(home,from,room.petSize),
          {...walkTo(from,to,room.petSize),crawl:{choice:turn,instanceId:crawl.leg.supportId!}},
          {...walkTo(to,home,room.petSize),returnHome:true}]});
      }
      const brush=findCatBrushPass(room.nativeWorld,turn);
      if(brush) {
        const from=catScreenPoint(brush.from,room.nativeWorld),to=catScreenPoint(brush.to,room.nativeWorld);
        candidates.push({kind:'wander',steps:[walkTo(home,from,room.petSize),
          {...walkTo(from,to,room.petSize),brush:{choice:turn,instanceId:brush.instanceId}},
          {...walkTo(to,home,room.petSize),returnHome:true}]});
      }
    }
    const naps = candidates.filter(plan => plan.kind === 'sofaSleep' || plan.kind === 'chairNap' || plan.kind === 'bedSleep' || plan.kind === 'bedSnuggle');
    const rests = candidates.filter(plan => plan.kind === 'sofaSit' || plan.kind === 'islandSit' || plan.kind === 'windowWatch');
    const active = candidates.filter(plan => !naps.includes(plan) && !rests.includes(plan));
    const night = room.period === 'night';
    // Perch exploration shares daytime choices with floor wandering and toys.
    // Add one choice so a room full of chairs does not crowd out other play.
    const perches = rests.filter(plan => plan.kind === 'sofaSit');
    if (!night && !room.asleep && room.nativeWorld && room.nativeStepCompletion !== false && perches.length)
      active.push(perches[Math.floor(turn / 5) % perches.length]);
    // Four of five choices favour sleep at night and activity during the day,
    // independently of how many toys or seats happen to be in the room.
    const primary = night ? naps : active;
    const secondary = night ? active : [...rests, ...naps];
    const choices = turn % 5 < 4 ? primary : secondary;
    const eligible = choices.length ? choices : primary.length ? primary : secondary;
    // Count each pool's own turns. Using turn % length skips a fifth primary
    // choice forever when there happen to be exactly five activities.
    const choiceTurn = turn % 5 < 4 ? Math.floor(turn / 5) * 4 + turn % 5 : Math.floor(turn / 5);
    const plan = eligible[choiceTurn % eligible.length];
    return plan ? { ...plan, ambientPeriod: room.period, steps: plan.steps.map(step =>
      step.animation === 'curlSleep' ? { ...step, durationMs: night ? 120_000 : 20_000 } : step) } : null;
  }
  const eligible = command ? candidates.filter(plan => plan.kind === command) : candidates;
  return preferredInstanceId !== undefined ? eligible.find(plan => plan.targetInstanceId === preferredInstanceId) ?? null
    : eligible[turn % eligible.length] ?? null;
}
