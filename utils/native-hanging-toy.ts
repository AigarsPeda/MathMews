import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

export type HangingToyState = { x: number; z: number; vx: number; vz: number; touching: boolean };
export const HANGING_TOY_LENGTH = .80;

/** Gravity and damping keep the ball on its string after a paw impulse. */
export function advanceHangingToy(state: HangingToyState, dt: number, scale: number, hit?: Vec3): HangingToyState {
  'worklet';
  const next = { ...state };
  if (hit && !state.touching) {
    next.vx += hit[0] * 5;
    next.vz += hit[2] * 5;
  }
  next.touching = !!hit;
  const steps = Math.max(1, Math.ceil(dt * 120));
  const h = dt / steps, gravity = 9.81 / Math.max(.04, HANGING_TOY_LENGTH * scale);
  for (let i = 0; i < steps; i++) {
    next.vx += (-gravity * Math.sin(next.x) - 1.2 * next.vx) * h;
    next.vz += (-gravity * Math.sin(next.z) - 1.2 * next.vz) * h;
    next.x += next.vx * h;
    next.z += next.vz * h;
    // The post stops inward swings before the ball passes through the sisal.
    if (next.x < -.35) { next.x = -.35; next.vx = Math.abs(next.vx) * .25; }
    // The platform limits upward travel; the string never stretches.
    const angle = Math.hypot(next.x, next.z);
    if (angle > 1.25) {
      next.x *= 1.25 / angle; next.z *= 1.25 / angle;
      next.vx *= -.25; next.vz *= -.25;
    }
  }
  return next;
}

export function hangingToyOffset(x: number, z: number): Vec3 {
  'worklet';
  const angle = Math.hypot(x, z), sine = angle > .00001 ? Math.sin(angle) / angle : 1;
  return [HANGING_TOY_LENGTH * x * sine, -HANGING_TOY_LENGTH * Math.cos(angle), HANGING_TOY_LENGTH * z * sine];
}

export function hangingToyPosition(object: NativeRoomObject, x = 0, z = 0): Vec3 {
  'worklet';
  const offset = hangingToyOffset(x, z);
  const local = [.30 + offset[0], 1.43 + offset[1], .12 + offset[2]];
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  return [object.position[0] + (local[0] * c + local[2] * s) * object.scale,
    object.position[1] + local[1] * object.scale,
    object.position[2] + (local[2] * c - local[0] * s) * object.scale];
}

/** A ball in a corner rebounds off the walls while its attachment stays fixed. */
export function containHangingToySwing(next: HangingToyState, previous: HangingToyState, object: NativeRoomObject): HangingToyState {
  'worklet';
  const limit = 2.35 - .1 * object.scale;
  const position = hangingToyPosition(object, next.x, next.z);
  if (Math.abs(position[0]) <= limit && Math.abs(position[2]) <= limit) return next;
  let low = 0, high = 1;
  for (let i = 0; i < 12; i++) {
    const t = (low + high) / 2;
    const p = hangingToyPosition(object, previous.x + (next.x - previous.x) * t, previous.z + (next.z - previous.z) * t);
    if (Math.abs(p[0]) <= limit && Math.abs(p[2]) <= limit) low = t; else high = t;
  }
  let vx = next.vx, vz = next.vz;
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  for (const axis of [0, 2]) if (Math.abs(position[axis]) > limit) {
    const nx = axis === 0 ? c : -s, nz = axis === 0 ? s : c;
    const dot = vx * nx + vz * nz;
    vx -= 1.35 * dot * nx; vz -= 1.35 * dot * nz;
  }
  return { ...next, x: previous.x + (next.x - previous.x) * low, z: previous.z + (next.z - previous.z) * low, vx, vz };
}

/** Sweep the paw relative to the moving ball so fast swats cannot skip contact. */
export function hangingToyContact(ball: Vec3, paws: Vec3[], radius: number,
  previous?: { ball: Vec3; paws: Vec3[] }): number {
  'worklet';
  for (let i = 0; i < paws.length; i++) {
    const end = paws[i].map((v, k) => v - ball[k]);
    const prior = previous && i < previous.paws.length ? previous.paws[i] : undefined;
    const start = prior && previous ? prior.map((v, k) => v - previous.ball[k]) : end;
    const motion = end.map((v, k) => v - start[k]);
    const lengthSquared = motion.reduce((sum, v) => sum + v * v, 0);
    // A repositioned cat must not hit everything between its old and new location.
    const t = lengthSquared > 0 && lengthSquared < (radius * 6) ** 2
      ? Math.max(0, Math.min(1, -start.reduce((sum, v, k) => sum + v * motion[k], 0) / lengthSquared)) : 1;
    if (Math.hypot(...start.map((v, k) => v + motion[k] * t)) <= radius) return i;
  }
  return -1;
}

/** Rotate an authored limb toward a target, preserving its segment lengths. */
export function limbAim(from: Vec3, to: Vec3): { angle: number; axis: Vec3 } {
  'worklet';
  const length = Math.hypot(...from) * Math.hypot(...to);
  const cross: Vec3 = [from[1] * to[2] - from[2] * to[1], from[2] * to[0] - from[0] * to[2], from[0] * to[1] - from[1] * to[0]];
  const sine = Math.hypot(...cross);
  if (length < 1e-8 || sine < 1e-8) return { angle: 0, axis: [1, 0, 0] };
  return { angle: Math.atan2(sine, from[0] * to[0] + from[1] * to[1] + from[2] * to[2]), axis: cross.map(v => v / sine) as Vec3 };
}

export function reachingElbow(shoulder: Vec3, elbow: Vec3, paw: Vec3, target: Vec3, heading: number): Vec3 {
  'worklet';
  const upper = Math.hypot(...elbow.map((v, i) => v - shoulder[i]));
  const lower = Math.hypot(...paw.map((v, i) => v - elbow[i]));
  const delta = target.map((v, i) => v - shoulder[i]) as Vec3;
  const length = Math.max(.0001, Math.hypot(...delta));
  const direction = delta.map(v => v / length);
  const distance = Math.max(Math.abs(upper - lower) + .001, Math.min(length, upper + lower - .001));
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const pole = [-Math.sin(heading), 0, -Math.cos(heading)];
  const dot = pole.reduce((sum, v, i) => sum + v * direction[i], 0);
  let bend = pole.map((v, i) => v - dot * direction[i]);
  if (Math.hypot(...bend) < .001) bend = [Math.cos(heading), 0, -Math.sin(heading)];
  const height = Math.sqrt(Math.max(0, upper * upper - along * along)) / Math.hypot(...bend);
  return shoulder.map((v, i) => v + direction[i] * along + bend[i] * height) as Vec3;
}
