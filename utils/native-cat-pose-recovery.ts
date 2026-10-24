import type { Vec3 } from '@/utils/native-room-world';

function rotation(m: number[]) {
  'worklet';
  // Normalize the columns so the correction contains rotation, not bone scale.
  const r=m.slice(0,12);
  for(let c=0;c<3;c++) {
    const n=Math.hypot(r[c*4],r[c*4+1],r[c*4+2]);
    for(let k=0;k<3;k++)r[c*4+k]/=n||1;
  }
  const trace=r[0]+r[5]+r[10];
  let q:number[];
  if(trace>0) {
    const s=Math.sqrt(trace+1)*2;
    q=[(r[6]-r[9])/s,(r[8]-r[2])/s,(r[1]-r[4])/s,s/4];
  } else {
    const i=r[0]>r[5]&&r[0]>r[10]?0:r[5]>r[10]?1:2,j=(i+1)%3,k=(i+2)%3;
    const s=Math.sqrt(Math.max(0,1+r[i*4+i]-r[j*4+j]-r[k*4+k]))*2;
    q=[0,0,0,0];q[i]=s/4;q[j]=(r[j*4+i]+r[i*4+j])/s;
    q[k]=(r[k*4+i]+r[i*4+k])/s;q[3]=(r[j*4+k]-r[k*4+j])/s;
  }
  return q;
}

/** Local correction from the new animation to the pose actually displayed.
 * Applied after IK, this retains interrupted contact and first-step offsets.
 */
export function catPoseCorrection(before: number[], after: number[]) {
  'worklet';
  const a=rotation(before),b=rotation(after);
  let q=[-a[3]*b[0]+a[0]*b[3]-a[1]*b[2]+a[2]*b[1],
    -a[3]*b[1]+a[0]*b[2]+a[1]*b[3]-a[2]*b[0],
    -a[3]*b[2]-a[0]*b[1]+a[1]*b[0]+a[2]*b[3],
    a[3]*b[3]+a[0]*b[0]+a[1]*b[1]+a[2]*b[2]];
  if(q[3]<0)q=q.map(v=>-v);
  const n=Math.hypot(q[0],q[1],q[2]);
  return {offset:before.slice(12,15).map((v,k)=>v-after[12+k]) as Vec3,
    axis:(n>1e-8?q.slice(0,3).map(v=>v/n):[0,1,0]) as Vec3,
    angle:2*Math.atan2(n,q[3])};
}
