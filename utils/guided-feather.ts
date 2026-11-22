import { projectWorld, ROOM_SPAN, type Vec3 } from '@/utils/native-room-world';

export type FeatherTouch = { x: number; y: number };
export type FeatherResponse = {
  target: Vec3; still: number; swat: number; strike?: Vec3; paw: number; pin: boolean;
};

/** Place the toy on the camera-facing vertical plane just in front of the paws. */
export function followFeather(touch: FeatherTouch, cat: Vec3, heading: number, scale: number, width: number,
  dt: number, previous?: FeatherResponse): FeatherResponse {
  'worklet';
  const reach = .76 * scale;
  const front: Vec3 = [cat[0] + Math.sin(heading) * reach, cat[1], cat[2] + Math.cos(heading) * reach];
  const floor = projectWorld(front, width);
  const high = projectWorld([front[0], front[1] + 1, front[2]], width);
  const across = (touch.x - floor.x) * ROOM_SPAN / width;
  const height = Math.max(.12 * scale, (floor.y - touch.y) / (floor.y - high.y));
  const side = across * Math.SQRT1_2;
  const target: Vec3 = [front[0] + side, cat[1] + height, front[2] - side];
  const travel = previous ? Math.hypot(target[0] - previous.target[0], target[1] - previous.target[1],
    target[2] - previous.target[2]) / scale : 0;
  const speed = travel / Math.max(.001, dt);
  const still = speed < .4 ? (previous?.still ?? 0) + dt : 0;
  const near = Math.abs(across) < .78 * scale && height < 1.20 * scale;
  const pin = Math.abs(across) < .43 * scale && height < .52 * scale && still >= .38;
  // Finish a swat before another fast pass can trigger the opposite paw.
  let swat = Math.max(0, (previous?.swat ?? 0) - dt);
  let paw = previous?.paw ?? 0;
  let strike = swat > 0 ? previous?.strike : undefined;
  if (!swat && near && speed > 2) {
    swat = .46;
    strike = target;
    paw = across < 0 ? 0 : 1;
  }
  return { target, still, swat, strike, paw, pin };
}
