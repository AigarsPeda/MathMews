import { isPlayablePlant } from '@/constants/plant-play';
import { FLOOR_Y, type CollisionBox, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';

/** Angle is the total extra bend, shared by the first three joints. Axis is world-space. */
export type TailContact = { angle: number; axis: Vec3; blocked: boolean };
export type TailBody = { pelvis: Vec3; chest: Vec3; radius: number };
const REST: TailContact = { angle: 0, axis: [0, 1, 0], blocked: false };
const MAX_BEND = 125 * Math.PI / 180;

/** Root <= 35 degrees, middle joints <= 45 degrees each. */
export function tailJointAngle(angle: number, joint: number): number {
  'worklet';
  return Math.max(0, Math.min(MAX_BEND, angle)) * (joint === 0 ? .28 : joint < 3 ? .36 : 0);
}

export function rotateTailPoint(point: Vec3, anchor: Vec3, angle: number, axis: Vec3): Vec3 {
  'worklet';
  const x = point[0] - anchor[0], y = point[1] - anchor[1], z = point[2] - anchor[2];
  const c = Math.cos(angle), s = Math.sin(angle), dot = axis[0] * x + axis[1] * y + axis[2] * z;
  return [
    anchor[0] + x * c + (axis[1] * z - axis[2] * y) * s + axis[0] * dot * (1 - c),
    anchor[1] + y * c + (axis[2] * x - axis[0] * z) * s + axis[1] * dot * (1 - c),
    anchor[2] + z * c + (axis[0] * y - axis[1] * x) * s + axis[2] * dot * (1 - c),
  ];
}

/** Forward kinematics matching the actor's successive world-axis rotations. */
export function bendTailPoints(points: Vec3[], contact: TailContact): Vec3[] {
  'worklet';
  const bent = points.map(p => [...p] as Vec3);
  for (let joint = 0; joint < Math.min(3, points.length - 1); joint++) {
    const angle = tailJointAngle(contact.angle, joint);
    for (let i = joint + 1; i < points.length; i++) {
      bent[i] = rotateTailPoint(bent[i], bent[joint], angle, contact.axis);
    }
  }
  return bent;
}

function bodyDistance(point: Vec3, body: TailBody): number {
  'worklet';
  const line = body.chest.map((v, k) => v - body.pelvis[k]);
  const lengthSquared = line.reduce((sum, v) => sum + v * v, 0);
  const t = Math.max(0, Math.min(1, line.reduce((sum, v, k) => sum + v * (point[k] - body.pelvis[k]), 0) / Math.max(1e-8, lengthSquared)));
  return Math.hypot(...point.map((v, k) => v - body.pelvis[k] - line[k] * t));
}

function boxDistance(point: Vec3, box: CollisionBox): number {
  'worklet';
  const outside = Math.hypot(...point.map((v, k) => v - Math.max(box.min[k], Math.min(box.max[k], v))));
  // Signed distance also distinguishes two poses fully inside a box.
  return outside || -Math.min(...point.map((v, k) => Math.min(v - box.min[k], box.max[k] - v)));
}

function evaluate(points: Vec3[], boxes: CollisionBox[], radius: number, contact: TailContact, body?: TailBody): { depth: number; safe: boolean; lift: number } {
  'worklet';
  const bent = bendTailPoints(points, contact);
  let depth = 0, count = 0, safe = true;
  for (let i = 1; i < bent.length; i++) {
    const a = bent[i - 1], b = bent[i];
    const samples = Math.max(1, Math.ceil(Math.hypot(...b.map((v, k) => v - a[k])) / (radius * .5)));
    for (let j = 1; j <= samples; j++) {
      const t = j / samples;
      const p = a.map((v, k) => v + (b[k] - v) * t) as Vec3;
      depth += Math.max(0, FLOOR_Y + radius - p[1]);
      depth += Math.max(0, Math.abs(p[0]) + radius - 2.35) + Math.max(0, Math.abs(p[2]) + radius - 2.35);
      for (const box of boxes) depth += Math.max(0, radius - boxDistance(p, box));
      if (body) {
        const authored = points[i - 1].map((v, k) => v + (points[i][k] - v) * t) as Vec3;
        // The first segment starts inside the rump and is bounded by the root
        // limit. Exposed samples must stay outside; any authored overlap farther
        // down the chain may not grow when the tail bends.
        const authoredDistance = bodyDistance(authored, body), surface = body.radius + radius;
        if (i > 1 || authoredDistance >= surface) {
          const clearance = Math.min(surface, authoredDistance);
          if (bodyDistance(p, body) < clearance - 1e-6) safe = false;
        }
      }
      count++;
    }
  }
  return { depth: depth / Math.max(1, count), safe, lift: bent[bent.length - 1][1] - points[points.length - 1][1] };
}

function keepOutsideBody(points: Vec3[], radius: number, contact: TailContact, body?: TailBody): TailContact {
  'worklet';
  if (!body || evaluate(points, [], radius, contact, body).safe) return contact;
  // Animation can move the torso into yesterday's correction. Retreat to the
  // safe portion of this bend, including while relaxing a pinned attachment.
  let low = 0, high = contact.angle;
  for (let i = 0; i < 10; i++) {
    const mid = (low + high) / 2;
    if (evaluate(points, [], radius, { ...contact, angle: mid }, body).safe) low = mid; else high = mid;
  }
  return { ...contact, angle: low };
}

/** Contact constraints run after animation, including Reduce Motion. */
export function resolveTailContact(points: Vec3[], world: NativeRoomWorld, previous: TailContact, delta: number, body?: TailBody): TailContact {
  'worklet';
  if (points.length < 2) return REST;
  const radius = .105 * world.catScale + .006;
  // Arc length, not authored root-to-tip distance: a curling chain can reach
  // outside its original bounding sphere.
  let reach = radius;
  for (let i = 1; i < points.length; i++) reach += Math.hypot(...points[i].map((v, k) => v - points[i - 1][k]));
  const boxes: CollisionBox[] = [];
  for (const object of world.objects) {
    if (!(object.collidable ?? object.solid) || object.movable) continue;
    // Plant collision boxes describe the pot/trunk. The whole bounds include
    // soft leaves; without finer geometry they must not deflect the tail.
    if (isPlayablePlant(object.modelId) && !object.collisionBoxes?.length) continue;
    if (boxDistance(points[0], object) > reach) continue;
    boxes.push(...(object.collisionBoxes?.length ? object.collisionBoxes : [object]));
  }
  const prior = { ...previous, angle: Math.max(0, Math.min(MAX_BEND, previous.angle)) };
  const dt = Math.max(0, delta);
  const anchor = points[0];
  const pinned = anchor[1] < FLOOR_Y + radius || Math.abs(anchor[0]) + radius > 2.35 || Math.abs(anchor[2]) + radius > 2.35
    || boxes.some(box => boxDistance(anchor, box) < radius);
  if (pinned) {
    const relaxed = keepOutsideBody(points, radius, { ...prior, angle: prior.angle * Math.exp(-dt * 12), blocked: true }, body);
    return relaxed.angle < .001 ? { ...REST, blocked: true } : relaxed;
  }
  const rest = evaluate(points, boxes, radius, REST, body);
  const relaxed = { ...prior, angle: prior.angle * Math.exp(-dt * 4), blocked: false };
  const releasing = evaluate(points, boxes, radius + .008, relaxed, body);
  if (releasing.depth < 1e-8 && releasing.safe) return relaxed.angle < .001 ? REST : relaxed;
  const current = evaluate(points, boxes, radius, prior, body);
  if (current.depth < 1e-8 && current.safe) return { ...prior, blocked: false };

  let target = REST, bestScore = rest.depth, bestDepth = rest.depth;
  // Slight preferences for a smaller bend, lifting, and continuity. Furniture
  // overlap dominates these costs; self-intersection is disallowed outright.
  const score = (candidate: TailContact, result: ReturnType<typeof evaluate>) => {
    'worklet';
    const change = Math.hypot(...candidate.axis.map((v, k) => v * candidate.angle - prior.axis[k] * prior.angle));
    return result.depth + world.catScale * (.0015 * candidate.angle + .001 * change)
      + Math.max(0, -result.lift) * .012;
  };
  const axes: Vec3[] = [prior.axis, [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0],
    [Math.SQRT1_2, 0, Math.SQRT1_2], [-Math.SQRT1_2, 0, -Math.SQRT1_2],
    [Math.SQRT1_2, 0, -Math.SQRT1_2], [-Math.SQRT1_2, 0, Math.SQRT1_2]];
  if (current.safe) {
    const value = score(prior, current);
    if (value < bestScore) { target = prior; bestScore = value; bestDepth = current.depth; }
  }
  for (const axis of axes) {
    let low = 0;
    for (let degrees = 5; degrees <= 125; degrees += 10) {
      let candidate: TailContact = { angle: degrees * Math.PI / 180, axis, blocked: false };
      let result = evaluate(points, boxes, radius, candidate, body);
      // Do not cross a forbidden body pose to reach a nominally clear endpoint.
      if (!result.safe) break;
      if (result.depth < 1e-8) {
        let high = candidate.angle;
        for (let i = 0; i < 6; i++) {
          const mid = (low + high) / 2;
          const refined = evaluate(points, boxes, radius, { ...candidate, angle: mid }, body);
          if (refined.depth < 1e-8 && refined.safe) high = mid; else low = mid;
        }
        candidate = { ...candidate, angle: high };
        result = evaluate(points, boxes, radius, candidate, body);
      }
      const value = score(candidate, result);
      const clears = result.depth < 1e-8, bestClears = bestDepth < 1e-8;
      if (clears && !bestClears || clears === bestClears && value < bestScore) {
        target = candidate; bestScore = value; bestDepth = result.depth;
      }
      if (result.depth < 1e-8) break;
      low = candidate.angle;
    }
  }
  // Smooth the rotation vector, including direction changes. No single-frame
  // switch of axis or full-strength engagement. Exponential response is time-based.
  const from = prior.axis.map(v => v * prior.angle);
  const difference = target.axis.map((v, k) => v * target.angle - from[k]);
  const distance = Math.hypot(...difference);
  const blend = Math.min(distance < 1e-5 ? 1 : 1 - Math.exp(-dt * 8), 2.4 * dt / Math.max(1e-8, distance));
  const vector = from.map((v, k) => v + difference[k] * blend);
  const angle = Math.hypot(...vector);
  const next = keepOutsideBody(points, radius, {
    angle, axis: angle > 1e-8 ? vector.map(v => v / angle) as Vec3 : prior.axis, blocked: false,
  }, body);
  const blocked = evaluate(points, boxes, radius, target, body).depth > 1e-8;
  return next.angle < .001 && target.angle === 0 ? { ...REST, blocked } : { ...next, blocked };
}

/** World rotation axes expressed in the tail parent's coordinate system. */
export function tailParentAxis(axis: Vec3, parent: readonly number[]): Vec3 {
  'worklet';
  const local = [0, 1, 2].map(i => {
    const start = i * 4;
    const scale = Math.hypot(parent[start], parent[start + 1], parent[start + 2]);
    return (parent[start] * axis[0] + parent[start + 1] * axis[1] + parent[start + 2] * axis[2]) / Math.max(1e-8, scale);
  });
  const length = Math.hypot(...local);
  return local.map(v => v / Math.max(1e-8, length)) as Vec3;
}
