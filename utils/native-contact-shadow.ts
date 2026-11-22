import { isLampDecorationId } from '@/constants/decoration-motion';
import { FLOOR_Y, NATIVE_MODEL_CATALOG, type NativeRoomObject, type Vec3 } from '@/utils/native-room-world';
import { fireplaceLightPosition } from '@/utils/native-fireplace';
import { buildRugSurfaces } from '@/utils/native-ground-support';

type ObjectPose = Pick<NativeRoomObject, 'position' | 'scale' | 'heading'>;

export function hasContactShadow(object: NativeRoomObject) {
  return object.wallAxis === undefined && (object.solid || object.movable || isLampDecorationId(object.modelId));
}

export function contactShadowShape(object: Pick<NativeRoomObject, 'modelId'>) {
  const meta = NATIVE_MODEL_CATALOG[object.modelId];
  const spread = /sofa/i.test(object.modelId) ? .72 : .60;
  return { center: [(meta.min[0] + meta.max[0]) / 2, (meta.min[2] + meta.max[2]) / 2],
    radius: [(meta.max[0] - meta.min[0]) * spread, (meta.max[2] - meta.min[2]) * spread] };
}

/** Approximate the fire's floor projection when the renderer has no shadow maps. */
export function fireShadowReach(position: Vec3, fire: ObjectPose) {
  'worklet';
  const light = fireplaceLightPosition(fire);
  const dx = position[0] - light[0], dz = position[2] - light[2];
  const distance = Math.hypot(dx, dz);
  if (distance < .01) return 0;
  const facing = (dx * Math.sin(fire.heading) + dz * Math.cos(fire.heading)) / distance;
  return Math.max(0, 1 - distance / (2.8 * fire.scale)) * Math.max(0, facing);
}

/** Contact shadows follow the saved yaw and the same drawing-thread drag preview. */
export function contactShadowPose(object: ObjectPose, shape: ReturnType<typeof contactShadowShape>, rugs: ReturnType<typeof buildRugSurfaces>, fire?: ObjectPose, cat = false) {
  'worklet';
  let heading = object.heading;
  const c = Math.cos(heading), s = Math.sin(heading);
  const position: Vec3 = [object.position[0] + (c * shape.center[0] + s * shape.center[1]) * object.scale,
    FLOOR_Y + .004, object.position[2] + (-s * shape.center[0] + c * shape.center[1]) * object.scale];
  const radius = shape.radius.map(value => value * object.scale);
  const reach = fire ? fireShadowReach(position, fire) : 0;
  if (cat && (reach === 0 || object.position[1] > FLOOR_Y + .35 * object.scale)) {
    return { position, scale: [0, 1, 0] as Vec3, heading };
  }
  if (fire && reach > 0) {
    const light = fireplaceLightPosition(fire);
    const angle = Math.atan2(position[0] - light[0], position[2] - light[2]);
    const extension = reach * Math.min(.64 * fire.scale, Math.max(...radius) * 1.4);
    position[0] = Math.max(-2.455, Math.min(2.455, position[0] + Math.sin(angle) * extension));
    position[2] = Math.max(-2.455, Math.min(2.455, position[2] + Math.cos(angle) * extension));
    if (cat) {
      heading = angle;
      const fade = Math.min(1, reach * 4);
      radius[0] *= fade;
      radius[1] = (radius[1] + extension) * fade;
    } else {
      radius[0] += extension * Math.abs(Math.sin(angle - heading));
      radius[1] += extension * Math.abs(Math.cos(angle - heading));
    }
  }
  const extentX = Math.abs(Math.cos(heading)) * radius[0] + Math.abs(Math.sin(heading)) * radius[1];
  const extentZ = Math.abs(Math.sin(heading)) * radius[0] + Math.abs(Math.cos(heading)) * radius[1];
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
  return { position, scale: [radius[0], 1, radius[1]] as Vec3, heading };
}
