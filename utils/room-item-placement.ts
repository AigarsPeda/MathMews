import { NATIVE_MODEL_CATALOG, ROOM_SPAN, projectWorld, unprojectFloor, type NativeRoomObject, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';
import type { RoomPoint } from '@/utils/room-activities';
import { isCurtainDecorationId } from '@/constants/decoration-motion';

type Box = { center: Vec3; half: Vec3; heading: number };
const rotate = (point: number[], angle: number): Vec3 => [Math.cos(angle) * point[0] + Math.sin(angle) * point[2], point[1], -Math.sin(angle) * point[0] + Math.cos(angle) * point[2]];

export function roomItemAnchor(object: NativeRoomObject, width: number): RoomPoint {
  const center = rotate(NATIVE_MODEL_CATALOG[object.modelId].center, object.heading);
  return projectWorld(center.map((v, i) => v * object.scale + object.position[i]) as Vec3, width);
}

/** Move the model's anchor without changing its saved heading or scale. */
export function roomItemAtPoint(object: NativeRoomObject, point: RoomPoint, width: number): NativeRoomObject {
  const center = rotate(NATIVE_MODEL_CATALOG[object.modelId].center, object.heading)
    .map((v, i) => v * object.scale + object.position[i]) as Vec3;
  const desired = unprojectFloor(point, center[1], width);
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
      half: box.min.map((v, i) => (box.max[i] - v) * object.scale / 2) as Vec3, heading: object.heading };
  });
}

/** Separating-axis test for rotated footprints, with a separate vertical span. */
function penetration(a: Box, b: Box): number {
  const height = a.half[1] + b.half[1] - Math.abs(a.center[1] - b.center[1]);
  if (height <= .005) return 0;
  let depth = Infinity;
  for (const heading of [a.heading, b.heading]) for (const turn of [0, Math.PI / 2]) {
    const x = Math.cos(heading + turn), z = -Math.sin(heading + turn);
    const extent = (box: Box) => box.half[0] * Math.abs(x * Math.cos(box.heading) - z * Math.sin(box.heading))
      + box.half[2] * Math.abs(x * Math.sin(box.heading) + z * Math.cos(box.heading));
    const overlap = extent(a) + extent(b) - Math.abs(x * (a.center[0] - b.center[0]) + z * (a.center[2] - b.center[2]));
    if (overlap <= .005) return 0;
    depth = Math.min(depth, overlap);
  }
  return Math.min(depth, height);
}

/** Cache fixed obstacles once per layout, rather than rebuild the room while dragging. */
export function createRoomPlacementResolver(world: NativeRoomWorld) {
  const obstacles = world.objects.map(object => ({ id: object.instanceId, boxes: boxes(object) }));
  const collisions = (object: NativeRoomObject) => {
    const own = boxes(object);
    return obstacles.filter(other => other.id !== object.instanceId).map(other => ({ id: other.id,
      depth: own.reduce((sum, a) => sum + other.boxes.reduce((total, b) => total + penetration(a, b), 0), 0) }));
  };
  const outsideRoom = (object: NativeRoomObject) => {
    // Curtains may extend beyond the wall edges or cover other wall fixtures.
    if (isCurtainDecorationId(object.modelId)) return 0;
    const axes = object.wallAxis === undefined ? [0, 2] : [object.wallAxis === 0 ? 2 : 0];
    return axes.reduce((sum, axis) => sum + Math.max(0, -2.32 - object.min[axis]) + Math.max(0, object.max[axis] - 2.32), 0)
      + (object.wallAxis === undefined ? 0 : Math.max(0, .18 - object.min[1]) + Math.max(0, object.max[1] - 2.65));
  };
  const canPlace = (object: NativeRoomObject) => outsideRoom(object) <= .00001 && collisions(object).every(hit => hit.depth === 0);
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
    move(id: string, point: RoomPoint, previous?: NativeRoomObject) {
      const original = world.objects.find(object => object.instanceId === id);
      if (!original) return undefined;
      let accepted = previous?.instanceId === id ? previous : original;
      const start = roomItemAnchor(accepted, world.width);
      const target = roomItemAtPoint(original, point, world.width);
      const distance = Math.hypot(...target.position.map((v, i) => v - accepted.position[i]));
      const steps = Math.min(160, Math.max(1, Math.ceil(distance / .035)));
      // Legacy overlaps may be pulled apart, but cannot deepen or hit new objects.
      let allowed = collisions(accepted), boundary = outsideRoom(accepted);
      for (let i = 1; i <= steps; i++) {
        const fraction = i / steps;
        const candidate = roomItemAtPoint(original, { x: start.x + (point.x - start.x) * fraction,
          y: start.y + (point.y - start.y) * fraction }, world.width);
        const hits = collisions(candidate);
        const outside = outsideRoom(candidate);
        if (outside > boundary + .00001 || hits.some((hit, j) => hit.depth > allowed[j].depth + .00001)) break;
        accepted = candidate; allowed = hits; boundary = outside;
      }
      return { object: accepted, point: roomItemAnchor(accepted, world.width) };
    },
  };
}
