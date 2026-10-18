import type { Vec3 } from '@/utils/native-room-world';

export type CatMotionLeg = {
  kind: 'walk' | 'hop';
  path: Vec3[];
  duration: number;
  arcHeight?: number;
  supportId?: string;
  turnDuration?: number;
  paces?: number[];
  animation?: 'hop' | 'jumpOn' | 'jumpOff' | 'sit';
};

/** Shared by collision prediction and playback. Height is above the endpoint chord. */
export function catJumpPoint(from: Vec3, to: Vec3, progress: number, height: number): Vec3 {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  const travel = t * t * (3 - 2 * t);
  return [from[0] + (to[0] - from[0]) * travel,
    from[1] + (to[1] - from[1]) * travel + 4 * height * t * (1 - t),
    from[2] + (to[2] - from[2]) * travel];
}

/** A short acceleration/braking ramp, with constant speed through intermediate points. */
export function catTravelProgress(elapsed: number, duration: number): number {
  'worklet';
  if (duration <= 0 || elapsed >= duration) return 1;
  const t = Math.max(0, elapsed), ramp = Math.min(.18, duration * .22);
  const area = duration - ramp;
  if (t < ramp) return t * t / (2 * ramp * area);
  if (t > duration - ramp) return 1 - (duration - t) ** 2 / (2 * ramp * area);
  return (t - ramp / 2) / area;
}

export function catPathPoint(path: readonly Vec3[], progress: number, paces?: readonly number[]): Vec3 {
  'worklet';
  let distance = 0;
  for (let i = 1; i < path.length; i++) distance += Math.hypot(...path[i].map((v, k) => v - path[i - 1][k])) * (paces?.[i] ?? 1);
  let remaining = Math.max(0, Math.min(1, progress)) * distance;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * (paces?.[i] ?? 1);
    if (remaining < length && length > 0) {
      const t = remaining / length;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    remaining -= length;
  }
  const end = path[path.length - 1];
  return [end[0], end[1], end[2]];
}

/** Start a revised floor route at the rendered pose, trimming already-passed samples. */
export function catPathFromPosition(path: readonly Vec3[], position: Vec3, paces?: readonly number[]) {
  'worklet';
  let segment = 0, nearest = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const dx = b[0] - a[0], dz = b[2] - a[2], squared = dx * dx + dz * dz;
    const t = squared ? Math.max(0, Math.min(1, ((position[0] - a[0]) * dx + (position[2] - a[2]) * dz) / squared)) : 0;
    const distance = Math.hypot(position[0] - a[0] - dx * t, position[2] - a[2] - dz * t);
    if (distance < nearest) { nearest = distance; segment = i; }
  }
  const result: Vec3[] = [[position[0], position[1], position[2]]], weights = [1];
  for (let i = Math.max(1, segment); i < path.length; i++) {
    result.push(path[i]); weights.push(paces?.[i] ?? 1);
  }
  let before = 0, after = 0;
  for (let i = 1; i < path.length; i++) before += Math.hypot(...path[i].map((v, k) => v - path[i - 1][k])) * (paces?.[i] ?? 1);
  for (let i = 1; i < result.length; i++) after += Math.hypot(...result[i].map((v, k) => v - result[i - 1][k])) * weights[i];
  return { path: result, paces: weights, fraction: before > .001 ? after / before : 1 };
}

/** A tighter curve needs more time. Cache these weights when the route changes. */
export function catWalkTiming(path: Vec3[], scale: number) {
  const paces = path.map(() => 1);
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1], b = path[i], c = path[i + 1];
    const before = Math.hypot(b[0]-a[0], b[2]-a[2]), after = Math.hypot(c[0]-b[0], c[2]-b[2]);
    if (before < .001 || after < .001) continue;
    const cosine = ((b[0]-a[0])*(c[0]-b[0])+(b[2]-a[2])*(c[2]-b[2])) / (before*after);
    const curvature = Math.acos(Math.max(-1,Math.min(1,cosine))) / Math.max(.02, (before+after)/2);
    const pace = Math.max(1, Math.min(2.5, 1.8*scale / Math.sqrt(1.8*scale/Math.max(.001,curvature))));
    paces[i] = Math.max(paces[i],pace); paces[i+1] = Math.max(paces[i+1],pace);
  }
  let distance = 0;
  for (let i = 1; i < path.length; i++) distance += Math.hypot(...path[i].map((v,k)=>v-path[i-1][k])) * paces[i];
  return { paces, duration: Math.max(.18, distance/(1.8*scale)+.18) };
}

/** Round only corners whose entire curve still clears the collision envelope. */
export function roundCatPath(path: Vec3[], radius: number, clear: (from: Vec3, to: Vec3) => boolean): Vec3[] {
  if (path.length < 3) return path;
  const result = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1], b = path[i], c = path[i + 1];
    const before = Math.hypot(...b.map((v, k) => v - a[k])), after = Math.hypot(...c.map((v, k) => v - b[k]));
    const cut = Math.min(radius, before * .3, after * .3);
    if (cut < .01) { result.push(b); continue; }
    const entry = b.map((v, k) => v + (a[k] - v) * cut / before) as Vec3;
    const exit = b.map((v, k) => v + (c[k] - v) * cut / after) as Vec3;
    const curve = [entry];
    for (let j = 1; j <= 8; j++) {
      const t = j / 8;
      curve.push(b.map((v, k) => (1 - t) ** 2 * entry[k] + 2 * (1 - t) * t * v + t * t * exit[k]) as Vec3);
    }
    if (clear(result[result.length - 1], entry) && curve.every((p, j) => !j || clear(curve[j - 1], p)) && clear(exit, c))
      result.push(...curve);
    else result.push(b);
  }
  result.push(path[path.length - 1]);
  return result;
}

export function catMotionSample(legs: readonly CatMotionLeg[], elapsed: number) {
  'worklet';
  let remaining = Math.max(0, elapsed), index = 0;
  for (; index < legs.length - 1 && remaining >= legs[index].duration; index++) remaining -= legs[index].duration;
  const leg = legs[index];
  const turning = remaining < (leg.turnDuration ?? 0);
  const actionDuration = leg.duration - (leg.turnDuration ?? 0);
  const actionProgress = Math.max(0, Math.min(1, (remaining - (leg.turnDuration ?? 0)) / actionDuration));
  const flight = Math.max(0, Math.min(1, (actionProgress - .20) / .50));
  const position = turning ? [...leg.path[0]] as Vec3 : leg.kind === 'hop'
    ? catJumpPoint(leg.path[0], leg.path[leg.path.length - 1], flight, leg.arcHeight ?? .35)
    : catPathPoint(leg.path, catTravelProgress(remaining, leg.duration), leg.paces);
  const ahead = leg.kind === 'hop' ? leg.path[leg.path.length - 1]
    : catPathPoint(leg.path, catTravelProgress(remaining + .10, leg.duration), leg.paces);
  return { position, ahead, kind: turning ? 'turn' as const : leg.kind, progress: turning ? remaining / leg.turnDuration! : actionProgress, index, animation: leg.animation };
}
