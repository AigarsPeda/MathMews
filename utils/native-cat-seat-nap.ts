import type { CatSleepPose } from '@/constants/cat-sleep';
import type { Vec3 } from '@/utils/native-room-world';

export type NapFoot = { position: Vec3; axes: number[] };

function ease(value: number) {
  'worklet';
  const t = Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
}

/** Keep the authored head lift on waking. A seated cat joins the curl after
 * the standing clip has lowered its hips. The logical clock still reverses. */
export function seatNapPose(time: number, waking: boolean, seated: boolean, stretchTime?: number) {
  'worklet';
  if (stretchTime!==undefined) {
    const rise = ease(stretchTime/.72);
    return { curl:1-rise, sample:time, napWeight:rise };
  }
  const unfolding = ease((time-.25)/.75);
  const curl = waking ? 1-unfolding : time;
  return {
    curl,
    sample: seated ? (waking ? time-.40*unfolding : .56+.44*time) : time,
    napWeight: seated ? ease(curl/.82) : 1,
  };
}

/** Match the authored tuck order. Lift the pad before travelling across the
 * cushion, and finish travelling before it receives weight on waking. */
export function seatNapPaw(upright: NapFoot, tucked: NapFoot, pose: CatSleepPose, curl: number, paw: number) {
  'worklet';
  const rear = paw>=2, right = paw%2===1;
  const start = rear ? (pose==='Side' ? (right ? .43 : .32) : .22) : right ? .49 : .40;
  const end = rear ? (pose==='Side' ? (right ? .98 : .87) : .80) : right ? .98 : .90;
  const t = Math.max(0,Math.min(1,(curl-start)/(end-start)));
  const across = ease((t-.18)/.64), up = ease(t);
  const a = upright.position, b = tucked.position;
  const lift = Math.min(.08,.35*Math.hypot(b[0]-a[0],b[2]-a[2]))*Math.sin(Math.PI*t)**2;
  return {
    position: [a[0]+(b[0]-a[0])*across,a[1]+(b[1]-a[1])*up+lift,a[2]+(b[2]-a[2])*across] as Vec3,
    rotation: across,
  };
}
