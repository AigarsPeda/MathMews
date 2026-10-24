import type { CatSleepPose } from '@/constants/cat-sleep';
import { restoreRoomSupports } from '@/utils/room-support';
import { isDecorationOpen } from '@/constants/item-interactions';
import { CAT_FURNITURE, isFurniturePerch } from '@/constants/cat-furniture';
import { catJourneyGait, type CatGait } from '@/utils/native-cat-gaits';
import { steerCatPath, roundCatPath, catPacedPath, catJumpPoint, catJumpAim, catJumpDuration, catJumpEffort, catWalkTiming, CAT_LANDING_WALK_PHASE, type CatMotionLeg, type CatTravelMotion } from '@/utils/native-cat-locomotion';
import { catTurnDuration } from '@/utils/native-cat-turn';
import { buildCatTraversalLinks, type CatTraversalLink } from '@/utils/native-cat-traversal';
import { CURTAIN_FABRIC_BOUNDS, isBathroomLightDecorationId, isCurtainDecorationId, isWallSpotlightDecorationId, normalizeSpotlightAngle, normalizeSpotlightSwivel } from "@/constants/decoration-motion";
import { isSeatingSofaDecorationId } from "@/constants/sofa-decorations";
import { normalizeRotationDegrees } from "@/utils/room-rotation";
import type { BedPhase } from '@/constants/bedroom-activities';
import type { BathroomFixtureKind, BathroomPhase } from '@/constants/bathroom-activities';
import { isPlayablePlant } from "@/constants/plant-play";
import { isCatFeederDecorationId } from "@/constants/cat-supplies-decorations";
import { isWindowDecorationId } from "@/constants/window-decorations";
import { isKitchenChairDecorationId, isKitchenIslandDecorationId, isKitchenPerchDecorationId } from '@/constants/kitchen-activities';
import type { RockingChair } from '@/utils/native-rocking-chair';
import { fridgeDoorGeometry, fridgeDoorSweepDistance } from '@/utils/native-fridge';
import catalog from '@/assets/3d/native/catalog.json';
import placementBounds from '@/constants/room-placement-bounds.json';
import windowMounts from '@/constants/window-mount-bounds.json';
import { getPlacedDecorationDragSize, getPlacedDecorationSpriteId, getPlacedDecorationWallFlipped } from '@/constants/decoration-variants';
import { getBedDisplaySize, getEquippedBedScale, isCatPetBedId } from '@/constants/cat-beds';
import { getPlacedToyDisplaySize, getPlacedToyRotationIndex } from '@/constants/cat-toys';
import { isRoomDoor } from '@/constants/home-rooms';
import { WALL_MOUNT_PLANE, WALL_PLACEMENT_MIN, WALL_PLACEMENT_MAX, WALL_PLACEMENT_BOTTOM, WALL_PLACEMENT_TOP } from '@/constants/room-geometry';
import { isRoomBackgroundDecoration } from '@/utils/room-depth';
import { hangingToyPosition } from '@/utils/native-hanging-toy';
import { roomOffsetToPoint, type RoomPoint } from '@/utils/room-coordinates';
import type { RoomActivityPlan, RoomActivityStep } from '@/utils/room-activities';
import type { PlacedDecoration, PlacedToy, RoomItemOffset, RoomLayerItem } from '@/types/game';
export type Vec3 = [
  number,
  number,
  number
];
export type ModelMetadata = {
  kind: string;
  renderScale: number;
  center: number[];
  min: number[];
  max: number[];
  animated: boolean;
  wind?: boolean;
  interactionBounds?: { node: string; min: number[]; max: number[] }[];
  powerMaterials?: { node: string; color: number[] }[];
  interactionParts?: { node: string; pivot: number[]; axis: number[]; angle: number; offset: number[]; mode: string }[];
  drawer?: { surface: number[] };
  cupboard?: { surface: number[]; clearance: number[] };
  collisionBoxes?: { min: number[]; max: number[]; footprint?: number[][] }[];
  placementBoxes?: { min: number[]; max: number[]; footprint?: number[][] }[];
  supportSurfaces?: { min: number[]; max: number[] }[];
  baseHull?: number[][];
  wallMountBounds?: { min: number[]; max: number[] };
  placementHull?: number[][];
  leaves?: { node: string; contact: string; point: number[] }[];
  bed?: { surface: number[]; covered: number[] };
  bathroom?: { kind: BathroomFixtureKind; contact: number[]; sprayHeight?: number };
};
export type CollisionBox = { min: Vec3; max: Vec3 };
type PlacementMetadata = Pick<ModelMetadata, "placementHull" | "collisionBoxes" | "placementBoxes" | "supportSurfaces" | "baseHull" | "wallMountBounds" | "interactionBounds"> & { placementBoxesFrom?: string };
const derivedPlacement = placementBounds as Record<string, PlacementMetadata>;
export const NATIVE_MODEL_CATALOG: Record<string, ModelMetadata> = Object.fromEntries(
  Object.entries(catalog as Record<string, ModelMetadata>).map(([id, metadata]) => {
    const derived = derivedPlacement[id];
    return [id, { ...metadata, ...derived, placementBoxes: derived?.placementBoxesFrom
      ? derivedPlacement[derived.placementBoxesFrom].placementBoxes : derived?.placementBoxes }];
  }),
);
export const FLOOR_Y = .068;
export const ROOM_SPAN = 7.45;
export const CAT_EATING_REACH = 1;
/** Bullet-to-Filament transforms retain mesh scale; remove it before rotation extraction. */
export function nativeBodyRotation(matrix: readonly number[]): {
  angle: number;
  axis: Vec3;
} {
  'worklet';
  const sx = Math.hypot(matrix[0], matrix[1], matrix[2]) || 1;
  const sy = Math.hypot(matrix[4], matrix[5], matrix[6]) || 1;
  const sz = Math.hypot(matrix[8], matrix[9], matrix[10]) || 1;
  const m00 = matrix[0] / sx, m11 = matrix[5] / sy, m22 = matrix[10] / sz;
  const m01 = matrix[4] / sy, m02 = matrix[8] / sz, m10 = matrix[1] / sx, m12 = matrix[9] / sz, m20 = matrix[2] / sx, m21 = matrix[6] / sy;
  let x = 0, y = 0, z = 0, w = 1;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = s / 4;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  }
  else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = s / 4;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  }
  else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = s / 4;
    z = (m12 + m21) / s;
  }
  else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = s / 4;
  }
  const length = Math.hypot(x, y, z);
  return length < 1e-8 ? { angle: 0, axis: [0, 1, 0] } : { angle: 2 * Math.atan2(length, w), axis: [x / length, y / length, z / length] };
}
// Match the original room's orthographic camera exactly, including tall viewports.
const elevation = 6.1 / Math.hypot(8, 8, 6.1);
const vertical = Math.sqrt(1 - elevation * elevation);
const diagonal = Math.SQRT1_2;
export type NativeRoomObject = {
  /** Other objects carried by the editor preview, never persisted on the model. */
  editingChildren?: NativeRoomObject[];
  instanceId: string;
  modelId: string;
  scale: number;
  heading: number;
  position: Vec3;
  min: Vec3;
  max: Vec3;
  solid: boolean;
  collidable?: boolean;
  movable: boolean;
  poweredOn?: boolean;
  opened?: boolean;
  drawer?: Vec3;
  cupboard?: Vec3;
  cupboardFits?: boolean;
  interactionBoxes?: CollisionBox[];
  curtainOpen?: boolean;
  fridgeOpen?: boolean | "ajar";
  fridgeHingeSide?: "left" | "right";
  spotlightAngle?: number;
  spotlightSwivel?: number;
  /** Fixed coordinate of a wall-mounted item's mounting plane. */
  wallAxis?: 0 | 2;
  /** Surface holding this lamp, reconstructed from its saved screen anchor. */
  supportId?: string;
  /** Carpet clearance along the camera ray, preserving the saved screen anchor. */
  rugLift?: number;
  /** Corrected wall anchor when a saved window placement lies outside the walls. */
  placementOffset?: RoomItemOffset;
  seat?: Vec3;
  seatHeading?: number;
  approach?: Vec3;
  collisionBoxes?: CollisionBox[];
  leaves?: Vec3[];
  bed?: { surface: Vec3; covered: Vec3 };
  bathroom?: { kind: BathroomFixtureKind; contact: Vec3 };
};
export type NativeRoomWorld = {
  width: number;
  height: number;
  catScale: number;
  kitchenNavigation?: boolean;
  /** Keep this activity outside the selected fridge's entire door swing. */
  fridgeDoorClearance?: string;
  radius: number;
  home: Vec3;
  objects: NativeRoomObject[];
};
export type CatBrushPass = { from: Vec3; to: Vec3; side: number; instanceId: string };
export type NativeTravel = {
  sleepPose?: CatSleepPose;
  brushSide?: number;
  through?: boolean;
  entryMotion?: CatTravelMotion;
  arcHeight?: number;
  /** Fore/aft paw spacing on a small support; one is the ordinary stance. */
  stance?: number;
  launchStance?: number;
  stanceWidth?: number;
  launchStanceWidth?: number;
  landingHeading?: number;
  walkAfterLanding?: boolean;
  landingLook?: Vec3;
  /** The final walking step can load the haunches for this supported jump. */
  prepareJump?: { target: Vec3; light: boolean };
  gait?: CatGait;
  ramp?: number;
  legs?: CatMotionLeg[];
  paces?: number[];
  awaitCompletion?: boolean;
  path: Vec3[];
  distance: number;
  duration: number;
  jump: boolean;
  blocked?: boolean;
  objectPath?: Vec3[];
  objectDuration?: number;
  heading?: number;
  hideEatingProps?: boolean;
  elapsed?: number;
  replanned?: boolean;
  targetPosition?: Vec3;
  treePlay?: boolean;
  plantPlay?: boolean;
  playTargetId?: string;
  pawTargetRadius?: number;
  rockingChair?: RockingChair;
  bed?: { instanceId: string; phase: BedPhase };
  bathroom?: { instanceId: string; kind: BathroomFixtureKind; phase: BathroomPhase };
};

/** Physics reports body centers. Keep navigation bounds current without resetting rendered bodies. */
export function updateNativeObjectPosition(world: NativeRoomWorld, id: string, center: Vec3): NativeRoomWorld {
  const object = world.objects.find(o => o.instanceId === id);
  if (!object) return world;
  const shift = center.map((v, i) => v - (object.min[i] + object.max[i]) / 2);
  if (Math.hypot(...shift) < .02) return world;
  const move = (point: Vec3) => point.map((v, i) => v + shift[i]) as Vec3;
  const moved = { ...object, position: move(object.position), min: move(object.min), max: move(object.max),
    seat: object.seat && move(object.seat), drawer: object.drawer && move(object.drawer), cupboard: object.cupboard && move(object.cupboard), interactionBoxes: object.interactionBoxes?.map(box => ({ min: move(box.min), max: move(box.max) })), approach: object.approach && move(object.approach),
    leaves: object.leaves?.map(move),
    bed: object.bed && { surface: move(object.bed.surface), covered: move(object.bed.covered) },
    bathroom: object.bathroom && { ...object.bathroom, contact: move(object.bathroom.contact) },
    collisionBoxes: object.collisionBoxes?.map(box => ({ min: move(box.min), max: move(box.max) })) };
  return { ...world, objects: world.objects.map(o => o === object ? moved : o) };
}

/** Save a resting floor toy's physics position using the editor's placement anchor. */
export function nativeObjectPlacementOffset(world: NativeRoomWorld, object: NativeRoomObject, center: Vec3): RoomItemOffset {
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  const delta = rotate(meta.center.map((v, i) => v - (meta.min[i] + meta.max[i]) / 2), object.heading);
  const point = projectWorld([center[0] + delta[0] * object.scale,
    FLOOR_Y + meta.center[1] * object.scale, center[2] + delta[2] * object.scale], world.width);
  const size = object.scale * world.width * meta.renderScale / ROOM_SPAN;
  return { x: point.x / Math.max(1, (world.width - size) / 2), y: point.y / Math.max(1, (world.height - size) / 2) };
}

/** A layout edit replaces moved objects, while unrelated edits retain physics positions. */
export function mergeNativeRoomWorld(layout: NativeRoomWorld, previous: NativeRoomWorld, live: NativeRoomWorld): NativeRoomWorld {
  const saved = new Map(previous.objects.map(o => [o.instanceId, o]));
  const positions = new Map(live.objects.map(o => [o.instanceId, o]));
  return { ...layout, objects: layout.objects.map(object => {
    const old = saved.get(object.instanceId), current = positions.get(object.instanceId);
    if (!old || !current || old.modelId !== object.modelId || old.scale !== object.scale || old.heading !== object.heading
      || old.position.some((v, i) => v !== object.position[i])) return object;
    return { ...object, position: current.position, min: current.min, max: current.max,
      seat: current.seat, approach: current.approach, leaves: current.leaves, collisionBoxes: current.collisionBoxes };
  }) };
}
export function projectWorld(point: Vec3, width: number): RoomPoint {
  'worklet';
  const pixels = width / ROOM_SPAN;
  return { x: (point[0] - point[2]) * diagonal * pixels,
    y: (elevation * (point[0] + point[2]) * diagonal - vertical * (point[1] - .9)) * pixels };
}
export function unprojectFloor(point: RoomPoint, y: number, width: number): Vec3 {
  'worklet';
  const pixels = Math.max(1, width) / ROOM_SPAN;
  const difference = point.x / pixels / diagonal;
  const sum = (point.y / pixels + vertical * (y - .9)) / elevation / diagonal;
  return [(sum + difference) / 2, y, (sum - difference) / 2];
}
export function catScreenPoint(position: Vec3, world: Pick<NativeRoomWorld, 'width' | 'catScale'>): RoomPoint {
  'worklet';
  return projectWorld([position[0], position[1] + .94 * world.catScale, position[2]], world.width);
}
export function catFloorPoint(point: RoomPoint, world: Pick<NativeRoomWorld, 'width' | 'catScale'>, y = FLOOR_Y): Vec3 {
  return unprojectFloor(point, y + .94 * world.catScale, world.width).map((v, i) => i === 1 ? y : v) as Vec3;
}
function rotate(point: number[], heading: number): Vec3 {
  return [Math.cos(heading) * point[0] + Math.sin(heading) * point[2], point[1], -Math.sin(heading) * point[0] + Math.cos(heading) * point[2]];
}

/** A wall lamp's backplate must fit on the wall; its head may overhang the edge. */
export function nativeWallPlacementBounds(object: NativeRoomObject): CollisionBox {
  const mount = NATIVE_MODEL_CATALOG[object.modelId].wallMountBounds;
  if (!mount) return { min: object.min, max: object.max };
  const corners = [mount.min[0], mount.max[0]].flatMap(x =>
    [mount.min[1], mount.max[1]].flatMap(y => [mount.min[2], mount.max[2]].map(z =>
      rotate([x,y,z],object.heading).map((v,i) => v*object.scale+object.position[i]))));
  return { min: [0,1,2].map(i => Math.min(...corners.map(p => p[i]))) as Vec3,
    max: [0,1,2].map(i => Math.max(...corners.map(p => p[i]))) as Vec3 };
}

export function isSurfacePlaceable(modelId: string): boolean {
  return !!NATIVE_MODEL_CATALOG[modelId]?.baseHull;
}

/** Support floor furniture on rugs using its feet/runners, rather than its overhang. */
export function placeObjectOnRugs(object: NativeRoomObject, objects: NativeRoomObject[]): NativeRoomObject {
  if (object.wallAxis !== undefined || object.movable || /carpet|rug/i.test(object.modelId) || object.supportId) return object;
  const rugs = objects.filter(other => /carpet|rug/i.test(other.modelId));
  if (!rugs.length && !object.rugLift) return object;
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  const previousLift = object.rugLift ?? 0;
  if (Math.abs(object.position[1] - previousLift - FLOOR_Y) > .00001) return object;
  const footprint = (owner: NativeRoomObject, hull: number[][], lift = 0) => hull.map(([x,z]) => {
    const p = rotate([x,0,z], owner.heading);
    return [p[0] * owner.scale + owner.position[0] - lift * 8 / 6.1,
      p[2] * owner.scale + owner.position[2] - lift * 8 / 6.1];
  });
  const rectangle = (box: { min: number[]; max: number[] }) =>
    [[box.min[0],box.min[2]], [box.max[0],box.min[2]], [box.max[0],box.max[2]], [box.min[0],box.max[2]]];
  const bases = (meta.collisionBoxes ?? [meta]).filter(box => box.min[1] <= meta.min[1] + .02)
    .map(box => footprint(object, rectangle(box), previousLift));
  const overlaps = (a: number[][], b: number[][]) => ![a,b].some(polygon => polygon.some((p,i) => {
    const next = polygon[(i + 1) % polygon.length], x = next[1] - p[1], z = p[0] - next[0];
    const first = a.map(point => point[0] * x + point[1] * z);
    const second = b.map(point => point[0] * x + point[1] * z);
    return Math.max(...first) <= Math.min(...second) || Math.max(...second) <= Math.min(...first);
  }));
  let lift = 0;
  for (const rug of rugs) {
    const rugMeta = NATIVE_MODEL_CATALOG[rug.modelId];
    const hull = footprint(rug, rugMeta.placementHull ?? rectangle(rugMeta));
    if (bases.some(base => overlaps(base, hull))) lift = Math.max(lift, rug.max[1] + .002 - (FLOOR_Y + meta.min[1] * object.scale));
  }
  if (lift === previousLift) return object;
  const delta: Vec3 = [(lift - previousLift) * 8 / 6.1, lift - previousLift, (lift - previousLift) * 8 / 6.1];
  const move = (point: Vec3) => point.map((v,i) => v + delta[i]) as Vec3;
  return { ...object, rugLift: lift || undefined, position: move(object.position), min: move(object.min), max: move(object.max),
    seat: object.seat && move(object.seat), cupboard: object.cupboard && move(object.cupboard), drawer: object.drawer && move(object.drawer),
    bed: object.bed && { surface: move(object.bed.surface), covered: move(object.bed.covered) },
    bathroom: object.bathroom && { ...object.bathroom, contact: move(object.bathroom.contact) },
    leaves: object.leaves?.map(move), approach: object.approach && [object.approach[0] + delta[0], object.approach[1], object.approach[2] + delta[2]],
    collisionBoxes: object.collisionBoxes?.map(box => ({ min: move(box.min), max: move(box.max) })),
    interactionBoxes: object.interactionBoxes?.map(box => ({ min: move(box.min), max: move(box.max) })) };
}

/** Rest a small object on an authored surface. Saved anchors use the exact
 * elevated pose; dragging may also target the surface and snap the base onto it. */
export function placeObjectOnSurface(object: NativeRoomObject, objects: NativeRoomObject[], width: number, snapToSurface = false): NativeRoomObject {
  if (!isSurfacePlaceable(object.modelId)) return placeObjectOnRugs(object, objects);
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  const centerOffset = rotate(meta.center, object.heading);
  const center = centerOffset.map((v, i) => v * object.scale + object.position[i]) as Vec3;
  const point = projectWorld(center, width);
  const base = meta.collisionBoxes?.filter(box => box.min[1] <= meta.min[1] + .02)
    .sort((a, b) => a.max[1] - b.max[1])[0] ?? meta;
  const baseHull = meta.baseHull ?? [base.min[0], base.max[0]].flatMap(x => [base.min[2], base.max[2]].map(z => [x,z]));
  const surfaces = objects.flatMap(owner => owner.instanceId === object.instanceId ? []
    : (NATIVE_MODEL_CATALOG[owner.modelId].supportSurfaces ?? []).map(top => ({ owner, top })))
    .sort((a, b) => (b.owner.position[1] + b.top.max[1] * b.owner.scale) - (a.owner.position[1] + a.top.max[1] * a.owner.scale));
  // Prefer an exact anchor before trying the surface beneath the dragged object.
  for (const targetBoard of snapToSurface ? [false, true] : [false]) for (const { owner, top } of surfaces) {
    const height = owner.position[1] + top.max[1] * owner.scale + .002;
    const desired = unprojectFloor(point, height + (targetBoard ? 0 : (meta.center[1] - meta.min[1]) * object.scale), width);
    const position = desired.map((v, i) => v - centerOffset[i] * object.scale) as Vec3;
    position[1] = height - meta.min[1] * object.scale;
    const fits = baseHull.every(([x,z]) => {
      const corner = rotate([x, 0, z], object.heading).map((v, i) => v * object.scale + position[i] - owner.position[i]);
      const local = rotate(corner, -owner.heading);
      return local[0] >= top.min[0] * owner.scale && local[0] <= top.max[0] * owner.scale
        && local[2] >= top.min[2] * owner.scale && local[2] <= top.max[2] * owner.scale;
    });
    if (!fits) continue;
    const delta = position.map((v, i) => v - object.position[i]);
    const move = (value: Vec3) => value.map((v, i) => v + delta[i]) as Vec3;
    return { ...object, supportId: owner.instanceId, rugLift: undefined, position, min: move(object.min), max: move(object.max),
      collisionBoxes: object.collisionBoxes?.map(box => ({ min: move(box.min), max: move(box.max) })) };
  }
  return placeObjectOnRugs(object, objects);
}
export function buildNativeRoomWorld(options: {
  width: number;
  height: number;
  petSize: number;
  sizeScale: number;
  homeOffset?: RoomItemOffset;
  bedId?: string;
  bedOffset?: RoomItemOffset;
  bedFlipped?: boolean;
  bedRotationDegrees?: number;
  bedScale?: number;
  decorations: PlacedDecoration[];
  toys: PlacedToy[];
  livePositions?: Record<string, RoomPoint>;
  layerOrder?: RoomLayerItem[];
}): NativeRoomWorld {
  const { width, height, sizeScale } = options;
  const catScale = options.petSize * .9 / Math.max(1, width) * ROOM_SPAN / 2.7;
  const world: NativeRoomWorld = { width, height, catScale, radius: 1.04 * catScale, home: [0, FLOOR_Y, 0], objects: [] };
  const curtainMountDepth = (flip: boolean, screen: RoomPoint, curtainSize: number, curtainHeading: number) => {
    const nearby = options.decorations
      .filter(item => isWindowDecorationId(item.decorationId) && getPlacedDecorationWallFlipped(item) === flip)
      .map(item => {
        const meta = NATIVE_MODEL_CATALOG[getPlacedDecorationSpriteId(item)];
        const size = getPlacedDecorationDragSize(item) * sizeScale;
        const point = options.livePositions?.[item.instanceId] ?? roomOffsetToPoint(item.offset, width, height, size);
        const distance = Math.hypot(screen.x - point.x, screen.y - point.y);
        const heading = (flip ? Math.PI / 2 : 0) + (normalizeRotationDegrees(item.rotationDegrees) ?? 0) * Math.PI / 180;
        const normal = flip ? 0 : 2;
        const mount = windowMounts[item.decorationId as keyof typeof windowMounts];
        // Parallel curtains hang against the frame; their panels drape over the
        // protruding sill. Angled fixtures retain clearance for their full bounds.
        const front = mount && Math.cos(curtainHeading - heading) > .999 ? mount.frame : meta;
        const depths = [front.min[0], front.max[0]].flatMap(x => [front.min[2], front.max[2]].map(z => rotate([x, 0, z], heading)[normal]));
        const backs = [meta.min[0], meta.max[0]].flatMap(x => [meta.min[2], meta.max[2]].map(z => rotate([x, 0, z], heading)[normal]));
        return { distance, size, depth: (Math.max(...depths) - Math.min(...backs)) * size / Math.max(1, width) * ROOM_SPAN / meta.renderScale };
      }).filter(window => window.distance <= (curtainSize + window.size) / 2)
      .sort((a, b) => a.distance - b.distance);
    // Use the nearest window's frame, rather than its deep sill or a remote window.
    return nearby.length ? nearby[0].depth + .015 : .025;
  };
  const add = (instanceId: string, modelId: string, size: number, offset: RoomItemOffset, flip = false, poweredOn?: boolean, rotationIndex = 0, rotationDegrees?: number, curtainOpen?: boolean, spotlightAngle?: number, spotlightSwivel?: number, fridgeOpen?: boolean | "ajar", fridgeHingeSide?: "left" | "right", opened?: boolean) => {
    const meta = NATIVE_MODEL_CATALOG[modelId];
    if (!meta)
      return;
    const wall = isRoomDoor(modelId) || (isRoomBackgroundDecoration(modelId) && !/carpet|rug/i.test(modelId)) || /longshelf|smallshelf|shelving|japaneseshelf/i.test(modelId);
    const scale = size / Math.max(1, width) * ROOM_SPAN / meta.renderScale;
    const screen = options.livePositions?.[instanceId] ?? roomOffsetToPoint(offset, width, height, size);
    const modelHeading = wall && !isWallSpotlightDecorationId(modelId) && !isBathroomLightDecorationId(modelId) && meta.max[0] - meta.min[0] < meta.max[2] - meta.min[2] ? Math.PI / 2 : 0;
    const heading = (flip ? Math.PI / 2 : 0) - modelHeading + rotationIndex * Math.PI / 2 + (isWindowDecorationId(modelId) ? 0 : (normalizeRotationDegrees(rotationDegrees) ?? 0) * Math.PI / 180);
    const center = rotate(meta.center, heading);
    const horizontalCorners = [meta.min[0], meta.max[0]].flatMap(x =>
      [meta.min[2], meta.max[2]].map(z => rotate([x, meta.min[1], z], heading)));
    let desired = unprojectFloor(screen, FLOOR_Y + center[1] * scale, width);
    if (wall) {
      // Solve on the wall plane, so moving a fixture preserves its screen anchor.
      const difference = screen.x / (Math.max(1, width) / ROOM_SPAN) / diagonal;
      let plane = WALL_MOUNT_PLANE;
      if (isWindowDecorationId(modelId) || isCurtainDecorationId(modelId) || isWallSpotlightDecorationId(modelId) || isBathroomLightDecorationId(modelId) || meta.wallMountBounds || meta.supportSurfaces?.length || normalizeRotationDegrees(rotationDegrees)) {
        const normal = flip ? 0 : 2;
        const back = Math.min(...horizontalCorners.map(corner => corner[normal]));
        // Keep the glass and frame in front of the opaque room wall.
        plane -= (back - center[normal]) * scale;
      }
      if (isCurtainDecorationId(modelId)) {
        const normal = flip ? 0 : 2;
        const fabricBack = Math.min(...[CURTAIN_FABRIC_BOUNDS.minX, CURTAIN_FABRIC_BOUNDS.maxX]
          .flatMap(x => [CURTAIN_FABRIC_BOUNDS.minZ, CURTAIN_FABRIC_BOUNDS.maxZ].map(z => rotate([x, 0, z], heading)[normal])));
        const hardwareBack = Math.min(...horizontalCorners.map(corner => corner[normal]));
        const depth = Math.max(curtainMountDepth(flip, screen, size, heading), (fabricBack - hardwareBack) * scale + .015);
        plane = WALL_MOUNT_PLANE + depth - (fabricBack - center[normal]) * scale;
      }
      const x = flip ? plane : plane + difference;
      const z = flip ? plane - difference : plane;
      const y = .9 + (elevation * (x + z) * diagonal - screen.y / (Math.max(1, width) / ROOM_SPAN)) / vertical;
      desired = [x, y, z];
    }
    let placementOffset: RoomItemOffset | undefined;
    if (isWindowDecorationId(modelId) || isWallSpotlightDecorationId(modelId) || isBathroomLightDecorationId(modelId)) {
      const before = [...desired];
      const along = flip ? 2 : 0;
      const mount = meta.wallMountBounds;
      const mountedCorners = mount ? [mount.min[0],mount.max[0]].flatMap(x =>
        [mount.min[2],mount.max[2]].map(z => rotate([x,0,z],heading))) : horizontalCorners;
      const limits = mountedCorners.map(point => point.map((v, i) => (v - center[i]) * scale));
      // The head can overhang the open end, but must clear the adjoining wall
      // at the room's inner corner.
      const low = Math.min(...horizontalCorners.map(point => (point[along]-center[along])*scale));
      const high = Math.max(...limits.map(point => point[along]));
      const clamp = (value: number, min: number, max: number) => min <= max ? Math.max(min, Math.min(max, value)) : (min + max) / 2;
      desired[along] = clamp(desired[along], WALL_PLACEMENT_MIN - low, WALL_PLACEMENT_MAX - high);
      const bottom = (meta.min[1] - meta.center[1]) * scale;
      const top = (meta.max[1] - meta.center[1]) * scale;
      desired[1] = clamp(desired[1], WALL_PLACEMENT_BOTTOM - bottom, WALL_PLACEMENT_TOP - top);
      if (Math.hypot(...desired.map((v,i) => v - before[i])) > 1e-6) {
        const point = projectWorld(desired, width);
        placementOffset = { x: point.x / Math.max(1, (width - size) / 2), y: point.y / Math.max(1, (height - size) / 2) };
      }
    }
    const position = desired.map((v, i) => v - center[i] * scale) as Vec3;
    if (isRoomBackgroundDecoration(modelId)) {
      const rank = options.layerOrder?.findIndex(item => item.kind !== 'bed' && item.instanceId === instanceId) ?? -1;
      // Shift along the camera ray: saved screen anchors stay exact, while
      // overlapping rugs and wall art retain the editor's front/back order.
      const depth = Math.max(0, rank + 1) * .0005;
      position[0] += depth * 8 / 6.1;
      position[1] += depth;
      position[2] += depth * 8 / 6.1;
    }
    const corners: Vec3[] = [];
    for (const x of [meta.min[0], meta.max[0]])
      for (const y of [meta.min[1], meta.max[1]])
        for (const z of [meta.min[2], meta.max[2]]) {
          corners.push(rotate([x, y, z], heading).map((v, i) => v * scale + position[i]) as Vec3);
        }
    const min = [0, 1, 2].map(i => Math.min(...corners.map(c => c[i]))) as Vec3;
    const max = [0, 1, 2].map(i => Math.max(...corners.map(c => c[i]))) as Vec3;
    const movable = /Ball$|toy-mouse|^yarn/i.test(modelId);
    const solid = !isCatFeederDecorationId(modelId) && !wall && !/carpet|rug/i.test(modelId) && !movable && max[1] > FLOOR_Y + .10;
    const collidable = !isCurtainDecorationId(modelId) && !/carpet|rug/i.test(modelId) && max[1] > FLOOR_Y + .01;
    const object: NativeRoomObject = { instanceId, modelId, position, scale, heading, min, max, solid, collidable, movable, poweredOn, opened, curtainOpen, fridgeOpen, fridgeHingeSide, spotlightAngle: isWallSpotlightDecorationId(modelId) ? normalizeSpotlightAngle(spotlightAngle) : undefined, spotlightSwivel: isWallSpotlightDecorationId(modelId) ? normalizeSpotlightSwivel(spotlightSwivel) : undefined, placementOffset,
      wallAxis: wall ? flip ? 0 : 2 : undefined };
    if (opened && meta.interactionBounds) object.interactionBoxes = meta.interactionBounds.flatMap(bounds => {
      const part = meta.interactionParts?.find(part => part.node === bounds.node);
      if (!part) return [];
      const corners: Vec3[] = [];
      for (const amount of [1]) for (const x of [bounds.min[0], bounds.max[0]])
        for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
          const p = [x,y,z].map((v,i) => v - part.pivot[i]), a = part.angle * amount, c = Math.cos(a), s = Math.sin(a);
          const [u,v,w] = part.axis, dot = u*p[0] + v*p[1] + w*p[2];
          const cross = [v*p[2]-w*p[1],w*p[0]-u*p[2],u*p[1]-v*p[0]];
          const moved = p.map((value,i) => value*c + cross[i]*s + part.axis[i]*dot*(1-c) + part.pivot[i] + part.offset[i]*amount);
          corners.push(rotate(moved,heading).map((value,i) => position[i] + value*scale) as Vec3);
        }
      return [{ min: [0,1,2].map(i=>Math.min(...corners.map(p=>p[i]))) as Vec3,
        max: [0,1,2].map(i=>Math.max(...corners.map(p=>p[i]))) as Vec3 }];
    });
    if (meta.cupboard) {
      object.cupboard = rotate(meta.cupboard.surface, heading).map((v,i) => position[i] + v * scale) as Vec3;
      object.cupboardFits = meta.cupboard.clearance.every((value,i) => value * scale >= [.65,1.25,.65][i] * world.catScale);
    }
    if (meta.drawer) object.drawer = rotate(meta.drawer.surface, heading).map((v,i) => position[i] + v * scale) as Vec3;
    if (meta.bed) {
      const at = (point: number[]) => rotate(point, heading).map((v, i) => position[i] + v * scale) as Vec3;
      object.bed = { surface: at(meta.bed.surface), covered: at(meta.bed.covered) };
      object.seat = object.bed.surface;
      object.seatHeading = heading;
      object.approach = at([0, 0, 1.2 + world.radius / scale]);
    }
    if (modelId.startsWith('bed-') && isCatPetBedId(modelId.slice(4))) {
      const at = (point: Vec3) => rotate(point, heading).map((v, i) => position[i] + v * scale) as Vec3;
      // Pet bed cushion: Blender center Z=.15 plus its .17 vertical radius.
      object.seat = at([0, .32, 0]);
      object.seatHeading = heading;
      object.approach = at([0, 0, 1.2 + world.radius / scale]);
      object.approach[1] = FLOOR_Y;
    }
    if (meta.bathroom) object.bathroom = { kind: meta.bathroom.kind,
      contact: rotate(meta.bathroom.contact, heading).map((v, i) => position[i] + v * scale) as Vec3 };
    if (meta.collisionBoxes) {
      object.collisionBoxes = meta.collisionBoxes.map(box => {
        const corners: Vec3[] = [];
        for (const x of [box.min[0], box.max[0]])
          for (const y of [box.min[1], box.max[1]])
            for (const z of [box.min[2], box.max[2]])
              corners.push(rotate([x, y, z], heading).map((v, i) => v * scale + position[i]) as Vec3);
        return {
          min: [0, 1, 2].map(i => Math.min(...corners.map(c => c[i]))) as Vec3,
          max: [0, 1, 2].map(i => Math.max(...corners.map(c => c[i]))) as Vec3,
        };
      });
    }
    if (isSeatingSofaDecorationId(modelId)) {
      // Sofa variants already contain their quarter turn in the exported model.
      const variant = modelId === 'sofaB' ? Math.PI / 2 : 0;
      const at = (p: Vec3) => rotate(rotate(p, variant), heading).map((v, i) => position[i] + v * scale) as Vec3;
      object.seat = at([0, .70, .27]);
      // Rest along the cushions, choosing the end that faces the camera at
      // positive X/Z. This keeps the face visible on either sofa orientation.
      const alongSeat = heading + variant + Math.PI / 2;
      object.seatHeading = Math.sin(alongSeat) + Math.cos(alongSeat) > 0
        ? alongSeat : alongSeat + Math.PI;
      object.approach = at([0, 0, .85 + world.radius / scale]);
      object.approach[1] = FLOOR_Y;
    }
    if (modelId === 'chairRockingOak') {
      const at = (p: Vec3) => rotate(p, heading).map((v, i) => position[i] + v * scale) as Vec3;
      // GLB cushion top: Blender Z=.69, with its front along native +Z.
      object.seat = at([0, .69, .035]);
      object.seatHeading = heading;
      object.approach = at([0, 0, .78 + world.radius / scale]);
      object.approach[1] = FLOOR_Y;
    }
    const furniture = CAT_FURNITURE[modelId];
    if (furniture) {
      const top = furniture.surfaces[0];
      object.seat = rotate([(top.min[0]+top.max[0])/2,top.max[1],(top.min[2]+top.max[2])/2],heading)
        .map((v,i)=>position[i]+v*scale) as Vec3;
      object.seatHeading = heading+furniture.front;
      const front = object.seatHeading;
      const distance = Math.hypot(max[0]-min[0],max[2]-min[2])/2+world.radius+.04;
      object.approach = [object.seat[0]+Math.sin(front)*distance,FLOOR_Y,object.seat[2]+Math.cos(front)*distance];
    }
    if (isKitchenChairDecorationId(modelId) || isKitchenIslandDecorationId(modelId)) {
      const at = (p: Vec3) => rotate(p, heading).map((v, i) => position[i] + v * scale) as Vec3;
      const chair = isKitchenChairDecorationId(modelId);
      // Dining seats top out at .655; both island worktops are 1.23 high.
      object.seat = at(chair ? [0, .655, .04] : [0, 1.233, 0]);
      object.seatHeading = heading;
      object.approach = at([0, 0, (chair ? .52 : .9) + world.radius / scale]);
      object.approach[1] = FLOOR_Y;
    }
    if (/^catTree|^toy-scratchPost/.test(modelId)) {
      const at = (p: Vec3) => rotate(p, heading).map((v, i) => position[i] + v * scale) as Vec3;
      object.seat = at([-.20, 1.64, -.06]);
      object.seatHeading = heading + Math.PI / 2;
      object.approach = at([.60 + .7 * world.catScale / scale + .04, 0, .12]);
      object.approach[1] = FLOOR_Y;
    }
    if (meta.leaves) object.leaves = meta.leaves.map(leaf => rotate(leaf.point, heading).map((v, i) => position[i] + v * scale) as Vec3);
    world.objects.push(object);
  };
  if (options.bedId)
    add('bed', 'bed-' + options.bedId, getBedDisplaySize(options.bedId) * getEquippedBedScale(options.bedScale) * sizeScale, options.bedOffset ?? { x: -.15, y: .3 }, options.bedFlipped, undefined, 0, options.bedRotationDegrees);
  for (const item of options.decorations)
    add(item.instanceId, getPlacedDecorationSpriteId(item), getPlacedDecorationDragSize(item) * sizeScale, item.offset, getPlacedDecorationWallFlipped(item), item.poweredOn, 0, item.rotationDegrees, item.curtainOpen, item.spotlightAngle, item.spotlightSwivel, item.fridgeOpen, item.fridgeHingeSide, isDecorationOpen(item));
  for (const item of options.toys)
    add(item.instanceId, 'toy-' + item.toyId, getPlacedToyDisplaySize(item) * sizeScale, item.offset, false, undefined, getPlacedToyRotationIndex(item), item.rotationDegrees);
  world.objects = world.objects.map(object => placeObjectOnRugs(object, world.objects));
  world.objects = world.objects.map(object => placeObjectOnSurface(object, world.objects, width));
  world.objects = restoreRoomSupports(world.objects, new Map([...options.decorations, ...options.toys]
    .filter(item => item.support).map(item => [item.instanceId, item.support!])));
  const findFree = createFloorSearch(world);
  // Land in navigable floor space so the following walk never relocates its start.
  for (const object of world.objects)
    if (object.approach) object.approach = findFree(object.approach);
  const home = catFloorPoint(options.livePositions?.cat ?? roomOffsetToPoint(options.homeOffset ?? { x: 0, y: .12 }, width, height, options.petSize), world);
  world.home = findFree(home);
  return world;
}
export function isFree(point: Vec3, world: NativeRoomWorld, ignoreId?: string): boolean {
  'worklet';
  const r = world.radius;
  // The head/tail clearance used around furniture is larger than the paw
  // footprint. Using it at floor edges makes corner bowls unreachable.
  const floorInset = Math.min(r, .5 * world.catScale);
  if (Math.abs(point[0]) > 2.32 - floorInset || Math.abs(point[2]) > 2.32 - floorInset)
    return false;
  for (const o of world.objects)
    if (o.instanceId !== ignoreId) {
      for (const box of o.interactionBoxes ?? []) {
        if (box.min[1] > FLOOR_Y + .8 * world.catScale) continue;
        if (Math.hypot(point[0]-Math.max(box.min[0],Math.min(box.max[0],point[0])),
          point[2]-Math.max(box.min[2],Math.min(box.max[2],point[2]))) < r+.015) return false;
      }
      if (!o.solid) continue;
      if (o.instanceId === world.fridgeDoorClearance && fridgeDoorSweepDistance(point, o) < r + .015) return false;
      if (point[0] < o.min[0] - r - .015 || point[0] > o.max[0] + r + .015
        || point[2] < o.min[2] - r - .015 || point[2] > o.max[2] + r + .015) continue;
      const dining = world.kitchenNavigation && (isKitchenChairDecorationId(o.modelId) || o.modelId === 'kitchenDiningTable');
      const boxes = (dining || isPlayablePlant(o.modelId) || o.modelId === 'lampFloorArc') && o.collisionBoxes?.length ? o.collisionBoxes : [o];
      for (const box of boxes) {
        if (box.min[1] > FLOOR_Y + .8 * world.catScale) continue;
        const x = Math.max(box.min[0], Math.min(box.max[0], point[0]));
        const z = Math.max(box.min[2], Math.min(box.max[2], point[2]));
        // The low base can sit beneath the reaching paws; keep the torso outside it.
        const clearance = /^catTree|^toy-scratchPost/.test(o.modelId) ? Math.min(r, .4 * world.catScale)
          : isPlayablePlant(o.modelId) ? Math.min(r, .65 * world.catScale) : r;
        const margin = clearance + .015, dx = point[0] - x, dz = point[2] - z;
        // A silhouette is inside its bounding box. Most floor samples are far
        // away, so only nearby ones need the detailed chair/table polygon test.
        if (dx * dx + dz * dz >= margin * margin) continue;
        if (!dining || nativeObstacleDistance(point, o, boxes.indexOf(box)) < margin) return false;
      }
    }
  return true;
}
export function findCatCrawlPass(world: NativeRoomWorld, turn: number) {
  const links=buildCatTraversalLinks(world,point=>isFree(point,world)).filter(link=>link.leg.animation==='crawl');
  return links[turn%links.length];
}

/** A cheek/shoulder pass along sturdy furniture, with clear space at both ends. */
export function findCatBrushPass(world: NativeRoomWorld, turn: number): CatBrushPass | undefined {
  const scale=world.catScale, compact={...world,radius:Math.min(world.radius,.40*scale)};
  const candidates:CatBrushPass[]=[];
  for(const object of world.objects) {
    if(!object.solid || object.opened || object.movable || object.min[1]>FLOOR_Y+.2*scale
      || object.max[1]<FLOOR_Y+scale || !/^(sofa|bedroomWardrobe|bedroomDresser|bookcase|cupboard|kitchenIsland|kitchenCounter|kitchenFridge|bedroomChest)/.test(object.modelId))continue;
    const neighbors={...world,objects:world.objects.filter(other=>other!==object)};
    for(const axis of [0,2])for(const side of [-1,1]) {
      const along=axis===0?2:0,from:Vec3=[0,FLOOR_Y,0],to:Vec3=[0,FLOOR_Y,0];
      from[axis]=to[axis]=(side<0?object.min[axis]:object.max[axis])+side*(.48*scale+.02);
      from[along]=object.min[along]-1.2*scale;to[along]=object.max[along]+1.2*scale;
      if(!isFree(from,world)||!isFree(to,world)||!clearLine(from,to,compact)||!clearLine(from,to,neighbors))continue;
      const heading=Math.atan2(to[0]-from[0],to[2]-from[2]);
      const toward=axis===0?-side*Math.cos(heading):side*Math.sin(heading);
      candidates.push({from,to,side:toward,instanceId:object.instanceId});
    }
  }
  return candidates[turn%candidates.length];
}

/** Share one floor occupancy scan across all approach repairs in a layout build.
 * This cache belongs to the build, so live physics/mutable previews cannot leave
 * stale obstacles in a later navigation query. */
function createFloorSearch(world: NativeRoomWorld) {
  let freeFloor: Vec3[] | undefined;
  const edge = 2.32 - Math.min(world.radius, .5 * world.catScale);
  const obstacles = world.objects.flatMap(object => {
    if (!object.solid) return [];
    const plant = isPlayablePlant(object.modelId);
    const parts = (plant || object.modelId === 'lampFloorArc') && object.collisionBoxes?.length ? object.collisionBoxes : [object];
    const clearance = (/^catTree|^toy-scratchPost/.test(object.modelId) ? Math.min(world.radius, .4 * world.catScale)
      : plant ? Math.min(world.radius, .65 * world.catScale) : world.radius) + .015;
    return parts.filter(box => box.min[1] <= FLOOR_Y + .8 * world.catScale)
      .map(box => ({ minX: box.min[0], maxX: box.max[0], minZ: box.min[2], maxZ: box.max[2], clearance, squared: clearance * clearance }));
  });
  const free = (x: number, z: number) => {
    if (world.kitchenNavigation) return isFree([x, FLOOR_Y, z], world);
    if (Math.abs(x) > edge || Math.abs(z) > edge) return false;
    for (const box of obstacles) {
      if (x <= box.minX - box.clearance || x >= box.maxX + box.clearance || z <= box.minZ - box.clearance || z >= box.maxZ + box.clearance) continue;
      const dx = x - Math.max(box.minX, Math.min(box.maxX, x));
      const dz = z - Math.max(box.minZ, Math.min(box.maxZ, z));
      if (dx * dx + dz * dz < box.squared) return false;
    }
    return true;
  };
  return (point: Vec3): Vec3 => {
    if (free(point[0], point[2])) return point;
    if (!freeFloor) {
      freeFloor = [];
      for (let x = -2.2; x <= 2.2; x += .1) for (let z = -2.2; z <= 2.2; z += .1)
        if (free(x, z)) freeFloor.push([x, FLOOR_Y, z]);
    }
    let best: Vec3 | undefined, distance = Infinity;
    for (const candidate of freeFloor) {
      const dx = candidate[0] - point[0], dz = candidate[2] - point[2];
      const squared = dx * dx + dz * dz;
      if (squared < distance) { distance = squared; best = candidate; }
    }
    if (best) return [...best];
    // An overfilled legacy room can still support the cat above its furniture.
    const top = world.objects.filter(o => o.solid && point[0] > o.min[0] - world.radius && point[0] < o.max[0] + world.radius && point[2] > o.min[2] - world.radius && point[2] < o.max[2] + world.radius).reduce((y, o) => Math.max(y, o.max[1]), FLOOR_Y);
    return [point[0], top + .01, point[2]];
  };
}
export function nearestFree(point: Vec3, world: NativeRoomWorld): Vec3 {
  return createFloorSearch(world)(point);
}

/** The two open front edges match the left/right room controls. */
export function nativeRoomEdge(world: NativeRoomWorld, side: -1 | 1): Vec3 {
  const edge = 2.35 - world.radius;
  return nearestFree(side === 1 ? [edge, FLOOR_Y, 1] : [1, FLOOR_Y, edge], world);
}
function clearLine(a: Vec3, b: Vec3, world: NativeRoomWorld): boolean {
  if (!isFree(a,world)) return false;
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / .04);
  for (let i = 1; i <= n; i++)
    if (!isFree([a[0] + (b[0] - a[0]) * i / n, FLOOR_Y, a[2] + (b[2] - a[2]) * i / n], world))
      return false;
  // Sampling alone can miss a grazing collision between two very close curve
  // vertices. Sweep the circular footprint exactly against ordinary boxes.
  const dx=b[0]-a[0], dz=b[2]-a[2], squared=dx*dx+dz*dz;
  const hits = (box: CollisionBox, radius: number) => {
    if (box.min[1]>FLOOR_Y+.8*world.catScale) return false;
    if (Math.max(a[0],b[0])<box.min[0]-radius || Math.min(a[0],b[0])>box.max[0]+radius
      || Math.max(a[2],b[2])<box.min[2]-radius || Math.min(a[2],b[2])>box.max[2]+radius) return false;
    let entry=0,exit=1;
    for (const axis of [0,2]) {
      const delta=b[axis]-a[axis];
      if (Math.abs(delta)<1e-9) { if(a[axis]<box.min[axis]||a[axis]>box.max[axis]) {entry=2;break;} }
      else {
        const first=(box.min[axis]-a[axis])/delta,last=(box.max[axis]-a[axis])/delta;
        entry=Math.max(entry,Math.min(first,last));exit=Math.min(exit,Math.max(first,last));
      }
    }
    if (entry<=exit) return true;
    for (const x of [box.min[0],box.max[0]]) for (const z of [box.min[2],box.max[2]]) {
      const t=squared>0?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/squared)):0;
      if ((a[0]+dx*t-x)**2+(a[2]+dz*t-z)**2<radius*radius) return true;
    }
    return false;
  };
  for (const object of world.objects) {
    if ((object.interactionBoxes??[]).some(box=>hits(box,world.radius+.015))) return false;
    if (!object.solid || world.kitchenNavigation && (isKitchenChairDecorationId(object.modelId)||object.modelId==='kitchenDiningTable')) continue;
    const radius=(/^catTree|^toy-scratchPost/.test(object.modelId)?Math.min(world.radius,.4*world.catScale)
      :isPlayablePlant(object.modelId)?Math.min(world.radius,.65*world.catScale):world.radius)+.015;
    const boxes=(isPlayablePlant(object.modelId)||object.modelId==='lampFloorArc')&&object.collisionBoxes?.length?object.collisionBoxes:[object];
    if (boxes.some(box=>hits(box,radius))) return false;
  }
  return true;
}
/** Walk into a revised floor command or standing departure when a curve fits.
 * Runs once on the JS thread; drawing uses only these validated samples. */
export function movingCatRoute(travel: NativeTravel | undefined, position: Vec3, heading: number, speed: number, world?: NativeRoomWorld, fromRest = false, fromLanding = false) {
  if(!world || !travel || travel.jump || travel.legs?.length || travel.bed || travel.bathroom || travel.blocked
    || travel.elapsed || travel.path.length<2 || Math.abs(position[1]-FLOOR_Y)>.04 || !fromRest&&speed<.5*world.catScale)return undefined;
  // Shared-value arrays can expose indices without Array prototype methods.
  // Materialize the route before passing it to the JS-side steering helpers.
  const source: Vec3[] = [];
  for(let i=0;i<travel.path.length;i++)source.push([travel.path[i][0],travel.path[i][1],travel.path[i][2]]);
  // A tiny reposition should not become a wide detour. Contact passes keep
  // their authored approach; ordinary standing departures can begin walking.
  if(fromRest && (pathLength(source)<(fromLanding?1.5:2.5)*world.catScale || travel.brushSide!==undefined))return undefined;
  // The landing's remaining support feet need one short forward step before
  // the shoulders turn across them. Starting curvature immediately can pull
  // those planted paws beyond leg reach during impact recovery.
  const start:Vec3=fromLanding ? [position[0]+Math.sin(heading)*.6*world.catScale,position[1],position[2]+Math.cos(heading)*.6*world.catScale] : position;
  if(fromLanding && !clearLine(position,start,world))return undefined;
  let continuation=source;
  if(fromLanding) {
    // Paced samples behind the forward recovery step are not new waypoints.
    // Join a point ahead; the curve still validates every replacement chord.
    const ahead=source.findIndex(point=>(point[0]-start[0])*Math.sin(heading)+(point[2]-start[2])*Math.cos(heading)>.10*world.catScale);
    continuation=[start,...source.slice(ahead<0?source.length-1:Math.max(1,ahead))];
  }
  const curve=steerCatPath(continuation,start,heading,world.catScale,(a,b)=>clearLine(a,b,world),true);
  if(!curve)return undefined;
  if(fromLanding)curve.unshift(position);
  const path=catPacedPath(curve,world.catScale);
  const roomyWorld={...world,radius:world.radius+.16*world.catScale};
  const timing=catWalkTiming(path,world.catScale,travel.gait??'walk',p=>isFree(p,roomyWorld),travel.through);
  return {path,...timing,startSpeed:fromRest?0:speed};
}

/** Navigation runs when a command/layout changes, never on the render thread. */
export function findRoomPath(start: Vec3, target: Vec3, world: NativeRoomWorld): Vec3[] {
  return searchRoomRoute(start, target, world).path;
}

type CatRoute = { path: Vec3[]; legs?: CatMotionLeg[] };
/** A* over floor cells and directed furniture connections. Costs include jump recovery. */
export function findCatRoomRoute(start: Vec3, target: Vec3, world: NativeRoomWorld): CatRoute {
  if (clearLine(start, target, world)) return { path: [start, target] };
  const links = buildCatTraversalLinks(world, point => isFree(point, world));
  return searchRoomRoute(start, target, world, links);
}

function searchRoomRoute(start: Vec3, target: Vec3, world: NativeRoomWorld, links: CatTraversalLink[] = []): CatRoute {
  const end = nearestFree(target, world);
  if (!isFree(start, world))
    start = nearestFree(start, world);
  if (clearLine(start, end, world))
    return { path: [start, end] };
  // Include the usable floor edges: a narrow passage next to a furnishing can
  // lie entirely between the regular grid's last column and the room boundary.
  const limit = 2.32 - Math.min(world.radius, .5 * world.catScale) - .001;
  const coordinates = [-limit, ...Array.from({ length: 45 }, (_, i) => -2.2 + i * .1)
    .filter(v => Math.abs(v) < limit), limit];
  const count = coordinates.length;
  const points: Vec3[] = Array.from({ length: count * count }, (_, i) =>
    [coordinates[i % count], FLOOR_Y, coordinates[Math.floor(i / count)]]);
  const point = (i: number) => points[i];
  const free = points.map(p => isFree(p, world));
  const available = points.map((_, i) => i).filter(i => free[i]);
  // Rounded endpoints can fall inside furniture even though the actual
  // endpoint is free. Connect each exact endpoint to a visible free grid node.
  const connection = (p: Vec3) => available.map(id => ({ id,
    distance: (p[0] - points[id][0]) ** 2 + (p[2] - points[id][2]) ** 2 }))
    .sort((a, b) => a.distance - b.distance).find(node => clearLine(p, points[node.id], world))?.id;
  const first = connection(start), last = connection(end);
  if (first === undefined || last === undefined) return { path: [start] };
  const extra = new Map<number, { to: number; leg?: CatMotionLeg; cost: number }[]>();
  const addEdge = (from: number, to: number, leg?: CatMotionLeg) => {
    const distance = pathLength([points[from], points[to]]);
    const cost = leg ? Math.max(distance, leg.duration * 1.8 * world.catScale + .08 * world.catScale) : distance;
    extra.set(from, [...(extra.get(from) ?? []), { to, leg, cost }]);
  };
  const anchors = new Map<string, number>();
  const anchor = (p: Vec3) => {
    const key = p.map(v => v.toFixed(6)).join(':');
    const existing = anchors.get(key);
    if (existing !== undefined) return existing;
    const id = points.length;
    points.push(p); anchors.set(key, id);
    if (Math.abs(p[1] - FLOOR_Y) < .01) {
      const floor = connection(p);
      if (floor !== undefined) { addEdge(id, floor); addEdge(floor, id); }
    }
    return id;
  };
  for (const link of links) addEdge(anchor(link.from), anchor(link.to), link.leg);
  const heuristic = points.map(p => Math.hypot(p[0] - end[0], p[2] - end[2]));
  // A min-heap avoids sorting the entire frontier at every visited floor tile.
  type Node = { id: number; cost: number; estimate: number; order: number };
  const open: Node[] = [];
  let order = 0;
  const before = (a: Node, b: Node) => a.estimate < b.estimate || a.estimate === b.estimate && a.order < b.order;
  const push = (id: number, cost: number) => {
    const node = { id, cost, estimate: cost + heuristic[id], order: order++ };
    let i = open.length;
    open.push(node);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!before(node, open[parent])) break;
      open[i] = open[parent]; i = parent;
    }
    open[i] = node;
  };
  const pop = () => {
    const first = open[0], tail = open.pop()!;
    if (open.length) {
      let i = 0;
      while (i * 2 + 1 < open.length) {
        let child = i * 2 + 1;
        if (child + 1 < open.length && before(open[child + 1], open[child])) child++;
        if (!before(open[child], tail)) break;
        open[i] = open[child]; i = child;
      }
      open[i] = tail;
    }
    return first;
  };
  const parents = new Map<number, number>(), costs = new Map([[first, 0]]), closed = new Set<number>();
  push(first, 0);
  while (open.length) {
    const node = pop(), current = node.id;
    if (closed.has(current) || node.cost !== costs.get(current)) continue;
    if (current === last) {
      const ids = [current];
      let i = current;
      while (i !== first) {
        i = parents.get(i)!;
        ids.unshift(i);
      }
      const legs: CatMotionLeg[] = [];
      let floorPath = [start, point(first)];
      const flush = () => {
        const smooth = [floorPath[0]];
        let from = 0;
        while (from < floorPath.length - 1) {
          let to = floorPath.length - 1;
          while (to > from + 1 && !clearLine(floorPath[from], floorPath[to], world)) to--;
          smooth.push(floorPath[to]); from = to;
        }
        const path = links.length ? roundCatPath(smooth, .6 * world.catScale, (a,b) => clearLine(a,b,world)) : smooth;
        const distance = pathLength(path);
        if (distance > 1e-6) legs.push({ kind: 'walk', path, ...catWalkTiming(path, world.catScale) });
      };
      for (let j = 1; j < ids.length; j++) {
        const leg = extra.get(ids[j - 1])?.find(edge => edge.to === ids[j])?.leg;
        if (leg) { flush(); legs.push(leg); floorPath = [point(ids[j])]; }
        else floorPath.push(point(ids[j]));
      }
      floorPath.push(end); flush();
      for (let j = 1; j < legs.length; j++) {
        const leg = legs[j], before = legs[j - 1].path;
        if (leg.kind !== 'hop' || before.length < 2) continue;
        const a = before[before.length - 2], b = before[before.length - 1], c = leg.path[leg.path.length - 1];
        const heading = Math.atan2(b[0] - a[0], b[2] - a[2]);
        const desired = Math.atan2(c[0] - b[0], c[2] - b[2]);
        const turn = Math.abs(Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading)));
        if (turn > .5) {
          const turnDuration = catTurnDuration(turn);
          legs[j] = { ...leg, turnDuration, duration: leg.duration + turnDuration };
        }
      }
      const path = legs.flatMap((leg, index) => index ? leg.path.slice(1) : leg.path);
      return { path: path.length ? path : [start, end], legs: legs.some(leg => leg.kind === 'hop' || leg.animation === 'crawl') ? legs : undefined };
    }
    closed.add(current);
    const visit = (next: number, edgeCost: number) => {
      if (closed.has(next)) return;
      const cost = node.cost + edgeCost;
      if (cost < (costs.get(next) ?? Infinity)) {
        parents.set(next, current); costs.set(next, cost); push(next, cost);
      }
    };
    for (const edge of extra.get(current) ?? []) visit(edge.to, edge.cost);
    if (current >= count * count) continue;
    for (const dx of [-1, 0, 1])
      for (const dz of [-1, 0, 1]) {
        if (!dx && !dz)
          continue;
        const x = current % count + dx, z = Math.floor(current / count) + dz;
        if (x < 0 || x >= count || z < 0 || z >= count)
          continue;
        const next = x + z * count;
        if (closed.has(next) || !free[next] || !clearLine(point(current), point(next), world))
          continue;
        visit(next, Math.hypot(points[current][0] - points[next][0], points[current][2] - points[next][2]));
      }
  }
  // An unreachable target never causes a direct walk through an obstacle.
  return { path: [start] };
}
export function pathLength(path: Vec3[]): number {
  return path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - path[i][0], p[1] - path[i][1], p[2] - path[i][2]), 0);
}
function findTraversalApproach(start: Vec3, points: Vec3[], world: NativeRoomWorld): Vec3[] | undefined {
  const links = buildCatTraversalLinks(world,point=>isFree(point,world));
  if (!links.length) return undefined;
  for (const point of points) {
    const path = searchRoomRoute(start,point,world,links).path;
    if (hasNativeArrived(path.at(-1)!,point)) return path;
  }
  return undefined;
}
/** Face the food from a reachable point, retaining the route already solved. */
export function findFoodBowlApproach(start: Vec3, bowl: NativeRoomObject, world: NativeRoomWorld): Vec3[] | undefined {
  const heading = Math.atan2(bowl.position[0] - start[0], bowl.position[2] - start[2]);
  const candidates: Vec3[] = [];
  for (let i = 0; i < 64; i++) {
    const turn = i % 2 ? (i + 1) / 2 : -i / 2;
    const angle = heading + turn * Math.PI / 32;
    const point: Vec3 = [bowl.position[0] - Math.sin(angle) * CAT_EATING_REACH * world.catScale, FLOOR_Y,
      bowl.position[2] - Math.cos(angle) * CAT_EATING_REACH * world.catScale];
    if (!isFree(point, world)) continue;
    candidates.push(point);
    const path = findRoomPath(start, point, world);
    if (pathLength([path.at(-1)!, point]) < .02) return path;
  }
  return findTraversalApproach(start,candidates,world);
}
/** Try reachable leaves from free floor positions, including corner approaches. */
export function findPlantApproach(start: Vec3, object: NativeRoomObject, world: NativeRoomWorld): Vec3 | undefined {
  return findPawApproach(start, object.leaves ?? [], .20 * object.scale, world);
}

export function findHangingToyApproach(start: Vec3, object: NativeRoomObject, world: NativeRoomWorld): Vec3 | undefined {
  return findPawApproach(start, [hangingToyPosition(object)], .1 * object.scale, world, object.collisionBoxes);
}

function findPawApproach(start: Vec3, points: Vec3[], targetRadius: number, world: NativeRoomWorld, obstacles?: NativeRoomObject['collisionBoxes']): Vec3 | undefined {
  const candidates: { position: Vec3; reach: number }[] = [];
  for (const point of points) for (const radius of [.6, .75, .9, 1.05, 1.2])
    for (let i = 0; i < 64; i++) {
      const angle = i * Math.PI / 32;
      const distance = radius * world.catScale + targetRadius;
      const position: Vec3 = [point[0] + Math.sin(angle) * distance, FLOOR_Y, point[2] + Math.cos(angle) * distance];
      if (!isFree(position, world)) continue;
      const heading = Math.atan2(point[0] - position[0], point[2] - position[2]);
      const reach = Math.min(...[-1, 1].map(side => {
        const shoulder: Vec3 = [position[0] + (.4 * Math.sin(heading) + side * .247 * Math.cos(heading)) * world.catScale,
          FLOOR_Y + .79 * world.catScale,
          position[2] + (.4 * Math.cos(heading) - side * .247 * Math.sin(heading)) * world.catScale];
        // A short geometric reach can still put the sisal post between paw and ball.
        if (obstacles?.length) for (let sample = 0; sample <= 16; sample++) {
          const t = sample / 16;
          const paw = shoulder.map((v, k) => v + (point[k] - v) * t);
          if (obstacles.some(box => Math.hypot(...paw.map((v, k) =>
            v - Math.max(box.min[k], Math.min(box.max[k], v)))) < .1 * world.catScale)) return Infinity;
        }
        return Math.hypot(...shoulder.map((v, k) => v - point[k]));
      }));
      if (reach < .69 * world.catScale + targetRadius + .18 * world.radius) candidates.push({ position, reach });
    }
  // Favor a comfortable paw reach over stopping at the first distant contact edge.
  const score = (candidate: typeof candidates[number]) => candidate.reach + .08 * pathLength([start, candidate.position]);
  candidates.sort((a, b) => score(a) - score(b));
  return candidates.find(({ position }) => pathLength([findRoomPath(start, position, world).at(-1)!, position]) < .01)?.position;
}
/** Only a temporary store preview may move to make room; saved objects stay put. */
export function placeNativePreview(world: NativeRoomWorld, id: string): void {
  const object = world.objects.find(o => o.instanceId === id);
  if (!object || !(object.solid || object.movable || isCatFeederDecorationId(object.modelId)))
    return;
  const center = object.min.map((v, i) => (v + object.max[i]) / 2) as Vec3;
  const half = object.min.map((v, i) => (object.max[i] - v) / 2);
  const clear = (x: number, z: number) => Math.abs(x) + half[0] < 2.3 && Math.abs(z) + half[2] < 2.3
    && world.objects.every(o => o === object || !(o.solid || o.movable) || x + half[0] + .08 < o.min[0] || x - half[0] - .08 > o.max[0] || z + half[2] + .08 < o.min[2] || z - half[2] - .08 > o.max[2]);
  let best: [
    number,
    number
  ] | undefined, distance = Infinity;
  for (let x = -2.1; x <= 2.1; x += .15)
    for (let z = -2.1; z <= 2.1; z += .15) {
      // Favor the foreground so a small new item is not hidden by taller
      // furnishings even when their floor footprints do not overlap.
      const d = Math.hypot(x - .8, z - 1.4);
      if (d < distance && clear(x, z)) {
        best = [x, z];
        distance = d;
      }
    }
  if (!best)
    return;
  const shift = [best[0] - center[0], 0, best[1] - center[2]];
  for (let axis = 0; axis < 3; axis++) {
    object.position[axis] += shift[axis];
    object.min[axis] += shift[axis];
    object.max[axis] += shift[axis];
    for (const box of object.collisionBoxes ?? []) {
      box.min[axis] += shift[axis];
      box.max[axis] += shift[axis];
    }
  }
  if (object.seat)
    object.seat = object.seat.map((v, i) => v + shift[i]) as Vec3;
  if (object.approach)
    object.approach = object.approach.map((v, i) => v + shift[i]) as Vec3;
  world.home = nearestFree(world.home, world);
}
/** Validate the same arc that the native actor will play, including recovery
 * refreshes which must preserve the original airborne trajectory. */
function nativeJumpArc(start: Vec3, target: Vec3, world: NativeRoomWorld, ignoreId?: string, fromSupportId?: string, landingHeading?: number): number | undefined {
  const furniture = world.objects.find(object=>object.instanceId===ignoreId && isFurniturePerch(object.modelId) && !object.opened);
  const kitchenChair = world.objects.find(object=>object.instanceId===ignoreId && isKitchenChairDecorationId(object.modelId));
  if (furniture && Math.hypot(start[0]-target[0],start[2]-target[2])>4*world.catScale) return undefined;
  for (const rise of furniture || kitchenChair || fromSupportId ? [.35,.5,.7,.9,1.15,1.4] : [.35]) {
    // Meet the destination while descending, including high seats.
    const height=Math.max(rise*world.catScale,Math.abs(target[1]-start[1])*.25+.06*world.catScale);
    if (isNativeJumpAtHeightClear(start,target,world,ignoreId,height,fromSupportId,landingHeading)) return height;
  }
  return undefined;
}
function isNativeJumpClear(start: Vec3, target: Vec3, world: NativeRoomWorld, ignoreId?: string): boolean {
  return nativeJumpArc(start,target,world,ignoreId)!==undefined;
}
function isNativeJumpAtHeightClear(start: Vec3, target: Vec3, world: NativeRoomWorld, ignoreId: string | undefined, height: number, fromSupportId?: string, landingHeading?: number): boolean {
  // A tucked jumping cat has the same body clearance on every furnishing.
  // Floor approaches still reserve their normal walking footprint.
  const radius = Math.min(world.radius,.55 * world.catScale);
  const kitchenChair = world.objects.find(object=>object.instanceId===ignoreId && isKitchenChairDecorationId(object.modelId));
  const gatheredRadius = kitchenChair ? Math.min(radius, world.catScale * (.08 + Math.hypot(
    .43 * catSupportStance(kitchenChair,world), .215 * catSupportWidth(kitchenChair,world)))) : radius;
  const furniture = !!fromSupportId || world.objects.some(object=>object.instanceId===ignoreId && isFurniturePerch(object.modelId) && !object.opened);
  const samples = furniture ? Math.max(100,Math.ceil((pathLength([start,target])+2*height)/(4*world.catScale))*100) : 40;
  for (let i = 0; i <= samples; i++) {
    // Check endpoints first: no higher arc can fix a blocked head at landing.
    const t = i===0 ? 0 : i===1 ? 1 : (i-1)/samples;
    const p = catJumpPoint(start, target, t, height, true);
    const aim=catJumpAim(start,target,t,landingHeading);
    const forwardX=Math.sin(aim.heading+aim.headTurn),forwardZ=Math.cos(aim.heading+aim.headTurn);
    if (fromSupportId && (Math.abs(p[0])+radius>2.35 || Math.abs(p[2])+radius>2.35
      || Math.abs(p[0]+forwardX*.70*world.catScale)+.32*world.catScale>2.35
      || Math.abs(p[2]+forwardZ*.70*world.catScale)+.32*world.catScale>2.35)) return false;
    if (world.objects.some(o => (o.solid || isFurniturePerch(o.modelId) && o.collidable) && (o.instanceId !== ignoreId || isFurniturePerch(o.modelId) && !o.opened || fromSupportId)
      && [...(o.collisionBoxes?.length ? o.collisionBoxes : [o]),...(o.interactionBoxes ?? [])].some((box, index) => {
        const own = o.instanceId === ignoreId || o.instanceId === fromSupportId;
        // At a small dining seat the paws gather beneath the torso. A nearby
        // tabletop below the belly must clear those gathered legs, rather than
        // the full walking envelope used while approaching on the floor.
        const gatheredLegs = kitchenChair?.seat && p[1] >= kitchenChair.seat[1] - .02 * world.catScale
          && box.max[1] <= kitchenChair.seat[1] + .45 * world.catScale;
        const clearance = own ? .285*world.catScale : gatheredLegs ? gatheredRadius : radius;
        // A support is contact only when the paws have risen above it. Lift
        // over the seat/table edge instead of passing through its front board.
        if (own && box.max[1]<=p[1]+.025*world.catScale) return false;
        const body = p[1] < box.max[1] && p[1] + (own ? 1.25 : .8)*world.catScale > box.min[1]
          && Math.hypot(p[0] - Math.max(box.min[0], Math.min(box.max[0], p[0])), p[2] - Math.max(box.min[2], Math.min(box.max[2], p[2]))) < clearance
          && (!NATIVE_MODEL_CATALOG[o.modelId] || index >= (o.collisionBoxes?.length ?? 1) || nativeObstacleDistance(p,o,index)<clearance);
        if (body) return true;
        // The head leads the flight. A root-only cylinder would let it land
        // inside a tall backrest; these chairs need a clear side approach.
        if (!furniture || box.max[1]<=p[1]+.75*world.catScale || box.min[1]>=p[1]+1.5*world.catScale) return false;
        return [.45,.70].some(lead=>{
          const head: Vec3 = [p[0]+forwardX*lead*world.catScale,p[1],p[2]+forwardZ*lead*world.catScale], radius=.32*world.catScale;
          return Math.hypot(head[0]-Math.max(box.min[0],Math.min(box.max[0],head[0])),head[2]-Math.max(box.min[2],Math.min(box.max[2],head[2])))<radius
            && (!NATIVE_MODEL_CATALOG[o.modelId] || index>=(o.collisionBoxes?.length ?? 1) || nativeObstacleDistance(head,o,index)<radius);
        });
      }))) return false;
  }
  return true;
}
/** A seat needs both a reachable floor point and a clear flight to its cushion.
 * Search exposed sides instead of moving a blocked anchor to an arbitrary
 * nearby floor point. Keep the chosen point for the exit. */
export function findSeatApproach(start: Vec3, object: NativeRoomObject, world: NativeRoomWorld, fromSupport = false): Vec3 | undefined {
  if (!object.seat || !object.approach) return undefined;
  const furniture = CAT_FURNITURE[object.modelId];
  const kitchenChair = isKitchenChairDecorationId(object.modelId), kitchenPerch = isKitchenPerchDecorationId(object.modelId);
  const chair = kitchenChair || !!furniture && !furniture.allSides, worktop = kitchenPerch || !!furniture?.allSides;
  const roundBed = object.modelId.startsWith('bed-') && isCatPetBedId(object.modelId.slice(4));
  const allSides = worktop || roundBed;
  if (kitchenChair || kitchenPerch || object.cupboard) world = kitchenNavigationWorld(world);
  const seat = object.seat;
  const front = object.heading + (furniture?.front ?? (object.modelId === 'sofaB' ? Math.PI / 2 : 0));
  const drawerFront = (object.drawer || object.cupboard) && object.interactionBoxes?.length ? Math.max(...object.interactionBoxes.map(box => Math.max(
    ...[box.min[0],box.max[0]].flatMap(x=>[box.min[2],box.max[2]].map(z=>(x-seat[0])*Math.sin(front)+(z-seat[2])*Math.cos(front)))))) + world.radius + .05 : undefined;
  const candidates = drawerFront === undefined ? [object.approach] : [[seat[0]+Math.sin(front)*drawerFront,FLOOR_Y,seat[2]+Math.cos(front)*drawerFront] as Vec3,object.approach];
  // A dining chair faces its table, so the cat often needs a side approach.
  // Worktops and round pet beds have no backrest limiting their entry side.
  // Every candidate still needs a clear floor route and an entrance/exit arc.
  for (let i = 0; i < (allSides ? 37 : chair ? 19 : 25); i++) {
    // Tall-backed seats are usually entered sideways. Try those exposed
    // sides first instead of sweeping every blocked front-facing angle.
    const turn = furniture && !furniture.allSides ? (i%2 ? -1 : 1)*(9-Math.floor(i/2))
      : i % 2 ? (i + 1) / 2 : -i / 2;
    const angle = front + turn * Math.PI / (chair || allSides ? 18 : 36);
    const x = Math.sin(angle), z = Math.cos(angle), clearance = world.radius + .04;
    const edge = Math.min(Math.abs(x) < 1e-6 ? Infinity : ((x > 0 ? object.max[0] + clearance : object.min[0] - clearance) - seat[0]) / x,
      Math.abs(z) < 1e-6 ? Infinity : ((z > 0 ? object.max[2] + clearance : object.min[2] - clearance) - seat[2]) / z);
    // A leading head needs room to rise before crossing an armrest. Step
    // farther back when the nearest floor point makes the arc too steep.
    for (const extra of furniture ? [0,.5,1,1.5] : [0])
      candidates.push([seat[0] + x * (edge+extra*world.catScale), FLOOR_Y, seat[2] + z * (edge+extra*world.catScale)]);
  }
  for (const point of candidates) {
    if (!isFree(point, world) || !isNativeJumpClear(point, seat, world, object.instanceId)
      || !isNativeJumpClear(seat, point, world, object.instanceId)) continue;
    // An elevated source is not a floor-route origin. Keep the destination's
    // later exit connected to the room instead of an isolated floor pocket.
    const path = findRoomPath(fromSupport ? world.home : start, point, world);
    if (pathLength([path.at(-1)!, point]) < .05) return point;
  }
  return undefined;
}

/** Kitchen passages need the head/torso envelope, rather than a circle large
 * enough to contain the extended walking tail in every orientation. */
function kitchenNavigationWorld(world: NativeRoomWorld): NativeRoomWorld {
  return { ...world, radius: Math.min(world.radius, .55 * world.catScale), kitchenNavigation: true };
}

/** Test authored local boxes/polygons so a rotated furnishing or round tabletop
 * does not fill the empty corners of its world-aligned bounding box. */
function nativeObstacleDistance(point: Vec3, object: NativeRoomObject, index: number): number {
  const meta = NATIVE_MODEL_CATALOG[object.modelId], box = meta.collisionBoxes?.[index] ?? meta;
  const dx = (point[0] - object.position[0]) / object.scale, dz = (point[2] - object.position[2]) / object.scale;
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  const x = c * dx - s * dz, z = s * dx + c * dz;
  if (!('footprint' in box) || !box.footprint?.length)
    return Math.hypot(x - Math.max(box.min[0], Math.min(box.max[0], x)), z - Math.max(box.min[2], Math.min(box.max[2], z))) * object.scale;
  let distance = Infinity, positive = false, negative = false;
  for (let i = 0; i < box.footprint.length; i++) {
    const a = box.footprint[i], b = box.footprint[(i + 1) % box.footprint.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], cross = dx * (z - a[1]) - dz * (x - a[0]);
    positive ||= cross > 1e-8; negative ||= cross < -1e-8;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    const gapX = x - a[0] - t * dx, gapZ = z - a[1] - t * dz;
    distance = Math.min(distance, gapX * gapX + gapZ * gapZ);
  }
  return positive && negative ? Math.sqrt(distance) * object.scale : 0;
}

/** Keep the paws inside a dry worktop and clear of mixers, lamps and taps. */
function kitchenPerchPoints(object: NativeRoomObject, world: NativeRoomWorld): Vec3[] {
  const pawRadius = .4 * world.catScale, radius = .55 * world.catScale, points: Vec3[] = [];
  for (const top of NATIVE_MODEL_CATALOG[object.modelId]?.supportSurfaces ?? []) {
    const minX = top.min[0] * object.scale + pawRadius, maxX = top.max[0] * object.scale - pawRadius;
    const minZ = top.min[2] * object.scale + pawRadius, maxZ = top.max[2] * object.scale - pawRadius;
    if (maxX < minX || maxZ < minZ) continue;
    for (const x of [.5, .25, .75, 0, 1]) for (const z of [.5, 0, 1]) {
      const p = rotate([minX + (maxX - minX) * x, top.max[1] * object.scale + .003, minZ + (maxZ - minZ) * z], object.heading)
        .map((v, i) => v + object.position[i]) as Vec3;
      if (Math.abs(p[0]) > 2.32 - radius || Math.abs(p[2]) > 2.32 - radius) continue;
      const blocked = world.objects.some(other => (other.collidable ?? other.solid) &&
        (other.collisionBoxes ?? [other]).some(box => box.max[1] > p[1] + .01 && box.min[1] < p[1] + .9 * world.catScale
          && Math.hypot(p[0] - Math.max(box.min[0], Math.min(box.max[0], p[0])),
            p[2] - Math.max(box.min[2], Math.min(box.max[2], p[2]))) < radius));
      if (!blocked) points.push(p);
    }
  }
  return points;
}

function findKitchenIslandPerch(start: Vec3, object: NativeRoomObject, world: NativeRoomWorld): { seat: Vec3; approach: Vec3 } | undefined {
  for (const seat of kitchenPerchPoints(object, world)) {
    const approach = findSeatApproach(start, { ...object, seat }, world);
    if (approach) return { seat, approach };
  }
  return undefined;
}

/** A round dining cushion has usable space beside its centre. Keep every pad
 * supported while looking for a landing clear of the adjacent table edge. */
function findKitchenChairPerch(start: Vec3, object: NativeRoomObject, world: NativeRoomWorld): { seat: Vec3; approach: Vec3 } | undefined {
  if (!object.seat) return undefined;
  for (const z of [0,.04,.08,-.04]) for (const x of [0,-.04,.04,-.08,.08]) {
    const shift=rotate([x*object.scale,0,z*object.scale],object.heading);
    const seat=object.seat.map((value,i)=>value+shift[i]) as Vec3;
    if (!catTransferPawsFit(seat,object.seatHeading ?? object.heading,object,world)) continue;
    const approach=findSeatApproach(start,{...object,seat},world);
    if (approach) return {seat,approach};
  }
  return undefined;
}

/** Fit paws on an authored seat/top, then exclude backs, arms and placed props.
 * Try exposed parts of a table instead of requiring its exact center. */
export function findFurniturePerch(start: Vec3, object: NativeRoomObject, world: NativeRoomWorld,
  acceptSeat?: (seat: Vec3) => boolean): { seat: Vec3; approach: Vec3 } | undefined {
  if(object.opened)return undefined;
  const furniture = CAT_FURNITURE[object.modelId] ?? (acceptSeat && catTransferSupport(object) ? {
    front: (object.seatHeading ?? object.heading)-object.heading, allSides: false,
    surfaces: catSupportSurfaces(object),
  } : undefined);
  if (!furniture) return undefined;
  const pawRadius = .28*world.catScale, bodyRadius = .55*world.catScale;
  const pawPad = .08*world.catScale/object.scale;
  const stance = acceptSeat ? catSupportStance(object,world) : 1;
  const width = catSupportWidth(object,world);
  const pawDepth = acceptSeat ? [-.43*stance,.40*stance] : [-.271,.425];
  const paws = [-.215,.215].flatMap(x=>pawDepth.map(z=>rotate([x*width*world.catScale/object.scale,0,z*world.catScale/object.scale],furniture.front)));
  const fractions = (axis: number) => acceptSeat || furniture.allSides || Math.abs(axis)<.5 ? [.5,.25,.75,.125,.875,0,1]
    : axis>0 ? [1,.875,.75,.5,.25,.125,0] : [0,.125,.25,.5,.75,.875,1];
  for (const top of furniture.surfaces) {
    const minX=top.min[0]-Math.min(...paws.map(p=>p[0]))+pawPad,maxX=top.max[0]-Math.max(...paws.map(p=>p[0]))-pawPad;
    const minZ=top.min[2]-Math.min(...paws.map(p=>p[2]))+pawPad,maxZ=top.max[2]-Math.max(...paws.map(p=>p[2]))-pawPad;
    if (minX>maxX || minZ>maxZ) continue;
    for (const u of fractions(Math.sin(furniture.front))) for (const v of fractions(Math.cos(furniture.front))) {
      const x=minX+(maxX-minX)*u,z=minZ+(maxZ-minZ)*v;
      if (paws.some(p=>top.footprint.some((a,i,poly)=>{const b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1];
        return (dx*(z+p[2]-a[1])-dz*(x+p[0]-a[0]))/Math.hypot(dx,dz)<pawPad-1e-6;}))) continue;
      const seat=rotate([x,top.max[1],z],object.heading).map((value,i)=>object.position[i]+value*object.scale) as Vec3;
      if (seat[1]<FLOOR_Y+.06*world.catScale || seat[1]-FLOOR_Y>2.4*world.catScale || Math.abs(seat[0])>2.32-pawRadius || Math.abs(seat[2])>2.32-pawRadius) continue;
      const occupied=world.objects.some(other=>(other.collidable ?? other.solid) &&
        [...(other.collisionBoxes ?? [other]),...(other.interactionBoxes ?? [])].some((box,index)=>{
          if (box.max[1]<=seat[1]+.025*world.catScale || box.min[1]>=seat[1]+1.25*world.catScale) return false;
          const radius=other.instanceId===object.instanceId?pawRadius:bodyRadius;
          const broad=Math.hypot(seat[0]-Math.max(box.min[0],Math.min(box.max[0],seat[0])),seat[2]-Math.max(box.min[2],Math.min(box.max[2],seat[2])));
          return broad<radius && (!NATIVE_MODEL_CATALOG[other.modelId] || index>=(other.collisionBoxes?.length ?? 1) || nativeObstacleDistance(seat,other,index)<radius);
        }));
      if (occupied) continue;
      if (acceptSeat && !acceptSeat(seat)) continue;
      const approach=findSeatApproach(start,{...object,seat},world,!!acceptSeat);
      if (approach) return {seat,approach};
    }
  }
  return undefined;
}

function catTransferSupport(object: NativeRoomObject): boolean {
  return !!object.seat && !object.bathroom && !object.opened
    && (isFurniturePerch(object.modelId) || isSeatingSofaDecorationId(object.modelId)
      || object.modelId==='chairRockingOak' || isKitchenChairDecorationId(object.modelId)
      || isKitchenIslandDecorationId(object.modelId) || !!object.bed);
}

/** Seat cushions are support planes too; backs, arms and cushions behind the
 * cat remain obstacles. Generic furniture already has mesh-derived polygons. */
function catSupportSurfaces(object: NativeRoomObject) {
  if (CAT_FURNITURE[object.modelId]) return CAT_FURNITURE[object.modelId].surfaces;
  const height=(object.seat![1]-object.position[1])/object.scale;
  const surfaces=(NATIVE_MODEL_CATALOG[object.modelId]?.collisionBoxes ?? []).filter(box=>Math.abs(box.max[1]-height)<.03)
    .map(box=>({ ...box, footprint: box.footprint ?? [[box.min[0],box.min[2]],[box.max[0],box.min[2]],
      [box.max[0],box.max[2]],[box.min[0],box.max[2]]] }));
  // A paw can bridge the narrow seam between adjacent sofa cushions. Add
  // only that seam, preserving the outside edges and any genuinely open gaps.
  if (isSeatingSofaDecorationId(object.modelId)) for(const axis of [0,2]) {
    const across=2-axis;
    for (const a of [...surfaces]) for (const b of [...surfaces]) {
      if (a === b || b.min[axis] < a.max[axis] || b.min[axis] - a.max[axis] > .04
        || Math.abs(a.min[across]-b.min[across]) > .005 || Math.abs(a.max[across]-b.max[across]) > .005) continue;
      const min=[Math.max(a.min[0],b.min[0]),height,Math.max(a.min[2],b.min[2])],max=[Math.min(a.max[0],b.max[0]),height,Math.min(a.max[2],b.max[2])];
      // Candidate generation also needs the joined rectangle: otherwise a
      // cat spanning two cushions is rejected before its pads are tested.
      min[axis]=a.min[axis];max[axis]=b.max[axis];
      surfaces.push({min,max,footprint:[[min[0],min[2]],[max[0],min[2]],[max[0],max[2]],[min[0],max[2]]]});
    }
  }
  return surfaces;
}

/** Bring the paws under the body on small seats. The actor uses the same
 * fore/aft compression while turning, pushing off and recovering a landing. */
function catSupportStance(object: NativeRoomObject, world: NativeRoomWorld): number {
  const surfaces=catSupportSurfaces(object);
  if (!surfaces.length) return 1;
  const span=(axis:number)=>(Math.max(...surfaces.map(s=>s.max[axis]))-Math.min(...surfaces.map(s=>s.min[axis])))*object.scale/world.catScale;
  const size=Math.min(span(0),span(2));
  return Math.max(isKitchenChairDecorationId(object.modelId) ? .35 : .65,Math.min(1,(Math.sqrt(Math.max(0,size*size-.59*.59))-.16)/.86));
}

/** Adduct the legs on a narrow support without shrinking the cat or its pads. */
function catSupportWidth(object: NativeRoomObject, world: NativeRoomWorld): number {
  const surfaces=catSupportSurfaces(object);
  if (!surfaces.length) return 1;
  const size=Math.min(...[0,2].map(axis=>(Math.max(...surfaces.map(s=>s.max[axis]))-Math.min(...surfaces.map(s=>s.min[axis])))*object.scale/world.catScale));
  if (isKitchenChairDecorationId(object.modelId)) return Math.max(.45,Math.min(1,(size-.16)/.95));
  return Math.max(.45,Math.min(1,(size-.18)/.43));
}

/** Test each round paw pad against the support union. A square around a paw
 * reserves empty diagonal corners and can wrongly reject a rotated seat. */
function catTransferPawsFit(at: Vec3, heading: number, object: NativeRoomObject, world: NativeRoomWorld): boolean {
  const surfaces=catSupportSurfaces(object), pad=.08*world.catScale, stance=catSupportStance(object,world),width=catSupportWidth(object,world);
  return [-.215,.215].every(x=>[-.43,.40].every(z=>Array.from({length:16},(_,i)=>i*Math.PI/8).every(angle=>{
    const px=Math.cos(angle)*pad,pz=Math.sin(angle)*pad;
    const p=rotate([x*world.catScale*width+px,0,z*world.catScale*stance+pz],heading);
    const dx=(at[0]+p[0]-object.position[0])/object.scale,dz=(at[2]+p[2]-object.position[2])/object.scale;
    const local=rotate([dx,0,dz],-object.heading);
    return surfaces.some(top=>Math.abs(top.max[1]*object.scale+object.position[1]-at[1])<.035*world.catScale
      && top.footprint.every((a,i,poly)=>{const b=poly[(i+1)%poly.length];
        return (b[0]-a[0])*(local[2]-a[1])-(b[1]-a[1])*(local[0]-a[0])>=-1e-6;}));
  })));
}

function furnitureTransferArc(start: Vec3, seat: Vec3, source: NativeRoomObject, target: NativeRoomObject, world: NativeRoomWorld, landingHeading?: number, launchHeading?: number): number | undefined {
  if (!catTransferSupport(source) || !catTransferSupport(target)) return undefined;
  const distance=Math.hypot(seat[0]-start[0],seat[2]-start[2]);
  if (distance<.4*world.catScale || distance>4*world.catScale || Math.abs(seat[1]-start[1])>1.65*world.catScale) return undefined;
  const heading=Math.atan2(seat[0]-start[0],seat[2]-start[2]);
  if (landingHeading!==undefined && Math.abs(Math.atan2(Math.sin(landingHeading-heading),Math.cos(landingHeading-heading)))>Math.PI/6+1e-6) return undefined;
  if (!catTransferPawsFit(start,heading,source,world) || !catTransferPawsFit(seat,landingHeading ?? heading,target,world)) return undefined;
  // A narrow shelf may support the final heading but leave no room to turn
  // there. Validate the planted turn too, before offering a direct transfer.
  if (launchHeading!==undefined) {
    const turn=Math.atan2(Math.sin(heading-launchHeading),Math.cos(heading-launchHeading));
    const samples=Math.max(1,Math.ceil(Math.abs(turn)/(Math.PI/12)));
    for(let i=0;i<=samples;i++) if(!catTransferPawsFit(start,launchHeading+turn*i/samples,source,world)) return undefined;
  }
  return nativeJumpArc(start,seat,world,target.instanceId,source.instanceId,landingHeading);
}

/** A supported task can take the next clear seat directly, without visiting
 * the floor. Keep a validated floor exit for the destination's later return. */
export function findFurnitureTransfer(start: Vec3, sourceId: string, targetId: string, world: NativeRoomWorld, launchHeading?: number) {
  const source=world.objects.find(o=>o.instanceId===sourceId),target=world.objects.find(o=>o.instanceId===targetId);
  if (!source || !target || sourceId===targetId || !catTransferSupport(source) || !catTransferSupport(target)) return undefined;
  // Prefer any straight landing before trying a small, planned adjustment.
  for (const adjustment of [0,-Math.PI/6,Math.PI/6]) {
    let arcHeight: number | undefined,heading: number | undefined;
    const perch=findFurniturePerch(start,target,world,seat=>{
      heading=Math.atan2(seat[0]-start[0],seat[2]-start[2])+adjustment;
      arcHeight=furnitureTransferArc(start,seat,source,target,world,heading,launchHeading);
      return arcHeight!==undefined;
    });
    if (perch && arcHeight!==undefined) return {...perch,arcHeight,heading:heading!};
  }
  return undefined;
}

export function findWindowWatchPerch(start: Vec3, window: NativeRoomObject, world: NativeRoomWorld): {
  object: NativeRoomObject; seat: Vec3; approach: Vec3; heading: number;
} | undefined {
  world = kitchenNavigationWorld(world);
  const choices = world.objects.filter(object => isKitchenPerchDecorationId(object.modelId))
    .flatMap(object => kitchenPerchPoints(object, world).map(seat => ({ object, seat,
      distance: Math.hypot(seat[0] - window.position[0], seat[2] - window.position[2]) })))
    .filter(choice => choice.distance < 3 && choice.seat[1] + 1.2 * world.catScale > window.min[1])
    .sort((a,b) => a.distance - b.distance);
  for (const { object, seat } of choices) {
    const approach = findSeatApproach(start, { ...object, seat, approach: object.approach ?? [seat[0], FLOOR_Y, object.max[2] + world.radius + .05] }, world);
    if (approach) return { object, seat, approach, heading: Math.atan2(window.position[0] - seat[0], window.position[2] - seat[2]) };
  }
  return undefined;
}

/** Stand in front of the selected object, without drifting to a remote free tile. */
function findKitchenFloorApproach(start: Vec3, object: NativeRoomObject, world: NativeRoomWorld, fridge = false): Vec3 | undefined {
  const door = fridgeDoorGeometry(object);
  const reach = door.width * object.scale + world.radius + .12 + .06 * object.scale;
  // Keep the usual front approaches, then try beyond the open door's tip.
  // An island can occupy every front point while leaving a route around its
  // far end to the hinge side. All candidates still clear the full door swing.
  const points: Vec3[] = fridge ? [45, 60, 75, 25, 85, 0, 90, 95, 100, 105, 110, 115].map(degrees => {
    const angle = degrees * Math.PI / 180;
    return [door.hingeX * object.scale + door.latch * Math.cos(angle) * reach, 0, door.front * object.scale + Math.sin(angle) * reach];
  }) : [0, -.25, .25, -.5, .5].map(x => [x * object.scale, 0, world.radius + .15]);
  const candidates: Vec3[] = [];
  for (const local of points) {
    const point = rotate(local, object.heading).map((v,i) => v + object.position[i]) as Vec3;
    point[1] = FLOOR_Y;
    if (!isFree(point, world)) continue;
    candidates.push(point);
    const path = findRoomPath(start, point, world);
    if (hasNativeArrived(path.at(-1)!, point)) return point;
  }
  // A free destination may only connect through a low furniture passage.
  // Use the same crawl/step connections as the journey that will execute it.
  if (candidates.length) {
    const links = buildCatTraversalLinks(world, point => isFree(point, world));
    if (links.length) for (const point of candidates) {
      const route = searchRoomRoute(start, point, world, links);
      if (hasNativeArrived(route.path.at(-1)!, point)) return point;
    }
  }
  return undefined;
}

export function findInvestigateApproach(start: Vec3, object: NativeRoomObject, world: NativeRoomWorld): Vec3 | undefined {
  const cx = (object.min[0] + object.max[0]) / 2, cz = (object.min[2] + object.max[2]) / 2;
  const hx = (object.max[0] - object.min[0]) / 2 + world.radius + .08;
  const hz = (object.max[2] - object.min[2]) / 2 + world.radius + .08;
  const points: Vec3[] = [];
  for (let i = 0; i < 24; i++) {
    const angle = object.heading + i * Math.PI / 12, x = Math.sin(angle), z = Math.cos(angle);
    const distance = Math.min(Math.abs(x) < 1e-6 ? Infinity : hx / Math.abs(x), Math.abs(z) < 1e-6 ? Infinity : hz / Math.abs(z));
    points.push([cx + x * distance, FLOOR_Y, cz + z * distance]);
  }
  points.sort((a,b) => pathLength([start,a]) - pathLength([start,b]));
  return points.find(point => isFree(point,world) && hasNativeArrived(findRoomPath(start,point,world).at(-1)!,point))
    ?? findTraversalApproach(start,points.filter(point=>isFree(point,world)),world)?.at(-1);
}

/** Animation completion is not proof that navigation reached its endpoint. */
export function hasNativeArrived(position: Vec3, target: Vec3): boolean {
  'worklet';
  return Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2]) <= .06;
}
export function findBathroomApproach(start: Vec3, object: NativeRoomObject, world: NativeRoomWorld): Vec3 | undefined {
  if (!object.bathroom) return undefined;
  const contact = object.bathroom.contact;
  if (!isFree(contact, world, object.instanceId)) return undefined;
  const span = object.bathroom.kind === 'bath' ? Math.PI : object.bathroom.kind === 'shower' ? Math.PI / 2 : Math.PI / 4;
  for (let i = 0; i < 33; i++) {
    const turn = i % 2 ? (i + 1) / 2 : -i / 2;
    const angle = object.heading + turn / 16 * span;
    const x = Math.sin(angle), z = Math.cos(angle);
    // Clear the fixture's face even when approaching it at an angle.
    // Adding clearance along the ray leaves diagonal entries too close.
    const clearance = world.radius + .04;
    const edge = Math.min(Math.abs(x) < 1e-6 ? Infinity : ((x > 0 ? object.max[0] + clearance : object.min[0] - clearance) - contact[0]) / x,
      Math.abs(z) < 1e-6 ? Infinity : ((z > 0 ? object.max[2] + clearance : object.min[2] - clearance) - contact[2]) / z);
    const point: Vec3 = [contact[0] + x * edge, FLOOR_Y, contact[2] + z * edge];
    if (!isFree(point, world)) continue;
    if (!isNativeJumpClear(point, contact, world, object.instanceId)
      || !isNativeJumpClear(contact, point, world, object.instanceId)) continue;
    const path = findRoomPath(start, point, world);
    if (pathLength([path.at(-1)!, point]) < .05) return point;
  }
  return undefined;
}

export function prepareNativeStep(plan: RoomActivityPlan, step: RoomActivityStep, fromScreen: RoomPoint, world: NativeRoomWorld, fromY: number, objectScreen?: RoomPoint): RoomActivityStep & {
  native: NativeTravel;
} {
  const sourceObject = world.objects.find(o => o.instanceId === (step.targetInstanceId ?? plan.targetInstanceId));
  // A chained command begins with the previous support's wake/exit steps.
  // Those still belong to the chair, even when the next destination is a fridge.
  const fridgeInvestigation = plan.kind === 'fridgeInvestigate'
    && (step.targetInstanceId ?? plan.targetInstanceId) === plan.targetInstanceId;
  if (step.kitchenNavigation || plan.kind === 'cupboardHide' || plan.kind === 'drawerHide' && sourceObject && isKitchenPerchDecorationId(sourceObject.modelId) || ['chairNap', 'islandSit', 'windowWatch', 'fridgeInvestigate'].includes(plan.kind)
    || plan.kind === 'returnHome' && sourceObject && (isKitchenChairDecorationId(sourceObject.modelId) || isKitchenPerchDecorationId(sourceObject.modelId) || sourceObject.cupboard))
    world = kitchenNavigationWorld(world);
  if (sourceObject && (fridgeInvestigation || plan.kind === 'returnHome' && sourceObject.fridgeOpen))
    world = { ...world, fridgeDoorClearance: sourceObject.instanceId };
  const jump = step.animation === 'jumpOn' || step.animation === 'jumpOff';
  const onSeat = !!step.sofaApproach && (step.animation !== 'jumpOff' || !!step.jumpFromInstanceId);
  const start = step.enteringRoom && !step.entryFromCurrent ? nativeRoomEdge(world, step.travelDirection === -1 ? 1 : -1) : catFloorPoint(fromScreen, world, fromY);
  const walking = step.animation?.startsWith('walk');
  const previousSeatPosition = plan.steps.find(s => s.seatPosition && (s.targetInstanceId ?? plan.targetInstanceId) === sourceObject?.instanceId)?.seatPosition;
  const kitchenPerch = sourceObject && isKitchenIslandDecorationId(sourceObject.modelId) && plan.kind === 'islandSit';
  const kitchenChair = sourceObject && isKitchenChairDecorationId(sourceObject.modelId);
  const furniturePerch = sourceObject && isFurniturePerch(sourceObject.modelId);
  const kitchenArrival = !step.seatPosition && !previousSeatPosition && sourceObject
    ? furniturePerch ? findFurniturePerch(start,sourceObject,world) : kitchenPerch ? findKitchenIslandPerch(start,sourceObject,world)
      : kitchenChair ? findKitchenChairPerch(start,sourceObject,world) : undefined : undefined;
  // Returning from a cupboard TOP is different from leaving its interior.
  const cupboardSeat = plan.kind === 'cupboardHide' || plan.kind === 'returnHome' && previousSeatPosition && sourceObject?.cupboard
    && Math.abs(previousSeatPosition[1]-sourceObject.cupboard[1])<.1*world.catScale;
  const drawerSeat = plan.kind === 'drawerHide' || plan.kind === 'returnHome' && previousSeatPosition && sourceObject?.drawer
    && Math.abs(previousSeatPosition[1]-sourceObject.drawer[1])<.1*world.catScale;
  const seatPosition = cupboardSeat ? sourceObject?.cupboard ?? previousSeatPosition : drawerSeat ? sourceObject?.drawer ?? previousSeatPosition : sourceObject?.bed ? (step.bedPhase === 'crawl' || step.bedPhase === 'covered'
    ? sourceObject.bed.covered : step.bedPhase === 'uncover' || step.animation === 'wakeStretch' ? sourceObject.bed.surface
      : step.seatPosition ?? previousSeatPosition ?? sourceObject.bed.surface) : step.seatPosition ?? previousSeatPosition ?? kitchenArrival?.seat;
  const object = sourceObject && seatPosition ? { ...sourceObject, seat: seatPosition, seatHeading: step.seatHeading ?? (cupboardSeat ? sourceObject.heading : sourceObject.seatHeading),
    approach: sourceObject.approach ?? [seatPosition[0], FLOOR_Y, sourceObject.max[2] + world.radius + .05] as Vec3 } : sourceObject;
  const tree = object && /^catTree|^toy-scratchPost/.test(object.modelId);
  const plant = object && plan.kind === 'plantPlay' && isPlayablePlant(object.modelId);
  const previousSeatApproach = plan.steps.find(s => s.seatApproach && (s.targetInstanceId ?? plan.targetInstanceId) === object?.instanceId)?.seatApproach;
  const seating = object?.seat && !tree && (step.approachingSeat || step.sofaApproach);
  const seatApproach = seating ? walking && !step.bedPhase ? kitchenArrival?.approach ?? findSeatApproach(start, object, world)
    : step.seatApproach ?? previousSeatApproach ?? findSeatApproach(start, object, world) : undefined;
  let bowlPath: Vec3[] | undefined;
  const previousBathroomApproach = plan.steps.find(s => s.bathroomApproach && (s.targetInstanceId ?? plan.targetInstanceId) === object?.instanceId)?.bathroomApproach;
  const bathroomApproach = object?.bathroom && step.bathroomPhase ? step.bathroomPhase === 'approach'
    ? findBathroomApproach(start, object, world) : step.bathroomApproach ?? previousBathroomApproach : undefined;
  const previousApproach = plan.steps.find(s => s.treeApproach && (s.targetInstanceId ?? plan.targetInstanceId) === object?.instanceId)?.treeApproach;
  const treeApproach = tree ? walking && !step.returnHome ? findHangingToyApproach(start, object, world)
    : step.treeApproach ?? previousApproach ?? object.approach : undefined;
  const plantApproach = plant && walking && !step.returnHome ? findPlantApproach(start, object, world) : undefined;
  let looseToyApproach: Vec3 | undefined;
  let target = plantApproach ?? catFloorPoint(step.position, world);
  const kitchenFloor = !step.returnHome && walking && (plan.kind === 'fridgeInvestigate' || plan.kind === 'windowWatch' && !step.approachingSeat)
    ? object && findKitchenFloorApproach(start, object, world, plan.kind === 'fridgeInvestigate') : undefined;
  const investigateApproach = !step.returnHome && walking && plan.kind === 'investigate' && object
    ? findInvestigateApproach(start, object, world) : undefined;
  if (investigateApproach) target = investigateApproach;
  if (kitchenFloor) target = kitchenFloor;
  if (step.returnHome) target = nearestFree(world.home, world);
  if (step.leavingRoom) target = nativeRoomEdge(world, step.travelDirection ?? 1);
  if (object?.bathroom && step.bathroomPhase) {
    target = ['enter', 'wash', 'use'].includes(step.bathroomPhase) ? object.bathroom.contact : bathroomApproach ?? start;
  }
  else if (object?.seat && object.approach) {
    if (onSeat)
      target = object.seat;
    else if (jump || walking && !step.returnHome && (step.approachingSeat || tree && plan.kind === 'toyPlay'))
      target = treeApproach ?? seatApproach ?? object.approach;
  }
  else if (plan.kind === 'doorTravel' && object) {
    target = [object.position[0], FLOOR_Y, object.position[2]];
    target[object.heading > 0 ? 0 : 2] += world.radius + .2;
  }
  else if (plan.kind === 'bowlEat' && object && step.bowlApproach) {
    bowlPath = findFoodBowlApproach(start, object, world);
    target = bowlPath?.at(-1) ?? start;
  }
  else if ((plan.kind === 'toyPlay' || plan.kind === 'mouseChase') && object && step.animation?.startsWith('walk')) {
    const meta = NATIVE_MODEL_CATALOG[object.modelId];
    const centerY = FLOOR_Y + (meta.max[1] + meta.min[1]) / 2 * object.scale;
    const screen = plan.kind === 'mouseChase' ? step.objectPosition : undefined;
    const p = screen ? unprojectFloor(screen, centerY, world.width) : object.position;
    const center=object.min.map((v,i)=>(v+object.max[i])/2) as Vec3;
    const radius=Math.max(object.max[0]-object.min[0],object.max[2]-object.min[2])/2;
    if(plan.kind==='toyPlay' && object.movable)looseToyApproach=findPawApproach(start,[center],radius,world);
    target = plan.kind==='toyPlay' && object.movable
      ? looseToyApproach ?? start
      : [p[0] - world.catScale * .20, FLOOR_Y, p[2] + world.radius + .15];
  }
  // A resting/play clip stays where navigation actually arrived. Reusing the
  // old sprite target here would undo the detour and snap into the furniture.
  const crawl = step.crawl && findCatCrawlPass(world,step.crawl.choice);
  const crawlValid=!!crawl && crawl.leg.supportId===step.crawl?.instanceId
    && pathLength([start,crawl.from])<.06*world.catScale;
  const brush = step.brush && findCatBrushPass(world, step.brush.choice);
  const brushValid = !!brush && brush.instanceId === step.brush?.instanceId
    && pathLength([start,brush.from]) < .06*world.catScale;
  const bedCrawl = !!object?.bed && (step.bedPhase === 'crawl' || step.bedPhase === 'uncover');
  let route = walking && !bedCrawl && !step.brush && !step.crawl ? findCatRoomRoute(start, target, world) : undefined;
  if(crawlValid&&crawl)route={path:[start,crawl.to],legs:[{...crawl.leg,path:[start,crawl.to]}]};
  let path = step.crawl ? crawlValid && crawl ? [start,crawl.to] : [start] : step.brush ? brushValid && brush ? [start,brush.to] : [start] : jump || bedCrawl ? [start, target] : walking ? route!.path : [start];
  if (walking && !step.brush && !route?.legs) path = roundCatPath(path, .6 * world.catScale, (a,b) => clearLine(a,b,world));
  // Finish the approach facing the jump. Reversing a validated departure
  // curve gives an arrival tangent, with the same whole-route clearance.
  if(walking && step.approachingSeat && object?.seat && !object.bed && !route?.legs && !step.brush) {
    const reverse: Vec3[] = [];
    for(let i=path.length-1;i>=0;i--)reverse.push(path[i]);
    const heading=Math.atan2(target[0]-object.seat[0],target[2]-object.seat[2]);
    const arrival=steerCatPath(reverse,target,heading,world.catScale,(a,b)=>clearLine(a,b,world));
    if(arrival)path=arrival.reverse();
  }
  let blocked = !!step.crawl && !crawlValid || !!step.brush && !brushValid || !!walking && path.length === 1 && Math.hypot(start[0] - target[0], start[2] - target[2]) > .05;
  if (plan.kind === 'bowlEat' && step.bowlApproach && !bowlPath) { blocked = true; path = [start]; }
  if (plan.kind === 'bowlEat' && step.animation === 'eating' && object
    && Math.abs(Math.hypot(start[0] - object.position[0], start[2] - object.position[2]) - CAT_EATING_REACH * world.catScale) > .08) blocked = true;
  if (step.bathroomPhase && (!object?.bathroom || !bathroomApproach)) { blocked = true; path = [start]; }
  if (plan.kind === 'investigate' && !step.returnHome && (!object || walking && !investigateApproach)
    || plan.kind === 'cupboardHide' && (!object?.cupboard || !object.cupboardFits || !object.opened)
    || plan.kind === 'drawerHide' && (!object?.drawer || !object.opened)) { blocked = true; path = [start]; }
  if (seating && !seatApproach) { blocked = true; path = [start]; }
  if ((kitchenPerch || (furniturePerch || kitchenChair) && seating) && !seatPosition || !step.returnHome && walking && (plan.kind === 'fridgeInvestigate' || plan.kind === 'windowWatch' && !step.approachingSeat) && !kitchenFloor
    || fridgeInvestigation && !step.returnHome && !object?.fridgeOpen) { blocked = true; path = [start]; }
  if (onSeat && !jump && !bedCrawl && object?.seat && !hasNativeArrived(start, object.seat)) blocked = true;
  if (object?.bathroom && ['wash', 'use'].includes(step.bathroomPhase ?? '')
    && !hasNativeArrived(start, object.bathroom.contact)) blocked = true;
  if ((tree && !treeApproach || plant && !plantApproach) && walking && !step.returnHome) { blocked = true; path = [start]; }
  if(plan.kind==='toyPlay' && object?.movable && walking && !step.returnHome && !looseToyApproach){blocked=true;path=[start];}
  if (!object && !step.returnHome && (step.approachingSeat || step.sofaApproach || step.bowlApproach || plan.kind === 'doorTravel' || plan.kind === 'toyPlay' || plan.kind === 'mouseChase' || plan.kind === 'bowlEat' || plan.kind === 'plantPlay')) {
    blocked = true;
    path = [start];
  }
  if (walking && (object?.seat || step.bathroomPhase || plan.kind === 'bowlEat' || step.leavingRoom) && Math.hypot(path.at(-1)![0] - target[0], path.at(-1)![2] - target[2]) > .12)
    blocked = true;
  const fromSupport=world.objects.find(o=>o.instanceId===step.jumpFromInstanceId);
  const arcHeight = jump ? step.jumpFromInstanceId
    ? fromSupport && object ? furnitureTransferArc(start,target,fromSupport,object,world,step.seatHeading,step.jumpLaunchHeading) : undefined
    : nativeJumpArc(start,target,world,object?.instanceId) : undefined;
  if (jump && arcHeight===undefined) { blocked = true; path = [start]; }
  if (walking && !bedCrawl && !blocked) path = catPacedPath(path,world.catScale);
  const paceIntent = step.returnHome ? 'returnHome' : plan.kind;
  const gait = step.brush ? 'walk' : step.gait ?? catJourneyGait(paceIntent, pathLength(path), world.catScale);
  const roomyWorld = { ...world, radius: world.radius + .16 * world.catScale };
  const roomy = (point: Vec3) => !step.brush && isFree(point, roomyWorld);
  const walkingThrough=!!walking && !blocked && (!!step.leavingRoom || plan.kind==='doorTravel') && (!route?.legs?.length || route.legs.at(-1)?.kind==='walk');
  const walkTiming = walking && !bedCrawl ? catWalkTiming(path,world.catScale,gait,roomy,walkingThrough) : undefined;
  if (step.brush && walkTiming) {
    walkTiming.paces=walkTiming.paces.map(pace=>pace*1.8);
    walkTiming.duration=(walkTiming.duration-walkTiming.ramp)*1.8+walkTiming.ramp;
  }
  if (route?.legs && walking && !blocked) route = { ...route, legs: route.legs.map((leg,index,legs) => {
    if (leg.kind !== 'walk' || leg.animation) return leg;
    const path = catPacedPath(leg.path,world.catScale);
    return { ...leg, path, ...catWalkTiming(path,world.catScale,step.gait??catJourneyGait(paceIntent,pathLength(path),world.catScale),roomy,walkingThrough&&index===legs.length-1) };
  }) };
  if (route?.legs && !blocked) route = { ...route, legs: route.legs.map((leg,index,legs) => {
    const next = legs[index+1];
    if (leg.kind !== 'hop' || next?.kind !== 'walk' || next.animation) return leg;
    const turn = leg.turnDuration ?? 0;
    return { ...leg, landingWalk: true, duration: turn+(leg.duration-turn)*CAT_LANDING_WALK_PHASE };
  }) };
  const distance = pathLength(path), duration = route?.legs && !blocked ? route.legs.reduce((sum, leg) => sum + leg.duration, 0)
    : jump && arcHeight!==undefined && !blocked ? catJumpDuration(start,target,arcHeight,world.catScale)
    : bedCrawl ? (step.moveMs ?? 1600) / 1000 : walking ? walkTiming!.duration : (step.moveMs ?? step.durationMs) / 1000;
  const position = catScreenPoint(path.at(-1)!, world);
  let objectPath: Vec3[] | undefined;
  if (object && plan.kind === 'mouseChase' && step.objectPosition) {
    const meta = NATIVE_MODEL_CATALOG[object.modelId];
    const centerY = FLOOR_Y + (meta.max[1] + meta.min[1]) / 2 * object.scale;
    const at = (screen: RoomPoint): Vec3 => { const p = unprojectFloor(screen, centerY, world.width); return [p[0], FLOOR_Y, p[2]]; };
    const startObject = objectScreen ? at(objectScreen) : [object.position[0], FLOOR_Y, object.position[2]] as Vec3;
    objectPath = findRoomPath(startObject, at(step.objectPosition), { ...world, radius: (object.max[0] - object.min[0]) / 2 });
  }
  const aim = plan.kind === 'windowWatch' ? world.objects.find(o => o.instanceId === plan.targetInstanceId)?.position
    : plant ? [...(object.leaves ?? [])].sort((a,b) => Math.hypot(...a.map((v,i)=>v-start[i])) - Math.hypot(...b.map((v,i)=>v-start[i])))[0]
    : tree && plan.kind === 'toyPlay' ? hangingToyPosition(object) : object?.position;
  const targetHeading = aim && !onSeat && !walking && !step.returnHome && (plan.kind === 'toyPlay' || plan.kind === 'plantPlay' || plan.kind === 'bowlEat' || plan.kind === 'windowWatch' || plan.kind === 'fridgeInvestigate' || plan.kind === 'investigate') ? Math.atan2(aim[0] - start[0], aim[2] - start[2]) : undefined;
  const rockingSupport=fromSupport?.modelId==='chairRockingOak' ? fromSupport : object;
  const departureSupport=fromSupport ?? (jump && !onSeat ? object : undefined);
  const stance=onSeat && object && catTransferSupport(object) ? catSupportStance(object,world) : 1;
  const launchStance=departureSupport && catTransferSupport(departureSupport) ? catSupportStance(departureSupport,world) : 1;
  const stanceWidth=onSeat && object && catTransferSupport(object) ? catSupportWidth(object,world) : 1;
  const launchStanceWidth=departureSupport && catTransferSupport(departureSupport) ? catSupportWidth(departureSupport,world) : 1;
  const rockingChair: RockingChair | undefined = rockingSupport?.modelId === 'chairRockingOak' && step.sofaApproach && !blocked
    ? { instanceId: rockingSupport.instanceId, pivot: [...rockingSupport.position],
      axis: [Math.cos(rockingSupport.heading), 0, -Math.sin(rockingSupport.heading)], seat: rockingSupport.seat!, scale: rockingSupport.scale,
      leaving: rockingSupport===fromSupport || step.animation === 'jumpOff' && !step.jumpFromInstanceId }
    : undefined;
  const preparationArc=walking && step.approachingSeat && object?.seat && !object.bed && !blocked && !route?.legs
    ? nativeJumpArc(target,object.seat,world,object.instanceId) : undefined;
  const prepareJump=preparationArc!==undefined && object?.seat
    ? {target:object.seat,light:catJumpEffort(target,object.seat,world.catScale,preparationArc)<.8} : undefined;
  return { ...step, kitchenNavigation: world.kitchenNavigation, seatPosition, seatApproach, treeApproach, plantApproach, bathroomApproach, position, durationMs: walking || jump ? duration * 1000 : step.durationMs, moveMs: walking || jump ? duration * 1000 : step.moveMs,
    native: { sleepPose: step.sleepPose, prepareJump, brushSide: !blocked ? brush?.side : undefined, through: walkingThrough, entryMotion: step.entryMotion, path, distance, duration, arcHeight, stance, launchStance, stanceWidth, launchStanceWidth, landingHeading:step.jumpFromInstanceId ? step.seatHeading : undefined, paces: walkTiming?.paces, gait: walkTiming?.gait, ramp: walkTiming?.ramp, legs: !blocked ? route?.legs : undefined, rockingChair, bed: object?.bed && step.bedPhase && !blocked
      ? { instanceId: object.instanceId, phase: step.bedPhase } : undefined, bathroom: object?.bathroom && step.bathroomPhase && !blocked
      ? { instanceId: object.instanceId, kind: object.bathroom.kind, phase: step.bathroomPhase } : undefined,
      jump: jump && !blocked, blocked, hideEatingProps: plan.kind === "bowlEat", treePlay: plan.kind === 'toyPlay' && !!object?.seat, plantPlay: !!plant, playTargetId: plan.kind==='toyPlay'?object?.instanceId:undefined, pawTargetRadius: tree && object ? .1*object.scale : 0, targetPosition: object?.position, objectPath, objectDuration: duration * .6,
      heading: object?.bed && (step.bedPhase === 'crawl' || step.bedPhase === 'covered') ? object.heading + Math.PI
        : object?.bathroom && step.bathroomPhase ? object.heading : object?.seat && onSeat ? object.seatHeading : targetHeading } };
}
