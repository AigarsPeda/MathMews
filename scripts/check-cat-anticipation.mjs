/** Predictive speed and gaze on the production planner and shipped cat rigs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,walking,enableActorCrossfade} from './check-cat-turning.mjs';
const motion=load('@/utils/native-cat-locomotion');
const {catTravelGaze}=load('@/utils/native-cat-expression');
const {FLOOR_Y}=load('@/utils/native-room-world');
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));

// Acceleration is continuous at launch, cruise and arrival, even when a
// doorway or command replacement supplies nonzero boundary velocity.
for(const [start,end] of [[0,0],[.3,0],[.3,.4],[2,0]]) {
  const duration=2,ramp=.2,h=1e-4;
  const p=t=>motion.catTravelProgress(t,duration,ramp,start,end);
  const velocity=t=>(p(t+h)-p(t-h))/(2*h);
  const acceleration=t=>(p(t+h)-2*p(t)+p(t-h))/(h*h);
  assert.ok(Math.abs(p(h)/h-start)<1e-5);
  assert.ok(Math.abs((1-p(duration-h))/h-end)<1e-5);
  for(const t of [2*h,ramp,duration-ramp,duration-2*h])
    assert.ok(Math.abs(acceleration(t))<.15,`No acceleration snap at ${t}: ${acceleration(t)}`);
  for(let t=h;t<duration-h;t+=.01)assert.ok(velocity(t)>=-1e-8,'No reverse motion during braking');
  assert.equal(p(0),0);assert.equal(p(duration),1);
}
assert.equal(motion.catTravelProgress(.5,2,0),.25,'A disabled ramp is finite');
const repeated=[[0,0,0],[0,0,2],[0,0,2],[1,0,2]];
const repeatedTiming=motion.catWalkTiming(repeated,.4,'run');
assert.equal(repeatedTiming.paces[1],repeatedTiming.paces[2],'Duplicate waypoints cannot create a speed discontinuity');
assert.ok(motion.catPathPoint(repeated,.5,repeatedTiming.paces).every(Number.isFinite));

const metrics=[];
for(const scale of [.3,.8])for(const gait of ['walk','trot','run']) {
  const speed={walk:1.8,trot:3,run:4.6}[gait]*scale;
  const path=motion.catPacedPath([[0,0,0],[0,0,12*scale]],scale);
  const timing=motion.catWalkTiming(path,scale,gait,p=>Math.abs(p[2]/scale-6)>.26);
  const before=path.findIndex(p=>p[2]>=5.5*scale-1e-8);
  if(gait!=='walk')assert.ok(timing.paces[before]>1.05,'Brake before entering a narrow passage');
  let peakBrake=0,peakAcceleration=0;
  for(let i=1;i<path.length;i++) {
    const a=timing.paces[i-1],b=timing.paces[i],length=distance(path[i-1],path[i]);
    const acceleration=speed*speed*Math.abs(b-a)/(length*Math.min(a,b)**3)/scale;
    if(b>a)peakBrake=Math.max(peakBrake,acceleration);
    else peakAcceleration=Math.max(peakAcceleration,acceleration);
  }
  assert.ok(peakBrake<=6.001,`Bound braking between samples: ${peakBrake}`);
  assert.ok(peakAcceleration<=5.001,`Bound acceleration between samples: ${peakAcceleration}`);
  metrics.push({scale,gait,peakBrake,peakAcceleration});
}
assert.equal(catTravelGaze([0,0,0],0,[0,0,0],.4),0,'Arrival has no undefined gaze');
assert.ok(catTravelGaze([0,0,0],Math.PI-.01,[-.01,0,-1],.4)<.03,'Gaze takes the short turn across angle wrap');

enableActorCrossfade();
const poses=[],preview=process.argv.includes('--preview');
for(const skin of preview?['orange']:['orange','grey','white'])for(const fps of preview?[60]:[30,60,120])for(const linked of [false,true]) {
  openSkin(skin);resetCatActor();
  const scale=.4,home=[0,FLOOR_Y,-1.5],end=[1.4,FLOOR_Y,.3];
  const world={width:390,height:420,catScale:scale,radius:.16,home,objects:[]};
  const path=motion.catPacedPath(motion.roundCatPath([home,[0,FLOOR_Y,.3],end],.24,()=>true),scale);
  const timing=motion.catWalkTiming(path,scale,'trot');
  const travel={path,...timing,distance:path.reduce((sum,p,i)=>sum+(i?distance(p,path[i-1]):0),0),jump:false,
    ...(linked?{legs:[{kind:'walk',path,...timing}]}:{})};
  const props={active:true,world,playback:walking,travel,activityKey:'anticipation'};
  render(props);
  let lead=0,slip=0,previousContacts=[],lastHead=0,maxHeadStep=0,paused=false;
  for(let i=0;i<Math.ceil((timing.duration+1)*fps);i++) {
    drawCat(1/fps);
    const state=actorState(),bones=actorBones();
    assert.ok(Object.values(bones).every(m=>m.every(Number.isFinite)));
    if(state.position[2]<.05&&Math.abs(state.heading)<.03)lead=Math.max(lead,state.travelHead);
    maxHeadStep=Math.max(maxHeadStep,Math.abs(state.travelHead-lastHead));lastHead=state.travelHead;
    const names=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
    for(let j=0;j<4;j++) {
      const anchor=state.gaitContacts[j],paw=bones[names[j]].slice(12,15),previous=previousContacts[j];
      if(anchor&&previous&&distance(anchor,previous.anchor)<1e-7)slip=Math.max(slip,distance(paw,previous.paw)/scale);
      previousContacts[j]=anchor?{anchor:[...anchor],paw}:null;
    }
    if(!paused&&state.travelHead>.04) {
      const frozen=bones;render({...props,active:false});drawCat(.4);
      for(const name of Object.keys(frozen))assert.ok(distance(actorBones()[name],frozen[name])<1e-7,'Pause holds predictive gaze and contacts');
      render(props);drawCat(0);
      for(const name of Object.keys(frozen))assert.ok(distance(actorBones()[name],frozen[name])<1e-6,'Zero-time resume does not reapply gaze');
      paused=true;
    }
    if(skin==='orange'&&fps===60&&!linked&&i%3===0)poses.push({gait:'anticipation',time:i/fps,nodes:bones,position:[...state.position],scale});
  }
  assert.ok(lead>.02,`${skin}/${fps}/${linked}: the head leads the body before the corner (${lead})`);
  assert.ok(paused,'Exercise pause while the cat looks into the turn');
  assert.ok(slip<.01,`Predictive gaze retains planted paws: ${slip}`);
  assert.ok(maxHeadStep<2/fps,`Gaze changes gradually: ${maxHeadStep}`);
  assert.ok(distance(actorState().position,end)<1e-7,'Exact arrival');
  assert.ok(Math.abs(actorState().travelHead)<.001,'Gaze settles after arrival');
  metrics.push({skin,fps,linked,lead,slip,maxHeadStep});
  resetCatActor();render({...props,reduceMotion:true});
  for(let i=0;i<fps;i++)drawCat(1/fps);
  assert.equal(actorState().travelHead,0,'Reduce Motion suppresses predictive gaze');
}
fs.writeFileSync('/tmp/brainpet-anticipation-metrics.json',JSON.stringify(metrics,null,2));
fs.writeFileSync('/tmp/brainpet-anticipation-poses.json',JSON.stringify(poses));
console.log('Verified smooth velocity ramps, predictive braking/acceleration, head-leading turns, planted feet, exact arrivals, pause/resume and Reduce Motion on direct and linked routes.');
