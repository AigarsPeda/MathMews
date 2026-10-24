/** Standing-to-walk contacts and secondary motion on the production actor. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,load,walking,idle,enableActorCrossfade} from './check-cat-turning.mjs';
const {catPacedPath,catWalkTiming}=load('@/utils/native-cat-locomotion');
const {catLaunchStep}=load('@/utils/native-cat-walk-launch');
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const paws=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
const metrics=[],poses=[];
enableActorCrossfade();
for(const skin of ['orange','grey','white'])for(const fps of [30,60,120])for(const length of [.25,2]) {
  openSkin(skin);resetCatActor();
  const scale=.4,home=[0,.068,0],world={width:390,height:420,catScale:scale,radius:.16,home,objects:[]};
  const base={active:true,world};render({...base,playback:idle});
  for(let i=0;i<fps*.8;i++)drawCat(1/fps);
  const heading=actorState().heading,end=[Math.sin(heading)*length,.068,Math.cos(heading)*length];
  const path=catPacedPath([home,end],scale),travel={path,...catWalkTiming(path,scale,'walk'),distance:length,jump:false};
  const props={...base,playback:walking,activityKey:'start',travel};
  let previous=actorBones(),slip=0,step=0,contacts=0,firstMove,follow=0;
  render(props);
  for(let i=0;i<Math.ceil((travel.duration+.5)*fps);i++) {
    drawCat(1/fps);const state=actorState(),bones=actorBones();
    for(const matrix of Object.values(bones))assert.ok(matrix.every(Number.isFinite));
    if(firstMove===undefined&&distance(state.position,home)>.00001)firstMove=i/fps;
    const progress=(state.distance-state.launchDistance)/(state.launchStride*scale);
    if(state.launchStarted&&progress<.9) {
      assert.ok(state.launchFromStanding,'A straight departure captures the standing pose');
      follow=Math.max(follow,Math.abs(state.spinePose.headPitch),Math.abs(state.spinePose.tailFollowYaw));
      for(let k=0;k<4;k++) {
        if(catLaunchStep(state.launchPhase,progress,k).progress===0) {
          contacts++;slip=Math.max(slip,distance(bones[paws[k]].slice(12,15),state.launchFeet[k])/scale);
        }
      }
    }
    for(const name of [...paws,'head','tailTip'])step=Math.max(step,distance(bones[name].slice(12,15),previous[name].slice(12,15))/scale);
    if(i===Math.round(fps*.15)) {
      render({...props,active:false});drawCat(.4);
      for(const name of Object.keys(bones))assert.ok(distance(actorBones()[name],bones[name])<1e-7,'Pause holds the first step');
      render(props);drawCat(0);
      for(const name of Object.keys(bones))assert.ok(distance(actorBones()[name],bones[name])<1e-6,'Resume retains the first-step pose');
    }
    if(skin==='orange'&&fps===60&&length===2&&i<90&&i%2===0)poses.push({nodes:bones,position:[...state.position],heading:state.heading,scale,time:i/fps,gait:'start'});
    previous=bones;
  }
  assert.ok(contacts>3,`${skin}/${fps}/${length}: standing contacts ${contacts}, launch ${actorState().launchFromStanding}`);
  assert.ok(slip<.01,`${skin}/${fps}/${length}: planted first-step paws stay put (${slip})`);
  assert.ok(step<10/fps+.01,`${skin}/${fps}/${length}: no first-step jump (${step})`);
  assert.ok(firstMove<.1,'The first step responds promptly');
  assert.ok(follow>.001,'Head and tail join the first supported stride');
  assert.ok(distance(actorState().position,end)<1e-7,'Departure retains exact arrival');
  if(fps===60)metrics.push({skin,length,slip,step,contacts,firstMove,follow});
}
fs.writeFileSync('/tmp/brainpet-starting-metrics.json',JSON.stringify(metrics,null,2));
fs.writeFileSync('/tmp/brainpet-starting-poses.json',JSON.stringify(poses));
console.log('Verified all coats at 30/60/120 FPS: short/long standing starts, anchored first contacts, prompt movement, head/tail response, exact arrival and pause/resume.');
