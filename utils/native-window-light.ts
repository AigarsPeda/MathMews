import { isWindowDecorationId } from '@/constants/window-decorations';
import { NATIVE_MODEL_CATALOG, type NativeRoomObject, type Vec3 } from '@/utils/native-room-world';

export function isWindowLightSource(modelId: string) {
  return isWindowDecorationId(modelId) || modelId === 'bathroomBathWindow';
}

/** Emit just inside the room, beyond the opaque glass and frame. */
export function windowLightConfig(object: NativeRoomObject) {
  const model = NATIVE_MODEL_CATALOG[object.modelId];
  const local: Vec3 = [(model.min[0] + model.max[0]) / 2, (model.min[1] + model.max[1]) / 2, model.max[2] + .06];
  const c = Math.cos(object.heading), s = Math.sin(object.heading);
  const position: Vec3 = [object.position[0] + (c * local[0] + s * local[2]) * object.scale,
    object.position[1] + local[1] * object.scale,
    object.position[2] + (-s * local[0] + c * local[2]) * object.scale];
  const length = Math.hypot(1, .65);
  const direction: Vec3 = [s / length, -.65 / length, c / length];
  const width = (model.max[0] - model.min[0]) * object.scale;
  const height = (model.max[1] - model.min[1]) * object.scale;
  // Curtains, blinds and shoji panels transmit less light than clear glass.
  const transmission = /Blinds|Japanese/.test(object.modelId) ? .45 : /^window(?:7|8|11)/.test(object.modelId) ? .7 : 1;
  return { position, direction, width, area: Math.min(3, width * height * .55) * transmission };
}

/** Dark night sky, independent of the moonlight falling into the room. */
export function windowPaneColor(daylight: number, flash = 0): [number, number, number, number] {
  'worklet';
  const base = [.025 + .345 * daylight, .045 + .525 * daylight, .09 + .67 * daylight];
  return [base[0] + (.7 - base[0]) * flash, base[1] + (.84 - base[1]) * flash, base[2] + (1 - base[2]) * flash, 1];
}

export function windowLightIntensity(area: number, daylight: number, flash = 0) {
  'worklet';
  return area * (600_000 + 600_000 * daylight + 6_000_000 * flash);
}

export function windowLightColor(daylight: number, flash = 0): Vec3 {
  'worklet';
  const base = [.52 + .48 * daylight, .70 + .27 * daylight, 1 - .13 * daylight];
  return [base[0] + (.72 - base[0]) * flash, base[1] + (.86 - base[1]) * flash, base[2] + (1 - base[2]) * flash];
}

/** A faint reflection on the frame; the glass remains the source of room light. */
export function windowFrameEmission(daylight: number, flash = 0): [number, number, number, number] {
  'worklet';
  const color = windowLightColor(daylight, flash), strength = .035 + .035 * daylight + 1.4 * flash;
  return [color[0] * strength, color[1] * strength, color[2] * strength, 1];
}
