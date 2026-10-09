import { isCurtainDecorationId } from '@/constants/decoration-motion';
import { NATIVE_MODEL_CATALOG, type NativeRoomObject } from '@/utils/native-room-world';
import { isWindowLightSource, windowLightColor } from '@/utils/native-window-light';
import windowMounts from '@/constants/window-mount-bounds.json';

export type CurtainProgress = Record<string, number>;
export type CurtainCoverage = { instanceId: string; coverage: number; open: number; transmission: number };

/** Closed panels meet in the middle; open panels gather beneath the rod ends. */
export function curtainPanelPose(open: number, side: number) {
  'worklet';
  const eased = open * open * (3 - 2 * open);
  return { x: side * (.45 + .35 * eased), width: 1 - .72 * eased, tieback: eased };
}

export const CURTAIN_ROD_HEIGHT = 1.87;
export const CURTAIN_HEIGHT_SCALE = .76;

/** Keep the hanging rings at the rod while the cloth slopes over a deep sill. */
export function curtainPanelTilt(curtain: NativeRoomObject, windows: NativeRoomObject[]): number {
  let tilt = 0;
  for (const window of windows) {
    if (Math.cos(window.heading - curtain.heading) < .999 || curtainWindowCoverage(window, curtain) === 0) continue;
    const mount = windowMounts[window.modelId as keyof typeof windowMounts];
    if (!mount || !('sill' in mount)) continue;
    const c = Math.cos(window.heading), s = Math.sin(window.heading);
    const depth = s * (curtain.position[0] - window.position[0]) + c * (curtain.position[2] - window.position[2]);
    const top = curtain.position[1] + CURTAIN_ROD_HEIGHT * CURTAIN_HEIGHT_SCALE * curtain.scale;
    const sillTop = window.position[1] + mount.sill.max[1] * window.scale;
    const distance = mount.sill.max[2] * window.scale + .015 - depth;
    const rise = (top - sillTop) / CURTAIN_HEIGHT_SCALE;
    if (rise > 0 && distance + .013 * curtain.scale > 0)
      tilt = Math.max(tilt, Math.atan2(distance, rise) + Math.asin(.013 * curtain.scale / Math.hypot(rise, distance)));
  }
  return tilt;
}

export function advanceCurtain(open: number, target: number, dt: number, reduceMotion: boolean) {
  'worklet';
  if (reduceMotion) return target;
  const step = Math.max(0, Math.min(.1, dt)) / .65;
  return open < target ? Math.min(target, open + step) : Math.max(target, open - step);
}

/** Aperture overlap in the window's plane, excluding nearby perpendicular walls. */
export function curtainWindowCoverage(window: NativeRoomObject, curtain: NativeRoomObject): number {
  if (!isWindowLightSource(window.modelId) || !isCurtainDecorationId(curtain.modelId) ||
      Math.cos(window.heading - curtain.heading) < .95) return 0;
  const c = Math.cos(window.heading), s = Math.sin(window.heading);
  const dx = curtain.position[0] - window.position[0], dz = curtain.position[2] - window.position[2];
  const across = c * dx - s * dz, depth = s * dx + c * dz;
  // The fabric must be in front of this window, within its mounting depth.
  if (depth < -.05 || depth > .8) return 0;
  const model = NATIVE_MODEL_CATALOG[window.modelId];
  const left = model.min[0] * window.scale, right = model.max[0] * window.scale;
  const bottom = window.position[1] + model.min[1] * window.scale;
  const top = window.position[1] + model.max[1] * window.scale;
  const overlapX = Math.max(0, Math.min(right, across + .90 * curtain.scale) - Math.max(left, across - .90 * curtain.scale));
  const overlapY = Math.max(0, Math.min(top, curtain.position[1] + 1.3528 * curtain.scale) - Math.max(bottom, curtain.position[1] + .0988 * curtain.scale));
  return Math.min(1, overlapX * overlapY / Math.max(.001, (right - left) * (top - bottom)));
}

export function windowCurtains(window: NativeRoomObject, objects: NativeRoomObject[]): CurtainCoverage[] {
  return objects.filter(object => isCurtainDecorationId(object.modelId)).flatMap(object => {
    const coverage = curtainWindowCoverage(window, object);
    return coverage > 0 ? [{ instanceId: object.instanceId, coverage, open: object.curtainOpen === false ? 0 : 1,
      transmission: object.modelId === 'curtainCreamLinen' ? .28 : .12 }] : [];
  });
}

export function curtainLightTransmission(curtains: CurtainCoverage[], progress: CurtainProgress): number {
  'worklet';
  let transmission = 1;
  for (const curtain of curtains) {
    const open = progress[curtain.instanceId] ?? curtain.open;
    const closed = 1 - (open * open * (3 - 2 * open));
    transmission *= 1 - curtain.coverage * closed * (1 - curtain.transmission);
  }
  return transmission;
}

/** Backlit fabric keeps its own colour while picking up sun or cool moonlight. */
export function curtainEmission(base: number[], daylight: number, clouds: number, exposure: number, open: number, flash = 0): [number, number, number, number] {
  'worklet';
  const light = windowLightColor(daylight, flash);
  const strength = exposure * clouds * ((.24 + .18 * (1 - open)) * (1 - .65 * daylight) + .65 * flash);
  return [base[0] * light[0] * strength, base[1] * light[1] * strength, base[2] * light[2] * strength, 1];
}

/** Align the rod just above the chosen window, with the panels centred on its frame. */
export function curtainAtWindow(curtain: NativeRoomObject, window: NativeRoomObject): NativeRoomObject {
  const meta = NATIVE_MODEL_CATALOG[curtain.modelId];
  const across = curtain.wallAxis === 0 ? 2 : 0;
  const delta = [0, window.max[1] + .06 - (curtain.position[1] + meta.max[1] * curtain.scale), 0];
  const middle = (window.min[across] + window.max[across]) / 2;
  delta[across] = middle - curtain.position[across];
  delta[across] = Math.max(-2.30 - curtain.min[across], Math.min(2.30 - curtain.max[across], delta[across]));
  delta[1] = Math.max(.18 - curtain.min[1], Math.min(2.65 - curtain.max[1], delta[1]));
  const move = (point: number[]) => point.map((value,i) => value + delta[i]) as [number,number,number];
  return { ...curtain, position: move(curtain.position), min: move(curtain.min), max: move(curtain.max) };
}
