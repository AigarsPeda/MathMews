/** The reported rocking chair can reach its neighboring sofa without a floor detour. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,point,enableActorCrossfade} from './check-cat-turning.mjs';
const w=load('@/utils/native-room-world'),a=load('@/utils/room-activities');
const fixture=JSON.parse(fs.readFileSync('scripts/fixtures/rocking-chair-navigation.json'));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function setup(width=366,height=390,reverse=false) {
  const options={width,height,petSize:80,sizeScale:1.15,homeOffset:fixture.roomPetOffset,decorations:fixture.placedDecorations,
    toys:fixture.placedToys,ownedToyIds:[],hungry:false,asleep:false,period:'morning',nativeStepCompletion:true};
  const world=w.buildNativeRoomWorld(options);options.nativeWorld=world;
  const chair=world.objects.find(o=>o.modelId==='chairRockingOak'),sofa=world.objects.find(o=>o.modelId==='sofaB');
  const source=reverse?sofa:chair,destination=reverse?chair:sofa;
  let plan=a.buildRoomActivity(options,0,'sofaSit',source.instanceId),at=world.home;
  for(let i=0;i<3;i++) {
    const step=w.prepareNativeStep(plan,plan.steps[i],w.catScreenPoint(at,world),world,at[1]);
    assert.ok(!step.native.blocked);plan.steps[i]=step;at=step.native.path.at(-1);
  }
  if(reverse) {
    const arrival=w.findFurnitureTransfer(chair.seat,chair.instanceId,sofa.instanceId,world);
    assert.ok(arrival);at=arrival.seat;
    plan.steps[2]=w.prepareNativeStep(plan,{...plan.steps[2],seatPosition:at,seatApproach:arrival.approach,seatHeading:arrival.heading},w.catScreenPoint(at,world),world,at[1]);
  }
  const current={plan,stepIndex:2},next=a.buildRoomActivity(options,0,'sofaSit',destination.instanceId);
  const routed=a.routeToSofa(options,next,w.catScreenPoint(at,world),current,at);
  assert.equal(routed.steps[0].jumpFromInstanceId,source.instanceId,'Both directions use a direct jump in the pictured layout');
  const jump=w.prepareNativeStep(routed,routed.steps[0],w.catScreenPoint(at,world),world,at[1]);
  assert.ok(jump.native.jump&&!jump.native.blocked);
  routed.steps[0]=jump;
  const rest=w.prepareNativeStep(routed,routed.steps[1],jump.position,world,jump.native.path.at(-1)[1]);
  assert.ok(!rest.native.blocked);routed.steps[1]=rest;
  assert.ok((reverse?jump.native.stance:jump.native.launchStance)<.8,'A small chair uses gathered paw placement');
  assert.equal(rest.native.heading,jump.seatHeading,'Landing keeps its heading instead of forcing a half turn');
  const automatic=a.continueFurnitureExploration(options,{plan:{...plan,steps:plan.steps.map(s=>({...s,hold:false}))},stepIndex:2},at,0);
  assert.equal(automatic?.steps[0].jumpFromInstanceId,source.instanceId,'Autonomous exploration can use the same departure');
  const obstructed={...world,objects:[...world.objects,{instanceId:'occupied-sofa',modelId:'test-blocker',solid:true,scale:1,heading:0,
    position:jump.seatPosition,min:jump.seatPosition.map(v=>v-1),max:jump.seatPosition.map(v=>v+1)}]};
  assert.equal(w.findFurnitureTransfer(at,source.instanceId,destination.instanceId,obstructed),undefined,'Real furniture blocking the flight is still rejected');
  return {options,world,chair,sofa,source,destination,current,routed,jump,rest,at};
}
setup(351,390);setup(366,390);setup(366,390,true);
const poses=[];enableActorCrossfade();
for(const reverse of [false,true])for(const skin of ['orange','grey','white'])for(const fps of [30,60,120]) {
  openSkin(skin);resetCatActor();const s=setup(366,390,reverse),seat=s.current.plan.steps[2];
  render({active:true,world:s.world,activityKey:'chair-rest',playback:{kind:'segment',segment:{assetKey:'sit',loop:false}},travel:seat.native});
  for(let i=0;i<fps;i++)drawCat(1/fps);
  let completed=0,lastPaws,largest=0,previousHeading,contacts=0,paused=false;
  const flightHeading=Math.atan2(s.jump.native.path.at(-1)[0]-s.at[0],s.jump.native.path.at(-1)[2]-s.at[2]);
  assert.ok(angle(s.jump.native.landingHeading,flightHeading)<=Math.PI/6+1e-6,'A planned landing adjustment is at most 30 degrees');
  const furnishings=[s.chair,s.sofa].map(o=>({modelId:o.modelId,position:o.position,heading:o.heading,scale:o.scale}));
  const record=(time)=>{if(skin==='orange'&&fps===60)poses.push({action:reverse?'nearbyBack':'nearby',time,nodes:actorBones(),position:[...actorState().position],scale:s.world.catScale,sofa:furnishings[1],furnishings});};
  record(0);
  const jumping={active:true,world:s.world,activityKey:'chair-to-sofa',playback:{kind:'segment',segment:{assetKey:s.jump.animation,loop:false}},
    travel:{...s.jump.native,awaitCompletion:true},onRoomStepComplete:()=>completed++};
  render(jumping);
  let time=0;
  for(let i=0;i<7*fps&&completed===0;i++) {
    drawCat(1/fps);time+=1/fps;const state=actorState(),paws=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'].map(point);
    if(lastPaws)for(let k=0;k<4;k++)largest=Math.max(largest,distance(lastPaws[k],paws[k])/s.world.catScale);
    lastPaws=paws;
    assert.ok(state.position[1]>w.FLOOR_Y+.1,'The whole rendered journey stays elevated');
    const head=point('head');
    assert.ok(Math.abs(head[0])+.2*s.world.catScale<2.35&&Math.abs(head[2])+.2*s.world.catScale<2.35,'The rendered head stays clear of room walls');
    if(state.jumpPhase<=.2) {
      assert.ok(distance(state.position,s.at)<1e-6,'Turning and gathering do not slide the cat across its support');
      for(const paw of paws)if(paw[1]<s.at[1]+.13*s.world.catScale) {
        const dx=(paw[0]-s.source.position[0])/s.source.scale,dz=(paw[2]-s.source.position[2])/s.source.scale;
        const x=Math.cos(s.source.heading)*dx-Math.sin(s.source.heading)*dz,z=Math.sin(s.source.heading)*dx+Math.cos(s.source.heading)*dz;
        assert.ok(reverse?x>=-.301&&x<=.481&&z>=-.946&&z<=.946:x>=-.306&&x<=.306&&z>=-.271&&z<=.341,
          'A planted paw stays on the actual cushion, including during the supported turn');contacts++;
      }
    }
    if(state.jumpPhase>.2&&state.jumpPhase<.99) {
      assert.ok(angle(state.heading,flightHeading)<=Math.PI/6+1e-6,'The cat never spins during flight');
      if(previousHeading!==undefined)assert.ok(angle(state.heading,previousHeading)<2/fps+.005,'The planned heading adjustment is continuous');
      previousHeading=state.heading;
    }
    if(reverse&&!paused&&state.jumpPhase>.45&&state.jumpPhase<.6) {
      paused=true;const frozen=actorBones(),phase=state.jumpPhase;
      render({...jumping,active:false});drawCat(.5);
      for(const[name,matrix]of Object.entries(frozen))assert.ok(distance(actorBones()[name],matrix)<1e-6,'Pausing freezes the complete adjusted landing pose');
      render(jumping);drawCat(0);assert.equal(actorState().jumpPhase,phase,'Resuming preserves the planned landing clock');
    }
    if(reverse&&state.jumpPhase>=.78)for(const paw of paws) {
      const dx=(paw[0]-s.chair.position[0])/s.chair.scale,dz=(paw[2]-s.chair.position[2])/s.chair.scale;
      const x=Math.cos(s.chair.heading)*dx-Math.sin(s.chair.heading)*dz,z=Math.sin(s.chair.heading)*dx+Math.cos(s.chair.heading)*dz;
      assert.ok(x>=-.306&&x<=.306&&z>=-.271&&z<=.341,'All four landed paws fit the chair cushion');
    }
    if(i%Math.max(1,Math.round(fps/10))===0)record(time);
  }
  assert.equal(completed,1);assert.ok(contacts>4);assert.ok(largest<20/fps+.02,'Gathering, takeoff and landing have no paw pop');
  if(reverse)assert.ok(paused,'Exercise pause/resume during the adjusted flight');
  assert.ok(distance(actorState().position,s.jump.native.path.at(-1))<1e-6);
  const landedHeading=actorState().heading;
  render({active:true,world:s.world,activityKey:'sofa-rest',playback:{kind:'segment',segment:{assetKey:'sit',loop:false}},travel:s.rest.native});
  for(let i=0;i<fps;i++){drawCat(1/fps);time+=1/fps;if(i%Math.max(1,Math.round(fps/10))===0)record(time);}
  assert.ok(angle(actorState().heading,landedHeading)<1e-6,'Resting does not add an unnecessary turn after touchdown');
}
fs.writeFileSync('/tmp/brainpet-nearby-furniture.json',JSON.stringify(poses));
console.log('Verified both directions in the reported chair/sofa layout, manual/automatic direct jumps, compact support contacts, blocked-flight rejection and no landing half turn.');
console.log('Verified planted paws, no preparation sliding, bounded 30-degree landing adjustments, smooth paw motion and exact arrivals on all three coats at 30/60/120 FPS.');
