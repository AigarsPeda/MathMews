import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

/** Door dimensions in model space, shared by rendering and navigation. */
export function fridgeDoorGeometry(object: Pick<NativeRoomObject, 'modelId' | 'fridgeHingeSide'>) {
  'worklet';
  const retro = object.modelId === 'kitchenFridge';
  const side = object.fridgeHingeSide ?? (retro ? 'right' : 'left');
  const latch = side === 'left' ? 1 : -1;
  return { latch, hingeX: -latch * (retro ? .51 : .585), front: retro ? .46 : .55,
    width: retro ? 1.02 : 1.17, angle: 85 * Math.PI / 180 };
}

/** Distance to the area swept by the door, including intermediate opening poses. */
export function fridgeDoorSweepDistance(point: Vec3, object: NativeRoomObject): number {
  'worklet';
  const door = fridgeDoorGeometry(object);
  const dx = (point[0] - object.position[0]) / object.scale;
  const dz = (point[2] - object.position[2]) / object.scale;
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  const x = (c * dx - s * dz - door.hingeX) * door.latch;
  const z = s * dx + c * dz - door.front;
  const angle = Math.atan2(z, x), radius = Math.hypot(x, z);
  let distance: number;
  if (angle >= 0 && angle <= door.angle) distance = Math.max(0, radius - door.width);
  else {
    // Outside the sector, the nearest point lies on one of its two radial edges.
    const edgeDistance = (a: number) => {
      const u = Math.cos(a), v = Math.sin(a);
      const reach = Math.max(0, Math.min(door.width, x * u + z * v));
      return Math.hypot(x - reach * u, z - reach * v);
    };
    distance = Math.min(edgeDistance(0), edgeDistance(door.angle));
  }
  return Math.max(0, distance - .06) * object.scale;
}

/** Frame-rate independent hinge motion, with no overshoot or idle writes. */
export function advanceFridge(open: number, target: number, dt: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion || Math.abs(target - open) < .001) return target;
  const next = open + (target - open) * (1 - Math.exp(-Math.max(0, Math.min(.067, dt)) * 9));
  return Math.abs(target - next) < .001 ? target : next;
}

export function fridgeLightPose(object: Pick<NativeRoomObject, 'modelId' | 'position' | 'scale' | 'heading'>, heightFraction = .8) {
  'worklet';
  const retro = object.modelId === 'kitchenFridge';
  const height = retro ? .075 + 1.29 * heightFraction : .755 + 1.55 * heightFraction;
  const front = retro ? .57 : .60;
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  const length = Math.hypot(1, .85);
  return {
    position: [object.position[0] + s * front * object.scale,
      object.position[1] + height * object.scale, object.position[2] + c * front * object.scale] as Vec3,
    direction: [s / length, -.85 / length, c / length] as Vec3,
  };
}

export function fridgeLightIntensity(open: number, scale: number): number {
  'worklet';
  // A small opening spills less light into the room than the full doorway.
  const amount = Math.max(0, Math.min(1, open));
  return 650_000 * scale * scale * amount * amount * (3 - 2 * amount);
}
