/** Drive the shipped actor from sofa landing into a queued floor journey. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,point,load,idle,walking,enableActorCrossfade} from './check-cat-turning.mjs';
const motion=load('@/utils/native-cat-locomotion'),w=load('@/utils/native-room-world');
const baseline=process.argv.includes('--baseline'),preview=baseline||process.argv.includes('--preview');
const poses=[],metrics=[],paws=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
enableActorCrossfade();
for(const skin of preview?['orange']:['orange','grey','white']) {
  openSkin(skin);
  for(const fps of preview?[60]:[30,60,120])for(const scale of preview?[.5]:[.35,.5])for(const degrees of preview?[0]:[0,60,150])for(const delay of !preview&&skin==='orange'&&fps===60&&scale===.5&&degrees===0?[0,4,12]:[0]) {
    resetCatActor();
    const world=w.buildNativeRoomWorld({width:390,height:420,petSize:80,sizeScale:1,decorations:[{decorationId:'sofaA',instanceId:'sofa',offset:{x:0,y:0},scale:1.3}],toys:[]});
    const sofa=world.objects[0],from=sofa.seat,landing=sofa.approach;world.catScale=scale;world.radius=.3*scale;world.home=from;
    const heading=Math.atan2(landing[0]-from[0],landing[2]-from[2]);
    render({active:true,world,playback:idle,travel:{path:[from],duration:0,distance:0,jump:false,heading}});drawCat(0);
    const target=[landing[0]+Math.sin(heading+degrees*Math.PI/180)*.8,landing[1],landing[2]+Math.cos(heading+degrees*Math.PI/180)*.8];
    const path=motion.catPacedPath([landing,target],scale),timing=motion.catWalkTiming(path,scale);
    let arrived=false,started=false,complete=0,firstMove,previous,slip=0,step=0,launchFrames=0,launchStep=0,bodyDip=0,arrivalFrame=0,frameCounter=0;
    let props={active:true,world,playback:{kind:'segment',segment:{assetKey:'jumpOff',loop:false}},activityKey:'landing',travel:{path:[from,landing],duration:.9,distance:distance(from,landing),jump:true,walkAfterLanding:true,awaitCompletion:true},onRoomStepComplete:()=>{arrived=true;arrivalFrame=frameCounter;}};
    render(props);
    for(let frame=0;frame<fps*5;frame++) {
      frameCounter=frame;
      if(arrived&&!started&&frame>=arrivalFrame+delay) {
        started=true;
        props={active:true,world,playback:walking,activityKey:'next-task',travel:{path,...timing,distance:.8,jump:false,awaitCompletion:true},onRoomStepComplete:()=>complete++};render(props);
      }
      drawCat(1/fps);const state=actorState(),feet=paws.map(point);
      if(started&&firstMove===undefined&&distance(state.position,landing)>.00001)firstMove=frame/fps;
      if(started&&state.launchStarted&&(state.distance-state.launchDistance)/(state.launchStride*scale)<.9) {
        launchFrames++;
        if(previous)for(let p=0;p<4;p++)launchStep=Math.max(launchStep,distance(feet[p],previous[p])/scale);
        if(state.launchFromLanding)bodyDip=Math.min(bodyDip,(point('spine')[1]-state.position[1])/scale-state.launchHeight);
        const phase=(state.distance-state.launchDistance)/(state.launchStride*scale);
        const {catLaunchStep}=load('@/utils/native-cat-walk-launch');
        for(let p=0;p<4;p++)if(catLaunchStep(state.launchPhase,phase,p).progress===0)slip=Math.max(slip,distance(feet[p],state.launchFeet[p])/scale);
      }
      if(previous)for(let p=0;p<4;p++)step=Math.max(step,distance(feet[p],previous[p])/scale);
      previous=feet;
      if(preview&&frame%3===0&&frame<fps*2.5)poses.push({action:'landingWalk',time:frame/fps,nodes:actorBones(),position:[...state.position],scale,sofa:{modelId:sofa.modelId,position:sofa.position,heading:sofa.heading,scale:sofa.scale}});
      if(started&&frame===fps*1.4) {
        const frozen=actorBones();render({...props,active:false});drawCat(.5);
        for(const[name,m]of Object.entries(frozen))assert.ok(distance(actorBones()[name],m)<1e-6,'Pause retains the complete handoff pose');
        render(props);drawCat(0);
      }
    }
    if(!baseline) {
      assert.ok(launchFrames>3,'A landing joins a planted first stride');
      if(degrees===0)assert.ok(firstMove<.82+delay/fps,`Queued walking begins during recovery, at ${firstMove}s`);
      assert.ok(launchStep<8/fps+.01,`First-stride touchdown cannot snap: ${skin}/${fps}/${scale}/${degrees}/${delay}: ${launchStep}`);
      assert.ok(bodyDip>-.015,`Landing recovery cannot add another crouch: ${bodyDip}`);
      assert.ok(slip<.004,`${skin}/${fps}/${scale}/${degrees}/${delay}: paws stay planted until lift-off: ${slip}`);
      assert.ok(step<18/fps+.01,`No paw teleport at ${fps} FPS: ${step}`);
      assert.equal(complete,1,'The next task arrives once');
      assert.ok(distance(actorState().position,target)<1e-6,'Exact next-task destination');
    }
    metrics.push({skin,fps,scale,degrees,delay,firstMove,launchFrames,launchStep,bodyDip,slip,step});
  }
  console.log(`Verified ${skin}: landing-to-walk contacts, direction changes, first strides, pause and arrival.`);
}
if(!baseline)for(const fps of [30,60,120]) {
  openSkin('orange');resetCatActor();
  const floor=w.FLOOR_Y,world={width:390,height:420,catScale:.45,radius:.30,home:[-1.4,floor,0],objects:[{instanceId:'books',modelId:'booksPile',scale:1,heading:0,position:[0,floor,0],solid:true,movable:false,min:[-.12,floor,-2.5],max:[.12,floor+.20,2.5]}]};
  const target=[1.4,floor,0],step={animation:'walk',mood:'idle',durationMs:1000,position:w.catScreenPoint(target,world)};
  const travel=w.prepareNativeStep({kind:'wander',steps:[step]},step,w.catScreenPoint(world.home,world),world,floor).native;
  assert.ok(travel.legs.some(leg=>leg.landingWalk),'The actual route planner schedules a recovery-to-walk overlap');
  let clock=0;
  for(const leg of travel.legs){if(leg.landingWalk)assert.ok(Math.abs(motion.catMotionSample(travel.legs,clock+leg.duration-1e-6).progress-motion.CAT_LANDING_WALK_PHASE)<.0001,'Overlap retains the original airborne clock');clock+=leg.duration;}
  render({active:true,world,playback:idle,travel:{path:[world.home],duration:0,distance:0,jump:false,heading:Math.PI/2}});drawCat(0);
  let complete=0,launched=false;
  render({active:true,world,playback:walking,activityKey:'linked-hop',travel:{...travel,awaitCompletion:true},onRoomStepComplete:()=>complete++});
  for(let i=0;i<(travel.duration+2)*fps;i++){drawCat(1/fps);launched ||= actorState().launchFromLanding;}
  assert.ok(launched,'A hop inside a continuous route uses its actual landing contacts');
  assert.equal(complete,1);assert.ok(distance(actorState().position,target)<1e-6);
}
if(preview)fs.writeFileSync(`/tmp/brainpet-landing-walk-${baseline?'before':'after'}.json`,JSON.stringify(poses));
fs.writeFileSync(`/tmp/brainpet-landing-walk-metrics-${baseline?'before':'after'}.json`,JSON.stringify(metrics,null,2));
