import { CURTAIN_FABRIC_BOUNDS, isCurtainDecorationId } from "@/constants/decoration-motion";
import { isSeatingSofaDecorationId } from "@/constants/sofa-decorations";
import { normalizeRotationDegrees } from "@/utils/room-rotation";
import type { BathroomFixtureKind, BathroomPhase } from '@/constants/bathroom-activities';
import { isPlayablePlant } from "@/constants/plant-play";
import { isFoodBowlDecorationId } from "@/constants/cat-supplies-decorations";
import { isWindowDecorationId } from "@/constants/window-decorations";
import type { RockingChair } from '@/utils/native-rocking-chair';
import catalog from '@/assets/3d/native/catalog.json';
import placementBounds from '@/constants/room-placement-bounds.json';
import windowMounts from '@/constants/window-mount-bounds.json';
import { getPlacedDecorationDragSize, getPlacedDecorationSpriteId, getPlacedDecorationWallFlipped } from '@/constants/decoration-variants';
import { getBedDisplaySize, getEquippedBedScale } from '@/constants/cat-beds';
import { getPlacedToyDisplaySize, getPlacedToyRotationIndex } from '@/constants/cat-toys';
import { isRoomDoor } from '@/constants/home-rooms';
import { isWallSpotlightDecorationId, normalizeSpotlightAngle } from '@/constants/decoration-motion';
import { isRoomBackgroundDecoration } from '@/utils/room-depth';
import { hangingToyPosition } from '@/utils/native-hanging-toy';
import { roomOffsetToPoint, type RoomPoint, type RoomActivityPlan, type RoomActivityStep } from '@/utils/room-activities';
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
  collisionBoxes?: { min: number[]; max: number[] }[];
  placementHull?: number[][];
  leaves?: { node: string; contact: string; point: number[] }[];
  bathroom?: { kind: BathroomFixtureKind; contact: number[]; sprayHeight?: number };
};
export type CollisionBox = { min: Vec3; max: Vec3 };
export const NATIVE_MODEL_CATALOG: Record<string, ModelMetadata> = Object.fromEntries(
  Object.entries(catalog as Record<string, ModelMetadata>).map(([id, metadata]) => [id, { ...metadata, ...(placementBounds as Record<string, Pick<ModelMetadata, "placementHull" | "collisionBoxes">>)[id] }]),
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
  curtainOpen?: boolean;
  spotlightAngle?: number;
  /** Fixed coordinate of a wall-mounted item's mounting plane. */
  wallAxis?: 0 | 2;
  /** Corrected wall anchor when a saved window placement lies outside the walls. */
  placementOffset?: RoomItemOffset;
  seat?: Vec3;
  seatHeading?: number;
  approach?: Vec3;
  collisionBoxes?: CollisionBox[];
  leaves?: Vec3[];
  bathroom?: { kind: BathroomFixtureKind; contact: Vec3 };
};
export type NativeRoomWorld = {
  width: number;
  height: number;
  catScale: number;
  radius: number;
  home: Vec3;
  objects: NativeRoomObject[];
};
export type NativeTravel = {
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
  rockingChair?: RockingChair;
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
    seat: object.seat && move(object.seat), approach: object.approach && move(object.approach),
    leaves: object.leaves?.map(move),
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

export function isTabletopLamp(modelId: string): boolean {
  return /^(lavaLamp|lampTable)/.test(modelId);
}

/** The saved screen anchor also identifies a lamp's elevated tabletop pose. */
export function placeLampOnTable(object: NativeRoomObject, objects: NativeRoomObject[], width: number): NativeRoomObject {
  if (!isTabletopLamp(object.modelId)) return object;
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  const centerOffset = rotate(meta.center, object.heading);
  const center = centerOffset.map((v, i) => v * object.scale + object.position[i]) as Vec3;
  const point = projectWorld(center, width);
  const base = meta.collisionBoxes?.filter(box => box.min[1] <= meta.min[1] + .02)
    .sort((a, b) => a.max[1] - b.max[1])[0] ?? meta;
  for (const table of objects) {
    if (!/^(table(Tan|Pink|Blue|Purple)|japaneseTable|living(Small)?Table|office(Drawing|Kitchen)Table)$/.test(table.modelId)) continue;
    const tableMeta = NATIVE_MODEL_CATALOG[table.modelId];
    const top = tableMeta.collisionBoxes?.filter(box => box.max[1] - box.min[1] < .2
      && box.max[0] - box.min[0] > .5 && box.max[2] - box.min[2] > .5)
      .sort((a, b) => b.max[1] - a.max[1])[0];
    if (!top) continue;
    const height = table.position[1] + top.max[1] * table.scale + .002;
    const desired = unprojectFloor(point, height + (meta.center[1] - meta.min[1]) * object.scale, width);
    const position = desired.map((v, i) => v - centerOffset[i] * object.scale) as Vec3;
    const fits = [base.min[0], base.max[0]].every(x => [base.min[2], base.max[2]].every(z => {
      const corner = rotate([x, 0, z], object.heading).map((v, i) => v * object.scale + position[i] - table.position[i]);
      const local = rotate(corner, -table.heading);
      return local[0] >= top.min[0] * table.scale && local[0] <= top.max[0] * table.scale
        && local[2] >= top.min[2] * table.scale && local[2] <= top.max[2] * table.scale;
    }));
    if (!fits) continue;
    const delta = position.map((v, i) => v - object.position[i]);
    const move = (value: Vec3) => value.map((v, i) => v + delta[i]) as Vec3;
    return { ...object, position, min: move(object.min), max: move(object.max),
      collisionBoxes: object.collisionBoxes?.map(box => ({ min: move(box.min), max: move(box.max) })) };
  }
  return object;
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
  const add = (instanceId: string, modelId: string, size: number, offset: RoomItemOffset, flip = false, poweredOn?: boolean, rotationIndex = 0, rotationDegrees?: number, curtainOpen?: boolean, spotlightAngle?: number) => {
    const meta = NATIVE_MODEL_CATALOG[modelId];
    if (!meta)
      return;
    const wall = isRoomDoor(modelId) || (isRoomBackgroundDecoration(modelId) && !/carpet|rug/i.test(modelId)) || /longshelf|smallshelf|shelving|japaneseshelf/i.test(modelId);
    const scale = size / Math.max(1, width) * ROOM_SPAN / meta.renderScale;
    const screen = options.livePositions?.[instanceId] ?? roomOffsetToPoint(offset, width, height, size);
    const modelHeading = wall && !isWallSpotlightDecorationId(modelId) && meta.max[0] - meta.min[0] < meta.max[2] - meta.min[2] ? Math.PI / 2 : 0;
    const heading = (flip ? Math.PI / 2 : 0) - modelHeading + rotationIndex * Math.PI / 2 + (normalizeRotationDegrees(rotationDegrees) ?? 0) * Math.PI / 180;
    const center = rotate(meta.center, heading);
    const horizontalCorners = [meta.min[0], meta.max[0]].flatMap(x =>
      [meta.min[2], meta.max[2]].map(z => rotate([x, meta.min[1], z], heading)));
    let desired = unprojectFloor(screen, FLOOR_Y + center[1] * scale, width);
    if (wall) {
      // Solve on the wall plane, so moving a fixture preserves its screen anchor.
      const difference = screen.x / (Math.max(1, width) / ROOM_SPAN) / diagonal;
      let plane = -2.35;
      if (isWindowDecorationId(modelId) || isCurtainDecorationId(modelId) || isWallSpotlightDecorationId(modelId) || normalizeRotationDegrees(rotationDegrees)) {
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
        plane = -2.35 + depth - (fabricBack - center[normal]) * scale;
      }
      const x = flip ? plane : plane + difference;
      const z = flip ? plane - difference : plane;
      const y = .9 + (elevation * (x + z) * diagonal - screen.y / (Math.max(1, width) / ROOM_SPAN)) / vertical;
      desired = [x, y, z];
    }
    let placementOffset: RoomItemOffset | undefined;
    if (isWindowDecorationId(modelId) || isWallSpotlightDecorationId(modelId)) {
      const before = [...desired];
      const along = flip ? 2 : 0;
      const limits = horizontalCorners.map(point => point.map((v, i) => (v - center[i]) * scale));
      const low = Math.min(...limits.map(point => point[along]));
      const high = Math.max(...limits.map(point => point[along]));
      const clamp = (value: number, min: number, max: number) => min <= max ? Math.max(min, Math.min(max, value)) : (min + max) / 2;
      desired[along] = clamp(desired[along], -2.30 - low, 2.30 - high);
      const bottom = (meta.min[1] - meta.center[1]) * scale;
      const top = (meta.max[1] - meta.center[1]) * scale;
      desired[1] = clamp(desired[1], .18 - bottom, 2.65 - top);
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
    const solid = !isFoodBowlDecorationId(modelId) && !wall && !/carpet|rug/i.test(modelId) && !movable && max[1] > FLOOR_Y + .10;
    const collidable = !isCurtainDecorationId(modelId) && !/carpet|rug/i.test(modelId) && max[1] > FLOOR_Y + .01;
    const object: NativeRoomObject = { instanceId, modelId, position, scale, heading, min, max, solid, collidable, movable, poweredOn, curtainOpen, spotlightAngle: isWallSpotlightDecorationId(modelId) ? normalizeSpotlightAngle(spotlightAngle) : undefined, placementOffset,
      wallAxis: wall ? flip ? 0 : 2 : undefined };
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
    add(item.instanceId, getPlacedDecorationSpriteId(item), getPlacedDecorationDragSize(item) * sizeScale, item.offset, getPlacedDecorationWallFlipped(item), item.poweredOn, 0, item.rotationDegrees, item.curtainOpen, item.spotlightAngle);
  for (const item of options.toys)
    add(item.instanceId, 'toy-' + item.toyId, getPlacedToyDisplaySize(item) * sizeScale, item.offset, false, undefined, getPlacedToyRotationIndex(item), item.rotationDegrees);
  world.objects = world.objects.map(object => placeLampOnTable(object, world.objects, width));
  // Land in navigable floor space so the following walk never relocates its start.
  for (const object of world.objects)
    if (object.approach) object.approach = nearestFree(object.approach, world);
  const home = catFloorPoint(options.livePositions?.cat ?? roomOffsetToPoint(options.homeOffset ?? { x: 0, y: .12 }, width, height, options.petSize), world);
  world.home = nearestFree(home, world);
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
    if (o.solid && o.instanceId !== ignoreId) {
      const boxes = (isPlayablePlant(o.modelId) || o.modelId === 'lampFloorArc') && o.collisionBoxes?.length ? o.collisionBoxes : [o];
      for (const box of boxes) {
        if (box.min[1] > FLOOR_Y + .8 * world.catScale) continue;
        const x = Math.max(box.min[0], Math.min(box.max[0], point[0]));
        const z = Math.max(box.min[2], Math.min(box.max[2], point[2]));
        // The low base can sit beneath the reaching paws; keep the torso outside it.
        const clearance = /^catTree|^toy-scratchPost/.test(o.modelId) ? Math.min(r, .4 * world.catScale)
          : isPlayablePlant(o.modelId) ? Math.min(r, .65 * world.catScale) : r;
        if (Math.hypot(point[0] - x, point[2] - z) < clearance + .015) return false;
      }
    }
  return true;
}
export function nearestFree(point: Vec3, world: NativeRoomWorld): Vec3 {
  if (isFree(point, world))
    return point;
  // Only the cat is repositioned if an old save put it inside furniture.
  let best: Vec3 = [0, FLOOR_Y, 0];
  let distance = Infinity;
  for (let x = -2.2; x <= 2.2; x += .1)
    for (let z = -2.2; z <= 2.2; z += .1) {
      const p: Vec3 = [x, FLOOR_Y, z];
      const d = Math.hypot(x - point[0], z - point[2]);
      if (d < distance && isFree(p, world)) {
        distance = d;
        best = p;
      }
    }
  if (distance < Infinity)
    return best;
  // An overfilled legacy room can still support the cat above its furniture.
  const top = world.objects.filter(o => o.solid && point[0] > o.min[0] - world.radius && point[0] < o.max[0] + world.radius && point[2] > o.min[2] - world.radius && point[2] < o.max[2] + world.radius).reduce((y, o) => Math.max(y, o.max[1]), FLOOR_Y);
  return [point[0], top + .01, point[2]];
}

/** The two open front edges match the left/right room controls. */
export function nativeRoomEdge(world: NativeRoomWorld, side: -1 | 1): Vec3 {
  const edge = 2.35 - world.radius;
  return nearestFree(side === 1 ? [edge, FLOOR_Y, 1] : [1, FLOOR_Y, edge], world);
}
function clearLine(a: Vec3, b: Vec3, world: NativeRoomWorld): boolean {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / .04);
  for (let i = 1; i <= n; i++)
    if (!isFree([a[0] + (b[0] - a[0]) * i / n, FLOOR_Y, a[2] + (b[2] - a[2]) * i / n], world))
      return false;
  return true;
}
/** Navigation runs when a command/layout changes, never on the render thread. */
export function findRoomPath(start: Vec3, target: Vec3, world: NativeRoomWorld): Vec3[] {
  const end = nearestFree(target, world);
  if (!isFree(start, world))
    start = nearestFree(start, world);
  if (clearLine(start, end, world))
    return [start, end];
  // Include the usable floor edges: a narrow passage next to a furnishing can
  // lie entirely between the regular grid's last column and the room boundary.
  const limit = 2.32 - Math.min(world.radius, .5 * world.catScale) - .001;
  const coordinates = [-limit, ...Array.from({ length: 45 }, (_, i) => -2.2 + i * .1)
    .filter(v => Math.abs(v) < limit), limit];
  const count = coordinates.length;
  const point = (i: number): Vec3 => [coordinates[i % count], FLOOR_Y, coordinates[Math.floor(i / count)]];
  const available = Array.from({ length: count * count }, (_, i) => i).filter(i => isFree(point(i), world));
  // Rounded endpoints can fall inside furniture even though the actual
  // endpoint is free. Connect each exact endpoint to a visible free grid node.
  const connection = (p: Vec3) => available.slice().sort((a, b) => pathLength([p, point(a)]) - pathLength([p, point(b)]))
    .find(i => clearLine(p, point(i), world));
  const first = connection(start), last = connection(end);
  if (first === undefined || last === undefined) return [start];
  const open = [first], parents = new Map<number, number>(), costs = new Map([[first, 0]]), closed = new Set<number>();
  while (open.length) {
    open.sort((a, b) => (costs.get(a)! + Math.hypot(point(a)[0] - end[0], point(a)[2] - end[2])) - (costs.get(b)! + Math.hypot(point(b)[0] - end[0], point(b)[2] - end[2])));
    const current = open.shift()!;
    if (current === last) {
      const route: Vec3[] = [end];
      let i = current;
      while (i !== first) {
        route.unshift(point(i));
        i = parents.get(i)!;
      }
      route.unshift(point(first));
      route.unshift(start);
      const smooth = [start];
      let from = 0;
      while (from < route.length - 1) {
        let to = route.length - 1;
        while (to > from + 1 && !clearLine(route[from], route[to], world))
          to--;
        smooth.push(route[to]);
        from = to;
      }
      return smooth;
    }
    closed.add(current);
    for (const dx of [-1, 0, 1])
      for (const dz of [-1, 0, 1]) {
        if (!dx && !dz)
          continue;
        const x = current % count + dx, z = Math.floor(current / count) + dz;
        if (x < 0 || x >= count || z < 0 || z >= count)
          continue;
        const next = x + z * count;
        if (closed.has(next) || !isFree(point(next), world) || !clearLine(point(current), point(next), world))
          continue;
        const cost = costs.get(current)! + pathLength([point(current), point(next)]);
        if (cost < (costs.get(next) ?? Infinity)) {
          parents.set(next, current);
          costs.set(next, cost);
          if (!open.includes(next))
            open.push(next);
        }
      }
  }
  // An unreachable target never causes a direct walk through an obstacle.
  return [start];
}
export function pathLength(path: Vec3[]): number {
  return path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - path[i][0], p[1] - path[i][1], p[2] - path[i][2]), 0);
}
/** Face the food from a reachable point, retaining the route already solved. */
export function findFoodBowlApproach(start: Vec3, bowl: NativeRoomObject, world: NativeRoomWorld): Vec3[] | undefined {
  const heading = Math.atan2(bowl.position[0] - start[0], bowl.position[2] - start[2]);
  for (let i = 0; i < 64; i++) {
    const turn = i % 2 ? (i + 1) / 2 : -i / 2;
    const angle = heading + turn * Math.PI / 32;
    const point: Vec3 = [bowl.position[0] - Math.sin(angle) * CAT_EATING_REACH * world.catScale, FLOOR_Y,
      bowl.position[2] - Math.cos(angle) * CAT_EATING_REACH * world.catScale];
    if (!isFree(point, world)) continue;
    const path = findRoomPath(start, point, world);
    if (pathLength([path.at(-1)!, point]) < .02) return path;
  }
  return undefined;
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
  if (!object || !(object.solid || object.movable))
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
/** Baths can be entered from any accessible side; shower and toilet entries
 * stay in front of their back panels and tanks. */
function isNativeJumpClear(start: Vec3, target: Vec3, world: NativeRoomWorld, ignoreId?: string): boolean {
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const p: Vec3 = [start[0] + (target[0] - start[0]) * t, start[1] + (target[1] - start[1]) * t + Math.sin(Math.PI * t) * .35 * world.catScale, start[2] + (target[2] - start[2]) * t];
    if (world.objects.some(o => o.solid && o.instanceId !== ignoreId
      && (o.collisionBoxes?.length ? o.collisionBoxes : [o]).some(box =>
        p[1] < box.max[1] && p[1] + .8 * world.catScale > box.min[1]
        && Math.hypot(p[0] - Math.max(box.min[0], Math.min(box.max[0], p[0])), p[2] - Math.max(box.min[2], Math.min(box.max[2], p[2]))) < world.radius))) return false;
  }
  return true;
}
/** A seat needs both a reachable floor point and a clear flight to its cushion.
 * Search the front half of the furnishing instead of moving a blocked anchor
 * to an arbitrary nearby floor point. Keep the chosen point for the exit. */
export function findSeatApproach(start: Vec3, object: NativeRoomObject, world: NativeRoomWorld): Vec3 | undefined {
  if (!object.seat || !object.approach) return undefined;
  const seat = object.seat;
  const front = object.heading + (object.modelId === 'sofaB' ? Math.PI / 2 : 0);
  const candidates = [object.approach];
  for (let i = 0; i < 25; i++) {
    const turn = i % 2 ? (i + 1) / 2 : -i / 2;
    const angle = front + turn * Math.PI / 36;
    const x = Math.sin(angle), z = Math.cos(angle), clearance = world.radius + .04;
    const edge = Math.min(Math.abs(x) < 1e-6 ? Infinity : ((x > 0 ? object.max[0] + clearance : object.min[0] - clearance) - seat[0]) / x,
      Math.abs(z) < 1e-6 ? Infinity : ((z > 0 ? object.max[2] + clearance : object.min[2] - clearance) - seat[2]) / z);
    candidates.push([seat[0] + x * edge, FLOOR_Y, seat[2] + z * edge]);
  }
  for (const point of candidates) {
    if (!isFree(point, world) || !isNativeJumpClear(point, seat, world, object.instanceId)
      || !isNativeJumpClear(seat, point, world, object.instanceId)) continue;
    const path = findRoomPath(start, point, world);
    if (pathLength([path.at(-1)!, point]) < .05) return point;
  }
  return undefined;
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
  const object = world.objects.find(o => o.instanceId === (step.targetInstanceId ?? plan.targetInstanceId));
  const jump = step.animation === 'jumpOn' || step.animation === 'jumpOff';
  const onSeat = !!step.sofaApproach && step.animation !== 'jumpOff';
  const tree = object && /^catTree|^toy-scratchPost/.test(object.modelId);
  const plant = object && plan.kind === 'plantPlay' && isPlayablePlant(object.modelId);
  const start = step.enteringRoom ? nativeRoomEdge(world, step.travelDirection === -1 ? 1 : -1) : catFloorPoint(fromScreen, world, fromY);
  const walking = step.animation?.startsWith('walk');
  const previousSeatApproach = plan.steps.find(s => s.seatApproach && (s.targetInstanceId ?? plan.targetInstanceId) === object?.instanceId)?.seatApproach;
  const seating = object?.seat && !tree && (step.approachingSeat || step.sofaApproach);
  const seatApproach = seating ? walking ? findSeatApproach(start, object, world)
    : step.seatApproach ?? previousSeatApproach ?? findSeatApproach(start, object, world) : undefined;
  let bowlPath: Vec3[] | undefined;
  const previousBathroomApproach = plan.steps.find(s => s.bathroomApproach && (s.targetInstanceId ?? plan.targetInstanceId) === object?.instanceId)?.bathroomApproach;
  const bathroomApproach = object?.bathroom && step.bathroomPhase ? step.bathroomPhase === 'approach'
    ? findBathroomApproach(start, object, world) : step.bathroomApproach ?? previousBathroomApproach : undefined;
  const previousApproach = plan.steps.find(s => s.treeApproach && (s.targetInstanceId ?? plan.targetInstanceId) === object?.instanceId)?.treeApproach;
  const treeApproach = tree ? walking && !step.returnHome ? findHangingToyApproach(start, object, world)
    : step.treeApproach ?? previousApproach ?? object.approach : undefined;
  const plantApproach = plant && walking && !step.returnHome ? findPlantApproach(start, object, world) : undefined;
  let target = plantApproach ?? catFloorPoint(step.position, world);
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
    target = [p[0] - world.catScale * .20, FLOOR_Y, p[2] + world.radius + .15];
  }
  // A resting/play clip stays where navigation actually arrived. Reusing the
  // old sprite target here would undo the detour and snap into the furniture.
  let path = jump ? [start, target] : walking ? bowlPath ?? findRoomPath(start, target, world) : [start];
  let blocked = !!walking && path.length === 1 && Math.hypot(start[0] - target[0], start[2] - target[2]) > .05;
  if (plan.kind === 'bowlEat' && step.bowlApproach && !bowlPath) { blocked = true; path = [start]; }
  if (plan.kind === 'bowlEat' && step.animation === 'eating' && object
    && Math.abs(Math.hypot(start[0] - object.position[0], start[2] - object.position[2]) - CAT_EATING_REACH * world.catScale) > .08) blocked = true;
  if (step.bathroomPhase && (!object?.bathroom || !bathroomApproach)) { blocked = true; path = [start]; }
  if (seating && !seatApproach) { blocked = true; path = [start]; }
  if (onSeat && !jump && object?.seat && !hasNativeArrived(start, object.seat)) blocked = true;
  if (object?.bathroom && ['wash', 'use'].includes(step.bathroomPhase ?? '')
    && !hasNativeArrived(start, object.bathroom.contact)) blocked = true;
  if ((tree && !treeApproach || plant && !plantApproach) && walking && !step.returnHome) { blocked = true; path = [start]; }
  if (!object && !step.returnHome && (step.approachingSeat || step.sofaApproach || step.bowlApproach || plan.kind === 'doorTravel' || plan.kind === 'toyPlay' || plan.kind === 'mouseChase' || plan.kind === 'bowlEat' || plan.kind === 'plantPlay')) {
    blocked = true;
    path = [start];
  }
  if (walking && (object?.seat || step.bathroomPhase || plan.kind === 'bowlEat' || step.leavingRoom) && Math.hypot(path.at(-1)![0] - target[0], path.at(-1)![2] - target[2]) > .12)
    blocked = true;
  if (jump && !isNativeJumpClear(start, target, world, object?.instanceId)) { blocked = true; path = [start]; }
  const distance = pathLength(path), duration = walking ? Math.max(.18, distance / (.8 * world.catScale * 2.25)) : (step.moveMs ?? step.durationMs) / 1000;
  const position = catScreenPoint(path.at(-1)!, world);
  let objectPath: Vec3[] | undefined;
  if (object && plan.kind === 'mouseChase' && step.objectPosition) {
    const meta = NATIVE_MODEL_CATALOG[object.modelId];
    const centerY = FLOOR_Y + (meta.max[1] + meta.min[1]) / 2 * object.scale;
    const at = (screen: RoomPoint): Vec3 => { const p = unprojectFloor(screen, centerY, world.width); return [p[0], FLOOR_Y, p[2]]; };
    const startObject = objectScreen ? at(objectScreen) : [object.position[0], FLOOR_Y, object.position[2]] as Vec3;
    objectPath = findRoomPath(startObject, at(step.objectPosition), { ...world, radius: (object.max[0] - object.min[0]) / 2 });
  }
  const aim = plant ? [...(object.leaves ?? [])].sort((a,b) => Math.hypot(...a.map((v,i)=>v-start[i])) - Math.hypot(...b.map((v,i)=>v-start[i])))[0]
    : tree && plan.kind === 'toyPlay' ? hangingToyPosition(object) : object?.position;
  const targetHeading = aim && !onSeat && !walking && (plan.kind === 'toyPlay' || plan.kind === 'plantPlay' || plan.kind === 'bowlEat') ? Math.atan2(aim[0] - start[0], aim[2] - start[2]) : undefined;
  const rockingChair: RockingChair | undefined = object?.modelId === 'chairRockingOak' && step.sofaApproach && !blocked
    ? { instanceId: object.instanceId, pivot: [object.position[0], FLOOR_Y, object.position[2]],
      axis: [Math.cos(object.heading), 0, -Math.sin(object.heading)], seat: object.seat!, scale: object.scale, leaving: step.animation === 'jumpOff' }
    : undefined;
  return { ...step, seatApproach, treeApproach, plantApproach, bathroomApproach, position, durationMs: walking ? duration * 1000 : step.durationMs, moveMs: walking ? duration * 1000 : step.moveMs,
    native: { path, distance, duration, rockingChair, bathroom: object?.bathroom && step.bathroomPhase && !blocked
      ? { instanceId: object.instanceId, kind: object.bathroom.kind, phase: step.bathroomPhase } : undefined,
      jump: jump && !blocked, blocked, hideEatingProps: plan.kind === "bowlEat", treePlay: plan.kind === 'toyPlay' && !!object?.seat, plantPlay: !!plant, targetPosition: object?.position, objectPath, objectDuration: duration * .6,
      heading: object?.bathroom && step.bathroomPhase ? object.heading : object?.seat && onSeat ? object.seatHeading : targetHeading } };
}
