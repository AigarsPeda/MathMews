import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

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
  // Light escapes as the door separates from its seal, then fills the doorway.
  const amount = Math.max(0, Math.min(1, open * 3));
  return 650_000 * scale * scale * amount * amount * (3 - 2 * amount);
}
