import { ROOM_SPAN, type Vec3 } from '@/utils/native-room-world';

export const ROOM_CAMERA_EYE: Vec3 = [56, 43.6, 56];
export const ROOM_CAMERA_TARGET: Vec3 = [0, .9, 0];
export const ROOM_CAMERA_DISTANCE = Math.hypot(56, 42.7, 56);

/** Distant perspective avoids Filament's orthographic local-light culling seams. */
export function configureRoomCamera(camera: {
  setProjection: (fov: number, aspect: number, near: number, far: number, direction: 'vertical') => void;
  lookAt: (eye: Vec3, target: Vec3, up: Vec3) => void;
}, aspect: number) {
  'worklet';
  // Keep the entire room inside Filament's default 100-unit lighting range.
  const distance = ROOM_CAMERA_DISTANCE;
  const fov = 2 * Math.atan(ROOM_SPAN / (2 * aspect * distance)) * 180 / Math.PI;
  // The native binding needs its fifth argument, despite the four-argument TS declaration.
  camera.setProjection(fov, aspect, distance - 8, distance + 8, 'vertical');
  camera.lookAt(ROOM_CAMERA_EYE, ROOM_CAMERA_TARGET, [0, 1, 0]);
}
