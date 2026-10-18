/** Compare actual native gait playback, planted paws, routing and interruptions. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openSkin, resetCatActor, drawCat, render, point, actorState, actorBones, load, walking, idle, enableActorCrossfade, sampleCatClip } from './check-cat-turning.mjs';
const motion=load('@/utils/native-cat-locomotion');
const {CAT_GAITS,catJourneyGait,catSpeedGait}=load('@/utils/native-cat-gaits');
const {FLOOR_Y,buildNativeRoomWorld,prepareNativeStep,catScreenPoint}=load('@/utils/native-room-world');
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const names=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
enableActorCrossfade();
assert.equal(catJourneyGait('bedSleep',10,.5),'walk');
assert.equal(catJourneyGait('mouseChase',3,.5),'run');
assert.equal(catJourneyGait('investigate',3,.5),'trot');
assert.equal(catJourneyGait('mouseChase',.4,.5),'walk');
assert.equal(catSpeedGait(3.6,'run','run'),'run');
assert.equal(catSpeedGait(3.6,'trot','run'),'trot');
assert.equal(catSpeedGait(4.6,'walk','walk'),'walk');
const straight=[[0,FLOOR_Y,0],[0,FLOOR_Y,4]];
const sampled=motion.catPacedPath(straight,.5);
const timings=['walk','trot','run'].map(gait=>motion.catWalkTiming(sampled,.5,gait));
assert.ok(timings[0].duration>timings[1].duration&&timings[1].duration>timings[2].duration,'Same trip has visibly distinct travel times');
const corridor=motion.catWalkTiming(sampled,.5,'run',()=>false);
assert.ok(corridor.duration>=timings[0].duration,'Narrow clearance never uses running speed');
const curve=motion.catPacedPath([[0,0,0],[0,0,1],[1,0,1]],.5);
assert.ok(motion.catWalkTiming(curve,.5,'run').paces.some(p=>p>2),'Sharp corners slow a run');
// Vertex pace interpolation must have continuous speed at a waypoint.
const path=[[0,0,0],[1,0,0],[2,0,0]],paces=[1,3,1];
const at=t=>motion.catPathPoint(path,t,paces)[0],h=1e-5;
assert.ok(Math.abs((at(.5)-at(.5-h))/h-(at(.5+h)-at(.5))/h)<.001,'No velocity step at a pace change');
const before=motion.catPathPoint(path,.28,paces),revised=motion.catPathFromPosition(path,before,paces);
assert.ok(distance(revised.path[0],before)<1e-8&&revised.paces[0]>1,'A changed route retains its local pace');

// Exercise the actual activity planner, including a corridor that fits the
// regular cat radius but has too little extra room for a run.
{
  const built=buildNativeRoomWorld({width:390,height:420,petSize:80,sizeScale:1,decorations:[],toys:[{toyId:'blueBall',instanceId:'toy',offset:{x:.5,y:.3}}]});
  const ball={...built.objects.find(o=>o.instanceId==='toy'),position:[1.3,FLOOR_Y,1.3]};
  const world={...built,objects:[ball]};
  const from=[-1.5,FLOOR_Y,-1.5],to=[1.5,FLOOR_Y,1.5];
  const step={animation:'walk',mood:'idle',targetInstanceId:'toy',position:catScreenPoint(to,world),durationMs:1000,moveMs:1000};
  const prepared=kind=>prepareNativeStep({kind,steps:[step]},step,catScreenPoint(from,world),world,FLOOR_Y);
  assert.equal(prepared('toyPlay').native.gait,'run',JSON.stringify({scale:world.catScale,travel:prepared('toyPlay').native}));
  assert.ok(prepared('toyPlay').native.duration<motion.catWalkTiming(prepared('toyPlay').native.path,world.catScale,'walk').duration,'Task context changes real scheduled movement');
  const returning={...step,returnHome:true};
  assert.equal(prepareNativeStep({kind:'toyPlay',steps:[returning]},returning,catScreenPoint(from,world),world,FLOOR_Y).native.gait,'walk','Cooling down from play uses a relaxed return');
  const box=(id,min,max)=>({instanceId:id,modelId:'livingTable',position:[0,0,0],scale:1,heading:0,min,max,solid:true,collidable:true,collisionBoxes:[{min,max}]});
  const corridorWorld={...world,catScale:.5,radius:.15,objects:[box('left',[-1,0,-2],[-.18,1,2]),box('right',[.18,0,-2],[1,1,2]),{...ball,position:[.1,FLOOR_Y,1.2]}]};
  const start=[0,FLOOR_Y,-1.5],end=[0,FLOOR_Y,1.5],walkStep={...step,position:catScreenPoint(end,corridorWorld)};
  const travel=prepareNativeStep({kind:'toyPlay',steps:[walkStep]},walkStep,catScreenPoint(start,corridorWorld),corridorWorld,FLOOR_Y).native;
  assert.ok(!travel.blocked&&travel.paces.every(p=>p>=4.6/1.8-.001),'The real narrow corridor retains walking speed');
}

const poses=[],metrics=[];
for(const skin of ['orange','grey','white']) {
  openSkin(skin);
  for(const gait of ['trot','run'])for(let paw=0;paw<4;paw++)for(const contact of [.05,.5,.95]) {
    const spec=CAT_GAITS[gait],phase=(spec.offsets[paw]+spec.stance*contact)%1;
    const bones=sampleCatClip(gait,phase),p=bones[names[paw]].slice(12,15);
    const forward=(paw<2?.40:-.43)-spec.stride*(spec.stance*contact-spec.stance/2);
    assert.ok(Math.abs(p[1]-.10)<.004&&Math.abs(p[2]-forward)<.005,`${skin}/${gait}: shipped stance timing and stride match the movement clock: paw=${paw} contact=${contact} position=${p} forward=${forward}`);
  }
  for(const fps of [30,60,120])for(const scale of [.3,.8])for(const gait of ['walk','trot','run']) {
    resetCatActor();
    const home=[0,FLOOR_Y,-4*scale],room={width:390,height:420,catScale:scale,radius:.3*scale,home,objects:[]};
    render({active:true,world:room,playback:idle});drawCat(1/fps);
    const path=motion.catPacedPath([home,[0,FLOOR_Y,4*scale]],scale),timing=motion.catWalkTiming(path,scale,gait);
    let props={active:true,world:room,playback:walking,activityKey:'gait',travel:{path,...timing,distance:8*scale,jump:false}};
    render(props);let previous,peak=0,contactFrames=0,slip=0,maxStep=0,maxDetail;const seen=new Set();
    for(let i=0;i<Math.ceil((timing.duration+2)*fps);i++) {
      drawCat(1/fps);const state=actorState(),paws=names.map(point);
      seen.add(state.gait);peak=Math.max(peak,state.gaitSpeed);
      if(previous && state.distance<4*scale && state.gaitSpeed>=previous.state.speed) {
        const ranks={walk:0,trot:1,run:2};
        assert.ok(ranks[state.gait]>=ranks[previous.state.gait],'Changing stride length cannot restart the first-step launch or force a walk mid-acceleration');
      }
      const anchors=state.gaitContacts.map(p=>p&&[...p]);
      if(previous)for(let j=0;j<4;j++) {
        const step=distance(previous.paws[j],paws[j])/scale;
        if(step>maxStep){maxStep=step;maxDetail={frame:i,paw:j,elapsed:state.elapsed,gait:state.gait,previous:previous.paws[j],next:paws[j],clipTime:state.clipTime,blend:state.blend,swing:state.gaitSwings[j],anchor:state.gaitContacts[j],previousState:previous.state};}
        if(anchors[j]&&previous.anchors[j]&&distance(anchors[j],previous.anchors[j])<1e-8) {
          slip=Math.max(slip,distance(previous.paws[j],paws[j])/scale);contactFrames++;
          assert.ok(distance(paws[j],anchors[j])<.008*scale,`${skin}/${gait}/${fps}: paw ${j} reaches its fixed contact: error=${distance(paws[j],anchors[j])/scale} frame=${i} elapsed=${state.elapsed} phase=${state.clipTime} gait=${state.gait} paw=${paws[j]} anchor=${anchors[j]} root=${state.position}`);
        }
      }
      assert.ok(paws.every(p=>p.every(Number.isFinite)),'No invalid IK pose');
      if(skin==='orange'&&fps===60&&scale===.3&&i%3===0&&i<360)poses.push({gait,scale,time:i/fps,nodes:actorBones(),position:[...state.position],clip:state.gait});
      previous={paws,anchors,state:{gait:state.gait,speed:state.gaitSpeed,time:state.clipTime,blend:state.blend,elapsed:state.elapsed,launch:(state.distance-state.launchDistance)/(state.launchStride*scale),stride:state.walkStride,swing:state.gaitSwings.map(s=>s&&JSON.parse(JSON.stringify(s)))}};
      if(i===Math.floor(timing.duration*fps*.45)) {
        const frozen=actorBones();render({...props,active:false});drawCat(.3);
        for(const[name,m]of Object.entries(frozen))assert.ok(distance(actorBones()[name],m)<1e-6,'Background pause holds the complete gait pose');
        render(props);drawCat(0);
      }
    }
    assert.ok(seen.has(gait),`${skin}/${fps}/${scale}: ${gait} is reached, seen=${[...seen]}`);
    assert.ok(contactFrames>10&&slip<.008,`${skin}/${gait}: planted paws stay fixed (${slip})`);
    assert.ok(maxStep<18/fps+.01,`${skin}/${gait}/${fps}: no paw teleport (${maxStep}, ${JSON.stringify(maxDetail)})`);
    assert.ok(distance(actorState().position,path.at(-1))<1e-6,'The faster cat stops on its original target');
    if(fps===60&&scale===.8)metrics.push({skin,gait,duration:timing.duration,peak,slip,maxStep});
  }
  console.log(`Verified ${skin}: walk/trot/run, acceleration/braking, fixed contacts, continuous poses, exact arrivals and full-pose pause at 30/60/120 FPS and two sizes.`);
}
// A running cat may be redirected or sent through a hop into a different task.
for(const fps of [30,60,120]) {
  openSkin('orange');resetCatActor();
  const scale=.5,room={width:390,height:420,catScale:scale,radius:.15,home:[0,FLOOR_Y,0],objects:[]};
  render({active:true,world:room,playback:idle});drawCat(1/fps);
  const first=motion.catPacedPath([room.home,[0,FLOOR_Y,5]],scale),timing=motion.catWalkTiming(first,scale,'run');
  render({active:true,world:room,playback:walking,activityKey:'running',travel:{path:first,...timing,distance:5,jump:false}});
  for(let i=0;i<fps*2;i++)drawCat(1/fps);
  const before=[...actorState().position],stale=[before[0],before[1],before[2]-.12],target=[before[0]+.8,before[1],before[2]+.6];
  const path=motion.catPacedPath([stale,target],scale),next=motion.catWalkTiming(path,scale,'trot');
  render({active:true,world:room,playback:walking,activityKey:'new-task',travel:{path,...next,distance:distance(stale,target),jump:false}});
  drawCat(1/fps);
  assert.ok(distance(actorState().position,before)<.06,'A new command does not rewind a running cat to stale JS coordinates');
  for(let i=0;i<fps*5;i++)drawCat(1/fps);
  assert.ok(distance(actorState().position,target)<1e-6,'A run can join a turn and a new destination');
  render({active:true,reduceMotion:true,world:room,playback:walking,activityKey:'reduced-run',travel:{path:first,...timing,distance:5,jump:false}});
  for(let i=0;i<fps;i++)drawCat(1/fps);
  assert.equal(actorState().gait,'walk','Reduce Motion keeps the stable walking pose');
}
console.log('Verified real task intent, safe corridor pace, relaxed returns, running-command replacement, turns and Reduce Motion.');
if(process.argv.includes('--poses'))fs.writeFileSync('/tmp/brainpet-gait-poses.json',JSON.stringify(poses));
fs.writeFileSync('/tmp/brainpet-gait-metrics.json',JSON.stringify(metrics,null,2));
console.log('Verified contextual pace selection, gait hysteresis, tight-space/corner slowdown and continuous waypoint speeds.');
