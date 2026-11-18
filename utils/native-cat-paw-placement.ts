import type { Entity, TransformManager } from 'react-native-filament';
import { tailParentAxis } from '@/utils/native-cat-contact';
import { limbAim, reachingElbow } from '@/utils/native-hanging-toy';
import type { Vec3 } from '@/utils/native-room-world';

type Leg = { upper: Entity; lower: Entity; paw: Entity; parent: Entity; rear: boolean };

export function yawPawVector(vector: Vec3, angle: number): Vec3 {
  'worklet';
  const c = Math.cos(angle), s = Math.sin(angle);
  return [vector[0]*c+vector[2]*s, vector[1], vector[2]*c-vector[0]*s];
}

function localPawVector(root: number[], vector: Vec3): Vec3 {
  'worklet';
  return [0,4,8].map(k => (vector[0]*root[k]+vector[1]*root[k+1]+vector[2]*root[k+2]) /
    (root[k]**2+root[k+1]**2+root[k+2]**2)) as Vec3;
}

export function worldPawVector(root: number[], vector: Vec3): Vec3 {
  'worklet';
  return [0,1,2].map(k => vector[0]*root[k]+vector[1]*root[4+k]+vector[2]*root[8+k]) as Vec3;
}

/** Keep the ankle's across and up axes in the support frame where it planted. */
export function localSoleAxes(sole: number[], heading: number, root?: number[]) {
  'worklet';
  return [0,4].flatMap(k => {
    const axis: Vec3 = [sole[k], sole[k+1], sole[k+2]];
    return root ? localPawVector(root, axis) : yawPawVector(axis, -heading);
  });
}

export function localPawPoint(root: number[], point: Vec3): Vec3 {
  'worklet';
  return localPawVector(root, [point[0]-root[12], point[1]-root[13], point[2]-root[14]]);
}

export function worldPawPoint(root: number[], local: Vec3): Vec3 {
  'worklet';
  return [0,1,2].map(k => root[12+k]+local[0]*root[k]+local[1]*root[4+k]+local[2]*root[8+k]) as Vec3;
}

/** A seated shin and its paw have compensating scales in the rig. Their
 * crossfade can stretch a planted mitten even when its ankle stays still. */
export function holdPawSize(transformManager: TransformManager, leg: Leg, size: number) {
  'worklet';
  const world = transformManager.getWorldTransform(leg.paw).data;
  const ratio = size / Math.hypot(world[0],world[1],world[2]);
  if (Math.abs(1-ratio)<.0001) return;
  const local = transformManager.getTransform(leg.paw), origin = local.translation;
  transformManager.setTransform(leg.paw,local.translate(origin.map(v=>-v) as Vec3)
    .scaling([ratio,ratio,ratio]).translate(origin));
}

/** Rotate the mitten about its own pivot around the room's vertical axis. */
export function turnCatPaw(transformManager: TransformManager, leg: Leg, angle: number) {
  'worklet';
  if (Math.abs(angle) <= .00001) return;
  const pad = transformManager.getTransform(leg.paw), pivot = pad.translation;
  const parent = transformManager.getWorldTransform(leg.lower).data;
  transformManager.setTransform(leg.paw, pad.translate(pivot.map(v => -v) as Vec3)
    .rotate(angle, tailParentAxis([0,1,0], parent)).translate(pivot));
}

/** Reach a world-space pad target while retaining the sole's orientation. */
export function placeCatPaw(transformManager: TransformManager, leg: Leg, reach: Vec3, sole: number[], heading: number, scale: number, adjustShoulder = true) {
  'worklet';
  let shoulder=transformManager.getWorldTransform(leg.upper).translation;
  const elbow=transformManager.getWorldTransform(leg.lower).translation,paw=transformManager.getWorldTransform(leg.paw).translation;
  const length=Math.hypot(...elbow.map((v,k)=>v-shoulder[k]))+Math.hypot(...paw.map((v,k)=>v-elbow[k]));
  const distance=Math.hypot(...reach.map((v,k)=>v-shoulder[k]));
  // At full extension, give back only the unreachable shoulder offset.
  if(adjustShoulder && distance>length-.002*scale) {
    const correction=reach.map((v,k)=>(v-shoulder[k])/distance*(distance-length+.002*scale)) as Vec3;
    const local=transformManager.getTransform(leg.upper),parent=transformManager.getWorldTransform(leg.parent).data;
    const magnitude=Math.hypot(...correction);
    transformManager.setTransform(leg.upper,local.translate(tailParentAxis(correction,parent).map(v=>v*magnitude/scale) as Vec3));
    shoulder=transformManager.getWorldTransform(leg.upper).translation;
  }
  const currentElbow=transformManager.getWorldTransform(leg.lower).translation,currentPaw=transformManager.getWorldTransform(leg.paw).translation;
  const knee=reachingElbow(shoulder,currentElbow,currentPaw,reach,heading+(leg.rear?Math.PI:0));
  const aim=limbAim(currentElbow.map((v,k)=>v-shoulder[k]) as Vec3,knee.map((v,k)=>v-shoulder[k]) as Vec3);
  const local=transformManager.getTransform(leg.upper),origin=local.translation;
  transformManager.setTransform(leg.upper,local.translate(origin.map(v=>-v) as Vec3)
    .rotate(aim.angle,tailParentAxis(aim.axis,transformManager.getWorldTransform(leg.parent).data)).translate(origin));
  const movedElbow=transformManager.getWorldTransform(leg.lower).translation,movedPaw=transformManager.getWorldTransform(leg.paw).translation;
  const lowerAim=limbAim(movedPaw.map((v,k)=>v-movedElbow[k]) as Vec3,reach.map((v,k)=>v-movedElbow[k]) as Vec3);
  const lower=transformManager.getTransform(leg.lower),pivot=lower.translation;
  transformManager.setTransform(leg.lower,lower.translate(pivot.map(v=>-v) as Vec3)
    .rotate(lowerAim.angle,tailParentAxis(lowerAim.axis,transformManager.getWorldTransform(leg.upper).data)).translate(pivot));
  for(const column of [4,0]) {
    const current=transformManager.getWorldTransform(leg.paw).data;
    const padAim=limbAim([current[column],current[column+1],current[column+2]],[sole[column],sole[column+1],sole[column+2]]);
    const pad=transformManager.getTransform(leg.paw),padOrigin=pad.translation;
    transformManager.setTransform(leg.paw,pad.translate(padOrigin.map(v=>-v) as Vec3)
      .rotate(padAim.angle,tailParentAxis(padAim.axis,transformManager.getWorldTransform(leg.lower).data)).translate(padOrigin));
  }
}
