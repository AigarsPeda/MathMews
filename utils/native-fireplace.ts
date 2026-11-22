import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

// Roots of the amber back row and the two golden tongues above the logs.
export const FIREPLACE_FLAMES = [
  { node: 'Soft teardrop flame', base: [-.205, .25, .13] as Vec3 },
  { node: 'Soft teardrop flame.001', base: [0, .25, .13] as Vec3 },
  { node: 'Soft teardrop flame.002', base: [.21, .25, .13] as Vec3 },
  { node: 'Soft teardrop flame.003', base: [-.115, .25, .203] as Vec3 },
  { node: 'Soft teardrop flame.004', base: [.115, .25, .208] as Vec3 },
];

export function fireplaceFlamePose(time: number, index: number, reduceMotion: boolean) {
  'worklet';
  if (reduceMotion) return { width: 1, height: 1, sway: 0, emission: 1 };
  const phase = 2.17 * index;
  const draft = Math.sin(1.75 * time + .65 * Math.sin(.83 * time));
  const rise = Math.sin(time * (4.2 + .36 * index) + phase + .8 * Math.sin(2.3 * time + phase));
  const tip = Math.sin(8.6 * time + 1.4 * rise + phase);
  return {
    width: 1 - .095 * rise + .035 * tip,
    height: .97 + .17 * rise + .055 * tip + .045 * draft,
    sway: .095 * draft + .085 * Math.sin(3.4 * time + phase) + .025 * tip,
    emission: .99 + .13 * rise + .065 * draft,
  };
}

/** Keep the source among the flames, behind the grate, as the fire leans. */
export function fireplaceLightPosition(object: Pick<NativeRoomObject, 'position' | 'heading' | 'scale'>, drift = 0, rise = 0): Vec3 {
  'worklet';
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  return [object.position[0] + (drift * c + .19 * s) * object.scale,
    object.position[1] + (.43 + rise) * object.scale,
    object.position[2] + (.19 * c - drift * s) * object.scale];
}
