import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

// Bases of the three flame meshes in livingFireplaceCream.glb.
export const FIREPLACE_FLAMES = [
  { node: 'Soft teardrop flame', base: [-.22, .25, .13] as Vec3 },
  { node: 'Soft teardrop flame.001', base: [0, .25, .13] as Vec3 },
  { node: 'Soft teardrop flame.002', base: [.22, .25, .13] as Vec3 },
];

export function fireplaceFlamePose(time: number, index: number, reduceMotion: boolean) {
  'worklet';
  const phase = index * 2.3;
  return reduceMotion ? { width: 1, height: 1, sway: 0 } : {
    width: .94 + .08 * Math.sin(time * 4.7 + phase),
    height: .94 + .15 * Math.sin(time * 5.1 + phase) + .06 * Math.sin(time * 9.7 + phase),
    sway: .035 * Math.sin(time * 3.9 + phase),
  };
}

export function fireplaceFlicker(time: number, reduceMotion: boolean) {
  'worklet';
  return reduceMotion ? 1 : .94 + .04 * Math.sin(time * 5.1) + .02 * Math.sin(time * 9.7 + 1.4);
}

/** Put the warm source at the open face so its light reaches the hearth and room. */
export function fireplaceLightPosition(object: Pick<NativeRoomObject, 'position' | 'heading' | 'scale'>): Vec3 {
  'worklet';
  return [object.position[0] + Math.sin(object.heading) * .36 * object.scale,
    object.position[1] + .46 * object.scale,
    object.position[2] + Math.cos(object.heading) * .36 * object.scale];
}
