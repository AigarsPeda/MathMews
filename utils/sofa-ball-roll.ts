import type { Vec3 } from '@/utils/native-room-world';

export type SofaBallRoll = { ballId: string; sofaId: string; start: Vec3; edge: Vec3; end: Vec3 };
export const SOFA_BALL_ROLL_SECONDS = 2.6;

/** The ball crosses the cushion, drops under gravity and slows on the floor. */
export function sofaBallPosition(roll: SofaBallRoll, fraction: number): Vec3 {
  'worklet';
  const t = Math.min(1, Math.max(0, fraction));
  if (t < .1) {
    const f = t / .1;
    return roll.start.map((v, i) => v + (roll.edge[i] - v) * f) as Vec3;
  }
  const f = (t - .1) / .9, horizontal = 1 - (1 - f) ** 2;
  const fall = Math.min(1, f / .2);
  return [roll.edge[0] + (roll.end[0] - roll.edge[0]) * horizontal,
    roll.edge[1] + (roll.end[1] - roll.edge[1]) * fall * fall,
    roll.edge[2] + (roll.end[2] - roll.edge[2]) * horizontal];
}
