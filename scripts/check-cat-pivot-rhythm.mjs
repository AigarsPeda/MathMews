/** Count actual lifted-paw events and retain the production pose for visual review. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,idle} from './check-cat-turning.mjs';
const {catTurnDuration}=load('@/utils/native-cat-turn');
const {FLOOR_Y}=load('@/utils/native-room-world');
const poses=[],metrics=[];
const names=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
for(const degrees of [-180,-90,45,90,180]) {
  openSkin('orange');resetCatActor();
  const scale=.8,home=[0,FLOOR_Y,0],world={width:390,height:420,catScale:scale,radius:.3,home,objects:[]};
  render({active:true,world,playback:idle,travel:{path:[home],heading:0,duration:0,distance:0,jump:false}});drawCat(1/60);
  const feet=names.map(n=>actorBones()[n].slice(12,15));
  render({active:true,world,playback:idle,activityKey:'pivot',travel:{path:[home],heading:degrees*Math.PI/180,duration:2,distance:0,jump:false}});
  const duration=catTurnDuration(degrees*Math.PI/180);
  let previous=[false,false,false,false],placements=0;
  for(let frame=0;frame<=Math.ceil((duration+.1)*60);frame++) {
    drawCat(1/60);const bones=actorBones(),state=actorState();
    const lifted=names.map((name,i)=>bones[name][13]>feet[i][1]+.002*scale);
    placements+=lifted.filter((v,i)=>v&&!previous[i]).length;
    assert.ok(lifted.filter(Boolean).length<=2,'Never leave fewer than two supporting paws');
    if(lifted.filter(Boolean).length===2)
      assert.ok(lifted[0]===lifted[3]&&lifted[1]===lifted[2],'Support spans opposite corners, never both feet on one side');
    assert.ok(Math.hypot(...state.position.map((v,i)=>v-home[i]))<1e-8,'The supported turn keeps its safe footprint');
    if(frame%2===0&&[90,180].includes(degrees))poses.push({degrees,progress:(frame+1)/60/duration,nodes:bones});
    previous=lifted;
  }
  assert.equal(placements,Math.abs(degrees)<=90?4:8,'Four placements per quarter-turn replace repeated microsteps');
  assert.ok(duration<=1.12+1e-8,'A half-turn must not delay the next action');
  metrics.push({degrees,duration,placements});
}
fs.writeFileSync('/tmp/brainpet-turn-poses.json',JSON.stringify(poses));
fs.writeFileSync('/tmp/brainpet-pivot-rhythm-metrics.json',JSON.stringify(metrics,null,2));
console.log('Verified purposeful pivot rhythm: four placements per quarter-turn, eight per half-turn, diagonal support and a fixed footprint.');
