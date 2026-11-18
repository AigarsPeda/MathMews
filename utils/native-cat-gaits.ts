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

/** Match the incoming stride to the pads already on the floor. Walk, trot and
 * run give each leg a different phase, even at the same point in a cycle. */
export function matchCatGaitPhase(gait: CatGait, previousPhase: number, paws: { forward: number; grounded: boolean }[]) {
  'worklet';
  const spec = CAT_GAITS[gait];
  let best = previousPhase, lowest = Infinity;
  for (let frame = 0; frame < 24; frame++) {
    const phase = previousPhase + frame / 24;
    let error = 0;
    for (let i = 0; i < paws.length; i++) {
      const step = ((phase - spec.offsets[i]) % 1 + 1) % 1;
      const swing = Math.max(0, (step - spec.stance) / (1 - spec.stance));
      const advance = swing ** 3 * (10 - 15 * swing + 6 * swing * swing);
      const forward = spec.stride * (spec.stance / 2 - step + advance);
      const lift = 16 * swing * swing * (1 - swing) ** 2;
      error += (forward - paws[i].forward) ** 2 * (paws[i].grounded ? 3 : 1)
        + (paws[i].grounded ? .055 * lift : 0);
    }
    if (error < lowest) { lowest = error; best = phase; }
  }
  return best;
}

/** Keep a low authored paw planted through blends; release once its swing lifts.
 * Coordinates are above the room support, so rugs and platforms can lift the
 * complete pose afterward without accumulating height in the saved contact. */
export function catGaitContact(animated: Vec3, anchor: Vec3 | undefined, ground: number, scale: number): Vec3 | undefined {
  'worklet';
  // Release at the beginning of the authored lift. A 0.008-unit dead band
  // held the paw into its acceleration and then released it with a jerk.
  if (animated[1] > ground + .0015 * scale) return undefined;
  if (anchor) return anchor;
  return animated[1] <= ground + .001 * scale ? [animated[0], ground, animated[2]] : undefined;
}

/** A short adjustment step reconciles different footfall patterns while speeding
 * up. Lift before advancing the paw instead of dragging an overextended foot. */
export function catGaitSwing(from: Vec3, to: Vec3, elapsed: number, scale: number, release?: { offset: Vec3; duration: number }, clearance?: number): Vec3 {
  'worklet';
  const t = Math.max(0,Math.min(1,elapsed/(release?.duration??.14))), blend=t*t*(3-2*t);
  // A naturally lifting paw already has an authored arc and ankle roll. Carry
  // its contact discrepancy into that swing without adding a second hop.
  if(release)return to.map((value,index)=>value+release.offset[index]*(1-blend)) as Vec3;
  const lift=Math.min(.065,.03+.16*Math.hypot(to[0]-from[0],to[2]-from[2])/scale);
  return [from[0]+(to[0]-from[0])*blend,
    from[1]+(to[1]-from[1])*blend+lift*scale*(clearance === undefined ? Math.sin(Math.PI*t)**2 : blend*clearance),
    from[2]+(to[2]-from[2])*blend];
}

/** Spread the walk's concentrated quintic swing slightly across its airborne
 * interval. End position and stance velocity are unchanged, including the
 * second swing after a launch. The correction is zero throughout support. */
export function catWalkSwingOffset(phase: number, paw: number) {
  'worklet';
  const gait=((phase-CAT_GAITS.walk.offsets[paw])%1+1)%1;
  if(gait<=.6)return 0;
  const t=(gait-.6)/.4,quintic=t*t*t*(10-15*t+6*t*t),cubic=t*t*(3-2*t);
  return .8*.4*(cubic-quintic);
}
