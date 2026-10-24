/** Moving route handoffs and tail motion on the shipped skeletons/worklet. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,load,walking,enableActorCrossfade} from './check-cat-turning.mjs';
const {catPacedPath,catWalkTiming,catTravelProgress,steerCatPath}=load('@/utils/native-cat-locomotion');
const {movingCatRoute,isFree,FLOOR_Y}=load('@/utils/native-room-world');
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const preview=process.argv.includes('--preview'),skins=preview?['orange']:['orange','grey','white'],rates=preview?[60]:[30,60,120];
const recordings=[],metrics=[];
const scale=.4,home=[0,FLOOR_Y,-1.6],world={width:390,height:420,catScale:scale,radius:.16,home,objects:[]};
const make=(path,gait='trot')=>{const samples=catPacedPath(path,scale);return {path:samples,...catWalkTiming(samples,scale,gait),distance:path.reduce((n,p,i)=>n+(i?distance(p,path[i-1]):0),0),jump:false};};
// The rate integral retains ordinary acceleration and exactly matches a
// nonzero incoming velocity, including above-cruise speed when slowing down.
for(const rate of [0,.3,1,2]) {
  assert.equal(catTravelProgress(0,2,.2,rate),0);assert.equal(catTravelProgress(2,2,.2,rate),1);
  assert.ok(Math.abs(catTravelProgress(1e-6,2,.2,rate)/1e-6-rate)<1e-5);
  let last=0;for(let i=0;i<=200;i++){const p=catTravelProgress(i/100,2,.2,rate);assert.ok(p>=last&&p<=1);last=p;}
}
assert.equal(steerCatPath([home,[0,FLOOR_Y,-2.1]],home,0,scale,()=>true),undefined,'A reversal retains a planted turn');
assert.equal(steerCatPath([home,[1,FLOOR_Y,0]],home,0,scale,()=>false),undefined,'An obstructed curve is rejected');
const curved=movingCatRoute(make([home,[1,FLOOR_Y,.3]]),home,0,.7,world);
assert.ok(curved&&curved.path.length>10&&curved.path.every(p=>isFree(p,world)),'A safe moving arc is sampled inside the navigable room');
const wall={instanceId:'wall',modelId:'livingTable',position:[0,0,0],heading:0,scale:1,solid:true,collidable:true,
  min:[-.3,FLOOR_Y,-1.45],max:[.3,1,-1.35]};
assert.equal(movingCatRoute(make([home,[1,FLOOR_Y,-1.6]]),home,0,.7,{...world,objects:[wall]}),undefined,'Do not carry momentum through furniture');
enableActorCrossfade();
for(const skin of skins)for(const fps of rates)for(const gait of ['walk','trot','run']) {
  openSkin(skin);resetCatActor();
  const meta={value:{name:'idle',time:0}},base={active:true,world,animationTimeValue:meta,playback:walking};
  const start=make([home,[0,FLOOR_Y,1.6]],gait),props={...base,activityKey:'first',travel:start};render(props);
  let minTail=Infinity,maxTail=-Infinity,previous;const seen=new Set();
  for(let i=0;i<fps*1.5;i++) {
    drawCat(1/fps);const state=actorState(),bones=actorBones();seen.add(state.gait);
    const tip=bones.tailTip.slice(12,15),root=bones.tailjoint0.slice(12,15);
    const side=((tip[0]-root[0])*Math.cos(state.heading)-(tip[2]-root[2])*Math.sin(state.heading))/scale;
    minTail=Math.min(minTail,side);maxTail=Math.max(maxTail,side);
    if(skin==='orange'&&fps===60&&i%6===0)recordings.push({gait,time:i/fps,nodes:bones,position:[...state.position],scale});
    previous=bones;
  }
  assert.ok(seen.has(gait),`${skin}/${fps}: the ${gait} clip is actually reached before steering (${[...seen]})`);
  assert.ok(maxTail-minTail>.08,`${skin}/${gait}/${fps}: the tail moves visibly during locomotion (${maxTail-minTail})`);
  const before=actorState(),position=[...before.position],speed=before.gaitSpeed*scale;
  const target=[1.3,FLOOR_Y,.9],next={...base,activityKey:'moving-turn',travel:make([position,target],gait)};
  render(next);
  let minimum=Infinity,maxDelta=0,slip=0,last=position,contacts=[],arrived=false;
  for(let i=0;i<fps*5;i++) {
    drawCat(1/fps);const state=actorState(),bones=actorBones(),step=distance(state.position,last);
    for(const matrix of Object.values(bones))assert.ok(matrix.every(Number.isFinite));
    assert.ok(isFree(state.position,world),'The rendered curve remains in free floor space');
    if(i<fps*.25){minimum=Math.min(minimum,step*fps);assert.equal(state.turnDuration,0,'A moving direction change does not insert an in-place turn');}
    for(const name of ['head','tailjoint0','tailTip','L.front.paw','R.rear.paw'])maxDelta=Math.max(maxDelta,distance(bones[name].slice(12,15),previous[name].slice(12,15))/scale);
    for(let k=0;k<4;k++) {
      const name=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'][k],p=bones[name].slice(12,15),anchor=state.gaitContacts[k];
      if(anchor&&contacts[k]&&distance(anchor,contacts[k].anchor)<1e-7)slip=Math.max(slip,distance(p,contacts[k].paw)/scale);
      contacts[k]=anchor?{anchor:[...anchor],paw:p}:null;
    }
    if(skin==='orange'&&fps===60&&i%6===0)recordings.push({gait,time:1.5+i/fps,nodes:bones,position:[...state.position],scale});
    if(i===Math.round(fps*.15)) {
      const frozen=bones,elapsed=state.elapsed;render({...next,active:false});drawCat(.4);
      for(const name of Object.keys(bones))assert.ok(distance(actorBones()[name],frozen[name])<1e-7,'Pause retains the complete curved movement and tail pose');
      render({...next,travel:{...next.travel,elapsed:elapsed-.02}});drawCat(0);
      for(const name of Object.keys(bones))assert.ok(distance(actorBones()[name],frozen[name])<1e-6,`${skin}/${fps}/${gait}/${name}: resume delta ${distance(actorBones()[name],frozen[name])}`);
    }
    last=[...state.position];previous=bones;
    if(distance(state.position,target)<1e-6)arrived=true;
  }
  assert.ok(minimum>speed*.25,`${skin}/${fps}/${gait}: movement carries speed into a new heading (${minimum}/${speed})`);
  assert.ok(slip<.01,`${skin}/${gait}: planted feet do not skate around a curve (${slip})`);
  assert.ok(maxDelta<20/fps+.01,`${skin}/${gait}: no body/tail/foot teleport (${maxDelta})`);
  assert.ok(arrived,'The curved route ends on the original requested target');
  if(fps===60)metrics.push({skin,gait,minimum,speed,slip,maxDelta});
}
fs.writeFileSync('/tmp/brainpet-fluid-poses.json',JSON.stringify(recordings));
fs.writeFileSync('/tmp/brainpet-fluid-metrics.json',JSON.stringify(metrics,null,2));
console.log(`Verified ${skins.join('/')} at ${rates.join('/')} FPS: walk/trot/run tail motion, safe moving turns, carried speed, stable contacts, exact arrivals, pause/resume, reversal and blocked-curve fallback.`);
