/** Count actual lifted-paw events and retain the production pose for visual review. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,idle} from './check-cat-turning.mjs';
const {catTurnDuration}=load('@/utils/native-cat-turn');
const {FLOOR_Y}=load('@/utils/native-room-world');
const poses=[],metrics=[];
const names=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
// Count the paw lifts on the rendered skeleton, including both sides of the stride boundaries.
for(const [degrees,expectedLifts] of [[-180,12],[-90,8],[-45,4],[45,4],[60,4],[61,8],[90,8],[120,8],[121,12],[180,12]]) {
  openSkin('orange');resetCatActor();
  const scale=.8,home=[0,FLOOR_Y,0],world={width:390,height:420,catScale:scale,radius:.3,home,objects:[]};
  render({active:true,world,playback:idle,travel:{path:[home],heading:0,duration:0,distance:0,jump:false}});drawCat(1/60);
  const feet=names.map(n=>actorBones()[n].slice(12,15));
  render({active:true,world,playback:idle,activityKey:'pivot',travel:{path:[home],heading:degrees*Math.PI/180,duration:2,distance:0,jump:false}});
  const duration=catTurnDuration(degrees*Math.PI/180);
  const standingHeight=actorBones().spine[13];
  let previous=[false,false,false,false],placements=0,maxReach=0,maxDrop=0,minGap=Infinity,minKneeBend=Math.PI;
  for(let frame=0;frame<=Math.ceil((duration+.1)*60);frame++) {
    drawCat(1/60);const bones=actorBones(),state=actorState();
    maxDrop=Math.max(maxDrop,(standingHeight-bones.spine[13])/scale);
    for(const part of ['front','rear']) {
      const left=bones[`L.${part}.paw`],right=bones[`R.${part}.paw`];
      const dx=(right[12]-left[12])/scale,dz=(right[14]-left[14])/scale;
      const across=dx*Math.cos(state.heading)-dz*Math.sin(state.heading);
      minGap=Math.min(minGap,across);
      for(const side of ['L','R']) {
        const paw=bones[`${side}.${part}.paw`],joint=bones[`${side}.${part==='front'?'foreleg':'hindleg'}joint0`];
        const knee=bones[`${side}.${part==='front'?'foreleg':'hindleg'}joint1`];
        const upper=[12,13,14].map(k=>knee[k]-joint[k]),lower=[12,13,14].map(k=>paw[k]-knee[k]);
        const cosine=upper.reduce((sum,v,k)=>sum+v*lower[k],0)/(Math.hypot(...upper)*Math.hypot(...lower));
        minKneeBend=Math.min(minKneeBend,Math.acos(Math.max(-1,Math.min(1,cosine))));
        maxReach=Math.max(maxReach,Math.hypot(paw[12]-joint[12],paw[14]-joint[14])/scale);
      }
    }
    assert.ok(maxDrop<.07,'The plush cat stays close to standing height');
    assert.ok(maxReach<.29 && minKneeBend>Math.PI/36,'Broader steps stay within reach with at least five degrees of bend in every leg');
    assert.ok(minGap>.30,'Mitten paws never overlap their opposite partner');
    const lifted=names.map((name,i)=>bones[name][13]>feet[i][1]+.002*scale);
    placements+=lifted.filter((v,i)=>v&&!previous[i]).length;
    assert.ok(lifted.filter(Boolean).length<=2,'Never leave fewer than two supporting paws');
    if(lifted.filter(Boolean).length===2)
      assert.ok(lifted[0]===lifted[3]&&lifted[1]===lifted[2],'Support spans opposite corners, never both feet on one side');
    assert.ok(Math.hypot(...state.position.map((v,i)=>v-home[i]))<1e-8,'The supported turn keeps its safe footprint');
    if(frame%2===0&&[90,180].includes(degrees))poses.push({degrees,progress:(frame+1)/60/duration,nodes:bones});
    previous=lifted;
  }
  assert.equal(placements,expectedLifts,`${degrees}° turn uses broad placements without extra lifts`);
  assert.ok(duration<=1.12+1e-8,'A half-turn must not delay the next action');
  metrics.push({degrees,duration,placements,maxDrop,maxReach,minGap,minKneeBend});
}
fs.writeFileSync('/tmp/brainpet-turn-poses.json',JSON.stringify(poses));
fs.writeFileSync('/tmp/brainpet-pivot-rhythm-metrics.json',JSON.stringify(metrics,null,2));
console.log('Verified purposeful pivot rhythm: broad paw placements within the original turn duration, diagonal support and a fixed footprint.');
