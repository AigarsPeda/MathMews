import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

/** Worklets Core values are mutable drawing-thread mailboxes, not React state. */
export function setRoomPreview(shared: { value: NativeRoomObject | undefined }, object: NativeRoomObject | undefined) {
  shared.value = object && { ...object, position: [...object.position], min: [...object.min], max: [...object.max] };
}

let previewResetSequence = 0;
/** An intentional clear releases the last native pose; a delayed mailbox read does not. */
export function resetRoomPreview(shared: { value: NativeRoomObject | undefined }, reset: { value: number }) {
  shared.value = undefined;
  reset.value = ++previewResetSequence;
}

/** Copy live shared properties before passing numbers to native transforms. */
export function nativeRoomPreview(value: NativeRoomObject | undefined, instanceId: string) {
  'worklet';
  if (value && value.instanceId !== instanceId) value = value.editingChildren?.find(child => child.instanceId === instanceId);
  if (!value) return undefined;
  const scale = value.scale, heading = value.heading, point = value.position;
  if (!point) return undefined;
  const position: Vec3 = [point[0], point[1], point[2]];
  if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(heading) || !position.every(Number.isFinite)) return undefined;
  return { scale, heading, position };
}

/** The saved scene may trail a drawing-thread drag by one React commit. */
export function nativeRoomPoseMatches(object: NativeRoomObject, applied: number[]) {
  'worklet';
  return applied.length === 5 && Math.abs(object.scale - applied[0]) < .001
    && Math.abs(object.heading - applied[1]) < .001
    && Math.hypot(object.position[0] - applied[2], object.position[1] - applied[3], object.position[2] - applied[4]) < .01;
}
