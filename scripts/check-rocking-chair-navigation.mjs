/** The chair beside the sofa has room for a tucked jumping cat, not its full walking tail envelope. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,idle,walking,enableActorCrossfade} from './check-cat-turning.mjs';
const w=load('@/utils/native-room-world');
const {buildRoomActivity}=load('@/utils/room-activities');
const {catJumpPoint}=load('@/utils/native-cat-locomotion');
const fixture=JSON.parse(fs.readFileSync('scripts/fixtures/rocking-chair-navigation.json'));
function setup(width,height) {
  const options={width,height,petSize:80,sizeScale:1.15,homeOffset:fixture.roomPetOffset,
    decorations:fixture.placedDecorations,toys:fixture.placedToys,ownedToyIds:[]};
  const world=w.buildNativeRoomWorld(options),chair=world.objects.find(o=>o.modelId==='chairRockingOak');
  const plan=buildRoomActivity({...options,nativeWorld:world},0,'sofaSit',chair.instanceId);
  assert.ok(plan,'The selected chair offers a sitting activity');
  return {world,chair,plan};
}
for(const [width,height] of [[351,390],[366,366],[366,390],[351,520],[390,650]]) {
  const {world,chair,plan}=setup(width,height);
  let at=world.home,prepared=plan,approach;
  for(let index=0;index<plan.steps.length;index++) {
    const step=w.prepareNativeStep(prepared,prepared.steps[index],w.catScreenPoint(at,world),world,at[1]);
    assert.equal(step.native.blocked,false,`${width}/${height}/${index}: walk, jump, sit and get down beside the sofa`);
    assert.ok(!step.kitchenNavigation,'Chair journeys retain normal floor clearance');
    if(index===0) {
      approach=step.native.path.at(-1);
      assert.ok(w.isFree(approach,world),'Takeoff reserves the complete walking footprint');
    }
    if(step.native.jump) {
      const [from,to]=step.native.path;
      assert.ok(w.pathLength([index===1?from:to,approach])<1e-6,'Use the same safe point for jumping up and down');
      for(let sample=0;sample<=100;sample++) {
        const p=catJumpPoint(from,to,sample/100,.35*world.catScale,true);
        for(const object of world.objects.filter(o=>o.solid&&o.instanceId!==chair.instanceId))
          for(const box of object.collisionBoxes??[object]) {
            const horizontal=Math.hypot(p[0]-Math.max(box.min[0],Math.min(box.max[0],p[0])),p[2]-Math.max(box.min[2],Math.min(box.max[2],p[2])));
            assert.ok(p[1]>=box.max[1]||p[1]+.8*world.catScale<=box.min[1]||horizontal>=.55*world.catScale,
              `${width}/${height}: jump clears ${object.modelId} at ${sample}%`);
          }
      }
    }
    at=step.native.path.at(-1);
    prepared={...prepared,steps:prepared.steps.map((old,i)=>i===index?step:old)};
  }
  assert.ok(w.hasNativeArrived(at,world.home),'The chair activity returns home');
  // A genuine obstacle in the flight/landing must still reject the command.
  const blockedWorld={...world,objects:[...world.objects,{instanceId:'seat-blocker',modelId:'test-blocker',solid:true,
    position:chair.seat,heading:0,scale:1,min:chair.seat.map(v=>v-.1),max:chair.seat.map(v=>v+.8)}]};
  assert.equal(w.findSeatApproach(world.home,chair,blockedWorld),undefined,'An occupied cushion stays unreachable');
}
const tight=setup(320,320);
assert.equal(w.findSeatApproach(tight.world.home,tight.chair,tight.world),undefined,'A sofa overlapping the landing envelope is still blocked');
// Play the prepared requests through the shipped skeleton, including the
// supported turn on the rotated chair and the next floor journey.
openSkin('orange');enableActorCrossfade();
for(const fps of [30,60,120]) {
  const {world,plan}=setup(366,390);
  resetCatActor();
  render({active:true,world,playback:idle});drawCat(0);
  let prepared=plan,at=world.home;
  for(let index=0;index<plan.steps.length;index++) {
    const step=w.prepareNativeStep(prepared,prepared.steps[index],w.catScreenPoint(at,world),world,at[1]);
    const walk=step.animation.startsWith('walk');
    const travel={...step.native,duration:step.animation==='sit'?.3:step.native.duration,awaitCompletion:true};
    const playback=walk?walking:{kind:'segment',segment:{assetKey:step.animation,loop:false}};
    let complete=0;
    render({active:true,world,playback,travel,activityKey:`chair-${index}`,onRoomStepComplete:()=>complete++});
    for(let frame=0;frame<Math.ceil((travel.duration+2.5)*fps);frame++)drawCat(1/fps);
    assert.equal(complete,1,`${fps}/${index}: actor completes the chair step exactly once`);
    at=[...actorState().position];
    assert.ok(w.pathLength([at,travel.path.at(-1)])<1e-6,`${fps}/${index}: rendered cat reaches the planned support`);
    prepared={...prepared,steps:prepared.steps.map((old,i)=>i===index?step:old)};
  }
}
console.log('Verified rocking chair entry, sitting, exit, full floor clearance and blocked landings in the furnished room.');
