import type { Vec3 } from '@/utils/native-room-world';

export function catLaunchBlend(progress: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}

/** Match cat_model.py's lateral walk: fore L/R, hind L/R. A paw already in
 * swing finishes that step; grounded paws wait for their own lift-off.
 */
export function catLaunchStep(phase: number, distance: number, paw: number) {
  'worklet';
  const offsets = [.18, .68, 0, .50];
  const gait = ((phase - offsets[paw]) % 1 + 1) % 1;
  const start = gait < .60 - 1e-6 ? Math.min(.40, .60 - gait) : 0;
  const contact = 1 - gait;
  // A nearly finished authored swing still needs time to lift this formerly
  // planted foot. It can join the following stance after touchdown.
  const end = Math.max(contact, .18);
  return { progress: catLaunchBlend((distance - start) / (end - start)),
    done: distance >= end, start, end, contact };
}

/** First-step contacts are world anchored. Only airborne feet approach the
 * walking pose, so moving the torso cannot drag a planted paw along the floor.
 */
export function catLaunchPaw(initial: Vec3, neutral: Vec3, animated: Vec3, root: Vec3,
  heading: number, scale: number, stride: number, phase: number, distance: number, paw: number): Vec3 {
  'worklet';
  const step = catLaunchStep(phase, distance, paw);
  if (step.done) return animated;
  const c = Math.cos(heading), s = Math.sin(heading);
  const forward = neutral[2] + stride * (.30 + step.contact - distance);
  const target: Vec3 = [root[0] + (neutral[0] * c + forward * s) * scale,
    root[1] + neutral[1] * scale, root[2] + (forward * c - neutral[0] * s) * scale];
  const lift = .065 * Math.sin(Math.PI * step.progress) ** 2 * scale;
  return [initial[0] + (target[0] - initial[0]) * step.progress,
    initial[1] + (target[1] - initial[1]) * step.progress + lift,
    initial[2] + (target[2] - initial[2]) * step.progress];
}

/** Carry the current crouch into the walk. A landing recovers after the hind
 * paws can step; it must not add the second dip used for a turning push-off. */
export function catLaunchSpine(initial: number, walking: number, distance: number, stride: number, landing = false) {
  'worklet';
  const settle = catLaunchBlend(landing ? (distance - .35) / .55 : distance / .20);
  return (initial - walking) * (1 - settle)
    - (landing ? 0 : .08) * Math.min(1, stride / .8) * settle * (1 - catLaunchBlend((distance - .50) / .40));
}
