import { FLOOR_Y, NATIVE_MODEL_CATALOG, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';

type RugSurface = {
  position: Vec3;
  cos: number;
  sin: number;
  centerX: number;
  centerZ: number;
  halfX: number;
  halfZ: number;
  height: number;
  round: boolean;
};

/** Cache rug footprints once per layout. Rugs remain traversable navigation surfaces. */
export function buildRugSurfaces(world?: NativeRoomWorld): RugSurface[] {
  return (world?.objects ?? []).flatMap(object => {
    if (!/carpet|rug/i.test(object.modelId)) return [];
    const meta = NATIVE_MODEL_CATALOG[object.modelId];
    if (!meta) return [];
    return [{ position: object.position, cos: Math.cos(object.heading), sin: Math.sin(object.heading),
      centerX: (meta.min[0] + meta.max[0]) * object.scale / 2,
      centerZ: (meta.min[2] + meta.max[2]) * object.scale / 2,
      halfX: (meta.max[0] - meta.min[0]) * object.scale / 2,
      halfZ: (meta.max[2] - meta.min[2]) * object.scale / 2,
      height: object.max[1], round: /round|flower/i.test(object.modelId) }];
  });
}

/** Lift the animated cat onto a rug before the edge of a paw reaches it. */
export function rugSupportLift(position: Vec3, paws: Vec3[], surfaces: RugSurface[], scale: number): number {
  'worklet';
  let lift = 0;
  // The toe pads extend beyond their exported bone pivots. Begin stepping up
  // one pad width ahead of the edge; full clearance is reached on first contact.
  const radius = .20 * scale;
  for (const surface of surfaces) {
    if (surface.halfX <= 0 || surface.halfZ <= 0) continue;
    for (const paw of paws) {
      const dx = paw[0] - surface.position[0], dz = paw[2] - surface.position[2];
      const x = dx * surface.cos - dz * surface.sin - surface.centerX;
      const z = dx * surface.sin + dz * surface.cos - surface.centerZ;
      const inside = surface.round
        ? (1 - Math.hypot(x / surface.halfX, z / surface.halfZ)) * Math.min(surface.halfX, surface.halfZ)
        : Math.min(surface.halfX - Math.abs(x), surface.halfZ - Math.abs(z));
      const weight = Math.max(0, Math.min(1, (inside + radius * 2) / Math.max(radius, .0001)));
      if (weight === 0) continue;
      const height = FLOOR_Y + (surface.height + .002 - FLOOR_Y) * weight;
      // Reclining clips lower a paw pivot below its standing height. Include
      // the toe pad beneath that pivot, while lifted walking paws retain the
      // model's floor origin as their lowest required support plane.
      const bottom = Math.min(position[1], paw[1] - .105 * scale);
      lift = Math.max(lift, height - bottom);
    }
  }
  return lift;
}
