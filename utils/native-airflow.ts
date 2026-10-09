import { isAirConditionerDecorationId } from '@/constants/decoration-motion';
import { NATIVE_MODEL_CATALOG, type NativeRoomObject, type Vec3 } from '@/utils/native-room-world';

export type AirflowSource = { position: Vec3; heading: number; scale: number };

/** Match the origin of the visible airflow strokes on either wall. */
export function airflowOrigin(object: NativeRoomObject): Vec3 {
  const center = NATIVE_MODEL_CATALOG[object.modelId].center;
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  return [object.position[0] + (c * center[0] + s * center[2]) * object.scale,
    object.position[1] + center[1] * object.scale,
    object.position[2] + (-s * center[0] + c * center[2]) * object.scale];
}

export function roomAirflowSources(objects: NativeRoomObject[]): AirflowSource[] {
  return objects.filter(object => isAirConditionerDecorationId(object.modelId) && object.poweredOn)
    .map(object => ({ position: airflowOrigin(object), heading: object.heading, scale: object.scale }));
}

/** A widening downward draft, with a soft edge and less force farther away. */
export function airflowStrength(point: Vec3, sources: AirflowSource[]): number {
  'worklet';
  let strength = 0;
  for (const source of sources) {
    const drop = source.position[1] - point[1];
    if (drop <= 0 || drop >= 3) continue;
    const dx = point[0] - source.position[0], dz = point[2] - source.position[2];
    const c = Math.cos(source.heading), s = Math.sin(source.heading);
    const across = dx * c - dz * s, forward = dx * s + dz * c;
    if (forward < -.2 * source.scale) continue;
    const width = .85 * source.scale + drop * .35;
    const depth = .5 * source.scale + drop * .55;
    const edge = Math.hypot(across / width, (forward - drop * .35) / depth);
    const fade = Math.max(0, 1 - edge);
    strength = Math.max(strength, fade * (2 - fade) * (1 - drop / 4));
  }
  return strength;
}
