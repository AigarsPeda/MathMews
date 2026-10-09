import type { NativeTravel } from '@/utils/native-room-world';

export type BathroomMotion = { lid: number; time: number; runningWater: boolean };
export const STILL_BATHROOM_MOTION: BathroomMotion = { lid: 0, time: 0, runningWater: false };

/** Each furnishing reacts only to its own command. Covered scenes keep their
 * pose; Reduce Motion snaps the lid and shows a stationary water stream. */
export function advanceBathroomMotion(previous: BathroomMotion, instanceId: string,
  activity: NativeTravel['bathroom'], dt: number, active: boolean, reduceMotion: boolean): BathroomMotion {
  'worklet';
  const current = activity?.instanceId === instanceId ? activity : undefined;
  const open = current?.kind === 'toilet' && ['open', 'enter', 'use', 'exit'].includes(current.phase);
  const target = open ? 1.48 : 0;
  const runningWater = !!current && current.kind !== 'toilet' && current.phase === 'wash';
  const delta = active ? Math.max(0, Math.min(1 / 15, dt)) : 0;
  const lid = reduceMotion ? target : previous.lid + (target - previous.lid) * (1 - Math.exp(-delta * 12));
  return { lid, runningWater, time: runningWater ? previous.time + delta : 0 };
}
