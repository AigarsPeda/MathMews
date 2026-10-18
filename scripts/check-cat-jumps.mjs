/** Check the real cat rig through sofa takeoff, flight, touchdown and rest. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,point,load,idle,enableActorCrossfade,sampleCatClip} from './check-cat-turning.mjs';
const w=load('@/utils/native-room-world');
const {buildRoomActivity}=load('@/utils/room-activities');
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const baseline=process.argv.includes('--baseline'),single=baseline||process.argv.includes('--preview'),capture=single||process.argv.includes('--poses');
const poses=[],metrics=[];
enableActorCrossfade();
for(const skin of single?['orange']:['orange','grey','white']) {
  openSkin(skin);
  if(!baseline)for(const name of ['jumpOn','jumpOff','hop']) {
    const start=sampleCatClip(name,0),end=sampleCatClip(name,1),standing=sampleCatClip('idle',0);
    for(const paw of ['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'])for(const pose of [start,end])
      assert.ok(distance(pose[paw].slice(12,15),standing[paw].slice(12,15))<.004,'The jump begins and recovers on its support without a pose pop');
    const landing=sampleCatClip(name,.70),compressed=sampleCatClip(name,.82);
    assert.ok(Math.abs(landing['L.front.paw'][13]-.10)<.004&&landing['L.rear.paw'][13]>.16,'Forepaws land before hind paws');
    assert.ok(compressed.spine[13]<standing.spine[13]-.04,'The body absorbs landing impact');
  }
  for(const fps of single?[60]:[30,60,120])for(const rotationIndex of single?[0]:[0,1,2,3])for(const itemScale of single?[1.3]:[1,1.3,1.8]) {
    const options={width:390,height:420,petSize:80,sizeScale:1,homeOffset:{x:0,y:.35},decorations:[{decorationId:'sofaA',instanceId:'sofa',offset:{x:0,y:0},rotationIndex,scale:itemScale}],toys:[],ownedToyIds:[],hungry:false,asleep:false};
    const world=w.buildNativeRoomWorld(options),sofa=world.objects.find(o=>o.instanceId==='sofa');
    const plan=buildRoomActivity({...options,nativeWorld:world},0,'sofaSit','sofa');
    let from=sofa.approach;
    const approach=w.prepareNativeStep(plan,plan.steps[0],w.catScreenPoint(from,world),world,w.FLOOR_Y);
    from=approach.native.path.at(-1);
    resetCatActor();
    const heading=Math.atan2(sofa.seat[0]-from[0],sofa.seat[2]-from[2]);
    render({active:true,world:{...world,home:from},playback:idle,travel:{path:[from],duration:0,distance:0,jump:false,heading}});drawCat(0);
    for(const [action,index]of [['jumpOn',1],['sit',2],['jumpOff',3]]) {
      const step=w.prepareNativeStep(plan,{...plan.steps[index],seatApproach:from[1]===w.FLOOR_Y?from:approach.native.path.at(-1)},w.catScreenPoint(from,world),world,from[1]);
      assert.ok(!step.native.blocked,`${action}: reachable sofa`);
      const native={...step.native,duration:action==='sit'?.45:step.native.duration,awaitCompletion:true};let complete=0;const clock={value:{}};
      const props={active:true,world,activityKey:action,playback:{kind:'segment',segment:{assetKey:action,loop:action==='sit',duration:action==='sit'?1200:900}},travel:native,animationTimeValue:clock,onRoomStepComplete:()=>complete++};
      render(props);
      let previous,airYaw=0,maxPawStep=0,elapsed=0;const duration=action==='sit'?2.3:2.5;
      for(let i=0;i<Math.ceil(duration*fps);i++) {
        drawCat(1/fps);const state=actorState(),paws=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'].map(point);
        const t=state.elapsed/native.duration;
        if(previous) {
          if(action!=='sit'&&t>.22&&t<.98&&state.elapsed<native.duration)airYaw=Math.max(airYaw,Math.abs(angle(state.heading,previous.heading)));
          for(let p=0;p<4;p++)maxPawStep=Math.max(maxPawStep,distance(previous.paws[p],paws[p])/world.catScale);
        }
        if(!baseline&&action!=='sit'&&t>.22&&t<1)assert.equal(clock.value.name,action,'Direct furnishing jumps use the requested takeoff/landing clip');
        if(!baseline&&action!=='sit'&&t>.22&&t<1)assert.ok(Math.abs(angle(state.heading,heading+(action==='jumpOff'?Math.PI:0)))<.002,'Flight and landing retain the takeoff heading');
        if(capture&&skin==='orange'&&fps===60&&rotationIndex===0&&itemScale===1.3&&i%3===0)poses.push({action,time:elapsed,nodes:actorBones(),position:[...state.position],scale:world.catScale,sofa:{modelId:sofa.modelId,position:sofa.position,heading:sofa.heading,scale:sofa.scale}});
        if(!baseline&&i===Math.floor(fps*.45)) {
          const frozen=actorBones();render({...props,active:false});drawCat(.4);
          for(const[name,m]of Object.entries(frozen))assert.ok(distance(actorBones()[name],m)<1e-6,'Pausing holds the complete jump or supported turn pose');
          render(props);drawCat(0);
        }
        previous={heading:state.heading,paws};elapsed+=1/fps;
      }
      if(!baseline){assert.equal(complete,1,`${action}: jump/turn completes once after settling (${actorState().elapsed}/${actorState().routeDuration})`);assert.ok(distance(actorState().position,native.path.at(-1))<1e-6,'Exact supported arrival');assert.ok(maxPawStep<20/fps+.01,`No paw teleport at ${skin}/${fps}/${action}: ${maxPawStep}`);}
      if(skin==='orange'&&fps===60)metrics.push({action,rotationIndex,itemScale,airYaw,maxPawStep});
      from=[...actorState().position];
    }
  }
  console.log(single ? `Recorded ${skin}: sofa up/down, supported resting turn and landing poses.` : `Verified ${skin}: sofa up/down and supported resting turns at 30/60/120 FPS, four rotations and three sizes.`);
}
if(!baseline)for(const fps of [30,60,120]) {
  openSkin('orange');resetCatActor();
  const scale=.5,home=[0,w.FLOOR_Y,.7],target=[0,w.FLOOR_Y+.45,-.2];
  const room={width:390,height:420,catScale:scale,radius:.15,home,objects:[]};
  const playback={kind:'segment',segment:{assetKey:'jumpOn',loop:false}};
  render({active:true,world:room,playback:idle,travel:{path:[home],duration:0,distance:0,jump:false,heading:Math.PI/2}});drawCat(0);
  const travel={path:[home,target],duration:.9,distance:distance(home,target),jump:true,heading:0,awaitCompletion:true};let arrivals=0;
  render({active:true,world:room,playback,activityKey:'first-jump',travel,onRoomStepComplete:()=>arrivals++});
  while(actorState().jumpPhase<.48)drawCat(1/fps);
  const before=actorState(),position=[...before.position],phase=before.jumpPhase,head=before.heading;
  const revised={...travel,path:[position,target],duration:.25};
  render({active:true,world:room,playback,activityKey:'same-seat-command',travel:revised,onRoomStepComplete:()=>arrivals++});drawCat(0);
  assert.ok(distance(actorState().position,position)<1e-6,'Replacing the same seat command preserves its airborne position');
  assert.ok(Math.abs(actorState().jumpPhase-phase)<1e-6,'An airborne command cannot restart the crouch or tuck');
  assert.ok(Math.abs(angle(actorState().heading,head))<1e-6,'An airborne command cannot change its heading');
  for(let i=0;i<fps*2;i++)drawCat(1/fps);
  assert.equal(arrivals,1,'The replacement jump lands exactly once');
  assert.ok(distance(actorState().position,target)<1e-6,'Replacement reaches the supported endpoint');
  const reduced={...travel,path:[target,home]};
  render({active:true,reduceMotion:true,world:room,playback,activityKey:'reduced-jump',travel:reduced});
  for(let i=0;i<fps*2;i++)drawCat(1/fps);
  assert.ok(actorBones().head.every(Number.isFinite),'Reduce Motion retains a valid landing');
  assert.ok(distance(actorState().position,home)<1e-6,'Reduce Motion reaches the intended support');
  assert.ok(Math.abs(point('L.front.paw')[1]-home[1]-.10*scale)<.004*scale,'Reduce Motion finishes with grounded paws');
}
if(!baseline) {
  const {SOFA_DECORATION_IDS,isSeatingSofaDecorationId}=load('@/constants/sofa-decorations');
  for(const decorationId of SOFA_DECORATION_IDS.filter(isSeatingSofaDecorationId))for(const wallFlipped of [false,true]) {
    const options={width:390,height:420,petSize:80,sizeScale:1,homeOffset:{x:0,y:.35},decorations:[{decorationId,instanceId:'variant',offset:{x:0,y:0},scale:1.3,wallFlipped}],toys:[],ownedToyIds:[],hungry:false,asleep:false};
    const world=w.buildNativeRoomWorld(options),sofa=world.objects.find(o=>o.instanceId==='variant');
    const plan=buildRoomActivity({...options,nativeWorld:world},0,'sofaSit','variant');
    const jump=w.prepareNativeStep(plan,plan.steps[1],w.catScreenPoint(sofa.approach,world),world,w.FLOOR_Y);
    assert.ok(!jump.native.blocked,`${decorationId}: clear cushion jump`);
    resetCatActor();render({active:true,world:{...world,home:sofa.approach},playback:idle});drawCat(0);
    render({active:true,world,activityKey:decorationId,playback:{kind:'segment',segment:{assetKey:'jumpOn',loop:false}},travel:jump.native});
    const facing=Math.atan2(sofa.seat[0]-sofa.approach[0],sofa.seat[2]-sofa.approach[2]);
    for(let i=0;i<180;i++){drawCat(1/60);if(actorState().jumpPhase>.2)assert.ok(Math.abs(angle(actorState().heading,facing))<.002,`${decorationId}/${wallFlipped}: no airborne swivel`);}
    assert.ok(distance(actorState().position,sofa.seat)<1e-6,`${decorationId}: lands on its cushion`);
  }
  console.log('Verified every sofa finish and both wall orientations, same-seat command replacement, complete-pose pause, and Reduce Motion.');
}
if(capture)fs.writeFileSync(`/tmp/brainpet-jump-poses-${baseline?'before':'after'}.json`,JSON.stringify(poses));
fs.writeFileSync(`/tmp/brainpet-jump-metrics-${baseline?'before':'after'}.json`,JSON.stringify(metrics,null,2));
