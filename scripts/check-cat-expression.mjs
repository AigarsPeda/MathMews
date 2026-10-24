/** Exercise secondary movement on the real rig without changing root/foot contacts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,enableActorCrossfade} from './check-cat-turning.mjs';
const {catJumpExpression}=load('@/utils/native-cat-expression');
const floor=load('@/utils/native-room-world').FLOOR_Y;
const preview=process.argv.includes('--preview'),coats=preview?['orange']:['orange','grey','white'],rates=preview?[60]:[30,60,120];
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const determinant=m=>Math.abs(m[0]*(m[5]*m[10]-m[6]*m[9])-m[4]*(m[1]*m[10]-m[2]*m[9])+m[8]*(m[1]*m[6]-m[2]*m[5]));
for(const phase of [0,1])assert.ok(Object.values(catJumpExpression(phase,[0,0,0],[1,.5,0],.5)).every(value=>Math.abs(value)<1e-12),'Secondary jump poses meet the unchanged endpoints');
assert.ok(catJumpExpression(.4,[0,0,0],[1,.5,0],.5).headPitch<0,'Look up toward a higher landing');
assert.ok(catJumpExpression(.4,[0,.5,0],[1,0,0],.5).headPitch>0,'Look down toward a lower landing');
assert.ok(Math.abs(catJumpExpression(.4,[0,0,0],[1.5,.5,0],.5).tailBase)>
  Math.abs(catJumpExpression(.4,[0,0,0],[.4,0,0],.5).tailBase),'Longer/higher jumps have more tail follow-through');
enableActorCrossfade();
const poses=[],ends=[];
const world={width:390,height:420,catScale:.5,radius:.28,home:[0,floor,0],objects:[{
  instanceId:'mouse',modelId:'toy-mouse',movable:true,solid:false,collidable:true,position:[-.5,floor,1.5],heading:0,scale:1,
  min:[-.6,floor,1.4],max:[-.4,floor+.15,1.6],
}]};
for(const coat of coats)for(const fps of rates) {
  openSkin(coat);resetCatActor();
  const props={active:true,world,activityKey:'held-sit',playback:{kind:'segment',segment:{assetKey:'sit',loop:false}},
    travel:{path:[world.home],duration:30,distance:0,jump:false,heading:0}};
  render(props);
  if(coat==='orange'&&fps===60)for(const name of ['expressionTime','lookCycle','attentionYaw','attentionPitch'])delete actorState()[name];
  let last,maximum=0,angularStep=0,blinkMin=Infinity,blinkMax=0,attentionMotion=0,earMin=Infinity,earMax=-Infinity;
  const samples={};
  for(let i=0;i<fps*16.5;i++) {
    drawCat(1/fps);const state=actorState(),bones=actorBones();
    assert.ok(distance(state.position,world.home)<1e-7,'Quiet looks do not move the root');
    if(i>fps*4) {
      const eye=determinant(bones['eye.L']);blinkMin=Math.min(blinkMin,eye);blinkMax=Math.max(blinkMax,eye);
    }
    // Compare an ear axis in the head frame, so a head turn alone cannot
    // satisfy the independent-ear regression.
    const h=bones.head,e=bones['ear.L'];
    const relative=[0,1,2].reduce((sum,k)=>sum+h[k]*e[8+k],0)/(Math.hypot(...h.slice(0,3))*Math.hypot(...e.slice(8,11)));
    earMin=Math.min(earMin,relative);earMax=Math.max(earMax,relative);
    if(last)for(const name of ['head','tailTip','ear.L','ear.R']) {
      maximum=Math.max(maximum,distance(bones[name].slice(12,15),last[name].slice(12,15))/world.catScale);
      for(const column of [0,4,8]) {
        const a=bones[name].slice(column,column+3),b=last[name].slice(column,column+3);
        const dot=a.reduce((sum,value,k)=>sum+value*b[k],0)/(Math.hypot(...a)*Math.hypot(...b));
        angularStep=Math.max(angularStep,Math.acos(Math.max(-1,Math.min(1,dot))));
      }
    }
    attentionMotion=Math.max(attentionMotion,Math.abs(state.attentionYaw));last=bones;
    for(const time of [2,6,9,15])if(i+1===time*fps)samples[time]=bones;
    if(coat==='orange'&&fps===60&&i%3===0)poses.push({action:'awake',time:i/fps,nodes:bones,position:[...state.position],scale:world.catScale,
      sofa:{modelId:'sofaA',position:[0,-5,0],heading:0,scale:1}});
    if(i===fps*6) {
      const frozen=bones,clock=state.expressionTime;render({...props,active:false});drawCat(.5);
      for(const[name,matrix]of Object.entries(frozen))assert.ok(distance(actorBones()[name],matrix)<1e-7,'Pause freezes secondary motion and face animation');
      assert.equal(actorState().expressionTime,clock);render(props);drawCat(0);
    }
  }
  assert.ok(earMax-earMin>.02,'The ear turns independently of the head');
  assert.ok(attentionMotion>.08,'The cat notices an actual nearby toy');
  assert.ok(blinkMin<blinkMax*.25,'An awake held pose keeps blinking beyond the first animation cycle');
  assert.ok(maximum<.65/fps+.012,`${coat}/${fps}: expression transitions have no head/tail pop (${maximum})`);
  assert.ok(angularStep<1.5/fps+.002,`${coat}/${fps}: head/tail rotations stay continuous (${angularStep})`);
  ends.push({coat,fps,samples});
  assert.ok(Math.abs(actorState().attentionYaw)>.08,'Interrupt the cat during an active look, not only in a quiet interval');
  const position=[...actorState().position];
  render({...props,activityKey:'jump',playback:{kind:'segment',segment:{assetKey:'jumpOn',loop:false}},
    travel:{path:[position,[1,floor+.4,0]],duration:.9,distance:1,jump:true,heading:Math.PI/2}});
  for(let i=0;i<fps*2;i++)drawCat(1/fps);
  assert.ok(Math.abs(actorState().attentionYaw)<1e-5,'Resting attention yields to a new command');
  resetCatActor();render({...props,activityKey:'reduced',reduceMotion:true});drawCat(.1);
  const reduced=actorBones();for(let i=0;i<fps;i++)drawCat(1/fps);
  for(const name of ['head','tailTip','eye.L','ear.L','ear.R'])assert.ok(distance(actorBones()[name],reduced[name])<1e-6,'Reduce Motion keeps the expression still');
  for(const clip of ['curlSleep','eating','batToy']) {
    resetCatActor();render({...props,activityKey:clip,playback:{kind:'segment',segment:{assetKey:clip,loop:true}}});
    for(let i=0;i<fps*3;i++)drawCat(1/fps);
    assert.equal(actorState().attentionYaw,0,'Sleep, care and play keep their authored attention');
  }
}
for(const coat of coats) {
  const reference=ends.find(x=>x.coat===coat&&x.fps===rates[rates.length-1]);
  for(const row of ends.filter(x=>x.coat===coat))for(const time of [2,6,9,15])for(const name of ['head','tailTip','ear.L','ear.R'])
    assert.ok(distance(row.samples[time][name],reference.samples[time][name])<.012,'Quiet expression positions and rotations are consistent across frame rates');
}
fs.writeFileSync('/tmp/brainpet-expression-rest.json',JSON.stringify(poses));
console.log(`Verified ${coats.join('/')} at ${rates.join('/')} FPS: continued held-pose blinks, nearby-toy attention, independent ear swivels/flicks, continuous head/tail movement, unchanged roots, pauses, command handoff, sleep/care/play and Reduce Motion.`);
