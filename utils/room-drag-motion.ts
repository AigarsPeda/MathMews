import { ROOM_SPAN, type NativeRoomObject, type Vec3 } from '@/utils/native-room-world';
import type { RoomPoint } from '@/utils/room-activities';

export type RoomDragMotion = { session: number; sequence: number; x: number; y: number; active: boolean; moved: boolean; at: number; measure: boolean; released?: boolean };
export const IDLE_ROOM_DRAG: RoomDragMotion = { session: 0, sequence: 0, x: 0, y: 0, active: false, moved: false, at: 0, measure: false };
export type RoomDragBase = {
  session: number; version: number; x: number; y: number; width: number; anchor: RoomPoint; object: NativeRoomObject;
};

/** Detach Worklets Core host-object proxies before handing a prior preview to Reanimated. */
export function snapshotRoomDragObject(object: NativeRoomObject): NativeRoomObject {
  // Room objects contain only serializable model data. This runs once on capture,
  // never in the pointer/frame path, and includes nested support-group geometry.
  return JSON.parse(JSON.stringify(object));
}

/** Inverse of the room projection at a fixed floor height or wall plane. */
export function roomDragDelta(dx: number, dy: number, width: number, wallAxis?: 0 | 2): Vec3 {
  'worklet';
  const pixels = Math.max(1, width) / ROOM_SPAN;
  const diagonal = Math.SQRT1_2, elevation = 6.1 / Math.hypot(8, 8, 6.1), vertical = Math.sqrt(1 - elevation * elevation);
  const difference = dx / (diagonal * pixels);
  if (wallAxis === 0) return [0, (-elevation * difference * diagonal - dy / pixels) / vertical, -difference];
  if (wallAxis === 2) return [difference, (elevation * difference * diagonal - dy / pixels) / vertical, 0];
  const sum = dy / (elevation * diagonal * pixels);
  return [(sum + difference) / 2, 0, (sum - difference) / 2];
}

/** Only pose/bounds move here. Collision and support resolution stay on the JS feedback path. */
export type RoomDragPreview = NativeRoomObject & { releaseSession?: number; dragSample?: { session: number; sequence: number; inputAt: number; phase: 'move' | 'release' } };
export function roomDragPreview(base: RoomDragBase, motion: RoomDragMotion): RoomDragPreview | undefined {
  'worklet';
  if (!motion.active || motion.released || motion.session !== base.session || !motion.moved) return undefined;
  const delta = roomDragDelta(motion.x - base.x, motion.y - base.y, base.width, base.object.wallAxis);
  const shift = (object: NativeRoomObject): NativeRoomObject => {
    const move = (p: Vec3): Vec3 => [p[0] + delta[0], p[1] + delta[1], p[2] + delta[2]];
    return { ...object, position: move(object.position), min: move(object.min), max: move(object.max) };
  };
  return { ...shift(base.object), dragSample: motion.measure ? { session: motion.session, sequence: motion.sequence, inputAt: motion.at, phase: 'move' } : undefined, editingChildren: base.object.editingChildren?.map(shift) };
}

export function roomDragAnchor(base: RoomDragBase | undefined, motion: RoomDragMotion, fallback: RoomPoint): RoomPoint {
  'worklet';
  return base && motion.active && base.session === motion.session
    ? { x: base.anchor.x + (motion.moved ? motion.x - base.x : 0),
      y: base.anchor.y + (motion.moved ? motion.y - base.y : 0) } : fallback;
}
