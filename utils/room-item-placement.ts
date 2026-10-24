import { FLOOR_Y, isSurfacePlaceable, placeObjectOnSurface, placeObjectOnRugs, nativeWallPlacementBounds, NATIVE_MODEL_CATALOG, ROOM_SPAN, projectWorld, unprojectFloor, type NativeRoomObject, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';
import type { RoomPoint } from '@/utils/room-activities';
import { isCurtainDecorationId } from '@/constants/decoration-motion';
import { WALL_MOUNT_PLANE, WALL_PLACEMENT_MIN, WALL_PLACEMENT_MAX, WALL_PLACEMENT_BOTTOM, WALL_PLACEMENT_TOP } from '@/constants/room-geometry';
import { MODERN_KITCHEN_ISLAND_IDS, MODERN_KITCHEN_COUNTER_IDS, MODERN_KITCHEN_FLOOR_SHELF_IDS, MODERN_KITCHEN_SINK_IDS, MODERN_KITCHEN_INDUCTION_IDS, MODERN_KITCHEN_FRIDGE_IDS } from '@/constants/modern-kitchen';

export type RoomPlacementEdge = 'leftWall' | 'backWall' | 'rightEdge' | 'frontEdge' | 'wallStart' | 'wallEnd' | 'wallBottom' | 'wallTop';
export type RoomPlacementFeedback = {
  candidate: NativeRoomObject;
  snapped?: boolean;
  access?: 'clear' | 'blocked';
  unsupportedSurfaceId?: string;
  blockers: { instanceId: string; boxes: Vec3[][] }[];
  boundaries: RoomPlacementEdge[];
};
export function roomPlacementStatus(feedback: RoomPlacementFeedback): 'blocked' | 'checking' | 'ready' {
  if (feedback.blockers.length || feedback.boundaries.length || feedback.unsupportedSurfaceId || feedback.access === 'blocked') return 'blocked';
  return feedback.access === 'clear' ? 'ready' : 'checking';
}
// Shipped room meshes: skirting inner faces and the flat floor before its bevel.
export const ROOM_PLACEMENT_MIN = -2.3075;
export const ROOM_PLACEMENT_MAX = 2.46;

type Box = { center: Vec3; half: Vec3; cos: number; sin: number; extentX: number; extentZ: number; axes?: Vec3[]; polygon?: Vec3[] };
const rotate = (point: number[], angle: number): Vec3 => [Math.cos(angle) * point[0] + Math.sin(angle) * point[2], point[1], -Math.sin(angle) * point[0] + Math.cos(angle) * point[2]];
const kitchenUnits = new Set<string>([...MODERN_KITCHEN_COUNTER_IDS, ...MODERN_KITCHEN_FLOOR_SHELF_IDS, ...MODERN_KITCHEN_SINK_IDS, ...MODERN_KITCHEN_INDUCTION_IDS, ...MODERN_KITCHEN_FRIDGE_IDS]);
const magnetUnits = new Set<string>([...kitchenUnits, ...MODERN_KITCHEN_ISLAND_IDS]);
const KITCHEN_SNAP_DISTANCE = .12;
const WALL_SNAP_POINTS = 10;
const OBJECT_SNAP_POINTS = 10;

function translateObject(object: NativeRoomObject, delta: Vec3): NativeRoomObject {
  const move = (value: Vec3) => value.map((v, i) => v + delta[i]) as Vec3;
  return { ...object, position: move(object.position), min: move(object.min), max: move(object.max),
    seat: object.seat && move(object.seat), approach: object.approach && move(object.approach),
    leaves: object.leaves?.map(move), bathroom: object.bathroom && { ...object.bathroom, contact: move(object.bathroom.contact) },
    collisionBoxes: object.collisionBoxes?.map(box => ({ min: move(box.min), max: move(box.max) })) };
}

/** Use mesh edges and a screen-sized magnet, independent of model framing. */
function wallSnapCandidates(object: NativeRoomObject, world: NativeRoomWorld, zoom: number, snapInside: boolean): NativeRoomObject[] {
  if (object.supportId || isCurtainDecorationId(object.modelId)) return [];
  const near = (delta: Vec3, gap: number) => {
    if (!snapInside && gap >= 0) return false;
    const a = projectWorld(object.position, world.width);
    const b = projectWorld(object.position.map((v, i) => v + delta[i]) as Vec3, world.width);
    return Math.hypot(b.x - a.x, b.y - a.y) * zoom <= WALL_SNAP_POINTS;
  };
  if (object.wallAxis !== undefined) {
    const axis = object.wallAxis === 0 ? 2 : 0;
    const bounds = nativeWallPlacementBounds(object);
    const start = WALL_PLACEMENT_MIN - object.min[axis];
    const end = WALL_PLACEMENT_MAX - bounds.max[axis];
    const shift = (distance: number): Vec3 => axis === 0 ? [distance, 0, 0] : [0, 0, distance];
    return [{ distance: start, gap: -start }, { distance: end, gap: end }]
      .filter(({ distance, gap }) => near(shift(distance), gap))
      .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))
      .map(({ distance }) => translateObject(object, shift(distance)));
  }
  const footprint = roomItemFootprint(object);
  const correction = (axis: 0 | 2): number | undefined => {
    const shift = (distance: number): Vec3 => axis === 0 ? [distance, 0, 0] : [0, 0, distance];
    const start = ROOM_PLACEMENT_MIN - Math.min(...footprint.map(p => p[axis]));
    if (near(shift(start), -start)) return start;
    const end = ROOM_PLACEMENT_MAX - Math.max(...footprint.map(p => p[axis]));
    // Open edges correct small overruns without attracting items across gaps.
    if (end < 0 && near(shift(end), end)) return end;
  };
  const x = correction(0), z = correction(2);
  const shifts: Vec3[] = [];
  // Correct both axes first; fixing one boundary can leave the other crossed.
  if (x !== undefined && z !== undefined) shifts.push([x, 0, z]);
  if (x !== undefined) shifts.push([x, 0, 0]);
  if (z !== undefined) shifts.push([0, 0, z]);
  return shifts.map(delta => translateObject(object, delta));
}

/** Match actual cabinet edges, rather than the differently framed sprite anchors. */
function kitchenJoinCandidates(object: NativeRoomObject, world: NativeRoomWorld, alignWall: boolean, establishedOnly = false): NativeRoomObject[] {
  if (!kitchenUnits.has(object.modelId)) return [];
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  const origin = rotate(object.position, -object.heading);
  const back = origin[2] + meta.min[2] * object.scale;
  const shifts: { x: number; z: number; distance: number; wall: boolean }[] = [];
  const facesWall = Math.abs(object.heading) < .00001 || Math.abs(object.heading - Math.PI / 2) < .00001;
  for (const other of world.objects) {
    if (other.instanceId === object.instanceId || !kitchenUnits.has(other.modelId)
      || Math.abs(Math.sin((other.heading - object.heading) / 2)) > .00001) continue;
    const otherMeta = NATIVE_MODEL_CATALOG[other.modelId];
    const otherOrigin = rotate(other.position, -object.heading);
    const otherBack = otherOrigin[2] + otherMeta.min[2] * other.scale;
    const z = otherBack - back;
    // Side contact identifies a kitchen run even when its old wall gaps exceed
    // the small point magnet. Use the wall as the common line, not that gap.
    const rowReach = Math.min(.35, .5 * Math.min(
      (meta.max[2] - meta.min[2]) * object.scale,
      (otherMeta.max[2] - otherMeta.min[2]) * other.scale));
    const wallRow = alignWall && facesWall && Math.abs(back - ROOM_PLACEMENT_MIN) <= rowReach
      && Math.abs(otherBack - ROOM_PLACEMENT_MIN) <= rowReach;
    // A touching pair defines an existing run, including any clearance needed
    // for windows. The original moving unit may be part of that pair.
    const established = establishedOnly && world.objects.some(neighbor => {
      if (neighbor.instanceId === other.instanceId || !kitchenUnits.has(neighbor.modelId)
        || Math.abs(Math.sin((neighbor.heading - other.heading) / 2)) > .00001) return false;
      const neighborMeta = NATIVE_MODEL_CATALOG[neighbor.modelId];
      const neighborOrigin = rotate(neighbor.position, -object.heading);
      if (Math.abs(neighborOrigin[2] + neighborMeta.min[2] * neighbor.scale - otherBack) > .00001) return false;
      const gap = Math.min(
        Math.abs(neighborOrigin[0] + neighborMeta.min[0] * neighbor.scale - otherOrigin[0] - otherMeta.max[0] * other.scale),
        Math.abs(otherOrigin[0] + otherMeta.min[0] * other.scale - neighborOrigin[0] - neighborMeta.max[0] * neighbor.scale));
      return gap <= KITCHEN_SNAP_DISTANCE;
    });
    if (establishedOnly && !established) continue;
    const joinReach = established && wallRow ? rowReach : KITCHEN_SNAP_DISTANCE;
    if (!wallRow && Math.abs(z) > joinReach) continue;
    for (const side of [-1, 1]) {
      const x = otherOrigin[0] + (side < 0 ? otherMeta.min[0] : otherMeta.max[0]) * other.scale
        - origin[0] - (side < 0 ? meta.max[0] : meta.min[0]) * object.scale;
      if (Math.abs(x) > KITCHEN_SNAP_DISTANCE) continue;
      if (wallRow && !establishedOnly) {
        const wallZ = ROOM_PLACEMENT_MIN - back;
        shifts.push({ x, z: wallZ, distance: Math.hypot(x, wallZ), wall: true });
      }
      if (Math.abs(z) <= joinReach) shifts.push({ x, z, distance: Math.hypot(x, z), wall: false });
    }
  }
  shifts.sort((a, b) => Number(b.wall) - Number(a.wall) || a.distance - b.distance);
  return shifts.map(shift => translateObject(object, rotate([shift.x, 0, shift.z], object.heading)));
}

export function roomItemAnchor(object: NativeRoomObject, width: number): RoomPoint {
  const center = rotate(NATIVE_MODEL_CATALOG[object.modelId].center, object.heading);
  return projectWorld(center.map((v, i) => v * object.scale + object.position[i]) as Vec3, width);
}

/** Move the model's anchor without changing its saved heading or scale. */
export function roomItemAtPoint(object: NativeRoomObject, point: RoomPoint, width: number): NativeRoomObject {
  const center = rotate(NATIVE_MODEL_CATALOG[object.modelId].center, object.heading)
    .map((v, i) => v * object.scale + object.position[i]) as Vec3;
  const desired = unprojectFloor(point, isSurfacePlaceable(object.modelId)
    ? FLOOR_Y + NATIVE_MODEL_CATALOG[object.modelId].center[1] * object.scale : center[1], width);
  if (object.wallAxis !== undefined) {
    const difference = point.x / (width / ROOM_SPAN) / Math.SQRT1_2;
    if (object.wallAxis === 2) { desired[2] = center[2]; desired[0] = center[2] + difference; }
    else { desired[0] = center[0]; desired[2] = center[0] - difference; }
    const elevation = 6.1 / Math.hypot(8, 8, 6.1), vertical = Math.sqrt(1 - elevation * elevation);
    desired[1] = center[1] + (projectWorld(desired, width).y - point.y) / (width / ROOM_SPAN * vertical);
  }
  const delta = desired.map((v, i) => v - center[i]);
  const move = (value: Vec3) => value.map((v, i) => v + delta[i]) as Vec3;
  return { ...object, supportId: undefined, rugLift: isSurfacePlaceable(object.modelId) ? undefined : object.rugLift,
    position: move(object.position), min: move(object.min), max: move(object.max),
    collisionBoxes: object.collisionBoxes?.map(box => ({ min: move(box.min), max: move(box.max) })) };
}

type PlacementShape = Pick<NativeRoomObject, 'modelId' | 'collidable' | 'heading' | 'scale' | 'position'>;
function boxes(object: PlacementShape): Box[] {
  if (object.collidable === false) return [];
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  return (meta.placementBoxes ?? meta.collisionBoxes ?? [{ min: meta.min, max: meta.max }]).map(box => {
    const center = rotate(box.min.map((v, i) => (v + box.max[i]) / 2), object.heading);
    const half = box.min.map((v, i) => (box.max[i] - v) * object.scale / 2) as Vec3;
    const cos = Math.cos(object.heading), sin = Math.sin(object.heading);
    const result: Box = { center: center.map((v, i) => v * object.scale + object.position[i]) as Vec3,
      half, cos, sin, extentX: half[0] * Math.abs(cos) + half[2] * Math.abs(sin),
      extentZ: half[0] * Math.abs(sin) + half[2] * Math.abs(cos),
      polygon: box.footprint?.map(([x, z]) => rotate([x, 0, z], object.heading)
        .map((v, i) => v * object.scale + object.position[i]) as Vec3) };
    result.axes = horizontalAxes(result);
    return result;
  });
}

/** Cabinet magnets follow their worktop faces, not every bevel and handle.
 * Detailed parts still own collision legality and the blocked-part overlay. */
function magnetBoxes(object: NativeRoomObject): Box[] {
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  if (!magnetUnits.has(object.modelId) || (meta.placementBoxes ?? meta.collisionBoxes ?? []).length <= 12) return boxes(object);
  const bounds = magnetUnits.has(object.modelId) && meta.supportSurfaces?.length ? meta.supportSurfaces : [meta];
  return bounds.map(part => {
    const center = rotate(part.min.map((v, i) => (v + part.max[i]) / 2), object.heading);
    const half = part.min.map((v, i) => (part.max[i] - v) * object.scale / 2) as Vec3;
    const cos = Math.cos(object.heading), sin = Math.sin(object.heading);
    return { center: center.map((v, i) => v * object.scale + object.position[i]) as Vec3,
      half, cos, sin, extentX: half[0] * Math.abs(cos) + half[2] * Math.abs(sin),
      extentZ: half[0] * Math.abs(sin) + half[2] * Math.abs(cos) };
  });
}

/** Actual mesh silhouette on the floor, rather than rotated bounding-box corners. */
export function roomItemFootprint(object: Pick<NativeRoomObject, 'modelId' | 'heading' | 'scale' | 'position' | 'min'>): Vec3[] {
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  const hull = meta.placementHull ?? [[meta.min[0],meta.min[2]], [meta.max[0],meta.min[2]],
    [meta.max[0],meta.max[2]], [meta.min[0],meta.max[2]]];
  return hull.map(([x,z]) => {
    const p = rotate([x,0,z],object.heading);
    return [p[0]*object.scale+object.position[0], object.min[1], p[2]*object.scale+object.position[2]];
  });
}
function boxCorners(box: Box): Vec3[] {
  return [-1,1].flatMap(y => [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z]) => {
    const p = [x*box.half[0]*box.cos+z*box.half[2]*box.sin, y*box.half[1],
      -x*box.half[0]*box.sin+z*box.half[2]*box.cos];
    return p.map((v,i)=>v+box.center[i]) as Vec3;
  }));
}

/** Release-only outline of the attempted furniture's structural parts. */
export function roomItemPlacementOutline(object: PlacementShape): Vec3[][] {
  return boxes(object).map(boxCorners);
}

/** Separating-axis test for rotated footprints, with a separate vertical span. */
function penetration(a: Box, b: Box, tolerance = .005, planarDepth = false): number {
  // Broad phase rejects distant boxes before the rotated separating-axis test.
  const dx = a.center[0] - b.center[0], dz = a.center[2] - b.center[2];
  if (Math.abs(dx) >= a.extentX + b.extentX || Math.abs(dz) >= a.extentZ + b.extentZ) return 0;
  const height = a.half[1] + b.half[1] - Math.abs(a.center[1] - b.center[1]);
  if (height <= .005) return 0;
  let depth = Infinity;
  for (let axis = 0; axis < 4; axis++) {
    const box = axis < 2 ? a : b;
    const x = axis % 2 ? box.sin : box.cos, z = axis % 2 ? box.cos : -box.sin;
    const overlap = a.half[0] * Math.abs(x * a.cos - z * a.sin) + a.half[2] * Math.abs(x * a.sin + z * a.cos)
      + b.half[0] * Math.abs(x * b.cos - z * b.sin) + b.half[2] * Math.abs(x * b.sin + z * b.cos)
      - Math.abs(x * dx + z * dz);
    if (overlap <= tolerance) return 0;
    depth = Math.min(depth, overlap);
  }
  // Mesh footprints can be rounded or asymmetric. Project both ends rather
  // than mirroring their farthest vertex across the bounding-box center.
  if (a.polygon || b.polygon) for (const axis of [...horizontalAxes(a), ...horizontalAxes(b)]) {
    const [aMin, aMax] = projection(a, axis), [bMin, bMax] = projection(b, axis);
    const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
    if (overlap <= tolerance) return 0;
    depth = Math.min(depth, overlap);
  }
  return planarDepth ? depth : Math.min(depth, height);
}

const boxAxes = (box: Box): Vec3[] => [[box.cos, 0, -box.sin], [box.sin, 0, box.cos], [0, 1, 0]];
const uniqueAxes = (axes: Vec3[]): Vec3[] => axes.filter((axis, i) => axes.findIndex(other => Math.abs(dot(axis, other)) > 1 - 1e-8) === i);
const horizontalAxes = (box: Box): Vec3[] => box.axes ?? (box.polygon ? uniqueAxes(box.polygon.map((point, i, points) => {
  const next = points[(i + 1) % points.length], x = next[2] - point[2], z = point[0] - next[0];
  const length = Math.hypot(x, z);
  return [x / length, 0, z / length] as Vec3;
})) : boxAxes(box).slice(0, 2));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const extent = (box: Box, axis: Vec3) => box.polygon
  ? Math.max(...box.polygon.map(p => Math.abs((p[0] - box.center[0]) * axis[0] + (p[2] - box.center[2]) * axis[2]))) + box.half[1] * Math.abs(axis[1])
  : box.half[0] * Math.abs(axis[0] * box.cos - axis[2] * box.sin)
    + box.half[2] * Math.abs(axis[0] * box.sin + axis[2] * box.cos) + box.half[1] * Math.abs(axis[1]);

/** Exact interval for asymmetric mesh footprints, including vertical axes. */
function projection(box: Box, axis: Vec3): [number, number] {
  const center = dot(box.center, axis);
  if (!box.polygon) { const radius = extent(box, axis); return [center - radius, center + radius]; }
  let min = Infinity, max = -Infinity;
  for (const p of box.polygon) {
    const value = p[0] * axis[0] + p[2] * axis[2];
    min = Math.min(min, value); max = Math.max(max, value);
  }
  const y = box.center[1] * axis[1], radius = box.half[1] * Math.abs(axis[1]);
  return [min + y - radius, max + y + radius];
}

/** First contact along a direction, including rotated faces and corner contact.
 * Intersect the overlap intervals on every separating axis, then take the
 * nearest endpoint. Never jump through a neighbor to its opposite side. */
function contactShifts(a: Box, b: Box): (direction: Vec3) => Vec3 | undefined {
  // These intervals depend on the pair, not the tested movement direction.
  // Reuse them across all candidate faces of detailed curved parts.
  const intervals = [...uniqueAxes([...horizontalAxes(a), ...horizontalAxes(b)]), [0, 1, 0] as Vec3].map(axis => {
    const [aMin, aMax] = projection(a, axis), [bMin, bMax] = projection(b, axis);
    return { axis, min: bMin - aMax, max: bMax - aMin };
  });
  return direction => {
    let lo = -Infinity, hi = Infinity;
    for (const { axis, min, max } of intervals) {
      const speed = dot(direction, axis);
      if (Math.abs(speed) < .00001) {
        if (min > .00001 || max < -.00001) return undefined;
        continue;
      }
      const first = min / speed, last = max / speed;
      lo = Math.max(lo, Math.min(first, last)); hi = Math.min(hi, Math.max(first, last));
      if (lo > hi + .00001) return undefined;
    }
    const distance = Math.abs(lo) < Math.abs(hi) ? lo : hi;
    return direction.map(v => v * distance) as Vec3;
  };
}

/** Nearest edge/vertex direction fills diagonal gaps between disjoint boxes. */
function closestBoxDirection(a: Box, b: Box): Vec3 | undefined {
  const first = a.polygon ?? boxCorners(a).slice(0, 4), second = b.polygon ?? boxCorners(b).slice(0, 4);
  let nearest: Vec3 | undefined, distance = Infinity;
  for (const [vertices, edges, sign] of [[first, second, 1], [second, first, -1]] as const) {
    for (const vertex of vertices) for (let i = 0; i < edges.length; i++) {
      const start = edges[i], end = edges[(i + 1) % edges.length];
      const dx = end[0] - start[0], dz = end[2] - start[2];
      const length = dx * dx + dz * dz;
      const t = length ? Math.max(0, Math.min(1, ((vertex[0] - start[0]) * dx + (vertex[2] - start[2]) * dz) / length)) : 0;
      const shift: Vec3 = [(start[0] + dx * t - vertex[0]) * sign, 0, (start[2] + dz * t - vertex[2]) * sign];
      const squared = dot(shift, shift);
      if (squared < distance) { nearest = shift; distance = squared; }
    }
  }
  return nearest && distance > .00000001 ? nearest.map(v => v / Math.sqrt(distance)) as Vec3 : undefined;
}

const PLACEMENT_CELL_SIZE = .5;
function visitPlacementCells(box: Box, visit: (key: string) => void) {
  const minX = Math.floor((box.center[0] - box.extentX) / PLACEMENT_CELL_SIZE), maxX = Math.floor((box.center[0] + box.extentX) / PLACEMENT_CELL_SIZE);
  const minZ = Math.floor((box.center[2] - box.extentZ) / PLACEMENT_CELL_SIZE), maxZ = Math.floor((box.center[2] + box.extentZ) / PLACEMENT_CELL_SIZE);
  // Before layout, screen-sized models can be enormous. Bound grid allocation.
  const count = (maxX - minX + 1) * (maxZ - minZ + 1);
  if (!Number.isFinite(count) || count > 256) return false;
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) visit(`${x}:${z}`);
  return true;
}

function indexPlacementShape(object: NativeRoomObject) {
  const parts = boxes(object), grid = new Map<string, Set<Box>>(), fallback = new Set<Box>();
  for (const box of parts) {
    if (!visitPlacementCells(box, key => {
      let cell = grid.get(key);
      if (!cell) { cell = new Set(); grid.set(key, cell); }
      cell.add(box);
    })) fallback.add(box);
  }
  return { boxes: parts, magnets: magnetUnits.has(object.modelId) ? magnetBoxes(object) : parts, grid, fallback };
}

type PlacementIndexCache = Map<string, { key: string; index: ReturnType<typeof indexPlacementShape> }>;

/** Own one cache per room, retaining only the latest geometry of its live items. */
export function createRoomPlacementResolverCache() {
  const cache: PlacementIndexCache = new Map();
  return (world: NativeRoomWorld, ignoredIds: string[] = []) => createRoomPlacementResolver(world, ignoredIds, cache);
}

/** Cache fixed obstacles once per layout, rather than rebuild the room while dragging. */
export function createRoomPlacementResolver(world: NativeRoomWorld, ignoredIds: string[] = [], cache?: PlacementIndexCache) {
  const ignored = new Set(ignoredIds);
  if (cache) {
    const retained = new Set(world.objects.map(object => object.instanceId));
    for (const id of cache.keys()) if (!retained.has(id)) cache.delete(id);
  }
  const obstacles = world.objects.filter(object => !ignored.has(object.instanceId)).map(object => {
    // These are exactly the inputs read by boxes/magnetBoxes. Keep the current
    // object separately so support, wall and other placement rules never go stale.
    const key = JSON.stringify([object.modelId, object.collidable, object.heading, object.scale, object.position]);
    const previous = cache?.get(object.instanceId);
    const index = previous?.key === key ? previous.index : indexPlacementShape(object);
    cache?.set(object.instanceId, { key, index });
    return { id: object.instanceId, object, ...index };
  });
  const cells = new Map<string, Set<typeof obstacles[number]>>();
  const unindexed = new Set<typeof obstacles[number]>();
  for (const obstacle of obstacles) {
    for (const key of obstacle.grid.keys()) {
      let cell = cells.get(key);
      if (!cell) { cell = new Set(); cells.set(key, cell); }
      cell.add(obstacle);
    }
    if (obstacle.fallback.size) unindexed.add(obstacle);
  }
  const nearby = (own: Box[]) => {
    const result = new Set(unindexed);
    for (const box of own) {
      const indexed = visitPlacementCells(box, key => {
        for (const obstacle of cells.get(key) ?? []) result.add(obstacle);
      });
      if (!indexed) return new Set(obstacles);
    }
    return result;
  };
  const nearbyBoxes = (box: Box, obstacle: typeof obstacles[number], reach: number) => {
    const found = new Set(obstacle.fallback);
    if (!visitPlacementCells({ ...box, extentX: box.extentX + reach, extentZ: box.extentZ + reach }, key => {
      for (const candidate of obstacle.grid.get(key) ?? []) found.add(candidate);
    })) return obstacle.boxes;
    return [...found];
  };
  const templates = new Map<string, { object: NativeRoomObject; boxes: Box[] }>();
  const movingBoxes = (object: NativeRoomObject) => {
    const key = `${object.instanceId}:${object.heading}:${object.scale}`;
    let template = templates.get(key);
    if (!template) { template = { object, boxes: boxes(object) }; templates.set(key, template); }
    const origin = template.object.position;
    const dx = object.position[0] - origin[0], dy = object.position[1] - origin[1], dz = object.position[2] - origin[2];
    return template.boxes.map(box => ({ ...box,
      center: [box.center[0] + dx, box.center[1] + dy, box.center[2] + dz] as Vec3,
      polygon: box.polygon?.map(p => [p[0] + dx, p[1] + dy, p[2] + dz] as Vec3) }));
  };
  const collisions = (object: NativeRoomObject, tolerance = .005) => {
    const own = movingBoxes(object);
    return obstacles.filter(other => other.id !== object.instanceId).map(other => ({ id: other.id,
      depth: own.reduce((sum, a) => sum + other.boxes.reduce((total, b) => total + penetration(a, b, tolerance), 0), 0) }));
  };
  const boundaryExcess = (object: NativeRoomObject): { edge: RoomPlacementEdge; depth: number }[] => {
    // Curtains may extend beyond the wall edges or cover other wall fixtures.
    if (isCurtainDecorationId(object.modelId)) return [];
    const floor = object.wallAxis === undefined;
    // Raised objects clear the floor skirting and can sit at the back of a shelf.
    const roomMin = object.supportId && object.min[1] > WALL_PLACEMENT_BOTTOM ? WALL_MOUNT_PLANE : ROOM_PLACEMENT_MIN;
    const footprint = roomItemFootprint(object);
    const wallBounds = !floor ? nativeWallPlacementBounds(object) : undefined;
    const axes = floor ? [0, 2] : [object.wallAxis === 0 ? 2 : 0];
    const result: { edge: RoomPlacementEdge; depth: number }[] = [];
    for (const axis of axes) {
      const lo = floor ? Math.min(...footprint.map(p => p[axis])) : object.min[axis];
      const hi = floor ? Math.max(...footprint.map(p => p[axis])) : wallBounds!.max[axis];
      result.push({ edge: floor ? axis === 0 ? 'leftWall' : 'backWall' : 'wallStart', depth: Math.max(0, (floor ? roomMin : WALL_PLACEMENT_MIN) - lo) },
        { edge: floor ? axis === 0 ? 'rightEdge' : 'frontEdge' : 'wallEnd', depth: Math.max(0, hi - (floor ? ROOM_PLACEMENT_MAX : WALL_PLACEMENT_MAX)) });
    }
    if (!floor) result.push({ edge: 'wallBottom', depth: Math.max(0, WALL_PLACEMENT_BOTTOM-object.min[1]) },
      { edge: 'wallTop', depth: Math.max(0, object.max[1]-WALL_PLACEMENT_TOP) });
    return result;
  };
  const outsideRoom = (object: NativeRoomObject) => boundaryExcess(object).reduce((sum, edge) => sum+edge.depth, 0);
  const canPlace = (object: NativeRoomObject, tolerance = .005) => {
    if (outsideRoom(object) > .00001) return false;
    const own = movingBoxes(object);
    for (const other of nearby(own)) {
      if (other.id === object.instanceId) continue;
      for (const a of own) for (const b of nearbyBoxes(a, other, 0)) if (penetration(a, b, tolerance) > 0) return false;
    }
    return true;
  };
  const canChange = (before: NativeRoomObject, after: NativeRoomObject) => {
    const allowed = collisions(before);
    return outsideRoom(after) <= outsideRoom(before) + .00001
      && collisions(after).every((hit, i) => hit.depth <= allowed[i].depth + .00001);
  };
  const preservesSupport = (object: NativeRoomObject) => {
    if (!object.supportId) return true;
    const resting = placeObjectOnSurface({ ...object, supportId: undefined }, world.objects, world.width);
    return resting.supportId === object.supportId && Math.abs(resting.position[1] - object.position[1]) < .00001;
  };
  const objectSnapCandidates = (object: NativeRoomObject, zoom: number, snapGaps: boolean): NativeRoomObject[] => {
    if (isCurtainDecorationId(object.modelId)) return [];
    const footprint = roomItemFootprint(object);
    const contacts = object.wallAxis === undefined && !object.supportId ? [0, 2].filter(axis =>
      Math.abs(Math.min(...footprint.map(p => p[axis])) - ROOM_PLACEMENT_MIN) < .00001) : [];
    const locked = object.wallAxis !== undefined ? [object.wallAxis] : contacts;
    const constrained = locked.length > 0;
    const allowed: Vec3[] = [[1, 0, 0], [0, 0, 1], ...(object.wallAxis !== undefined ? [[0, 1, 0] as Vec3] : [])];
    const directions = allowed.filter(axis => locked.every(index => axis[index] === 0));
    if (constrained && !directions.length) return [];
    const zero = projectWorld([0, 0, 0], world.width);
    const reach = OBJECT_SNAP_POINTS * ROOM_SPAN / (world.width * zoom * .47);
    const shifts = new Map<string, { delta: Vec3; distance: number }>();
    const own = magnetBoxes(object);
    for (const other of nearby(own.map(box => ({ ...box, extentX: box.extentX + reach, extentZ: box.extentZ + reach })))) {
      if (other.id === object.instanceId || other.id === object.supportId || isCurtainDecorationId(other.object.modelId)) continue;
      // Magnets only attract at a neighbor's edge. Once the footprint is deep
      // inside another item, keep following the pointer instead of searching
      // hundreds of internal ribs and bevels for an escape snap.
      if (object.wallAxis === undefined && other.object.wallAxis === undefined
        && [0, 2].every(axis => Math.min(object.max[axis], other.object.max[axis])
          - Math.max(object.min[axis], other.object.min[axis]) > Math.min(reach, .25 * Math.min(object.max[axis] - object.min[axis], other.object.max[axis] - other.object.min[axis])))) continue;
      const parallelKitchen = kitchenUnits.has(object.modelId) && kitchenUnits.has(other.object.modelId)
        && Math.abs(Math.sin((object.heading - other.object.heading) / 2)) < .00001;
      const localBounds = (item: NativeRoomObject) => {
        const meta = NATIVE_MODEL_CATALOG[item.modelId], origin = rotate(item.position, -item.heading);
        return { min: meta.min.map((v,i) => origin[i] + v * item.scale), max: meta.max.map((v,i) => origin[i] + v * item.scale) };
      };
      const first = parallelKitchen ? localBounds(object) : undefined, second = parallelKitchen ? localBounds(other.object) : undefined;
      const kitchenCorner = first && second && [0, 2].every(axis =>
        first.min[axis] >= second.max[axis] - .00001 || second.min[axis] >= first.max[axis] - .00001);
      // A nearby edge may slightly overlap after an imprecise release. A drop
      // into the middle of another item has no clear contact intent.
      const axes = object.wallAxis === undefined ? [0, 2] : [object.wallAxis === 0 ? 2 : 0, 1];
      const shallow = .5 * Math.min(...axes.flatMap(axis => [object.max[axis] - object.min[axis], other.object.max[axis] - other.object.min[axis]]));
      const pairs = own.map(a => ({ a, nearby: (magnetUnits.has(other.object.modelId) ? other.magnets : nearbyBoxes(a, other, reach)).filter(b =>
        Math.abs(a.center[0] - b.center[0]) <= a.extentX + b.extentX + reach
        && Math.abs(a.center[2] - b.center[2]) <= a.extentZ + b.extentZ + reach) }));
      if (pairs.some(({ a, nearby }) => nearby.some(b => penetration(a, b, .005, true) > shallow))) continue;
      // Rank the nearest solid-part pairs before solving their contact planes.
      // A curved bed/chair can contain hundreds of parts; trying every pair is
      // an unbounded mesh search on the input thread.
      const contacts = pairs.flatMap(({ a, nearby }) => nearby.flatMap(b => {
        const height = a.half[1] + b.half[1] - Math.abs(a.center[1] - b.center[1]);
        if (object.wallAxis === undefined ? height <= .005 : height < -reach) return [];
        const dx = Math.max(0, Math.abs(a.center[0] - b.center[0]) - a.extentX - b.extentX);
        const dz = Math.max(0, Math.abs(a.center[2] - b.center[2]) - a.extentZ - b.extentZ);
        return [{ a, b, distance: dx * dx + dz * dz }];
      })).sort((a, b) => a.distance - b.distance).slice(0, 32);
      for (const { a, b } of contacts) {
        if (Math.abs(a.center[0] - b.center[0]) > a.extentX + b.extentX + reach
          || Math.abs(a.center[2] - b.center[2]) > a.extentZ + b.extentZ + reach) continue;
        const overlapping = penetration(a, b) > 0;
        if (!snapGaps && !overlapping) continue;
        // Cabinet joins follow the unit faces. Tiny bevels and trim should not
        // pull a deliberately staggered kitchen diagonally into a straight row.
        const axes = constrained ? directions : parallelKitchen
          ? [[Math.cos(object.heading), 0, -Math.sin(object.heading)] as Vec3, [Math.sin(object.heading), 0, Math.cos(object.heading)] as Vec3]
          : uniqueAxes([...horizontalAxes(a), ...horizontalAxes(b)]);
        if (!constrained && (!parallelKitchen || kitchenCorner) && !overlapping) {
          const diagonal = closestBoxDirection(a, b);
          if (diagonal) axes.push(diagonal);
        }
        const contact = contactShifts(a, b);
        for (const direction of axes) {
          const delta = contact(direction);
          if (!delta) continue;
          const point = projectWorld(delta, world.width);
          const distance = Math.hypot(point.x - zero.x, point.y - zero.y) * zoom;
          if (distance > OBJECT_SNAP_POINTS || distance < .00001) continue;
          const key = delta.map(v => v.toFixed(5)).join(':');
          if (!shifts.has(key)) shifts.set(key, { delta, distance });
        }
      }
    }
    // A magnet is a small correction, not an exhaustive placement search.
    // Keep the nearest distinct screen-space corrections; all still pass exact
    // solid-part collision validation before they can be displayed or saved.
    const pixels = new Set<string>();
    return [...shifts.values()].sort((a, b) => a.distance - b.distance).filter(({ delta }) => {
      const p = projectWorld(delta, world.width);
      const key = `${Math.round((p.x - zero.x) * zoom * 2)}:${Math.round((p.y - zero.y) * zoom * 2)}`;
      if (pixels.has(key)) return false;
      pixels.add(key); return true;
    }).slice(0, 24).map(({ delta }) => translateObject(object, delta));
  };
  const feedback = (candidate: NativeRoomObject): RoomPlacementFeedback => {
    const own = movingBoxes(candidate);
    return { candidate, boundaries: boundaryExcess(candidate).filter(edge => edge.depth > .00001).map(edge => edge.edge),
      blockers: [...nearby(own)].filter(other => other.id !== candidate.instanceId).flatMap(other => {
        const hitSet = new Set<Box>();
        for (const a of own) for (const b of nearbyBoxes(a, other, 0)) {
          if (!hitSet.has(b) && penetration(a, b) > 0) hitSet.add(b);
        }
        const hits = other.boxes.filter(box => hitSet.has(box));
        return hits.length ? [{instanceId:other.id,boxes:hits.map(boxCorners)}] : [];
      }) };
  };
  const snapObject = (moved: NativeRoomObject, zoom = 1, snapInsideWalls = true): NativeRoomObject => {
    const wallCandidates = wallSnapCandidates(moved, world, zoom, snapInsideWalls);
    const joins = (object: NativeRoomObject) => snapInsideWalls || !canPlace(object) ? kitchenJoinCandidates(object, world, snapInsideWalls) : [];
    // Keep an established row's clearance first. Otherwise use the wall as
    // the common line and try side joins from the corrected wall pose.
    const acceptable = (object: NativeRoomObject) => preservesSupport(object) && canPlace(object, .00001);
    if (snapInsideWalls) for (const candidate of kitchenJoinCandidates(moved, world, true, true)) {
      if (acceptable(candidate)) return candidate;
    }
    for (const object of wallCandidates) {
      const footprint = roomItemFootprint(object);
      const contacts = [0, 2].filter(axis => Math.abs(Math.min(...footprint.map(p => p[axis])) - ROOM_PLACEMENT_MIN) < .00001);
      for (const joined of joins(object)) if (contacts.every(axis => Math.abs(joined.position[axis] - object.position[axis]) < .00001)
        && acceptable(joined)) return joined;
      for (const candidate of objectSnapCandidates(object, zoom, snapInsideWalls)) if (acceptable(candidate)) return candidate;
      if (acceptable(object)) return object;
    }
    for (const candidate of joins(moved)) if (acceptable(candidate)) return candidate;
    for (const candidate of objectSnapCandidates(moved, zoom, snapInsideWalls)) if (acceptable(candidate)) return candidate;
    return moved;
  };
  function* findFree(object: NativeRoomObject, preferVisible = false): Generator<void, NativeRoomObject | undefined> {
    // Suggestions should be easy to grab. This conservative screen-space score
    // is only a ranking heuristic; physical legality still uses exact geometry.
    const projectedBounds = (item: NativeRoomObject) => {
      const points = [item.min[0], item.max[0]].flatMap(x => [item.min[1], item.max[1]]
        .flatMap(y => [item.min[2], item.max[2]].map(z => projectWorld([x, y, z], world.width))));
      return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
        top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
    };
    const occluders = preferVisible ? world.objects.filter(other => other.instanceId !== object.instanceId && (other.wallAxis !== undefined || other.collidable !== false))
      .map(other => ({ object: other, bounds: projectedBounds(other) })) : [];
    const visibility = (candidate: NativeRoomObject) => {
      if (!preferVisible) return 1;
      const bounds = projectedBounds(candidate);
      const depth = (candidate.min[0] + candidate.max[0] + candidate.min[2] + candidate.max[2]) / 2;
      let visible = 0;
      for (const x of [.2, .5, .8]) for (const y of [.2, .5, .8]) {
        const px = bounds.left + x * (bounds.right - bounds.left), py = bounds.top + y * (bounds.bottom - bounds.top);
        if (!occluders.some(({ object: other, bounds: b }) =>
          ((candidate.wallAxis !== undefined && other.wallAxis === candidate.wallAxis)
            || (other.min[0] + other.max[0] + other.min[2] + other.max[2]) / 2 > depth + .01)
          && px >= b.left && px <= b.right && py >= b.top && py <= b.bottom)) visible++;
      }
      return visible / 9;
    };
    let best: NativeRoomObject | undefined, bestVisibility = -1;
    const consider = (candidate: NativeRoomObject) => {
      if (!canPlace(candidate)) return false;
      const score = visibility(candidate);
      if (score > bestVisibility) { best = candidate; bestVisibility = score; }
      return score >= 2 / 3;
    };
    const initial = kitchenUnits.has(object.modelId) ? snapObject(object) : object;
    if (consider(initial)) return initial;
    const candidates: { point: RoomPoint; distance: number }[] = [];
    const center = rotate(NATIVE_MODEL_CATALOG[object.modelId].center, object.heading)
      .map((v, i) => v * object.scale + object.position[i]) as Vec3;
    if (object.wallAxis === undefined) {
      for (let x = -2.2; x <= 2.2; x += .15) for (let z = -2.2; z <= 2.2; z += .15)
        candidates.push({ point: projectWorld([x, center[1], z], world.width), distance: Math.hypot(x - center[0], z - center[2]) });
    } else {
      const along = object.wallAxis === 0 ? 2 : 0;
      for (let horizontal = -2.2; horizontal <= 2.2; horizontal += .15) for (let y = .2; y <= 2.6; y += .15) {
        const target: Vec3 = [...center]; target[along] = horizontal; target[1] = y;
        candidates.push({ point: projectWorld(target, world.width), distance: Math.hypot(horizontal - center[along], y - center[1]) });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const size = object.scale * world.width * NATIVE_MODEL_CATALOG[object.modelId].renderScale / ROOM_SPAN;
    for (const { point } of candidates) {
      yield;
      if (Math.abs(point.x) > (world.width - size) / 2 || Math.abs(point.y) > (world.height - size) / 2) continue;
      const moved = roomItemAtPoint(object, point, world.width);
      const candidate = kitchenUnits.has(object.modelId) ? snapObject(moved) : moved;
      if (consider(candidate)) return candidate;
    }
    return best;
  }
  return {
    canPlace,
    feedback,
    /** The visible candidate and release use the same snapping and geometry. */
    preview(id: string, point: RoomPoint, zoom = 1, heldSnap?: NativeRoomObject, snapping = true) {
      const original = world.objects.find(object => object.instanceId === id);
      if (!original) return undefined;
      const moved = placeObjectOnSurface(roomItemAtPoint(original, point, world.width), world.objects, world.width, true);
      const anchor = heldSnap && roomItemAnchor(heldSnap, world.width);
      const candidate = snapping && heldSnap && anchor
        && Math.hypot(anchor.x - point.x, anchor.y - point.y) * zoom <= OBJECT_SNAP_POINTS * 1.5 && canPlace(heldSnap)
        ? heldSnap : placeObjectOnRugs(snapping ? snapObject(moved, zoom) : moved, world.objects);
      const details = feedback(candidate);
      // A pointed-at board is an explicit surface intent. If the base cannot
      // fit, keep the attempt invalid instead of silently dropping to the floor.
      if (!candidate.supportId && isSurfacePlaceable(candidate.modelId)) {
        for (const owner of world.objects) {
          if (owner.instanceId === id || ignoredIds.includes(owner.instanceId)) continue;
          for (const top of NATIVE_MODEL_CATALOG[owner.modelId].supportSurfaces ?? []) {
            const corners = [[top.min[0], top.min[2]], [top.max[0], top.min[2]], [top.max[0], top.max[2]], [top.min[0], top.max[2]]]
              .map(([x, z]) => projectWorld(rotate([x, top.max[1], z], owner.heading).map((v, i) => v * owner.scale + owner.position[i]) as Vec3, world.width));
            const sides = corners.map((a, i) => { const b = corners[(i + 1) % corners.length]; return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x); });
            if (sides.every(value => value >= 0) || sides.every(value => value <= 0)) { details.unsupportedSurfaceId = owner.instanceId; break; }
          }
          if (details.unsupportedSurfaceId) break;
        }
      }
      return { object: candidate, point: roomItemAnchor(candidate, world.width), feedback: details,
        accepted: !details.blockers.length && !details.boundaries.length && !details.unsupportedSurfaceId,
        snapped: candidate.position.some((value, i) => Math.abs(value - moved.position[i]) > .00001) };
    },
    /** New items use the nearest empty spot instead of overlapping furniture. */
    nearestFree(object: NativeRoomObject) {
      const search = findFree(object);
      let next = search.next();
      while (!next.done) next = search.next();
      return next.value;
    },
    async nearestFreeAsync(object: NativeRoomObject, signal: AbortSignal, preferVisible = false) {
      const search = findFree(object, preferVisible);
      let start = performance.now();
      while (!signal.aborted) {
        const next = search.next();
        if (next.done) return next.value;
        if (performance.now() - start >= 4) {
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          start = performance.now();
        }
      }
      return undefined;
    },
    canChange,
    /** Resize around the floor base or wall mounting center, not sprite framing. */
    resize(before: NativeRoomObject, after: NativeRoomObject) {
      let delta: Vec3;
      if (before.wallAxis === undefined) {
        const supportDelta = (before.rugLift ?? 0) - (after.rugLift ?? 0);
        delta = [before.position[0] - after.position[0],
          before.supportId ? before.min[1] - after.min[1] : before.position[1] - after.position[1],
          before.position[2] - after.position[2]];
        delta = delta.map((v,i) => v - supportDelta * (i === 1 ? 1 : 8 / 6.1)) as Vec3;
      } else {
        delta = before.min.map((v, i) => (v + before.max[i] - after.min[i] - after.max[i]) / 2) as Vec3;
        delta[before.wallAxis] = 0;
      }
      const resized = placeObjectOnRugs({ ...translateObject(after, delta), supportId: before.supportId }, world.objects);
      return preservesSupport(resized) && canChange(before, resized) ? resized : undefined;
    },
    /** A small turn near an edge may need a small positional correction. */
    rotate(before: NativeRoomObject, after: NativeRoomObject) {
      if (canPlace(after)) return after;
      const footprint = roomItemFootprint(after);
      const shift = [0, 0, 0] as Vec3;
      if (after.wallAxis === undefined && !after.supportId) for (const axis of [0, 2]) {
        const low = Math.min(...footprint.map(p => p[axis])), high = Math.max(...footprint.map(p => p[axis]));
        shift[axis] = low < ROOM_PLACEMENT_MIN ? ROOM_PLACEMENT_MIN - low : high > ROOM_PLACEMENT_MAX ? ROOM_PLACEMENT_MAX - high : 0;
      }
      const inside = translateObject(after, shift);
      const zero = projectWorld(after.position, world.width);
      const candidates = [inside, ...objectSnapCandidates(inside, 1, false)];
      const allowed = collisions(before);
      return candidates.find(candidate => {
        const point = projectWorld(candidate.position, world.width);
        return Math.hypot(point.x - zero.x, point.y - zero.y) <= OBJECT_SNAP_POINTS
          && preservesSupport(candidate) && canPlace(candidate);
      }) ?? (outsideRoom(after) <= outsideRoom(before) + .00001
        && collisions(after).every((hit, i) => hit.depth <= allowed[i].depth + .00001) ? after : undefined);
    },
    /** Drag previews follow the pointer freely; contact matters only at release. */
    move(id: string, point: RoomPoint) {
      const original = world.objects.find(object => object.instanceId === id);
      if (!original) return undefined;
      const object = placeObjectOnSurface(roomItemAtPoint(original, point, world.width), world.objects, world.width, true);
      return { object, point: roomItemAnchor(object, world.width) };
    },
    /** An invalid drop returns to the saved pose without changing the room. */
    drop(id: string, point: RoomPoint, { zoom = 1, snapInsideWalls = true } = {}) {
      const original = world.objects.find(object => object.instanceId === id);
      if (!original) return undefined;
      const moved = placeObjectOnSurface(roomItemAtPoint(original, point, world.width), world.objects, world.width, true);
      const candidate = placeObjectOnRugs(snapObject(moved, zoom, snapInsideWalls), world.objects);
      const details = feedback(candidate);
      const accepted = details.boundaries.length === 0 && details.blockers.length === 0;
      const object = accepted ? candidate : original;
      return { accepted, object, point: roomItemAnchor(object, world.width), feedback: accepted ? undefined : details };
    },
  };
}
