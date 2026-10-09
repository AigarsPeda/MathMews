import type { NativeTravel, Vec3 } from '@/utils/native-room-world';

export type RockingChair = {
  instanceId: string;
  pivot: Vec3;
  axis: Vec3;
  seat: Vec3;
  scale: number;
  leaving?: boolean;
};
export type RockingMotion = { chair?: RockingChair; time: number; weight: number; angle: number; lift: number };
export const STILL_ROCKING_MOTION: RockingMotion = { time: 0, weight: 0, angle: 0, lift: 0 };
// Lower edge of the shipped GLB runners, in local [Z, Y]. Keeping the lowest
// rotated point at its original height lets the curved runners roll on the floor.
const RUNNER_PROFILE = [
  [-.773534,.149399],[-.611485,.089278],[-.585866,.079896],[-.559492,.070783],[-.531974,.061995],
  [-.502937,.053588],[-.472007,.045615],[-.438936,.038146],[-.398147,.029934],[-.359779,.022964],
  [-.323219,.017104],[-.288010,.012256],[-.253701,.008320],[-.219848,.005191],[-.186005,.002762],
  [-.151718,.000923],[-.116520,-.000441],[-.079930,-.001440],[-.041457,-.002188],[-.000561,-.002794],
  [.035553,-.003205],[.069561,-.003382],[.101908,-.003256],[.133029,-.002758],[.163349,-.001817],
  [.193281,-.000361],[.223228,.001676],[.253585,.004362],[.284752,.007758],[.317132,.011925],
  [.351136,.016922],[.387333,.022835],[.421034,.029056],[.452608,.035777],[.482310,.042932],
  [.510519,.050468],[.537617,.058329],[.563999,.066459],[.731517,.118781],
];

export function advanceRockingChair(previous: RockingMotion, chair: RockingChair | undefined, cat: Vec3 | undefined, dt: number): RockingMotion {
  'worklet';
  const current = chair && previous.chair?.instanceId !== chair.instanceId ? STILL_ROCKING_MOTION : previous;
  const support = chair ?? current.chair;
  if (!support) return STILL_ROCKING_MOTION;
  const occupied = !!chair && !!cat && Math.hypot(...cat.map((v, i) => v - chair.seat[i])) < .08 * chair.scale;
  const delta = Math.max(0, Math.min(1 / 15, dt));
  const weight = current.weight + ((occupied ? 1 : 0) - current.weight) * (1 - Math.exp(-delta * 3));
  if (!occupied && weight < .0001) return STILL_ROCKING_MOTION;
  const time = current.time + delta;
  const angle = .08 * weight * Math.sin(time * 1.6);
  const bottom = Math.min(...RUNNER_PROFILE.map(([z, y]) => y * Math.cos(angle) - z * Math.sin(angle)));
  return { chair: support, time, weight, angle, lift: (-.003382 - bottom) * support.scale };
}

/** Ease the cat into contact at landing and out of contact at takeoff. */
export function rockingChairContact(travel: NativeTravel | undefined, elapsed: number): number {
  'worklet';
  if (!travel?.rockingChair) return 0;
  if (!travel.jump) return 1;
  const jump = Math.max(0, Math.min(1, (elapsed / travel.duration - .20) / .50));
  const t = Math.max(0, Math.min(1, travel.rockingChair.leaving ? 1 - jump / .12 : (jump - .88) / .12));
  return t * t * (3 - 2 * t);
}
