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

function turnCycles(angle: number, onCushion: boolean) {
  'worklet';
  // The gathered seat stance lets each diagonal carry a quarter turn.
  const sweep = onCushion ? Math.PI / 2 : Math.PI / 3;
  return Math.max(1, Math.ceil(Math.abs(angle) / sweep - 1e-6));
}

function turnTravel(progress: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, progress)), ramp = .12;
  if (t < ramp) return t * t / (2 * ramp * (1 - ramp));
  if (t > 1 - ramp) return 1 - (1 - t) ** 2 / (2 * ramp * (1 - ramp));
  return (t - ramp / 2) / (1 - ramp);
}

// The paws and the body share angular progress, including the ease into and out of a turn.
function bodyTravel(progress: number) {
  'worklet';
  return turnTravel((progress - .12) / .80);
}

/** Look first, then step around the planted feet, then straighten the neck. */
export function catTurnPose(angle: number, progress: number, initialHead = 0, initialCrouch = 0, onCushion = false) {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  const duration = catTurnDuration(angle), seconds = t * duration;
  const body = bodyTravel(t);
  const chest = turnTravel((seconds - .10) / (duration - .18));
  const hips = turnTravel((seconds - .15) / (duration - .23));
  const loadingSide = Math.sign(angle) * .010 * Math.cos(body * turnCycles(angle, onCushion) * Math.PI * 2)
    * smooth(seconds / .065) * (1 - smooth((t - .88) / .12));
  const anticipation = Math.max(.22, .14 / duration);
  const loading = Math.max(.16, .10 / duration);
  const look = smooth(t / anticipation) * (1 - smooth((t - .72) / .28));
  return {
    heading: angle * body,
    chestYaw: angle * (chest - body),
    hipYaw: angle * (hips - body),
    side: loadingSide,
    head: initialHead * (1 - smooth(t / anticipation)) + Math.sign(angle) * Math.min(.48, Math.abs(angle) * .6) * look,
    crouch: initialCrouch * (1 - smooth(t / loading)) + (.035 + .020 * Math.min(1, Math.abs(angle) / (Math.PI / 2)))
      * smooth(t / loading) * (1 - smooth((t - .82) / .18)),
  };
}

function turnStep(angle: number, progress: number, paw: number, onCushion = false) {
  'worklet';
  const cycles = turnCycles(angle, onCushion);
  const travel = bodyTravel(progress) * cycles;
  const cycle = Math.min(cycles - 1, Math.floor(travel));
  const lead = angle > 0 ? paw === 1 || paw === 2 : paw === 0 || paw === 3;
  const onset = (lead ? 0 : .5) + (paw >= 2 ? .035 : 0);
  const step = Math.max(0, Math.min(1, (travel - cycle - onset) / .465));
  // Each diagonal lands close to where its shoulders and hips will pass during support.
  const offset = lead ? -.10 : .12;
  const before = cycle === 0 ? 0 : angle * (cycle + offset) / cycles;
  const after = cycle === cycles - 1 ? angle : angle * (cycle + 1 + offset) / cycles;
  // Clear the cushion before sweeping the pad, then finish the sweep before landing.
  const blend = smooth(onCushion ? (step - .12) / .76 : step);
  return { before, after, step, blend };
}

export function catTurnPawOrientation(angle: number, progress: number, paw: number, onCushion = false) {
  'worklet';
  const { before, after, step, blend } = turnStep(angle, progress, paw, onCushion);
  return { heading: before + (after - before) * blend, pitch: .24 * Math.sin(Math.PI * step) ** 2, settled: before === 0 ? blend : 1 };
}

/** Paw targets in the starting heading's frame, in left fore, right fore, left hind, right hind order. */
export function catTurnPaw(neutral: Vec3, initial: Vec3, angle: number, progress: number, paw: number, onCushion = false): Vec3 {
  'worklet';
  const { before, after, step, blend } = turnStep(angle, progress, paw, onCushion);
  const heading = before + (after - before) * blend;
  const c = Math.cos(heading), s = Math.sin(heading);
  // Sweep the paw around the planted pair. Carry the visible starting pose into its first lift.
  const initialWeight = before === 0 ? 1 - blend : 0;
  const reach = Math.hypot(neutral[0], neutral[2]) * Math.abs(after - before);
  const lift = Math.min(.10, .024 + .12 * reach) * 16 * step ** 2 * (1 - step) ** 2;
  return [
    neutral[0] * c + neutral[2] * s + (initial[0] - neutral[0]) * initialWeight,
    neutral[1] + (initial[1] - neutral[1]) * initialWeight + lift,
    neutral[2] * c - neutral[0] * s + (initial[2] - neutral[2]) * initialWeight,
  ];
}
