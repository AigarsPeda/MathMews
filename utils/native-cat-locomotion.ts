import { CAT_GAITS, type CatGait } from '@/utils/native-cat-gaits';
import jumpProfile from '@/constants/cat-jump.json';
import type { Vec3 } from '@/utils/native-room-world';

/** All four paws have landed; the remaining recovery can join a first stride. */
export const CAT_LANDING_WALK_PHASE = jumpProfile.walkReady;
export const CAT_JUMP_TAKEOFF = jumpProfile.takeoff;
export const CAT_JUMP_TOUCHDOWN = jumpProfile.touchdown;

/** A planned, small landing adjustment starts after takeoff. The head leads
 * the body; ordinary jumps retain their fixed heading throughout. */
export function catJumpAim(from: Vec3, to: Vec3, progress: number, landingHeading?: number) {
  'worklet';
  const heading=Math.atan2(to[0]-from[0],to[2]-from[2]);
  const delta=landingHeading===undefined ? 0 : Math.atan2(Math.sin(landingHeading-heading),Math.cos(landingHeading-heading));
  const t=Math.max(0,Math.min(1,progress)),blend=Math.max(0,Math.min(1,(t-.25)/.65));
  return { heading:heading+delta*blend*blend*(3-2*blend),headTurn:Math.max(-.12,Math.min(.12,delta*.25))*Math.sin(Math.PI*t) };
}

/** Scale the flight clock with the validated arc, rather than floating through
 * every jump for the same time. Units are relative to the cat's own size. */
export function catJumpDuration(from: Vec3, to: Vec3, height: number, scale: number): number {
  const flight = Math.max(Math.sqrt(8 * height / (jumpProfile.gravity * scale)),
    Math.hypot(to[0] - from[0], to[2] - from[2]) / (7 * scale));
  return Math.max(jumpProfile.minDuration, Math.min(jumpProfile.maxDuration,
    flight / (CAT_JUMP_TOUCHDOWN - CAT_JUMP_TAKEOFF)));
}

export type CatMotionLeg = {
  kind: 'walk' | 'hop';
  landingWalk?: boolean;
  path: Vec3[];
  duration: number;
  arcHeight?: number;
  supportId?: string;
  turnDuration?: number;
  paces?: number[];
  gait?: CatGait;
  ramp?: number;
  animation?: 'hop' | 'jumpOn' | 'jumpOff' | 'sit';
};

/** Shared by collision prediction and playback. Height is above the endpoint chord. */
export function catJumpPoint(from: Vec3, to: Vec3, progress: number, height: number, carryMomentum = false): Vec3 {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  // Direct furnishing jumps carry momentum. Tight obstacle traversal keeps
  // its validated lift-first envelope, with more height before crossing a backrest.
  const travel = carryMomentum ? t : t * t * (3 - 2 * t);
  return [from[0] + (to[0] - from[0]) * travel,
    from[1] + (to[1] - from[1]) * travel + 4 * height * t * (1 - t),
    from[2] + (to[2] - from[2]) * travel];
}

/** A short acceleration/braking ramp, with constant speed through intermediate points. */
export function catTravelProgress(elapsed: number, duration: number, acceleration = .18): number {
  'worklet';
  if (duration <= 0 || elapsed >= duration) return 1;
  const t = Math.max(0, elapsed), ramp = Math.min(acceleration, duration * .22);
  const area = duration - ramp;
  if (t < ramp) return t * t / (2 * ramp * area);
  if (t > duration - ramp) return 1 - (duration - t) ** 2 / (2 * ramp * area);
  return (t - ramp / 2) / area;
}

export function catPathPoint(path: readonly Vec3[], progress: number, paces?: readonly number[]): Vec3 {
  'worklet';
  let distance = 0;
  for (let i = 1; i < path.length; i++) distance += Math.hypot(...path[i].map((v, k) => v - path[i - 1][k])) * ((paces?.[i - 1] ?? 1) + (paces?.[i] ?? 1)) / 2;
  let remaining = Math.max(0, Math.min(1, progress)) * distance;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], physical = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const first = paces?.[i - 1] ?? 1, last = paces?.[i] ?? 1, length = physical * (first + last) / 2;
    if (remaining < length && length > 0) {
      // Invert the integral of linearly interpolated time-per-meter weights.
      const weighted = remaining / physical;
      const t = 2 * weighted / (first + Math.sqrt(Math.max(0, first * first + 2 * (last - first) * weighted)));
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
  let segment = 0, nearest = Infinity, segmentProgress = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const dx = b[0] - a[0], dz = b[2] - a[2], squared = dx * dx + dz * dz;
    const t = squared ? Math.max(0, Math.min(1, ((position[0] - a[0]) * dx + (position[2] - a[2]) * dz) / squared)) : 0;
    const distance = Math.hypot(position[0] - a[0] - dx * t, position[2] - a[2] - dz * t);
    if (distance < nearest) { nearest = distance; segment = i; segmentProgress = t; }
  }
  const result: Vec3[] = [[position[0], position[1], position[2]]];
  const firstPace = paces?.[Math.max(0, segment - 1)] ?? 1, lastPace = paces?.[segment] ?? 1;
  const weights = [firstPace + (lastPace - firstPace) * segmentProgress];
  for (let i = Math.max(1, segment); i < path.length; i++) {
    result.push(path[i]); weights.push(paces?.[i] ?? 1);
  }
  let before = 0, after = 0;
  for (let i = 1; i < path.length; i++) before += Math.hypot(...path[i].map((v, k) => v - path[i - 1][k])) * ((paces?.[i - 1] ?? 1) + (paces?.[i] ?? 1)) / 2;
  for (let i = 1; i < result.length; i++) after += Math.hypot(...result[i].map((v, k) => v - result[i - 1][k])) * (weights[i - 1] + weights[i]) / 2;
  return { path: result, paces: weights, fraction: before > .001 ? after / before : 1 };
}

/** Sample long straights too, so clearance and approach speed can vary locally. */
export function catPacedPath(path: Vec3[], scale: number): Vec3[] {
  if (!path.length) return path;
  const result = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], count = Math.max(1, Math.ceil(Math.hypot(...b.map((v,k)=>v-a[k])) / Math.max(.08,.5*scale)));
    for (let j = 1; j <= count; j++) result.push(a.map((v,k)=>v+(b[k]-v)*j/count) as Vec3);
  }
  return result;
}

/** A tighter curve needs more time. Cache these weights when the route changes. */
export function catWalkTiming(path: Vec3[], scale: number, gait: CatGait = 'walk', clearance?: (point: Vec3) => boolean) {
  const speed = CAT_GAITS[gait].speed * scale, ramp = CAT_GAITS[gait].ramp;
  const paces = path.map(point => clearance && !clearance(point) ? speed / (1.8 * scale) : 1);
  if (gait !== 'walk' && paces.length) {
    const distances=[0];
    for(let i=1;i<path.length;i++)distances.push(distances[i-1]+Math.hypot(...path[i].map((v,k)=>v-path[i-1][k]))/scale);
    const total=distances[distances.length-1];
    for(let i=0;i<path.length;i++) {
      // Finish the first walking step before asking for a faster footfall
      // pattern, and recover a walking approach before the final stop.
      const t=Math.max(0,Math.min(1,(Math.min(distances[i],total-distances[i])-.8)/1.25));
      const limit=(1.8+(CAT_GAITS[gait].speed-1.8)*t*t*(3-2*t))*scale;
      paces[i]=Math.max(paces[i],speed/limit);
    }
  }
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1], b = path[i], c = path[i + 1];
    const before = Math.hypot(b[0]-a[0], b[2]-a[2]), after = Math.hypot(c[0]-b[0], c[2]-b[2]);
    if (before < .001 || after < .001) continue;
    const cosine = ((b[0]-a[0])*(c[0]-b[0])+(b[2]-a[2])*(c[2]-b[2])) / (before*after);
    const curvature = Math.acos(Math.max(-1,Math.min(1,cosine))) / Math.max(.02, (before+after)/2);
    const pace = Math.max(1, Math.min(5, speed / Math.sqrt(1.8*scale/Math.max(.001,curvature))));
    paces[i] = Math.max(paces[i],pace); paces[i+1] = Math.max(paces[i+1],pace);
  }
  let distance = 0;
  for (let i = 1; i < path.length; i++) distance += Math.hypot(...path[i].map((v,k)=>v-path[i-1][k])) * (paces[i-1]+paces[i]) / 2;
  return { paces, gait, ramp, duration: Math.max(.18, distance/speed+ramp) };
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
  const actionDuration = (leg.duration - (leg.turnDuration ?? 0)) / (leg.landingWalk ? CAT_LANDING_WALK_PHASE : 1);
  const actionProgress = Math.max(0, Math.min(1, (remaining - (leg.turnDuration ?? 0)) / actionDuration));
  const flight = Math.max(0, Math.min(1, (actionProgress - CAT_JUMP_TAKEOFF) / (CAT_JUMP_TOUCHDOWN - CAT_JUMP_TAKEOFF)));
  const position = turning ? [...leg.path[0]] as Vec3 : leg.kind === 'hop'
    ? catJumpPoint(leg.path[0], leg.path[leg.path.length - 1], flight, leg.arcHeight ?? .35)
    : catPathPoint(leg.path, catTravelProgress(remaining, leg.duration, leg.ramp), leg.paces);
  const ahead = leg.kind === 'hop' ? leg.path[leg.path.length - 1]
    : catPathPoint(leg.path, catTravelProgress(remaining + .10, leg.duration, leg.ramp), leg.paces);
  return { position, ahead, kind: turning ? 'turn' as const : leg.kind, progress: turning ? remaining / leg.turnDuration! : actionProgress, index, animation: leg.animation, gait: leg.gait, actionDuration,
    heading: leg.kind === 'hop' ? Math.atan2(leg.path[leg.path.length-1][0]-leg.path[0][0],leg.path[leg.path.length-1][2]-leg.path[0][2]) : undefined };
}
