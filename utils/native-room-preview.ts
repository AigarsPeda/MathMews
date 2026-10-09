import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

/** Copy live shared properties before passing numbers to native transforms. */
export function nativeRoomPreview(value: NativeRoomObject | undefined, instanceId: string) {
  'worklet';
  if (!value || value.instanceId !== instanceId) return undefined;
  const scale = value.scale, heading = value.heading, point = value.position;
  if (!point) return undefined;
  const position: Vec3 = [point[0], point[1], point[2]];
  if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(heading) || !position.every(Number.isFinite)) return undefined;
  return { scale, heading, position };
}
