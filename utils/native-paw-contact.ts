import type { Vec3 } from '@/utils/native-room-world';

export type PawObjectTarget = { instanceId: string; position: Vec3; radius: number };

function ease(a: number, b: number, value: number) {
  'worklet';
  const t=Math.max(0,Math.min(1,(value-a)/(b-a)));
  return t*t*(3-2*t);
}

/** Reach, briefly press, then release. The other forepaw keeps its authored support. */
export function pawReachWeight(phase: number, side: number) {
  'worklet';
  const contact=side===0?.34:.61;
  return ease(contact-.15,contact-.015,phase)*(1-ease(contact+.02,contact+.16,phase));
}

/** Aim the pad at the near surface, leaving a little bend in the elbow. */
export function pawSurfaceTarget(shoulder: Vec3, elbow: Vec3, paw: Vec3, center: Vec3, radius: number, scale: number): Vec3 {
  'worklet';
  const direction=center.map((v,i)=>v-shoulder[i]);
  const distance=Math.max(.0001,Math.hypot(...direction));
  const length=Math.hypot(...elbow.map((v,i)=>v-shoulder[i]))+Math.hypot(...paw.map((v,i)=>v-elbow[i]));
  const reach=Math.max(.001,Math.min(length-.025*scale,distance-radius-.065*scale));
  return shoulder.map((v,i)=>v+direction[i]/distance*reach) as Vec3;
}

/** A held or retreating paw cannot repeatedly kick a toy. Ignore teleport motion. */
export function pawContactImpulse(ball: Vec3, paw: Vec3, previous: Vec3 | undefined, dt: number, radius: number): Vec3 | undefined {
  'worklet';
  if(!previous || dt<=0)return undefined;
  const motion=paw.map((v,i)=>v-previous[i]);
  if(Math.hypot(...motion)>radius*6)return undefined;
  const direction=ball.map((v,i)=>v-previous[i]);
  const distance=Math.max(.0001,Math.hypot(...direction));
  const closing=motion.reduce((sum,v,i)=>sum+v*direction[i]/distance,0)/dt;
  if(closing<.035)return undefined;
  const strength=Math.min(.12,Math.max(.045,closing*.07));
  const horizontal=Math.max(.001,Math.hypot(direction[0],direction[2]));
  return [direction[0]/horizontal*strength,.012,direction[2]/horizontal*strength];
}
