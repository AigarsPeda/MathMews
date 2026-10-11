import { LAMP_LIGHT_ORIGINS, isWallSpotlightDecorationId, normalizeSpotlightAngle, normalizeSpotlightSwivel, SPOTLIGHT_PIVOT } from '@/constants/decoration-motion';
import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

/** Light origins are measured inside the shade or bottle in model coordinates. */
export function lampLightPose(object: Pick<NativeRoomObject, 'modelId' | 'spotlightAngle' | 'spotlightSwivel' | 'heading' | 'position' | 'scale'>) {
  'worklet';
  // Keep the pose usable on the drawing thread without JS-side classification.
  const wall = object.modelId.startsWith('wallSpot');
  const angle = (object.spotlightAngle ?? -25) * Math.PI / 180;
  const turn = (object.spotlightSwivel ?? 0) * Math.PI / 180;
  // Match the head's tilt, then its swivel around the vertical pivot axis.
  const direction: Vec3 = wall ? [-Math.sin(angle) * Math.sin(turn), -Math.cos(angle), -Math.sin(angle) * Math.cos(turn)] : [0, -1, 0];
  const local = wall ? [SPOTLIGHT_PIVOT[0] + direction[0] * .16,
    SPOTLIGHT_PIVOT[1] + direction[1] * .16, SPOTLIGHT_PIVOT[2] + direction[2] * .16] : LAMP_LIGHT_ORIGINS[object.modelId];
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  return {
    position: [object.position[0] + (c * local[0] + s * local[2]) * object.scale,
      object.position[1] + local[1] * object.scale,
      object.position[2] + (-s * local[0] + c * local[2]) * object.scale] as Vec3,
    direction: [c * direction[0] + s * direction[2], direction[1], -s * direction[0] + c * direction[2]] as Vec3,
  };
}

export function lampLightConfig(object: NativeRoomObject) {
  const local = LAMP_LIGHT_ORIGINS[object.modelId];
  if (!local || !object.poweredOn) return undefined;
  const wall = isWallSpotlightDecorationId(object.modelId);
  const { position, direction } = lampLightPose({ ...object, spotlightAngle: normalizeSpotlightAngle(object.spotlightAngle), spotlightSwivel: normalizeSpotlightSwivel(object.spotlightSwivel) });
  const lava = object.modelId === 'lavaLampOff' || object.modelId === 'lavaLampAni';
  const lantern = object.modelId === 'halloweenGhostLantern';
  return {
    type: lava || lantern ? 'point' as const : 'spot' as const,
    position,
    direction,
    colorKelvin: lava ? 2200 : wall ? 3000 : 2700,
    // The room's daylight is bright; enough power makes the warm pool visible.
    intensity: (lava ? 160_000 : lantern || wall ? 95_000 : 230_000) * object.scale * object.scale,
    // Keep light volumes bounded; attenuation fades before their outer limit.
    falloffRadius: Math.max(3, (lava ? 5 : 3) * object.scale),
    // A focused core fades smoothly to the outer cone.
    spotLightCone: (wall ? [.30, .85] : lava ? [.35, .85] : [.65, 1.45]) as [number, number],
    // Keep local lights inexpensive when several lamps are placed in a room.
    castShadows: false,
  };
}

/** A focused shade target remains tappable when a sofa overlaps the lamp's bounds. */
export function lampSwitchPosition(object: NativeRoomObject): Vec3 | undefined {
  const light = lampLightConfig({ ...object, poweredOn: true });
  return light ? [light.position[0], light.position[1] + .25 * object.scale, light.position[2]] : undefined;
}
