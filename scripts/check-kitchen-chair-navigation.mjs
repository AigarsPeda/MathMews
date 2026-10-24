/** Saved kitchen: leave the fridge, nap on the exposed chair, then return. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,idle,walking,enableActorCrossfade} from './check-cat-turning.mjs';
const w=load('@/utils/native-room-world');
const {buildRoomActivity,buildRoomExit}=load('@/utils/room-activities');
const fixture=JSON.parse(fs.readFileSync('scripts/fixtures/crowded-kitchen.json'));
for(const height of [365,380,395]) {
  const options={...fixture,width:370,height,petSize:81+1/3,sizeScale:(101+2/3)/100*1.15,
    homeOffset:{x:0,y:.12},ownedToyIds:[],hungry:false,asleep:false,
    decorations:fixture.decorations.map(o=>({...o,...(o.instanceId==='kitchen-6'?{fridgeOpen:true}:{})}))};
  const world=w.buildNativeRoomWorld(options);options.nativeWorld=world;
  const chair=world.objects.find(o=>o.instanceId==='kitchen-15');
  let at=world.home;
  const requests=[];
  function prepare(plan,stopAtHold=false) {
    for(let i=0;i<plan.steps.length;i++) {
      const step=w.prepareNativeStep(plan,plan.steps[i],w.catScreenPoint(at,world),world,at[1]);
      assert.equal(step.native.blocked,false,`${height}/${plan.kind}/${i}/${step.animation}: reachable`);
      assert.ok(w.pathLength([step.native.path[0],at])<1e-6,'No relocation between commands');
      requests.push(step);at=step.native.path.at(-1);
      plan={...plan,steps:plan.steps.map((s,j)=>i===j?step:s)};
      if(stopAtHold&&step.hold)return {plan,stepIndex:i};
    }
    return {plan,stepIndex:plan.steps.length-1};
  }
  prepare(buildRoomActivity(options,0,'fridgeInvestigate','kitchen-6'),true);
  const nap=prepare(buildRoomActivity(options,0,'chairNap',chair.instanceId),true);
  assert.ok(w.hasNativeArrived(at,chair.seat),'The selected front cushion is reached');
  const next=buildRoomActivity(options,0,'fridgeInvestigate','kitchen-6');
  const exit=buildRoomExit(options,nap.plan,nap.stepIndex,w.catScreenPoint(at,world));
  prepare({...next,steps:[...exit.steps,...next.steps]},true);
  // The same chair with an occupied cushion must still reject the landing.
  const blocker={instanceId:'occupied-seat',modelId:'test-blocker',solid:true,heading:0,scale:1,
    position:chair.seat,min:chair.seat.map(v=>v-.1),max:chair.seat.map(v=>v+.8)};
  assert.equal(w.findSeatApproach(at,chair,{...world,objects:[...world.objects,blocker]}),undefined);
  if(height!==380)continue;
  openSkin('orange');enableActorCrossfade();resetCatActor();
  render({active:true,world,playback:idle});drawCat(0);
  for(const [i,step] of requests.entries()) {
    const travel={...step.native,awaitCompletion:true};
    const playback=step.animation.startsWith('walk')?walking:{kind:'segment',segment:{assetKey:step.animation,
      loop:false,reverse:step.reverse,sleepPose:step.sleepPose}};
    let complete=0;
    render({active:true,world,playback,travel,activityKey:`kitchen-chair-${i}`,onRoomStepComplete:()=>complete++});
    for(let f=0;f<Math.ceil((travel.duration+2.5)*60);f++)drawCat(1/60);
    assert.equal(complete,1,`${i}: actual actor finishes exactly once`);
    assert.ok(w.hasNativeArrived(actorState().position,travel.path.at(-1)));
    assert.ok(Object.values(actorBones()).every(matrix=>matrix.every(Number.isFinite)));
    if(step.animation==='jumpOn') {
      for(const name of ['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw']) {
        const bone=actorBones()[name],dx=(bone[12]-chair.position[0])/chair.scale,dz=(bone[14]-chair.position[2])/chair.scale;
        const x=dx*Math.cos(chair.heading)-dz*Math.sin(chair.heading),z=dx*Math.sin(chair.heading)+dz*Math.cos(chair.heading);
        for(let j=0;j<16;j++) {
          const pad=.08*world.catScale/chair.scale,angle=j*Math.PI/8;
          assert.ok(((x+Math.cos(angle)*pad)/.36)**2+((z+Math.sin(angle)*pad)/(.36*.89))**2<=1.04,
            `${name}: the rendered pad remains on the round cushion`);
        }
      }
    }
  }
}
console.log('Verified saved kitchen fridge → front chair nap → wake → jump down → fridge, real actor completion, and occupied-seat rejection.');
