import specs from '@/constants/cat-gaits.json';
import type { Vec3 } from '@/utils/native-room-world';

export type CatGait = keyof typeof specs;
export const CAT_GAITS = specs;

/** A lively destination justifies speed only when the journey has room for it. */
export function catJourneyGait(kind: string, distance: number, scale: number): CatGait {
  const lengths = distance / Math.max(.001, scale);
  if (lengths < 2 || /Sleep|Snuggle|Nap|returnHome/.test(kind)) return 'walk';
  if (lengths >= 4 && ['mouseChase', 'featherChase', 'ballToss', 'yarnRoll', 'toyPlay'].includes(kind)) return 'run';
  return 'trot';
}

/** Hysteresis keeps acceleration and braking from flickering between clips. */
export function catSpeedGait(speed: number, previous: CatGait, maximum: CatGait): CatGait {
  'worklet';
  if (maximum === 'walk') return 'walk';
  if (maximum === 'run' && speed > (previous === 'run' ? 3.25 : 3.85)) return 'run';
  return speed > (previous === 'walk' ? 2.25 : 1.95) ? 'trot' : 'walk';
}

/** Keep a low authored paw planted through blends; release once its swing lifts.
 * Coordinates are above the room support, so rugs and platforms can lift the
 * complete pose afterward without accumulating height in the saved contact. */
export function catGaitContact(animated: Vec3, anchor: Vec3 | undefined, ground: number, scale: number): Vec3 | undefined {
  'worklet';
  if (animated[1] > ground + .008 * scale) return undefined;
  if (anchor) return anchor;
  return animated[1] <= ground + .003 * scale ? [animated[0], ground, animated[2]] : undefined;
}

/** A short adjustment step reconciles different footfall patterns while speeding
 * up. Lift before advancing the paw instead of dragging an overextended foot. */
export function catGaitSwing(from: Vec3, to: Vec3, elapsed: number, scale: number): Vec3 {
  'worklet';
  const t = Math.max(0,Math.min(1,elapsed/.14)), blend=t*t*(3-2*t);
  return [from[0]+(to[0]-from[0])*blend,
    from[1]+(to[1]-from[1])*blend+.065*scale*Math.sin(Math.PI*t)**2,
    from[2]+(to[2]-from[2])*blend];
}
