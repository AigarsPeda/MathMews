import type { NativeTravel } from '@/utils/native-room-world';

export type BathroomMotion = { lid: number; time: number; surfaceTime: number; runningWater: boolean };
export const STILL_BATHROOM_MOTION: BathroomMotion = { lid: 0, time: 0, surfaceTime: 0, runningWater: false };

/** Each furnishing reacts only to its own command. Covered scenes keep their
 * pose; Reduce Motion snaps the lid and shows a stationary water stream. */
export function advanceBathroomMotion(previous: BathroomMotion, instanceId: string,
  activity: NativeTravel['bathroom'], dt: number, active: boolean, reduceMotion: boolean): BathroomMotion {
  'worklet';
  const current = activity?.instanceId === instanceId ? activity : undefined;
  const open = current?.kind === 'toilet' && ['open', 'enter', 'use', 'exit'].includes(current.phase);
  const target = open ? 1.48 : 0;
  const runningWater = !!current && current.kind !== 'toilet' && current.phase === 'wash';
  const delta = active && !reduceMotion ? Math.max(0, Math.min(1 / 15, dt)) : 0;
  const lid = reduceMotion ? target : previous.lid + (target - previous.lid) * (1 - Math.exp(-delta * 12));
  return { lid, runningWater, time: runningWater ? previous.time + delta : 0,
    surfaceTime: previous.surfaceTime + delta };
}

/** Local surface details stay inside the basin, including at their widest. */
export function bathWaterDetailPose(index: number, time: number, ripple: boolean) {
  'worklet';
  if (ripple) {
    const phase = (time * .42 + index / 3) % 1;
    return { scale: .25 + .9 * phase, x: 0, z: 0,
      opacity: .48 * Math.sin(Math.PI * phase) ** 2 };
  }
  const phase = time * .85 + index * 1.7;
  return { scale: .94 + .06 * Math.sin(phase), x: .018 * Math.sin(phase * .7),
    z: .012 * Math.cos(phase), opacity: .23 + .10 * Math.sin(phase) };
}
