/** Avoid stop-and-shuffle pivots when a collision-safe walking turn fits. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,idle,walking,enableActorCrossfade} from './check-cat-turning.mjs';
const {movingCatRoute,isFree,FLOOR_Y}=load('@/utils/native-room-world');
const {catPacedPath,catWalkTiming,steerCatPath}=load('@/utils/native-cat-locomotion');
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const scale=.4,home=[0,FLOOR_Y,0],world={width:390,height:420,catScale:scale,radius:.16,home,objects:[]};
const make=(a,b)=>{const path=catPacedPath([a,b],scale);return {path,...catWalkTiming(path,scale),distance:distance(a,b),jump:false,awaitCompletion:true};};
const reverse=[0,FLOOR_Y,-1.6];
assert.ok(movingCatRoute(make(home,reverse),home,0,0,world,true),'A standing cat can walk around a reversal');
assert.equal(movingCatRoute(make(home,[0,FLOOR_Y,-.3]),home,0,0,world,true),undefined,'A short reposition must not detour around the room');
assert.equal(movingCatRoute({...make(home,reverse),jump:true},home,0,0,world,true),undefined,'Takeoff alignment retains supported turns');
assert.equal(movingCatRoute({...make(home,reverse),elapsed:.2},home,0,0,world,true),undefined,'Resume never replans a departure');
assert.equal(movingCatRoute(make(home,reverse),[0,FLOOR_Y+.4,0],0,0,world,true),undefined,'Perches retain supported turns');
const opposite=steerCatPath([home,reverse],home,0,scale,(a,b)=>a[0]<=.001&&b[0]<=.001,true);
assert.ok(opposite&&opposite.some(p=>p[0]<-.1),'If the right shoulder is blocked, try the left');
assert.equal(steerCatPath([home,reverse],home,0,scale,()=>false,true),undefined,'Blocked U-turns keep the pivot fallback');
const wall={instanceId:'barrier',modelId:'livingTable',position:[0,FLOOR_Y,.2],heading:0,scale:1,solid:true,collidable:true,
  min:[-2,FLOOR_Y,.18],max:[2,2,.28]};
assert.equal(movingCatRoute(make(home,reverse),home,0,0,{...world,objects:[wall]},true),undefined,'A reversal never walks forward through furniture');

enableActorCrossfade();
const poses=[],metrics=[],preview=process.argv.includes('--preview');
for(const skin of preview?['orange']:['orange','grey','white'])for(const fps of preview?[60]:[30,60,120])
for(const moving of [false,true])for(const degrees of [-90,90,180]) {
  openSkin(skin);resetCatActor();
  render({active:true,world,playback:idle,travel:{path:[home],heading:0,distance:0,duration:0,jump:false}});drawCat(1/fps);
  if(moving) {
    render({active:true,world,playback:walking,travel:make(home,[0,FLOOR_Y,1.6]),activityKey:'first'});
    for(let i=0;i<fps*.7;i++)drawCat(1/fps);
  }
  const start=[...actorState().position],heading=actorState().heading+degrees*Math.PI/180;
  const end=[start[0]+Math.sin(heading)*1.6,FLOOR_Y,start[2]+Math.cos(heading)*1.6];
  const completions=[],props={active:true,world,playback:walking,travel:make(start,end),activityKey:'curved-turn',
    onRoomStepComplete:key=>completions.push(key)};
  render(props);
  let last=start,contacts=[],slip=0,firstMotion,paused=false,previousYaw=actorState().heading,largestYawStep=0;
  for(let i=0;i<fps*10;i++) {
    drawCat(1/fps);
    const state=actorState(),bones=actorBones(),step=distance(state.position,last);
    assert.equal(state.turnDuration,0,`${skin}/${fps}/${moving}/${degrees}: use walking footfalls, not a stationary pivot`);
    assert.ok(isFree(state.position,world),'The whole route stays on free floor');
    assert.ok(Object.values(bones).every(m=>m.every(Number.isFinite)));
    if(step>1e-5&&firstMotion===undefined)firstMotion=i/fps;
    if(state.elapsed>.15&&state.elapsed<state.routeDuration-.15)assert.ok(step>1e-8,'No stopped frame within the walking turn');
    const yawStep=Math.abs(Math.atan2(Math.sin(state.heading-previousYaw),Math.cos(state.heading-previousYaw)));
    largestYawStep=Math.max(largestYawStep,yawStep);previousYaw=state.heading;
    for(const [j,name] of ['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'].entries()) {
      const anchor=state.gaitContacts[j],paw=bones[name].slice(12,15),old=contacts[j];
      if(anchor&&old&&distance(anchor,old.anchor)<1e-7)slip=Math.max(slip,distance(paw,old.paw)/scale);
      contacts[j]=anchor?{anchor:[...anchor],paw}:null;
    }
    if(!paused&&i===Math.round(fps*.5)) {
      const frozen=bones;render({...props,active:false});drawCat(.4);
      for(const name of Object.keys(frozen))assert.ok(distance(actorBones()[name],frozen[name])<1e-7,'Pause preserves the walking turn');
      render(props);drawCat(0);
      for(const name of Object.keys(frozen))assert.ok(distance(actorBones()[name],frozen[name])<1e-6,'Resume preserves the same contacts');
      paused=true;
    }
    if(skin==='orange'&&fps===60&&!moving&&degrees!==-90&&i%6===0&&state.elapsed<=state.routeDuration+.2)
      poses.push({gait:`turn-${degrees}`,time:i/fps,nodes:bones,position:[...state.position],scale});
    last=[...state.position];
    if(state.elapsed>state.routeDuration+.3)break;
  }
  assert.ok(firstMotion<.1,`Begin walking without a pivot delay: ${firstMotion}`);
  assert.ok(slip<.01,`Keep planted paws fixed: ${slip}`);
  assert.ok(largestYawStep<=6/fps+1e-6,'Never snap to the destination heading');
  assert.ok(distance(actorState().position,end)<1e-7,'Preserve the requested endpoint');
  assert.deepEqual(completions,['curved-turn'],'Finish exactly once after the actual curved route');
  metrics.push({skin,fps,moving,degrees,firstMotion,slip,largestYawStep,duration:actorState().routeDuration});
}
// A seated cat and Reduce Motion must not enter the new standing departure.
for(const [clip,reduceMotion] of [['sit',false],['idle',true]]) {
  openSkin('orange');resetCatActor();
  render({active:true,world,playback:{kind:'segment',segment:{assetKey:clip,loop:true}}});drawCat(1/60);
  render({active:true,world,reduceMotion,playback:walking,travel:make(home,reverse),activityKey:'gated'});drawCat(1/60);
  if(reduceMotion)assert.equal(actorState().travelHead,0);
  else assert.ok(actorState().turnDuration>0,'A seated pose keeps its supported departure');
}
fs.writeFileSync('/tmp/brainpet-walking-turns-poses.json',JSON.stringify(poses));
fs.writeFileSync('/tmp/brainpet-walking-turns-metrics.json',JSON.stringify(metrics,null,2));
console.log('Verified standing and moving quarter/half turns, immediate walking, fixed paw contacts, safe opposite-side fallback, exact completion, pause/resume and supported-turn exclusions.');
