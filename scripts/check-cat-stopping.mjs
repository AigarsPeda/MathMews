/** Exercise arrival and interrupted walks on the real actor and shipped rigs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,load,walking,idle,enableActorCrossfade} from './check-cat-turning.mjs';
const {catPacedPath,catWalkTiming}=load('@/utils/native-cat-locomotion');
const scale=.4,home=[-1,.068,-1],end=[1,.068,1],world={width:390,height:420,catScale:scale,radius:.16,home,objects:[]};
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const followers=['headPitch','headYaw','headRoll','tailFollowYaw','tailFollowPitch','tailTipYaw','tailTipPitch'];
const poses=[],metrics=[];
enableActorCrossfade();
for(const skin of ['orange','grey','white'])for(const fps of [30,60,120])for(const stop of [1.35,1.60,1.85,'arrival']) {
  openSkin(skin);resetCatActor();
  const base={active:true,world};
  render({...base,playback:idle});drawCat(0);
  const path=catPacedPath([home,end],scale),travel={path,...catWalkTiming(path,scale,'walk'),distance:distance(home,end),jump:false};
  const moving={...base,playback:walking,activityKey:'walk',travel};render(moving);
  const duration=stop==='arrival'?travel.duration:stop;
  for(let i=0;i<Math.floor(duration*fps);i++)drawCat(1/fps);
  // Exercise an idle flick already in progress when the walk stops.
  actorState().expressionTime=5.4;
  const resting=stop==='arrival'?moving:{...base,playback:idle,activityKey:'stop'};
  if(stop!=='arrival') {
    const before=actorBones();render(resting);drawCat(0);
    for(const name of ['head','tailTip'])assert.ok(distance(before[name],actorBones()[name])<1e-6,'Idle gestures cannot pop in when the stop command arrives');
  }
  let previous={...actorState().spinePose},lastBones=actorBones(),maxStep=0,maxSpeed=0,tailAtQuarter=0;
  const position=[...actorState().position];
  for(let i=0;i<fps*3;i++) {
    drawCat(1/fps);
    const s=actorState(),bones=actorBones();
    for(const matrix of Object.values(bones))assert.ok(matrix.every(Number.isFinite),'Stopping cannot produce invalid transforms');
    for(const key of followers)maxSpeed=Math.max(maxSpeed,Math.abs(s.spinePose[key]-previous[key])*fps);
    for(const name of ['head','tailTip'])maxStep=Math.max(maxStep,distance(bones[name].slice(12,15),lastBones[name].slice(12,15))/scale);
    if(stop!=='arrival')assert.ok(distance(position,s.position)<1e-8,'Settling cannot slide the navigation root');
    if(i===Math.floor(fps*.25))tailAtQuarter=Math.hypot(s.spinePose.tailTipYaw,s.spinePose.tailTipPitch);
    if(i===Math.floor(fps*.1)&&stop!=='arrival') {
      const frozen=actorBones();render({...resting,active:false});drawCat(.5);
      for(const name of Object.keys(frozen))assert.ok(distance(actorBones()[name],frozen[name])<1e-7,'Pause freezes settling');
      render(resting);drawCat(0);
      for(const name of Object.keys(frozen))assert.ok(distance(actorBones()[name],frozen[name])<1e-6,'Resume cannot jump');
    }
    if(skin==='orange'&&fps===60&&stop===1.60&&i%2===0)poses.push({nodes:bones,position:[...s.position],heading:s.heading,scale,time:i/fps,gait:'stop'});
    previous={...s.spinePose};lastBones=bones;
  }
  assert.ok(maxSpeed<1,'Head and tail offsets release without a snap');
  assert.ok(maxStep<12/fps,`No head/tail teleport (${maxStep})`);
  assert.ok(followers.every(key=>Math.abs(actorState().spinePose[key])<.0001),'Follow-through settles within three seconds');
  assert.ok(actorState().tailYaw.every(v=>Math.abs(v)<.0001),'Travel tail wave settles within three seconds');
  if(stop==='arrival')assert.ok(distance(actorState().position,end)<1e-7,'Natural arrival retains the requested endpoint');
  if(fps===60)metrics.push({skin,stop,maxSpeed,maxStep,tailAtQuarter});
}
fs.writeFileSync('/tmp/brainpet-stopping-poses.json',JSON.stringify(poses));
fs.writeFileSync('/tmp/brainpet-stopping-metrics.json',JSON.stringify(metrics,null,2));
console.log('Verified all coats at 30/60/120 FPS: natural arrival, three interrupted stride phases, settled head/tail, stationary root and pause/resume.');
