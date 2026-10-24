/** Real GLB/worklet checks for independent ears and waking into other actions. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,enableActorCrossfade,sampleCatClip} from './check-cat-turning.mjs';
const floor=load('@/utils/native-room-world').FLOOR_Y;
const preview=process.argv.includes('--preview'),coats=preview?['orange']:['orange','grey','white'],rates=preview?[60]:[30,60,120];
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const angle=(a,b)=>{const dot=[0,1,2].reduce((s,k)=>s+a[8+k]*b[8+k],0)/(Math.hypot(...a.slice(8,11))*Math.hypot(...b.slice(8,11)));return Math.acos(Math.max(-1,Math.min(1,dot)));};
const world={width:390,height:420,catScale:.5,radius:.28,home:[0,floor,0],objects:[]};
const poses=[],samples=[];
const wake=load('@/pet-display/registry/cat-model-registry').catModelRegistry.getScenario('wakeUp');
assert.equal(wake.steps.at(-1).assetKey,'wakeStretch','General sleep wakes through the new stretch');
assert.equal(wake.steps.at(-1).loop,false,'Waking never loops the stretch');
enableActorCrossfade();
for(const coat of coats)for(const fps of rates) {
  openSkin(coat);resetCatActor();
  const sleeping=sampleCatClip('curlSleep',0),curled=sampleCatClip('curlUp',1);
  assert.ok(sleeping.tailTip[13]<sleeping.tailjoint0[13]+.15,'Sleeping tail rests beside the body instead of standing upright');
  assert.ok(Math.abs(sleeping.tailTip[12]-sleeping.tailjoint0[12])>.25,'Resting tail clears the center of the back');
  for(const name of ['tailjoint0','tailjoint1','tailjoint2','tailjoint3','tailTip']) {
    assert.ok(sleeping[name][13]>.1,'Resting tail stays above the cushion');
    assert.ok(distance(curled[name],sleeping[name])<1e-5,'Settling ends in the exact sleeping tail pose');
    assert.ok(distance(sleeping[name],sampleCatClip('curlSleep',2)[name])<1e-5,'Sleeping tail loops without a seam');
  }
  const base={active:true,world,activityKey:'wake',playback:{kind:'scenario',steps:[
    {assetKey:'curlSleep',loop:false,model:{duration:.6,rate:1}},
    {assetKey:'curlUp',reverse:true,loop:false},
    {assetKey:'wakeStretch',loop:false},
    {assetKey:'idle',loop:true},
  ]}};
  render(base);
  let last,maxDelta=0,maxAngle=0,feet,stretchChest=Infinity,standingChest=0;
  const row={coat,fps};
  for(let i=0;i<fps*5;i++) {
    drawCat(1/fps);const bones=actorBones(),state=actorState();
    assert.ok(bones['ear.L']&&bones['ear.R'],'Both ears have independent joints');
    for(const matrix of Object.values(bones))assert.ok(matrix.every(Number.isFinite),'Every blended pose stays finite');
    assert.ok(distance(state.position,world.home)<1e-8,'Waking does not slide the root');
    if(last)for(const name of ['head','chest','pelvis','tailTip','ear.L','ear.R','L.front.paw','R.rear.paw']) {
      maxDelta=Math.max(maxDelta,distance(bones[name].slice(12,15),last[name].slice(12,15))/world.catScale);
      maxAngle=Math.max(maxAngle,angle(bones[name],last[name]));
    }
    const elapsed=(i+1)/fps;
    if(elapsed>=1.85&&elapsed<=4.1) {
      feet??=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'].map(n=>bones[n].slice(12,15));
      ['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'].forEach((name,k)=>assert.ok(distance(bones[name].slice(12,15),feet[k])<.003,`${coat}/${fps}/${elapsed}/${name}: stretch keeps pads planted (${distance(bones[name].slice(12,15),feet[k])})`));
      stretchChest=Math.min(stretchChest,bones.chest[13]);
    }
    if(i+1===fps*4.5){standingChest=bones.chest[13];row.end=bones;}
    if(i+1===fps*2.5) {
      row.mid=bones;
      const paused=bones,clock=state.elapsed;render({...base,active:false});drawCat(.5);
      assert.equal(actorState().elapsed,clock,'Pause freezes a stretch');
      for(const name of Object.keys(bones))assert.ok(distance(actorBones()[name],paused[name])<1e-7,'Paused bones do not drift');
      render(base);drawCat(0);
    }
    if(coat==='orange'&&fps===60&&i%6===0)poses.push({action:'wake',time:i/fps,nodes:bones,position:[...state.position],scale:world.catScale});
    last=bones;
  }
  assert.ok(standingChest-stretchChest>.075,'Waking visibly lowers the chest before recovering');
  assert.ok(maxDelta<4.5/fps+.012,`${coat}/${fps}: no positional pops across sleep, uncurl, stretch and idle (${maxDelta})`);
  assert.ok(maxAngle<8/fps+.02,`${coat}/${fps}: no rotational snaps across waking (${maxAngle})`);
  samples.push(row);
  // General pet sleep uses the registry's faster reversed sleepy clip,
  // unlike the room-bed uncurl sequence above. Exercise its real timing too.
  resetCatActor();render({...base,activityKey:'general-wake',playback:{kind:'scenario',steps:[
    {assetKey:'sleep',loop:false,model:{duration:.6,rate:1}},...wake.steps,{assetKey:'idle',loop:true},
  ]}});
  let previousGeneral;
  for(let i=0;i<fps*5;i++) {
    drawCat(1/fps);const current=actorBones();
    if(previousGeneral)for(const name of ['head','chest','ear.L','ear.R']) {
      assert.ok(current[name].every(Number.isFinite),'General waking produces finite joints');
      assert.ok(distance(current[name].slice(12,15),previousGeneral[name].slice(12,15))/world.catScale<6/fps+.015,'General waking blends without a positional pop');
    }
    previousGeneral=current;
  }
  // Interrupt at the deepest part, then walk, turn, jump and return to rest.
  resetCatActor();const stretch={...base,activityKey:'stretch',playback:{kind:'segment',segment:{assetKey:'wakeStretch',loop:false}}};render(stretch);
  for(let i=0;i<fps;i++)drawCat(1/fps);
  const start=[...actorState().position];
  render({...base,activityKey:'walk',playback:{kind:'segment',segment:{assetKey:'walk',loop:true}},
    travel:{path:[start,[0,floor,1.5]],duration:2,distance:1.5,jump:false,gait:'run'}});
  let previous=actorBones();
  for(let i=0;i<fps*3;i++){
    drawCat(1/fps);const current=actorBones();for(const m of Object.values(current))assert.ok(m.every(Number.isFinite));
    for(const name of ['head','chest','ear.L','ear.R'])assert.ok(distance(current[name].slice(12,15),previous[name].slice(12,15))<5/fps+.015,`${coat}/${fps}/${i}/${name}: interrupt delta ${distance(current[name].slice(12,15),previous[name].slice(12,15))}`);
    previous=current;
  }
  assert.ok(distance(actorState().position,[0,floor,1.5])<.01,'A command interrupts the stretch and reaches its target');
  render({...base,activityKey:'jump',playback:{kind:'segment',segment:{assetKey:'jumpOn',loop:false}},
    travel:{path:[[0,floor,1.5],[1,floor+.4,1.5]],duration:.9,distance:1,jump:true,heading:Math.PI/2}});
  for(let i=0;i<fps*2;i++)drawCat(1/fps);
  assert.ok(distance(actorState().position,[1,floor+.4,1.5])<.01,'Waking and walking can continue into a jump');
  resetCatActor();render({...stretch,reduceMotion:true});drawCat(.1);const reduced=actorBones();
  for(let i=0;i<fps;i++)drawCat(1/fps);
  for(const name of ['head','ear.L','ear.R','L.front.paw'])assert.ok(distance(actorBones()[name],reduced[name])<1e-6,'Reduce Motion keeps the waking pose still');
}
for(const coat of coats) {
  const reference=samples.find(s=>s.coat===coat&&s.fps===rates.at(-1));
  for(const row of samples.filter(s=>s.coat===coat))for(const stage of ['mid','end'])for(const name of ['head','chest','ear.L','ear.R'])
    assert.ok(distance(row[stage][name],reference[stage][name])<.025,'Waking agrees across frame rates');
}
fs.writeFileSync('/tmp/brainpet-cat-waking.json',JSON.stringify(poses));
console.log(`Verified waking on ${coats.join('/')} at ${rates.join('/')} FPS: sleep/uncurl/stretch/idle blends, four planted paws, fixed root, pauses, interruption into walking/jumping and Reduce Motion.`);
