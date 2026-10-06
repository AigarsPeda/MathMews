import { FLOOR_Y, type CollisionBox, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';

export type TailContact = { angle: number; axis: Vec3; blocked: boolean };
const REST: TailContact = { angle: 0, axis: [0, 1, 0], blocked: false };

/** Rotate a tail capsule chain at its anchored hip without changing bone lengths. */
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

function penetration(points: Vec3[], boxes: CollisionBox[], radius: number, contact: TailContact): number {
  'worklet';
  let depth = 0;
  const anchor = points[0];
  const rotated = points.map(p => rotateTailPoint(p, anchor, contact.angle, contact.axis));
  for (let i = 1; i < rotated.length; i++) {
    const a = rotated[i - 1], b = rotated[i];
    const samples = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (radius * .5)));
    for (let j = 0; j <= samples; j++) {
      const t = j / samples;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      depth += Math.max(0, FLOOR_Y + radius - y);
      depth += Math.max(0, Math.abs(x) + radius - 2.35) + Math.max(0, Math.abs(z) + radius - 2.35);
      for (const box of boxes) {
        const dx = x - Math.max(box.min[0], Math.min(box.max[0], x));
        const dy = y - Math.max(box.min[1], Math.min(box.max[1], y));
        const dz = z - Math.max(box.min[2], Math.min(box.max[2], z));
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        depth += Math.max(0, radius - distance);
      }
    }
  }
  return depth;
}

// Refine the clearing boundary instead of showing a 10-degree pose step.
function refineContact(points: Vec3[], boxes: CollisionBox[], radius: number, low: number, candidate: TailContact): TailContact {
  'worklet';
  let high = candidate.angle;
  for (let i = 0; i < 6; i++) {
    const mid = (low + high) / 2;
    if (penetration(points, boxes, radius, { ...candidate, angle: mid }) < 1e-8) high = mid;
    else low = mid;
  }
  return { ...candidate, angle: high };
}

/** Contact constraints run after authored animation and before skinning, including Reduce Motion. */
export function resolveTailContact(points: Vec3[], world: NativeRoomWorld, previous: TailContact, delta: number): TailContact {
  'worklet';
  const radius = .105 * world.catScale + .006;
  const reach = Math.max(...points.map(p => Math.hypot(p[0] - points[0][0], p[1] - points[0][1], p[2] - points[0][2]))) + radius;
  const boxes: CollisionBox[] = [];
  for (const object of world.objects) {
    if (!(object.collidable ?? object.solid) || object.movable) continue;
    const distance = Math.hypot(...points[0].map((v, k) => v - Math.max(object.min[k], Math.min(object.max[k], v))));
    if (distance > reach) continue;
    boxes.push(...(object.collisionBoxes ?? [{ min: object.min, max: object.max }]));
  }
  // A clearance margin prevents alternate relaxation/contact frames at the
  // surface. Keep the previous axis and solve continuously before trying others.
  const relaxed = { ...previous, angle: previous.angle * Math.exp(-delta * 4), blocked: false };
  if (penetration(points, boxes, radius + .008, relaxed) < 1e-8) return relaxed.angle < .001 ? REST : relaxed;
  if (penetration(points, boxes, radius, previous) < 1e-8) return { ...previous, blocked: false };
  if (penetration(points, boxes, radius, REST) < 1e-8) return REST;
  if (previous.blocked) {
    // An anchored root inside a furnishing cannot be freed by rotating it.
    // Follow the least-penetrating pose locally instead of exhausting all axes
    // on every frame and snapping between unrelated solutions.
    let best = previous, depth = penetration(points, boxes, radius, previous);
    for (const sign of [-1, 1]) {
      const candidate = { ...previous, angle: Math.max(0, Math.min(Math.PI * 5 / 6, previous.angle + sign * delta * 1.5)) };
      const nextDepth = penetration(points, boxes, radius, candidate);
      if (nextDepth < depth) { best = candidate; depth = nextDepth; }
    }
    return { ...best, blocked: depth > 1e-8 };
  }
  if (previous.angle > 0 && !previous.blocked) {
    for (let step = 1; step <= 6; step++) {
      const candidate = { ...previous, angle: previous.angle + step * Math.PI / 180, blocked: false };
      if (penetration(points, boxes, radius, candidate) < 1e-8) return refineContact(points, boxes, radius, previous.angle, candidate);
    }
  }
  let best = REST, bestDepth = penetration(points, boxes, radius, REST);
  // The smallest clearing hip rotation retains the authored curl and attachment.
  const axes: Vec3[] = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [Math.SQRT1_2, 0, Math.SQRT1_2], [Math.SQRT1_2, 0, -Math.SQRT1_2]];
  for (let degrees = 10; degrees <= 150; degrees += 10) {
    for (const axis of axes) for (const sign of [1, -1]) {
      const candidate = { angle: degrees * Math.PI / 180, axis: axis.map(v => v * sign) as Vec3, blocked: false };
      const depth = penetration(points, boxes, radius, candidate);
      if (depth < 1e-8) return refineContact(points, boxes, radius, Math.max(0, candidate.angle - Math.PI / 18), candidate);
      if (depth < bestDepth) { best = candidate; bestDepth = depth; }
    }
  }
  return { ...best, blocked: true };
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
