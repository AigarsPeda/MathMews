import { isFoodBowlDecorationId } from "@/constants/cat-supplies-decorations";
import catalog from '@/assets/3d/native/catalog.json';
import { getPlacedDecorationDragSize, getPlacedDecorationSpriteId, getPlacedDecorationWallFlipped } from '@/constants/decoration-variants';
import { getBedDisplaySize, getEquippedBedScale } from '@/constants/cat-beds';
import { getPlacedToyDisplaySize } from '@/constants/cat-toys';
import { isRoomDoor } from '@/constants/home-rooms';
import { isRoomBackgroundDecoration } from '@/utils/room-depth';
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
};
export type CollisionBox = { min: Vec3; max: Vec3 };
export const NATIVE_MODEL_CATALOG: Record<string, ModelMetadata> = catalog;
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
  seat?: Vec3;
  seatHeading?: number;
  approach?: Vec3;
  collisionBoxes?: CollisionBox[];
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
    collisionBoxes: object.collisionBoxes?.map(box => ({ min: move(box.min), max: move(box.max) })) };
  return { ...world, objects: world.objects.map(o => o === object ? moved : o) };
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
      seat: current.seat, approach: current.approach, collisionBoxes: current.collisionBoxes };
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
export function buildNativeRoomWorld(options: {
  width: number;
  height: number;
  petSize: number;
  sizeScale: number;
  homeOffset?: RoomItemOffset;
  bedId?: string;
  bedOffset?: RoomItemOffset;
  bedFlipped?: boolean;
  bedScale?: number;
  decorations: PlacedDecoration[];
  toys: PlacedToy[];
  livePositions?: Record<string, RoomPoint>;
  layerOrder?: RoomLayerItem[];
}): NativeRoomWorld {
  const { width, height, sizeScale } = options;
  const catScale = options.petSize * .9 / Math.max(1, width) * ROOM_SPAN / 2.7;
  const world: NativeRoomWorld = { width, height, catScale, radius: 1.04 * catScale, home: [0, FLOOR_Y, 0], objects: [] };
  const add = (instanceId: string, modelId: string, size: number, offset: RoomItemOffset, flip = false, poweredOn?: boolean) => {
    const meta = NATIVE_MODEL_CATALOG[modelId];
    if (!meta)
      return;
    const wall = isRoomDoor(modelId) || (isRoomBackgroundDecoration(modelId) && !/carpet|rug/i.test(modelId)) || /longshelf|smallshelf|shelving|japaneseshelf/i.test(modelId);
    const scale = size / Math.max(1, width) * ROOM_SPAN / meta.renderScale;
    const screen = options.livePositions?.[instanceId] ?? roomOffsetToPoint(offset, width, height, size);
    const modelHeading = wall && meta.max[0] - meta.min[0] < meta.max[2] - meta.min[2] ? Math.PI / 2 : 0;
    const heading = (flip ? Math.PI / 2 : 0) - modelHeading;
    const center = rotate(meta.center, heading);
    let desired = unprojectFloor(screen, FLOOR_Y + center[1] * scale, width);
    if (wall) {
      // Solve on the wall plane, so moving a fixture preserves its screen anchor.
      const difference = screen.x / (Math.max(1, width) / ROOM_SPAN) / diagonal;
      const x = flip ? -2.35 : -2.35 + difference;
      const z = flip ? -2.35 - difference : -2.35;
      const y = .9 + (elevation * (x + z) * diagonal - screen.y / (Math.max(1, width) / ROOM_SPAN)) / vertical;
      desired = [x, y, z];
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
    const collidable = !/carpet|rug/i.test(modelId) && max[1] > FLOOR_Y + .01;
    const object: NativeRoomObject = { instanceId, modelId, position, scale, heading, min, max, solid, collidable, movable, poweredOn };
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
    if (/^sofa[AB]$/.test(modelId)) {
      // Sofa variants already contain their quarter turn in the exported model.
      const variant = modelId === 'sofaB' ? -Math.PI / 2 : 0;
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
    world.objects.push(object);
  };
  if (options.bedId)
    add('bed', 'bed-' + options.bedId, getBedDisplaySize(options.bedId) * getEquippedBedScale(options.bedScale) * sizeScale, options.bedOffset ?? { x: -.15, y: .3 }, options.bedFlipped);
  for (const item of options.decorations)
    add(item.instanceId, getPlacedDecorationSpriteId(item), getPlacedDecorationDragSize(item) * sizeScale, item.offset, getPlacedDecorationWallFlipped(item), item.poweredOn);
  for (const item of options.toys)
    add(item.instanceId, 'toy-' + item.toyId, getPlacedToyDisplaySize(item) * sizeScale, item.offset);
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
      const x = Math.max(o.min[0], Math.min(o.max[0], point[0]));
      const z = Math.max(o.min[2], Math.min(o.max[2], point[2]));
      if (Math.hypot(point[0] - x, point[2] - z) < r + .015)
        return false;
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
export function prepareNativeStep(plan: RoomActivityPlan, step: RoomActivityStep, fromScreen: RoomPoint, world: NativeRoomWorld, fromY: number, objectScreen?: RoomPoint): RoomActivityStep & {
  native: NativeTravel;
} {
  const object = world.objects.find(o => o.instanceId === (step.targetInstanceId ?? plan.targetInstanceId));
  const jump = step.animation === 'jumpOn' || step.animation === 'jumpOff';
  const onSeat = !!step.sofaApproach && step.animation !== 'jumpOff';
  let target = catFloorPoint(step.position, world);
  if (step.returnHome) target = nearestFree(world.home, world);
  if (step.leavingRoom) target = nativeRoomEdge(world, step.travelDirection ?? 1);
  if (object?.seat && object.approach) {
    if (onSeat)
      target = object.seat;
    else if (jump || step.animation?.startsWith('walk') && plan.kind !== 'returnHome' && step === plan.steps[0])
      target = object.approach;
  }
  else if (plan.kind === 'doorTravel' && object) {
    target = [object.position[0], FLOOR_Y, object.position[2]];
    target[object.heading > 0 ? 0 : 2] += world.radius + .2;
  }
  else if (plan.kind === 'bowlEat' && object && step.bowlApproach) {
    // Align the lowered muzzle in the eating clip with the placed bowl.
    const start = catFloorPoint(fromScreen, world, fromY);
    const heading = Math.atan2(object.position[0] - start[0], object.position[2] - start[2]);
    // A corner or nearby furnishing can leave a narrow reachable arc. Eight
    // compass directions miss it even when the muzzle can reach the food.
    const approaches = Array.from({ length: 64 }, (_, i) => {
      const turn = i % 2 ? (i + 1) / 2 : -i / 2;
      const angle = heading + turn * Math.PI / 32;
      return [object.position[0] - Math.sin(angle) * CAT_EATING_REACH * world.catScale, FLOOR_Y,
        object.position[2] - Math.cos(angle) * CAT_EATING_REACH * world.catScale] as Vec3;
    });
    target = approaches.find(point => isFree(point, world)
      && pathLength([findRoomPath(start, point, world).at(-1)!, point]) < .12) ?? approaches[0];
  }
  else if ((plan.kind === 'toyPlay' || plan.kind === 'mouseChase') && object && step.animation?.startsWith('walk')) {
    const meta = NATIVE_MODEL_CATALOG[object.modelId];
    const centerY = FLOOR_Y + (meta.max[1] + meta.min[1]) / 2 * object.scale;
    const screen = plan.kind === 'mouseChase' ? step.objectPosition : undefined;
    const p = screen ? unprojectFloor(screen, centerY, world.width) : object.position;
    target = [p[0] - world.catScale * .20, FLOOR_Y, p[2] + world.radius + .15];
  }
  const start = step.enteringRoom ? nativeRoomEdge(world, step.travelDirection === -1 ? 1 : -1) : catFloorPoint(fromScreen, world, fromY);
  const walking = step.animation?.startsWith('walk');
  // A resting/play clip stays where navigation actually arrived. Reusing the
  // old sprite target here would undo the detour and snap into the furniture.
  let path = jump ? [start, target] : walking ? findRoomPath(start, target, world) : [start];
  let blocked = !!walking && path.length === 1 && Math.hypot(start[0] - target[0], start[2] - target[2]) > .05;
  if (!object && !step.returnHome && (step.sofaApproach || step.bowlApproach || plan.kind === 'doorTravel' || plan.kind === 'toyPlay' || plan.kind === 'mouseChase' || plan.kind === 'bowlEat')) {
    blocked = true;
    path = [start];
  }
  if (walking && (object?.seat || plan.kind === 'bowlEat' || step.leavingRoom) && Math.hypot(path.at(-1)![0] - target[0], path.at(-1)![2] - target[2]) > .12)
    blocked = true;
  if (jump)
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const p: Vec3 = [start[0] + (target[0] - start[0]) * t, start[1] + (target[1] - start[1]) * t + Math.sin(Math.PI * t) * .35 * world.catScale, start[2] + (target[2] - start[2]) * t];
      if (world.objects.some(o => o.solid && o.instanceId !== object?.instanceId && p[1] < o.max[1] && p[1] + .8 * world.catScale > o.min[1]
        && Math.hypot(p[0] - Math.max(o.min[0], Math.min(o.max[0], p[0])), p[2] - Math.max(o.min[2], Math.min(o.max[2], p[2]))) < world.radius)) {
        blocked = true;
        path = [start];
        break;
      }
    }
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
  const targetHeading = object && !onSeat && !walking && (plan.kind === 'toyPlay' || plan.kind === 'bowlEat') ? Math.atan2(object.position[0] - start[0], object.position[2] - start[2]) : undefined;
  return { ...step, position, durationMs: walking ? duration * 1000 : step.durationMs, moveMs: walking ? duration * 1000 : step.moveMs,
    native: { path, distance, duration, jump: jump && !blocked, blocked, hideEatingProps: plan.kind === "bowlEat", targetPosition: object?.position, objectPath, objectDuration: duration * .6, heading: object?.seat && onSeat ? object.seatHeading : targetHeading } };
}
