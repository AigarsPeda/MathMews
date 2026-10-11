import { FLOOR_Y, isSurfacePlaceable, placeObjectOnSurface, nativeWallPlacementBounds, NATIVE_MODEL_CATALOG, ROOM_SPAN, projectWorld, unprojectFloor, type NativeRoomObject, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';
import type { RoomPoint } from '@/utils/room-activities';
import { isCurtainDecorationId } from '@/constants/decoration-motion';
import { WALL_MOUNT_PLANE, WALL_PLACEMENT_MIN, WALL_PLACEMENT_MAX, WALL_PLACEMENT_BOTTOM, WALL_PLACEMENT_TOP } from '@/constants/room-geometry';
import { MODERN_KITCHEN_COUNTER_IDS, MODERN_KITCHEN_FLOOR_SHELF_IDS, MODERN_KITCHEN_SINK_IDS, MODERN_KITCHEN_INDUCTION_IDS, MODERN_KITCHEN_FRIDGE_IDS } from '@/constants/modern-kitchen';

export type RoomPlacementEdge = 'leftWall' | 'backWall' | 'rightEdge' | 'frontEdge' | 'wallStart' | 'wallEnd' | 'wallBottom' | 'wallTop';
export type RoomPlacementFeedback = {
  candidate: NativeRoomObject;
  blockers: { instanceId: string; boxes: Vec3[][] }[];
  boundaries: RoomPlacementEdge[];
};
// Shipped room meshes: skirting inner faces and the flat floor before its bevel.
export const ROOM_PLACEMENT_MIN = -2.3075;
export const ROOM_PLACEMENT_MAX = 2.46;

type Box = { center: Vec3; half: Vec3; cos: number; sin: number };
const rotate = (point: number[], angle: number): Vec3 => [Math.cos(angle) * point[0] + Math.sin(angle) * point[2], point[1], -Math.sin(angle) * point[0] + Math.cos(angle) * point[2]];
const kitchenUnits = new Set<string>([...MODERN_KITCHEN_COUNTER_IDS, ...MODERN_KITCHEN_FLOOR_SHELF_IDS, ...MODERN_KITCHEN_SINK_IDS, ...MODERN_KITCHEN_INDUCTION_IDS, ...MODERN_KITCHEN_FRIDGE_IDS]);
const KITCHEN_SNAP_DISTANCE = .12;
const WALL_SNAP_POINTS = 10;
const OBJECT_SNAP_POINTS = 10;

function translateObject(object: NativeRoomObject, delta: Vec3): NativeRoomObject {
  const move = (value: Vec3) => value.map((v, i) => v + delta[i]) as Vec3;
  return { ...object, position: move(object.position), min: move(object.min), max: move(object.max),
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
  const x = ROOM_PLACEMENT_MIN - Math.min(...footprint.map(p => p[0]));
  const z = ROOM_PLACEMENT_MIN - Math.min(...footprint.map(p => p[2]));
  const nearX = near([x, 0, 0], -x), nearZ = near([0, 0, z], -z);
  const shifts: Vec3[] = [];
  // Correct both axes first; a single-wall correction can still cross the other.
  if (nearX && nearZ) shifts.push([x, 0, z]);
  if (nearX) shifts.push([x, 0, 0]);
  if (nearZ) shifts.push([0, 0, z]);
  return shifts.map(delta => translateObject(object, delta));
}

/** Match actual cabinet edges, rather than the differently framed sprite anchors. */
function kitchenJoinCandidates(object: NativeRoomObject, world: NativeRoomWorld): NativeRoomObject[] {
  if (!kitchenUnits.has(object.modelId)) return [];
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  const origin = rotate(object.position, -object.heading);
  const back = origin[2] + meta.min[2] * object.scale;
  const shifts: { x: number; z: number; distance: number }[] = [];
  for (const other of world.objects) {
    if (other.instanceId === object.instanceId || !kitchenUnits.has(other.modelId)
      || Math.abs(Math.sin((other.heading - object.heading) / 2)) > .00001) continue;
    const otherMeta = NATIVE_MODEL_CATALOG[other.modelId];
    const otherOrigin = rotate(other.position, -object.heading);
    const z = otherOrigin[2] + otherMeta.min[2] * other.scale - back;
    if (Math.abs(z) > KITCHEN_SNAP_DISTANCE) continue;
    for (const side of [-1, 1]) {
      const x = otherOrigin[0] + (side < 0 ? otherMeta.min[0] : otherMeta.max[0]) * other.scale
        - origin[0] - (side < 0 ? meta.max[0] : meta.min[0]) * object.scale;
      if (Math.abs(x) <= KITCHEN_SNAP_DISTANCE) shifts.push({ x, z, distance: Math.hypot(x, z) });
    }
  }
  shifts.sort((a, b) => a.distance - b.distance);
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
  return { ...object, supportId: undefined, position: move(object.position), min: move(object.min), max: move(object.max),
    collisionBoxes: object.collisionBoxes?.map(box => ({ min: move(box.min), max: move(box.max) })) };
}

function boxes(object: NativeRoomObject): Box[] {
  if (object.collidable === false) return [];
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  return (meta.collisionBoxes ?? [{ min: meta.min, max: meta.max }]).map(box => {
    const center = rotate(box.min.map((v, i) => (v + box.max[i]) / 2), object.heading);
    return { center: center.map((v, i) => v * object.scale + object.position[i]) as Vec3,
      half: box.min.map((v, i) => (box.max[i] - v) * object.scale / 2) as Vec3,
      cos: Math.cos(object.heading), sin: Math.sin(object.heading) };
  });
}

/** Actual mesh silhouette on the floor, rather than rotated bounding-box corners. */
export function roomItemFootprint(object: NativeRoomObject): Vec3[] {
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
export function roomItemPlacementOutline(object: NativeRoomObject): Vec3[][] {
  return boxes(object).map(boxCorners);
}

/** Separating-axis test for rotated footprints, with a separate vertical span. */
function penetration(a: Box, b: Box, tolerance = .005, planarDepth = false): number {
  // Broad phase rejects distant boxes before the rotated separating-axis test.
  const dx = a.center[0] - b.center[0], dz = a.center[2] - b.center[2];
  if (Math.abs(dx) >= a.half[0]*Math.abs(a.cos)+a.half[2]*Math.abs(a.sin)+b.half[0]*Math.abs(b.cos)+b.half[2]*Math.abs(b.sin)
    || Math.abs(dz) >= a.half[0]*Math.abs(a.sin)+a.half[2]*Math.abs(a.cos)+b.half[0]*Math.abs(b.sin)+b.half[2]*Math.abs(b.cos)) return 0;
  const height = a.half[1] + b.half[1] - Math.abs(a.center[1] - b.center[1]);
  if (height <= .005) return 0;
  let depth = Infinity;
  for (const box of [a, b]) for (const turn of [false, true]) {
    const x = turn ? box.sin : box.cos, z = turn ? box.cos : -box.sin;
    const extent = (box: Box) => box.half[0] * Math.abs(x * box.cos - z * box.sin)
      + box.half[2] * Math.abs(x * box.sin + z * box.cos);
    const overlap = extent(a) + extent(b) - Math.abs(x * dx + z * dz);
    if (overlap <= tolerance) return 0;
    depth = Math.min(depth, overlap);
  }
  return planarDepth ? depth : Math.min(depth, height);
}

const boxAxes = (box: Box): Vec3[] => [[box.cos, 0, -box.sin], [box.sin, 0, box.cos], [0, 1, 0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const extent = (box: Box, axis: Vec3) => box.half[0] * Math.abs(axis[0] * box.cos - axis[2] * box.sin)
  + box.half[2] * Math.abs(axis[0] * box.sin + axis[2] * box.cos) + box.half[1] * Math.abs(axis[1]);

/** First contact along a direction, including rotated faces and corner contact.
 * Intersect the overlap intervals on every separating axis, then take the
 * nearest endpoint. Never jump through a neighbor to its opposite side. */
function contactShift(a: Box, b: Box, direction: Vec3): Vec3 | undefined {
  let lo = -Infinity, hi = Infinity;
  const relative = a.center.map((v, i) => v - b.center[i]) as Vec3;
  for (const axis of [...boxAxes(a), ...boxAxes(b).slice(0, 2)]) {
    const radius = extent(a, axis) + extent(b, axis), offset = dot(relative, axis), speed = dot(direction, axis);
    if (Math.abs(speed) < .00001) {
      if (Math.abs(offset) > radius + .00001) return undefined;
      continue;
    }
    const first = (-radius - offset) / speed, last = (radius - offset) / speed;
    lo = Math.max(lo, Math.min(first, last)); hi = Math.min(hi, Math.max(first, last));
    if (lo > hi + .00001) return undefined;
  }
  const distance = Math.abs(lo) < Math.abs(hi) ? lo : hi;
  return direction.map(v => v * distance) as Vec3;
}

/** Nearest edge/vertex direction fills diagonal gaps between disjoint boxes. */
function closestBoxDirection(a: Box, b: Box): Vec3 | undefined {
  const first = boxCorners(a).slice(0, 4), second = boxCorners(b).slice(0, 4);
  let nearest: Vec3 | undefined, distance = Infinity;
  for (const [vertices, edges, sign] of [[first, second, 1], [second, first, -1]] as const) {
    for (const vertex of vertices) for (let i = 0; i < 4; i++) {
      const start = edges[i], end = edges[(i + 1) % 4];
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

/** Cache fixed obstacles once per layout, rather than rebuild the room while dragging. */
export function createRoomPlacementResolver(world: NativeRoomWorld) {
  const obstacles = world.objects.map(object => ({ id: object.instanceId, object, boxes: boxes(object) }));
  const templates = new Map<string, { object: NativeRoomObject; boxes: Box[] }>();
  const movingBoxes = (object: NativeRoomObject) => {
    const key = `${object.instanceId}:${object.heading}:${object.scale}`;
    let template = templates.get(key);
    if (!template) { template = { object, boxes: boxes(object) }; templates.set(key, template); }
    const origin = template.object.position;
    return template.boxes.map(box => ({ ...box,
      center: box.center.map((v,i) => v + object.position[i] - origin[i]) as Vec3 }));
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
  const canPlace = (object: NativeRoomObject) => outsideRoom(object) <= .00001 && collisions(object).every(hit => hit.depth === 0);
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
    const own = movingBoxes(object);
    for (const other of obstacles) {
      if (other.id === object.instanceId || other.id === object.supportId || isCurtainDecorationId(other.object.modelId)) continue;
      // A nearby edge may slightly overlap after an imprecise release. A drop
      // into the middle of another item has no clear contact intent.
      const axes = object.wallAxis === undefined ? [0, 2] : [object.wallAxis === 0 ? 2 : 0, 1];
      const shallow = .5 * Math.min(...axes.flatMap(axis => [object.max[axis] - object.min[axis], other.object.max[axis] - other.object.min[axis]]));
      if (own.some(a => other.boxes.some(b => penetration(a, b, .005, true) > shallow))) continue;
      for (const a of own) for (const b of other.boxes) {
        const height = a.half[1] + b.half[1] - Math.abs(a.center[1] - b.center[1]);
        if (object.wallAxis === undefined ? height <= .005 : height < -reach) continue;
        if (Math.abs(a.center[0] - b.center[0]) > extent(a, [1, 0, 0]) + extent(b, [1, 0, 0]) + reach
          || Math.abs(a.center[2] - b.center[2]) > extent(a, [0, 0, 1]) + extent(b, [0, 0, 1]) + reach) continue;
        const overlapping = penetration(a, b) > 0;
        if (!snapGaps && !overlapping) continue;
        const axes = constrained ? directions : [...boxAxes(a).slice(0, 2), ...boxAxes(b).slice(0, 2)];
        if (!constrained && !overlapping) {
          const diagonal = closestBoxDirection(a, b);
          if (diagonal) axes.push(diagonal);
        }
        for (const direction of axes) {
          const delta = contactShift(a, b, direction);
          if (!delta) continue;
          const point = projectWorld(delta, world.width);
          const distance = Math.hypot(point.x - zero.x, point.y - zero.y) * zoom;
          if (distance > OBJECT_SNAP_POINTS || distance < .00001) continue;
          const key = delta.map(v => v.toFixed(5)).join(':');
          if (!shifts.has(key)) shifts.set(key, { delta, distance });
        }
      }
    }
    return [...shifts.values()].sort((a, b) => a.distance - b.distance).map(({ delta }) => translateObject(object, delta));
  };
  const feedback = (candidate: NativeRoomObject): RoomPlacementFeedback => {
    const own = movingBoxes(candidate);
    return { candidate, boundaries: boundaryExcess(candidate).filter(edge => edge.depth > .00001).map(edge => edge.edge),
      blockers: obstacles.filter(other => other.id !== candidate.instanceId).flatMap(other => {
        const hits = other.boxes.filter(b => own.some(a => penetration(a,b)>0));
        return hits.length ? [{instanceId:other.id,boxes:hits.map(boxCorners)}] : [];
      }) };
  };
  return {
    canPlace,
    /** New items use the nearest empty spot instead of overlapping furniture. */
    nearestFree(object: NativeRoomObject) {
      if (canPlace(object)) return object;
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
        if (Math.abs(point.x) > (world.width - size) / 2 || Math.abs(point.y) > (world.height - size) / 2) continue;
        const candidate = roomItemAtPoint(object, point, world.width);
        if (canPlace(candidate)) return candidate;
      }
      return undefined;
    },
    canChange(before: NativeRoomObject, after: NativeRoomObject) {
      const allowed = collisions(before);
      return outsideRoom(after) <= outsideRoom(before) + .00001
        && collisions(after).every((hit, i) => hit.depth <= allowed[i].depth + .00001);
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
      const wallCandidates = wallSnapCandidates(moved, world, zoom, snapInsideWalls);
      const joins = (object: NativeRoomObject) => snapInsideWalls || !canPlace(object) ? kitchenJoinCandidates(object, world) : [];
      // Neighbor alignment must not pull a unit away from a nearby wall. Also
      // try joins from the corrected pose, for runs of touching kitchen modules.
      const candidates = wallCandidates.flatMap(object => {
        const footprint = roomItemFootprint(object);
        const contacts = [0, 2].filter(axis => Math.abs(Math.min(...footprint.map(p => p[axis])) - ROOM_PLACEMENT_MIN) < .00001);
        return [...joins(object).filter(joined => contacts.every(axis =>
          Math.abs(joined.position[axis] - object.position[axis]) < .00001)), ...objectSnapCandidates(object, zoom, snapInsideWalls), object];
      });
      candidates.push(...joins(moved), ...objectSnapCandidates(moved, zoom, snapInsideWalls));
      const candidate = candidates.find(object => preservesSupport(object) && outsideRoom(object) <= .00001
        && collisions(object, .00001).every(hit => hit.depth === 0)) ?? moved;
      const details = feedback(candidate);
      const accepted = details.boundaries.length === 0 && details.blockers.length === 0;
      const object = accepted ? candidate : original;
      return { accepted, object, point: roomItemAnchor(object, world.width), feedback: accepted ? undefined : details };
    },
  };
}
