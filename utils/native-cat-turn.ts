import type { Vec3 } from '@/utils/native-room-world';

function smooth(t: number) {
  'worklet';
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function catTurnDuration(angle: number) {
  'worklet';
  return .16 + Math.max(.35, Math.abs(angle) / (Math.PI / 2)) * .48;
}

/** Look first, then step around the planted feet, then straighten the neck. */
export function catTurnPose(angle: number, progress: number, initialHead = 0, initialCrouch = 0) {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  const travel = Math.max(0, Math.min(1, (t - .12) / .80)), ramp = .06;
  const body = travel < ramp ? travel * travel / (2 * ramp * (1 - ramp))
    : travel > 1 - ramp ? 1 - (1 - travel) ** 2 / (2 * ramp * (1 - ramp))
    : (travel - ramp / 2) / (1 - ramp);
  const anticipation = Math.max(.22,.14/catTurnDuration(angle));
  const loading = Math.max(.16,.10/catTurnDuration(angle));
  const look = smooth(t / anticipation) * (1 - smooth((t - .72) / .28));
  return { heading: angle * body, head: initialHead * (1 - smooth(t / anticipation)) + Math.sign(angle) * Math.min(.48, Math.abs(angle) * .6) * look,
    crouch: initialCrouch * (1 - smooth(t / loading)) + (.09+.09*Math.min(1,Math.abs(angle)/(Math.PI/2))) * smooth(t / loading) * (1 - smooth((t - .82) / .18)) };
}

function turnStep(angle: number, progress: number, paw: number) {
  'worklet';
  const cycles = Math.max(1, Math.ceil(Math.abs(angle) / (Math.PI / 2) - 1e-6));
  const travel = Math.max(0, Math.min(cycles, (progress - .12) / .80 * cycles));
  const cycle = Math.min(cycles - 1, Math.floor(travel));
  const onset = angle > 0 ? [.5, 0, .06, .56] : [0, .5, .56, .06];
  const step = Math.max(0, Math.min(1, (travel - cycle - onset[paw]) / .44));
  return { before: angle * cycle / cycles, after: angle * (cycle + 1) / cycles, step };
}

export function catTurnPawOrientation(angle: number, progress: number, paw: number) {
  'worklet';
  const { before, after, step } = turnStep(angle, progress, paw);
  return { heading: before + (after - before) * smooth(step), settled: before === 0 ? smooth(step) : 1 };
}

/** Coordinates are relative to the heading at the start of the turn.
 * Diagonal pairs alternate support, making two purposeful beats per quarter-turn.
 * Paw order is left fore, right fore, left hind, right hind.
 */
export function catTurnPaw(neutral: Vec3, initial: Vec3, angle: number, progress: number, paw: number): Vec3 {
  'worklet';
  // The inside forepaw leads its opposite hind paw by a fraction of a beat.
  const { before, after, step } = turnStep(angle, progress, paw);
  const from: Vec3 = before === 0 ? initial : [neutral[0] * Math.cos(before) + neutral[2] * Math.sin(before), neutral[1], neutral[2] * Math.cos(before) - neutral[0] * Math.sin(before)];
  const to: Vec3 = [neutral[0] * Math.cos(after) + neutral[2] * Math.sin(after), neutral[1], neutral[2] * Math.cos(after) - neutral[0] * Math.sin(after)];
  const blend = smooth(step);
  // A zero-velocity lift/touchdown avoids a visible snap at either contact.
  const reach=Math.hypot(to[0]-from[0],to[2]-from[2]);
  const lift = Math.min(.085,.025+.14*reach) * Math.sin(Math.PI * step) ** 2;
  return [from[0] + (to[0] - from[0]) * blend, from[1] + (to[1] - from[1]) * blend + lift, from[2] + (to[2] - from[2]) * blend];
}
