import { FLOOR_Y, isTabletopLamp, placeLampOnTable, NATIVE_MODEL_CATALOG, ROOM_SPAN, projectWorld, unprojectFloor, type NativeRoomObject, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';
import type { RoomPoint } from '@/utils/room-activities';
import { isCurtainDecorationId } from '@/constants/decoration-motion';

export type RoomPlacementEdge = 'leftWall' | 'backWall' | 'rightEdge' | 'frontEdge' | 'wallBottom' | 'wallTop';
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

export function roomItemAnchor(object: NativeRoomObject, width: number): RoomPoint {
  const center = rotate(NATIVE_MODEL_CATALOG[object.modelId].center, object.heading);
  return projectWorld(center.map((v, i) => v * object.scale + object.position[i]) as Vec3, width);
}

/** Move the model's anchor without changing its saved heading or scale. */
export function roomItemAtPoint(object: NativeRoomObject, point: RoomPoint, width: number): NativeRoomObject {
  const center = rotate(NATIVE_MODEL_CATALOG[object.modelId].center, object.heading)
    .map((v, i) => v * object.scale + object.position[i]) as Vec3;
  const desired = unprojectFloor(point, isTabletopLamp(object.modelId)
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
  return { ...object, position: move(object.position), min: move(object.min), max: move(object.max) };
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
function penetration(a: Box, b: Box): number {
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
    if (overlap <= .005) return 0;
    depth = Math.min(depth, overlap);
  }
  return Math.min(depth, height);
}

/** Cache fixed obstacles once per layout, rather than rebuild the room while dragging. */
export function createRoomPlacementResolver(world: NativeRoomWorld) {
  const obstacles = world.objects.map(object => ({ id: object.instanceId, boxes: boxes(object) }));
  const templates = new Map<string, { object: NativeRoomObject; boxes: Box[] }>();
  const movingBoxes = (object: NativeRoomObject) => {
    const key = `${object.instanceId}:${object.heading}:${object.scale}`;
    let template = templates.get(key);
    if (!template) { template = { object, boxes: boxes(object) }; templates.set(key, template); }
    const origin = template.object.position;
    return template.boxes.map(box => ({ ...box,
      center: box.center.map((v,i) => v + object.position[i] - origin[i]) as Vec3 }));
  };
  const collisions = (object: NativeRoomObject) => {
    const own = movingBoxes(object);
    return obstacles.filter(other => other.id !== object.instanceId).map(other => ({ id: other.id,
      depth: own.reduce((sum, a) => sum + other.boxes.reduce((total, b) => total + penetration(a, b), 0), 0) }));
  };
  const boundaryExcess = (object: NativeRoomObject): { edge: RoomPlacementEdge; depth: number }[] => {
    // Curtains may extend beyond the wall edges or cover other wall fixtures.
    if (isCurtainDecorationId(object.modelId)) return [];
    const floor = object.wallAxis === undefined;
    const footprint = roomItemFootprint(object);
    const axes = floor ? [0, 2] : [object.wallAxis === 0 ? 2 : 0];
    const result: { edge: RoomPlacementEdge; depth: number }[] = [];
    for (const axis of axes) {
      const lo = floor ? Math.min(...footprint.map(p => p[axis])) : object.min[axis];
      const hi = floor ? Math.max(...footprint.map(p => p[axis])) : object.max[axis];
      result.push({ edge: axis === 0 ? 'leftWall' : 'backWall', depth: Math.max(0, (floor ? ROOM_PLACEMENT_MIN : -2.32) - lo) },
        { edge: axis === 0 ? 'rightEdge' : 'frontEdge', depth: Math.max(0, hi - (floor ? ROOM_PLACEMENT_MAX : 2.32)) });
    }
    if (!floor) result.push({ edge: 'wallBottom', depth: Math.max(0, .18-object.min[1]) },
      { edge: 'wallTop', depth: Math.max(0, object.max[1]-2.65) });
    return result;
  };
  const outsideRoom = (object: NativeRoomObject) => boundaryExcess(object).reduce((sum, edge) => sum+edge.depth, 0);
  const canPlace = (object: NativeRoomObject) => outsideRoom(object) <= .00001 && collisions(object).every(hit => hit.depth === 0);
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
      const object = placeLampOnTable(roomItemAtPoint(original, point, world.width), world.objects, world.width);
      return { object, point: roomItemAnchor(object, world.width) };
    },
    /** An invalid drop returns to the saved pose without changing the room. */
    drop(id: string, point: RoomPoint) {
      const original = world.objects.find(object => object.instanceId === id);
      if (!original) return undefined;
      const candidate = placeLampOnTable(roomItemAtPoint(original, point, world.width), world.objects, world.width);
      const details = feedback(candidate);
      const accepted = details.boundaries.length === 0 && details.blockers.length === 0;
      const object = accepted ? candidate : original;
      return { accepted, object, point: roomItemAnchor(object, world.width), feedback: accepted ? undefined : details };
    },
  };
}
