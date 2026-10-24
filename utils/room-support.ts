import placementBounds from '@/constants/room-placement-bounds.json';
import catalog from '@/assets/3d/native/catalog.json';
import type { ModelMetadata, NativeRoomObject, Vec3 } from '@/utils/native-room-world';
import type { RoomItemSupport } from '@/types/game';

const metadata = Object.fromEntries(Object.entries(catalog).map(([id, meta]) => [id, { ...meta, ...(placementBounds as Record<string, object>)[id] }])) as unknown as Record<string, ModelMetadata>;
const rotate = (p: Vec3, angle: number): Vec3 => [Math.cos(angle) * p[0] + Math.sin(angle) * p[2], p[1], -Math.sin(angle) * p[0] + Math.cos(angle) * p[2]];

export function roomSupport(object: NativeRoomObject, parent: NativeRoomObject): RoomItemSupport {
  return { parentId: parent.instanceId,
    position: rotate(object.position.map((v, i) => (v - parent.position[i]) / parent.scale) as Vec3, -parent.heading),
    heading: object.heading - parent.heading };
}

export function transformRoomObject(object: NativeRoomObject, position: Vec3, heading = object.heading, scale = object.scale): NativeRoomObject {
  const angle = heading - object.heading;
  const point = (p: Vec3): Vec3 => rotate(p.map((v, i) => (v - object.position[i]) * scale / object.scale) as Vec3, angle).map((v, i) => v + position[i]) as Vec3;
  const bounds = (min: number[], max: number[]) => {
    const corners = [min[0], max[0]].flatMap(x => [min[1], max[1]].flatMap(y => [min[2], max[2]]
      .map(z => rotate([x, y, z], heading).map((v, i) => v * scale + position[i]))));
    return { min: [0, 1, 2].map(i => Math.min(...corners.map(p => p[i]))) as Vec3,
      max: [0, 1, 2].map(i => Math.max(...corners.map(p => p[i]))) as Vec3 };
  };
  const meta = metadata[object.modelId];
  return { ...object, position, heading, scale, ...bounds(meta.min, meta.max),
    collisionBoxes: meta.collisionBoxes?.map(box => bounds(box.min, box.max)),
    interactionBoxes: object.interactionBoxes?.map(box => {
      const corners = [box.min[0], box.max[0]].flatMap(x => [box.min[1], box.max[1]].flatMap(y => [box.min[2], box.max[2]].map(z => point([x, y, z]))));
      return { min: [0, 1, 2].map(i => Math.min(...corners.map(p => p[i]))) as Vec3, max: [0, 1, 2].map(i => Math.max(...corners.map(p => p[i]))) as Vec3 };
    }),
    seat: object.seat && point(object.seat), seatHeading: object.seatHeading === undefined ? undefined : object.seatHeading + angle,
    approach: object.approach && point(object.approach), leaves: object.leaves?.map(point),
    drawer: object.drawer && point(object.drawer), cupboard: object.cupboard && point(object.cupboard),
    bed: object.bed && { surface: point(object.bed.surface), covered: point(object.bed.covered) },
    bathroom: object.bathroom && { ...object.bathroom, contact: point(object.bathroom.contact) } };
}

export function attachRoomObject(object: NativeRoomObject, parent: NativeRoomObject, support: RoomItemSupport) {
  const position = rotate(support.position.map(v => v * parent.scale) as Vec3, parent.heading)
    .map((v, i) => v + parent.position[i]) as Vec3;
  return { ...transformRoomObject(object, position, parent.heading + support.heading), supportId: parent.instanceId, rugLift: undefined };
}

/** Cycle-safe traversal also recognizes legacy surfaces inferred from saved anchors. */
export function roomSupportGroup(objects: NativeRoomObject[], ids: string[]): NativeRoomObject[] {
  const included = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const object of objects) if (object.supportId && included.has(object.supportId) && !included.has(object.instanceId)) {
      included.add(object.instanceId); changed = true;
    }
  }
  return objects.filter(object => included.has(object.instanceId));
}

export function moveRoomSupportGroup(objects: NativeRoomObject[], original: NativeRoomObject, candidate: NativeRoomObject, extraIds: string[] = []) {
  const group = roomSupportGroup(objects, [original.instanceId, ...extraIds]);
  const angle = candidate.heading - original.heading;
  const moved = new Map<string, NativeRoomObject>([[candidate.instanceId, candidate]]);
  for (const object of group) {
    if (object.instanceId === original.instanceId) continue;
    const offset = rotate(object.position.map((v, i) => v - original.position[i]) as Vec3, angle);
    moved.set(object.instanceId, transformRoomObject(object, offset.map((v, i) => v + candidate.position[i]) as Vec3, object.heading + angle));
  }
  const resolved = new Set([candidate.instanceId]), visiting = new Set<string>();
  const resolve = (object: NativeRoomObject): NativeRoomObject => {
    if (resolved.has(object.instanceId) || visiting.has(object.instanceId)) return moved.get(object.instanceId)!;
    visiting.add(object.instanceId);
    const parent = objects.find(parent => parent.instanceId === object.supportId);
    if (parent && moved.has(parent.instanceId)) moved.set(object.instanceId, attachRoomObject(object, resolve(parent), roomSupport(object, parent)));
    visiting.delete(object.instanceId); resolved.add(object.instanceId);
    return moved.get(object.instanceId)!;
  };
  group.forEach(resolve);
  return [...moved.values()];
}

export function restoreRoomSupports(objects: NativeRoomObject[], supports: Map<string, RoomItemSupport>) {
  const resolved = new Map<string, NativeRoomObject>(), visiting = new Set<string>();
  const resolve = (object: NativeRoomObject): NativeRoomObject => {
    if (resolved.has(object.instanceId)) return resolved.get(object.instanceId)!;
    if (visiting.has(object.instanceId)) return object;
    visiting.add(object.instanceId);
    const support = supports.get(object.instanceId);
    const parent = support && objects.find(other => other.instanceId === support.parentId && other.instanceId !== object.instanceId);
    const next = parent && !visiting.has(parent.instanceId) ? attachRoomObject(object, resolve(parent), support!) : object;
    visiting.delete(object.instanceId); resolved.set(object.instanceId, next);
    return next;
  };
  return objects.map(resolve);
}
