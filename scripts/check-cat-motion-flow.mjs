/** Complete approaches and supported handoffs on the shipped cat, not isolated clocks. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,point,load,idle,walking,enableActorCrossfade,sampleCatClip} from './check-cat-turning.mjs';
const w=load('@/utils/native-room-world'),motion=load('@/utils/native-cat-locomotion');
const {buildRoomActivity}=load('@/utils/room-activities');
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const paws=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
const metrics=[],poses=[];
fs.mkdirSync('/tmp/brainpet-motion-flow',{recursive:true});
const preview=process.argv.includes('--preview');
enableActorCrossfade();
for(const skin of preview?['orange']:['orange','grey','white']) {
  openSkin(skin);
  for(const fps of preview?[60]:[30,60,120])for(const offset of preview?[.7]:[-.7,.7]) {
    const options={width:390,height:420,petSize:80,sizeScale:1,homeOffset:{x:offset*.15,y:.35},decorations:[{decorationId:'sofaA',instanceId:'sofa',offset:{x:0,y:0},scale:1.3}],toys:[]};
    const world=w.buildNativeRoomWorld(options),sofa=world.objects[0];
    const plan=buildRoomActivity({...options,nativeWorld:world},0,'sofaSit','sofa');
    const approach=w.prepareNativeStep(plan,plan.steps[0],w.catScreenPoint(world.home,world),world,w.FLOOR_Y);
    assert.ok(!approach.native.blocked&&approach.native.prepareJump,'A reachable cushion approach advertises its takeoff');
    const path=approach.native.path,end=path.at(-1),heading=Math.atan2(path[1][0]-path[0][0],path[1][2]-path[0][2]);
    resetCatActor();render({active:true,world,playback:idle,travel:{path:[world.home],duration:0,distance:0,jump:false,heading}});drawCat(0);
    let arrived=false,preparedFrames=0;
    render({active:true,world,playback:walking,activityKey:'approach',travel:{...approach.native,awaitCompletion:true},onRoomStepComplete:()=>{arrived=true;}});
    for(let frame=0;!arrived&&frame<fps*12;frame++) {
      drawCat(1/fps);if(actorState().preparation>0)preparedFrames++;
      if(preview&&frame%3===0)poses.push({action:'approach',time:frame/fps,nodes:actorBones(),position:[...actorState().position],scale:world.catScale,sofa:{modelId:sofa.modelId,position:sofa.position,heading:sofa.heading,scale:sofa.scale}});
    }
    assert.ok(arrived&&preparedFrames>=3,'The last walking step loads the jump before arrival');
    assert.ok(Math.abs(delta(actorState().heading,Math.atan2(sofa.seat[0]-end[0],sofa.seat[2]-end[2])))<.25,'The final approach faces the takeoff');
    const before=paws.map(point);
    // JS dispatch delays hold the loaded pose rather than standing up again.
    for(let i=0;i<4;i++)drawCat(1/fps);
    assert.equal(actorState().preparation,1);
    const jump=w.prepareNativeStep(plan,{...plan.steps[1],seatApproach:approach.seatApproach,seatPosition:approach.seatPosition},w.catScreenPoint(end,world),world,w.FLOOR_Y);
    let landed=0;
    render({active:true,world,playback:{kind:'segment',segment:{assetKey:'jumpOn',loop:false}},activityKey:'jump',travel:{...jump.native,awaitCompletion:true},onRoomStepComplete:()=>landed++});drawCat(0);
    assert.equal(actorState().jumpOffset,motion.CAT_JUMP_PREPARE,'The jump continues the existing preparation instead of crouching twice');
    assert.equal(actorState().turnDuration,0,'Aligned takeoff has no extra stationary turn');
    const handoff=Math.max(...paws.map((p,i)=>distance(point(p),before[i])/world.catScale));
    assert.ok(handoff<.035,`No paw pop at the walk-to-jump handoff: ${handoff}`);
    for(let frame=0;frame<fps*2;frame++){drawCat(1/fps);if(preview&&frame%3===0)poses.push({action:'jumpOn',time:frame/fps,nodes:actorBones(),position:[...actorState().position],scale:world.catScale,sofa:{modelId:sofa.modelId,position:sofa.position,heading:sofa.heading,scale:sofa.scale}});}
    assert.equal(landed,1);assert.ok(distance(actorState().position,sofa.seat)<1e-6);
    metrics.push({skin,fps,offset,preparedFrames,handoff});
  }
  if(!preview)for(const base of ['jumpOn','jumpOff']) {
    const rest=sampleCatClip('idle',0),full=sampleCatClip(base,.44),light=sampleCatClip(base+'Light',.44);
    assert.ok(light['L.rear.paw'][13]<full['L.rear.paw'][13]-.10,'Small jumps gather less than high-effort jumps');
    for(let frame=0;frame<=120;frame++) {
      const t=frame/120,pose=sampleCatClip(base+'Light',t);
      for(const paw of paws)if(t<=.08||paw.includes('rear')&&t<=.20||paw.includes('front')&&t>=.70||t>=.82)
        assert.ok(distance(pose[paw].slice(12,15),rest[paw].slice(12,15))<.008,`${skin}/${base}: light jumps preserve support at ${t}`);
    }
  }
  if(!preview)for(const fps of [30,60,120]) {
    const scale=.5,floor=w.FLOOR_Y,from=[0,floor+.2,0],landing=[0,floor,.3];
    const world={width:390,height:420,catScale:scale,radius:.3*scale,home:from,objects:[]};
    const target=[.8,floor,.8],arc=.175;
    const duration=motion.catJumpDuration(from,landing,arc,scale);
    const bytes=fs.readFileSync(`assets/3d/native/cat-${skin}.glb`);
    const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
    resetCatActor();
    render({active:true,world,playback:idle,travel:{path:[from],duration:0,distance:0,jump:false,heading:0}});drawCat(0);
    let landed=false,started=false,walkFrames=0,complete=0,landingHead;
    render({active:true,world,playback:{kind:'segment',segment:{assetKey:'jumpOff',loop:false}},activityKey:'light-drop',travel:{path:[from,landing],duration,arcHeight:arc,distance:distance(from,landing),jump:true,walkAfterLanding:true,landingLook:target,awaitCompletion:true},onRoomStepComplete:()=>landed=true});
    for(let frame=0;frame<fps*4;frame++) {
      if(landed&&!started) {
        const head=actorBones().head;landingHead=Math.atan2(head[8],head[10]);
        const path=motion.catPacedPath([landing,target],scale),timing=motion.catWalkTiming(path,scale);
        render({active:true,world,playback:walking,activityKey:'curved-departure',travel:{path,...timing,distance:distance(landing,target),jump:false,awaitCompletion:true},onRoomStepComplete:()=>complete++});
        started=true;
      }
      drawCat(1/fps);
      const state=actorState();
      if(!started)assert.equal(model.animations[state.clip].name,'jumpOffLight','Short drops select the lighter authored pose');
      else {
        walkFrames++;
        if(walkFrames===1) {
          const head=actorBones().head;
          assert.ok(Math.abs(delta(Math.atan2(head[8],head[10]),landingHead))<.05,'Landing anticipation carries into the first step without a head snap');
        }
        assert.equal(state.turnDuration,0,'A clear landing turns into the next stride without a stationary pivot');
        assert.ok(state.routePath.length>2,'The departure follows a collision-checked curve');
      }
    }
    assert.ok(walkFrames>fps);assert.equal(complete,1);
    assert.ok(distance(actorState().position,target)<1e-6);
  }
  console.log(`Verified ${skin}: aligned approach, loaded final step, delayed handoff, exact arrival, light-jump contacts and curved landing departures.`);
}
assert.ok(motion.catJumpEffort([0,0,0],[0,-.2,.3],.5,.175)<.8);
assert.equal(motion.catJumpEffort([0,0,0],[0,.7,.9],.5,.4),1);
fs.writeFileSync('/tmp/brainpet-motion-flow/flow-metrics.json',JSON.stringify(metrics,null,2));
if(preview)fs.writeFileSync('/tmp/brainpet-motion-flow/flow-poses.json',JSON.stringify(poses));
