import { isLampDecorationId } from '@/constants/decoration-motion';
import { FLOOR_Y, NATIVE_MODEL_CATALOG, type NativeRoomObject, type Vec3 } from '@/utils/native-room-world';
import { buildRugSurfaces } from '@/utils/native-ground-support';

export function hasContactShadow(object: NativeRoomObject) {
  return object.wallAxis === undefined && (object.solid || object.movable) && !isLampDecorationId(object.modelId);
}

export function contactShadowShape(object: NativeRoomObject) {
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  const spread = /sofa/i.test(object.modelId) ? .72 : .60;
  return { center: [(meta.min[0] + meta.max[0]) / 2, (meta.min[2] + meta.max[2]) / 2],
    radius: [(meta.max[0] - meta.min[0]) * spread, (meta.max[2] - meta.min[2]) * spread] };
}

/** Contact shadows follow the saved yaw and the same drawing-thread drag preview. */
export function contactShadowPose(object: Pick<NativeRoomObject, 'position' | 'scale' | 'heading'>, shape: ReturnType<typeof contactShadowShape>, rugs: ReturnType<typeof buildRugSurfaces>) {
  'worklet';
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  const position: Vec3 = [object.position[0] + (c * shape.center[0] + s * shape.center[1]) * object.scale,
    FLOOR_Y + .004, object.position[2] + (-s * shape.center[0] + c * shape.center[1]) * object.scale];
  const radius = shape.radius.map(value => value * object.scale);
  const extentX = Math.abs(c) * radius[0] + Math.abs(s) * radius[1];
  const extentZ = Math.abs(s) * radius[0] + Math.abs(c) * radius[1];
  const fit = Math.max(.001, Math.min(1, (2.46 - Math.abs(position[0])) / Math.max(.001, extentX),
    (2.46 - Math.abs(position[2])) / Math.max(.001, extentZ)));
  radius[0] *= fit; radius[1] *= fit;
  // Lift the shadow onto a rug under its footprint. The tiny height difference
  // keeps a partially covered sofa grounded on both surfaces without z-fighting.
  for (const rug of rugs) {
    const dx = position[0] - rug.position[0], dz = position[2] - rug.position[2];
    const x = dx * rug.cos - dz * rug.sin - rug.centerX;
    const z = dx * rug.sin + dz * rug.cos - rug.centerZ;
    const reach = Math.min(...radius) * .6;
    const intersects = rug.round
      ? Math.hypot(x / (rug.halfX + reach), z / (rug.halfZ + reach)) < 1
      : Math.abs(x) < rug.halfX + reach && Math.abs(z) < rug.halfZ + reach;
    if (intersects) position[1] = Math.max(position[1], rug.height + .004);
  }
  return { position, scale: [radius[0], 1, radius[1]] as Vec3, heading: object.heading };
}
