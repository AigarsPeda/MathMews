import type { Vec3 } from '@/utils/native-room-world';

function smooth(start: number, end: number, time: number) {
  'worklet';
  const t=Math.max(0,Math.min(1,(time-start)/(end-start)));
  return t*t*(3-2*t);
}

/** Look farther along the validated route than the body's steering target.
 * Ease out near arrival so tiny target offsets cannot whip the head sideways. */
export function catTravelGaze(position: Vec3, heading: number, target: Vec3, scale: number) {
  'worklet';
  const dx=target[0]-position[0], dz=target[2]-position[2];
  const angle=Math.atan2(dx,dz)-heading;
  return Math.max(-.38,Math.min(.38,Math.atan2(Math.sin(angle),Math.cos(angle))))
    *smooth(.08,.45,Math.hypot(dx,dz)/scale);
}

/** Secondary movement stays away from the root and all four contact legs. */
export function catJumpExpression(phase: number, from: Vec3, to: Vec3, scale: number) {
  'worklet';
  const t=Math.max(0,Math.min(1,phase)),distance=Math.hypot(to[0]-from[0],to[2]-from[2]);
  const effort=Math.max(.35,Math.min(1,distance/(4*scale)+Math.max(0,to[1]-from[1])/(3*scale)));
  const flight=smooth(.16,.40,t)*(1-smooth(.60,.90,t));
  const follow=smooth(.24,.49,t)*(1-smooth(.75,1,t));
  const look=smooth(0,.16,t)*(1-smooth(.65,1,t));
  return {
    headPitch:-Math.max(-.12,Math.min(.12,Math.atan2(to[1]-from[1],Math.max(.1*scale,distance))*.20))*look,
    tailBase:-.22*effort*flight,
    tailTip:-.12*effort*follow,
    tailCurl:.16*effort*follow*Math.sin(Math.PI*t),
  };
}

/** Quiet intervals separate short looks and tail-tip flicks. No random frame noise. */
export function catRestExpression(time: number, elapsed: number) {
  'worklet';
  const phase=((time%7.3)+7.3)%7.3;
  const look=smooth(.7,1.5,phase)*(1-smooth(3.2,4.2,phase))*smooth(0,.6,elapsed);
  const flick=smooth(4.8,5.1,phase)*(1-smooth(5.9,6.3,phase));
  return {look,tilt:.025*look,tailTip:.08*flick*Math.sin((phase-4.8)*Math.PI*2)};
}

/** Ears lead a look slightly; separate brief flicks avoid a metronomic wiggle. */
export function catEarReaction(time: number, yaw: number, turn: number, speed: number, resting: boolean) {
  'worklet';
  const phase=((time%7.3)+7.3)%7.3;
  const listen=smooth(.45,1.1,phase)*(1-smooth(3.2,4.2,phase));
  const flick=(offset:number)=> {
    const t=phase-offset;
    return t>0&&t<.48?Math.sin(Math.PI*t/.48)**2:0;
  };
  const aim=Math.max(-.22,Math.min(.22,turn+(resting?yaw*listen:0)));
  const tuck=-.10*Math.max(0,Math.min(1,(speed-1.5)/2));
  return {yaw:aim,left:tuck-(resting?.12*flick(5.0):0),right:tuck-(resting?.09*flick(5.17):0)};
}


/** A distance-driven wave travels down the tail, with counterbalance through
 * bends. These offsets never translate the tail root or any planted paw. */
export function catTravelTail(phase: number, speed: number, turnRate: number) {
  'worklet';
  const amount=Math.max(0,Math.min(1,speed/1.8));
  const running=Math.max(0,Math.min(1,(speed-2)/2.6));
  // A broad balance wave spans three strides, rather than wagging on
  // every footfall. The distal joints follow with increasing delay.
  const wave=phase*Math.PI*2/3;
  const counter=-Math.max(-.14,Math.min(.14,turnRate*.045))*amount;
  return {
    yaw:[0,1,2,3].map(i=>amount*(.045+i*.025)*Math.sin(wave-i*.7)+counter*(1-i*.14)),
    pitch:[0,1,2,3].map(i=>running*(-.10/(i+1)+.035*Math.sin(wave-i*.65))),
  };
}
