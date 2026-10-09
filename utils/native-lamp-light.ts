import { LAMP_LIGHT_ORIGINS } from '@/constants/decoration-motion';
import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

/** Lamp origins are measured below the shade in the exported model's coordinates. */
export function lampLightConfig(object: NativeRoomObject) {
  const local = LAMP_LIGHT_ORIGINS[object.modelId];
  if (!local || !object.poweredOn) return undefined;
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  const position: Vec3 = [
    object.position[0] + (c * local[0] + s * local[2]) * object.scale,
    object.position[1] + local[1] * object.scale,
    object.position[2] + (-s * local[0] + c * local[2]) * object.scale,
  ];
  return {
    type: 'spot' as const,
    position,
    direction: [0, -1, 0] as Vec3,
    colorKelvin: 2700,
    // The room's daylight is bright; enough power makes the warm pool visible.
    intensity: 150_000 * object.scale * object.scale,
    falloffRadius: 3 * object.scale,
    spotLightCone: [.35, .85] as [number, number],
    // Keep local lights inexpensive when several lamps are placed in a room.
    castShadows: false,
  };
}

/** A focused shade target remains tappable when a sofa overlaps the lamp's bounds. */
export function lampSwitchPosition(object: NativeRoomObject): Vec3 | undefined {
  const light = lampLightConfig({ ...object, poweredOn: true });
  return light ? [light.position[0], light.position[1] + .25 * object.scale, light.position[2]] : undefined;
}
