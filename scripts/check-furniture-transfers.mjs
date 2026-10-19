/** Direct commands between real supports, including safe floor fallbacks. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {furnitureTransferScene,furnitureExplorationScene,relocate} from './fixtures/furniture-transfers.mjs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,point,idle,enableActorCrossfade} from './check-cat-turning.mjs';
const w=load('@/utils/native-room-world'),a=load('@/utils/room-activities');
const {getDecorationRotationGroup}=load('@/constants/decoration-variants');
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const setup=(id,degrees)=>furnitureTransferScene(w,getDecorationRotationGroup,id,degrees);
function currentPlan(options,source,seat=source.seat,curled=false) {
  const plan=a.buildRoomActivity(options,0,curled?'sofaSleep':'sofaSit',source.instanceId);
  const step={...plan.steps[curled?3:2],seatPosition:seat,seatApproach:source.approach,position:w.catScreenPoint(seat,options.nativeWorld),
    targetInstanceId:source.instanceId,native:{path:[seat],duration:0,distance:0,jump:false}};
  return {plan:{...plan,steps:[step]},stepIndex:0};
}
function route(scene,curled=false) {
  const {options,world,source,target}=scene,next=a.buildRoomActivity(options,0,'sofaSit',target.instanceId);
  return a.routeToSofa(options,next,w.catScreenPoint(source.seat,world),currentPlan(options,source,source.seat,curled),source.seat);
}
function ambientCurrent(scene) {
  const current=currentPlan(scene.options,scene.source);
  return {...current,plan:{...current.plan,userRequested:false,
    steps:current.plan.steps.map(step=>({...step,hold:false}))}};
}
function blocker(center,extent=[.15,2,.15]) {
  return {instanceId:'blocker',modelId:'test-blocker',solid:true,collidable:true,heading:0,scale:1,position:center,
    min:center.map((v,i)=>v-extent[i]),max:center.map((v,i)=>v+extent[i])};
}
let cases=0;
for(const id of ['tablePurple','chairRockingOak','chairOfficeA'])for(const degrees of [0,53,180,270]) {
  const scene=setup(id,degrees),plan=route(scene),jump=plan.steps.find(s=>s.jumpFromInstanceId);
  assert.ok(jump,`${id}/${degrees}: clear nearby supports use a direct jump`);
  assert.equal(plan.steps[0],jump,'No floor departure or floor approach precedes a direct jump');
  const prepared=w.prepareNativeStep(plan,jump,w.catScreenPoint(scene.source.seat,scene.world),scene.world,scene.source.seat[1]);
  assert.ok(prepared.native.jump&&!prepared.native.blocked);
  assert.equal(prepared.targetInstanceId,'target');assert.equal(prepared.jumpFromInstanceId,'sofa');
  assert.ok(prepared.native.path.every(p=>p[1]>w.FLOOR_Y+.1),'Both endpoints remain elevated');
  const held=plan.steps.find(s=>s.hold);
  assert.ok(distance(held.seatPosition,prepared.native.path.at(-1))<1e-6,'The new task uses the selected landing, including an alternate table end');
  const down=plan.steps.find(s=>s.animation==='jumpOff'&&!s.jumpFromInstanceId);
  const exit=w.prepareNativeStep(plan,down,w.catScreenPoint(held.seatPosition,scene.world),scene.world,held.seatPosition[1]);
  assert.ok(!exit.native.blocked&&exit.native.path.at(-1)[1]===w.FLOOR_Y,'The destination retains a safe later floor exit');
  assert.equal(plan.steps.at(-1).sofaApproach,undefined,'The subsequent home walk has no stale seat-contact intent');
  const autonomous=a.continueFurnitureExploration({...scene.options,period:'morning'},ambientCurrent(scene),scene.source.seat,2);
  assert.ok(autonomous,`${id}/${degrees}: autonomous exploration uses the same safe transfer`);
  assert.equal(autonomous.steps[0].jumpFromInstanceId,'sofa');
  assert.equal(autonomous.userRequested,false);
  assert.ok(autonomous.steps.every(s=>!s.hold),'Automatic rests never become held commands');
  assert.deepEqual(Array.from(autonomous.exploredFurniture),['sofa','target']);
  const pause=autonomous.steps[1];
  assert.equal(pause.animation,'sit');assert.ok(pause.durationMs>=6000&&pause.durationMs<=10500);
  assert.deepEqual(pause.seatPosition,autonomous.steps[0].seatPosition,'Resting retains the chosen landing');
  assert.equal(a.continueFurnitureExploration(scene.options,{plan:autonomous,stepIndex:1},pause.seatPosition,3),null,
    'The cat does not bounce back onto a previously visited support');
  const sleeping=route(scene,true);
  assert.ok(sleeping.steps[0].reverse&&sleeping.steps[0].animation==='curlUp','A sleeping cat stands up before transferring');
  assert.equal(sleeping.steps[0].targetInstanceId,'sofa','Standing up retains the source support');
  const middle=scene.source.seat.map((v,i)=>(v+scene.target.seat[i])/2);
  const blockedWorld={...scene.world,objects:[...scene.world.objects,blocker(middle,[.45,2,.45])]};
  assert.equal(w.findFurnitureTransfer(scene.source.seat,'sofa','target',blockedWorld),undefined,'A tall barrier cannot be jumped through');
  cases++;
}
const scene=setup(),{source,target,world,options}=scene;
const selected=w.findFurnitureTransfer(source.seat,'sofa','target',world);
assert.ok(selected);
for(const [name,objects]of [
  ['occupied top',[source,target,blocker(target.seat,[.8,1,.8])]],
  ['too far',[source,relocate(target,2,1.9)]],
  ['low headroom',[source,target,blocker(selected.seat.map((v,i)=>v+(i===1?.7*world.catScale:0)),[.9,.10,.9])]],
  ['missing source',[target]],
]) {
  const blocked={...world,objects};
  assert.equal(w.findFurnitureTransfer(source.seat,'sofa','target',blocked),undefined,name);
  const plan=route({...scene,options:{...options,nativeWorld:blocked},world:blocked});
  assert.ok(!plan.steps.some(s=>s.jumpFromInstanceId),`${name}: preserve the floor route when direct flight is unsafe`);
  assert.equal(a.continueFurnitureExploration({...options,nativeWorld:blocked},ambientCurrent(scene),source.seat,0),null,
    `${name}: autonomous exploration also rejects the unsafe flight`);
}
const ambient=ambientCurrent(scene),snapshot=JSON.stringify(ambient);
const busy={...options,period:'morning',toys:Array.from({length:3},(_,i)=>({toyId:'blueBall',instanceId:'ball-'+i,offset:{x:0,y:.4}}))};
const busyChoices=Array.from({length:25},(_,turn)=>({turn,plan:a.buildRoomActivity(busy,turn)})).filter(({turn})=>turn%5<4);
assert.ok(busyChoices.some(({plan})=>plan.kind==='sofaSit'),'Furniture exploration is not starved when toys make exactly five daytime choices');
for(const toy of busy.toys)assert.ok(busyChoices.some(({plan})=>plan.targetInstanceId===toy.instanceId),'Perch visits also leave each toy a turn');
for(const patch of [{hungry:true},{asleep:true},{period:'night'},{nativeWorld:undefined},{nativeStepCompletion:false}])
  assert.equal(a.continueFurnitureExploration({...options,...patch},ambient,source.seat,0),null,'Care, sleep and simple graphics take priority');
for(const patch of [{userRequested:true},{exploredFurniture:['sofa','earlier','older']},{kind:'sofaSleep'}])
  assert.equal(a.continueFurnitureExploration(options,{...ambient,plan:{...ambient.plan,...patch}},source.seat,0),null,'Commands, sleep and the outing limit stop autonomous hopping');
for(const patch of [{hold:true},{animation:'jumpOn'},{native:{blocked:true}}])
  assert.equal(a.continueFurnitureExploration(options,{plan:{...ambient.plan,steps:[{...ambient.plan.steps[0],...patch}]},stepIndex:0},source.seat,0),null);
assert.equal(JSON.stringify(ambient),snapshot,'Choosing the next perch does not mutate the running plan');
const outing=furnitureExplorationScene(w,getDecorationRotationGroup);
const firstHop=a.continueFurnitureExploration(outing.options,ambientCurrent(outing),outing.source.seat,0);
const secondHop=a.continueFurnitureExploration(outing.options,{plan:firstHop,stepIndex:1},firstHop.steps[1].seatPosition,1);
assert.equal(firstHop.targetInstanceId,'target');assert.equal(secondHop.targetInstanceId,'third');
assert.deepEqual(Array.from(secondHop.exploredFurniture),['sofa','target','third']);
assert.equal(a.continueFurnitureExploration(outing.options,{plan:secondHop,stepIndex:1},secondHop.steps[1].seatPosition,2),null);
let perched=outing.source.seat;
for(const plan of [firstHop,secondHop]) {
  for(const step of plan.steps.slice(0,2)) {
    const prepared=w.prepareNativeStep(plan,step,w.catScreenPoint(perched,outing.world),outing.world,perched[1]);
    assert.ok(!prepared.native.blocked,'Each autonomous hop and rest retains usable support contacts');
    perched=prepared.native.path.at(-1);
  }
}
for(const step of secondHop.steps.slice(2)) {
  const prepared=w.prepareNativeStep(secondHop,step,w.catScreenPoint(perched,outing.world),outing.world,perched[1]);
  assert.ok(!prepared.native.blocked,'The final perch keeps a safe path back to the floor');
  perched=prepared.native.path.at(-1);
}
assert.equal(perched[1],w.FLOOR_Y);
const trapped={...relocate(target,.5,-1.5),instanceId:'trapped'};
const divided={...world,objects:[source,target,trapped]};
const reachable=w.findFurnitureTransfer(source.seat,'sofa','target',divided);
assert.ok(reachable);
assert.equal(w.findFurnitureTransfer(reachable.seat,'target','trapped',divided),undefined,
  'A perch whose only floor landing is disconnected from the room is not chosen');
const planned=route(scene),direct=planned.steps[0];
const changed={...world,objects:[source,target,blocker(selected.seat,[.8,1,.8])]};
assert.ok(w.prepareNativeStep(planned,direct,w.catScreenPoint(source.seat,world),changed,source.seat[1]).native.blocked,
  'A changed room invalidates a queued direct flight before takeoff');
const withoutNative={...options,nativeWorld:undefined};
assert.ok(!a.routeToSofa(withoutNative,a.buildRoomActivity(withoutNative,0,'sofaSit','target'),{x:0,y:0},currentPlan(options,source)).steps.some(s=>s.jumpFromInstanceId),
  'Simple graphics retain the established floor route');
assert.ok(!a.routeToSofa({...options,nativeStepCompletion:false},a.buildRoomActivity(options,0,'sofaSit','target'),w.catScreenPoint(source.seat,world),currentPlan(options,source)).steps.some(s=>s.jumpFromInstanceId),
  'Simple graphics with a native layout still keep the floor route');

// Play the real rig from one elevated support to the next, then continue to
// another command. No timer-only simulation can detect a root or paw pop.
const poses=[];enableActorCrossfade();
for(const skin of ['orange','grey','white'])for(const fps of [30,60,120])for(const id of ['tablePurple','chairRockingOak']) {
  openSkin(skin);resetCatActor();const s=setup(id),p=route(s),step=w.prepareNativeStep(p,p.steps[0],w.catScreenPoint(s.source.seat,s.world),s.world,s.source.seat[1]);
  const heading=Math.atan2(step.native.path.at(-1)[0]-s.source.seat[0],step.native.path.at(-1)[2]-s.source.seat[2]);
  render({active:true,world:{...s.world,home:s.source.seat},playback:idle,travel:{path:[s.source.seat],duration:0,distance:0,jump:false,heading}});drawCat(0);
  let arrived=0,minHeight=Infinity,lastPaws,largest=0;
  const props={active:true,world:s.world,activityKey:'transfer',playback:{kind:'segment',segment:{assetKey:step.animation,loop:false}},travel:{...step.native,awaitCompletion:true},onRoomStepComplete:()=>arrived++};
  render(props);
  for(let frame=0;frame<(step.native.duration+1)*fps;frame++) {
    drawCat(1/fps);const state=actorState(),paws=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'].map(point);
    minHeight=Math.min(minHeight,state.position[1]);
    if(lastPaws)for(let k=0;k<4;k++)largest=Math.max(largest,distance(lastPaws[k],paws[k])/s.world.catScale);
    lastPaws=paws;
    if(skin==='orange'&&fps===60&&id==='tablePurple'&&frame%3===0)poses.push({action:'transfer',time:frame/fps,nodes:actorBones(),position:[...state.position],scale:s.world.catScale,
      sofa:{modelId:s.source.modelId,position:s.source.position,heading:s.source.heading,scale:s.source.scale},
      furnishings:[s.source,s.target].map(o=>({modelId:o.modelId,position:o.position,heading:o.heading,scale:o.scale}))});
    if(frame===Math.floor(.4*fps)) {
      const frozen=actorBones();render({...props,active:false});drawCat(.5);
      for(const[n,m]of Object.entries(frozen))assert.ok(distance(actorBones()[n],m)<1e-6,'Pausing holds the complete elevated jump');
      render(props);drawCat(0);
    }
  }
  assert.equal(arrived,1);assert.ok(minHeight>w.FLOOR_Y+.1,'The rendered jump never detours to the floor');
  assert.ok(distance(actorState().position,step.native.path.at(-1))<1e-6,'Exact elevated arrival');
  assert.ok(largest<20/fps+.01,'The transfer has no paw teleport');
  const next=a.buildRoomActivity(s.options,0,'sofaSit','sofa'),current={plan:{...p,steps:[{...p.steps.find(s=>s.hold),native:{path:[actorState().position]}}]},stepIndex:0};
  const repeat=a.routeToSofa(s.options,a.buildRoomActivity(s.options,0,'sofaSit','target'),w.catScreenPoint(actorState().position,s.world),current,[...actorState().position]);
  assert.ok(!repeat.steps.some(s=>s.jumpFromInstanceId),'Repeating the current command stays on its selected landing');
  assert.ok(distance(repeat.steps[0].seatPosition,actorState().position)<1e-6);
  const follow=a.routeToSofa(s.options,next,w.catScreenPoint(actorState().position,s.world),current,[...actorState().position]);
  assert.equal(follow.steps[0].jumpFromInstanceId,'target','A second command can jump back without a floor detour');
  const back=w.prepareNativeStep(follow,follow.steps[0],w.catScreenPoint(actorState().position,s.world),s.world,actorState().position[1]);
  assert.ok(!back.native.blocked&&back.native.jump);
  assert.equal(back.animation,back.native.path.at(-1)[1]<back.native.path[0][1]-.08*s.world.catScale?'jumpOff':'jumpOn',
    'A lower destination uses the downward jump pose');
  const before=[...actorState().position];let returned=0;
  render({...props,activityKey:'jump-back',playback:{kind:'segment',segment:{assetKey:back.animation,loop:false}},travel:{...back.native,awaitCompletion:true},onRoomStepComplete:()=>returned++});drawCat(0);
  assert.ok(distance(actorState().position,before)<1e-6,'The next command starts at the actual elevated arrival');
  for(let frame=0;frame<(back.native.duration+3)*fps;frame++){drawCat(1/fps);assert.ok(actorState().position[1]>w.FLOOR_Y+.1);}
  assert.equal(returned,1);assert.ok(distance(actorState().position,back.native.path.at(-1))<1e-6);
}
fs.writeFileSync('/tmp/brainpet-furniture-transfers.json',JSON.stringify(poses));
console.log(`Verified ${cases} rotated sofa/chair/table pairs, sleeping departures, safe floor fallbacks, live invalidation and simple graphics.`);
console.log('Verified direct elevated arrivals, repeated commands, pauses and continuous paws on all three rigs at 30/60/120 FPS.');
console.log('Verified autonomous safe perch choices, varied rests, no revisits, bounded outings and care/command/night priorities.');
