import { isSurfacePlaceable, NATIVE_MODEL_CATALOG, placeObjectOnRugs, projectWorld, unprojectFloor, type NativeRoomObject, type Vec3 } from '@/utils/native-room-world';
import { roomItemAtPoint } from '@/utils/room-item-placement';
import { transformRoomObject } from '@/utils/room-support';
import type { RoomPoint } from '@/utils/room-activities';

const rotate = (point: number[], angle: number): Vec3 => [Math.cos(angle) * point[0] + Math.sin(angle) * point[2], point[1], -Math.sin(angle) * point[0] + Math.cos(angle) * point[2]];

/** Capture once per gesture. Surface changes must preserve the original screen anchor. */
export function createRoomDragPlacement(origin: NativeRoomObject, objects: NativeRoomObject[], width: number, zoom: number, ignoredIds: string[]) {
  // Large furniture and wall items still track the finger through collisions.
  // Magnetic correction belongs to explicit placement controls, not live motion.
  if (!isSurfacePlaceable(origin.modelId) || origin.wallAxis !== undefined) {
    return (point: RoomPoint) => ({ object: placeObjectOnRugs(roomItemAtPoint(origin, point, width), objects), unsupportedSurfaceId: undefined });
  }
  const meta = NATIVE_MODEL_CATALOG[origin.modelId];
  const center = rotate(meta.center, origin.heading).map(value => value * origin.scale);
  const hull = meta.baseHull!.map(([x, z]) => rotate([x, 0, z], origin.heading).map(value => value * origin.scale));
  const zero = projectWorld([0, 0, 0], width);
  const surfaces = objects.filter(owner => owner.instanceId !== origin.instanceId && !ignoredIds.includes(owner.instanceId))
    .flatMap(owner => (NATIVE_MODEL_CATALOG[owner.modelId].supportSurfaces ?? []).map(top => {
      const worldPoint = (x: number, z: number) => rotate([x, top.max[1], z], owner.heading)
        .map((v, i) => v * owner.scale + owner.position[i]) as Vec3;
      const padding = (axis: Vec3) => {
        const p = projectWorld(rotate(axis, owner.heading), width);
        return 6 / Math.max(1, Math.hypot(p.x - zero.x, p.y - zero.y) * zoom);
      };
      return { owner, height: owner.position[1] + top.max[1] * owner.scale + .002,
        minX: top.min[0] * owner.scale, maxX: top.max[0] * owner.scale,
        minZ: top.min[2] * owner.scale, maxZ: top.max[2] * owner.scale,
        padX: padding([1, 0, 0]), padZ: padding([0, 0, 1]),
        outline: [[top.min[0], top.min[2]], [top.max[0], top.min[2]], [top.max[0], top.max[2]], [top.min[0], top.max[2]]]
          .map(([x, z]) => projectWorld(worldPoint(x, z), width)) };
    })).sort((a, b) => b.height - a.height);
  type Surface = typeof surfaces[number];
  let held: Surface | undefined = surfaces.filter(surface => surface.owner.instanceId === origin.supportId)
    .sort((a, b) => Math.abs(a.height - origin.min[1]) - Math.abs(b.height - origin.min[1]))[0];
  const pose = (surface: Surface, point: RoomPoint): Vec3 => {
    const anchor = unprojectFloor(point, surface.height + (meta.center[1] - meta.min[1]) * origin.scale, width);
    return anchor.map((v, i) => v - center[i]) as Vec3;
  };
  const fits = (surface: Surface, position: Vec3, retain = false) => hull.every(corner => {
    const local = rotate(corner.map((v, i) => v + position[i] - surface.owner.position[i]) as Vec3, -surface.owner.heading);
    const x = retain ? surface.padX : 0, z = retain ? surface.padZ : 0;
    return local[0] >= surface.minX - x && local[0] <= surface.maxX + x
      && local[2] >= surface.minZ - z && local[2] <= surface.maxZ + z;
  });
  return (point: RoomPoint) => {
    // Prefer the captured board, including its height when one owner has several shelves.
    // The six-point exit margin prevents edge flicker; it never permits an invalid drop.
    if (held && !fits(held, pose(held, point), true)) held = undefined;
    held ??= surfaces.find(surface => fits(surface, pose(surface, point)));
    if (held) {
      const position = pose(held, point);
      return { object: { ...transformRoomObject(origin, position), supportId: held.owner.instanceId, rugLift: undefined },
        unsupportedSurfaceId: fits(held, position) ? undefined : held.owner.instanceId };
    }
    const pointedAt = surfaces.find(surface => {
      const sides = surface.outline.map((a, i, corners) => {
        const b = corners[(i + 1) % corners.length];
        return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
      });
      return sides.every(value => value >= 0) || sides.every(value => value <= 0);
    });
    return { object: placeObjectOnRugs(roomItemAtPoint(origin, point, width), objects), unsupportedSurfaceId: pointedAt?.owner.instanceId };
  };
}
