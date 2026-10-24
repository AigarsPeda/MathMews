/** Acknowledgment must never restart a journey or move a supporting paw. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,idle,walking,enableActorCrossfade} from './check-cat-turning.mjs';
const {FLOOR_Y}=load('@/utils/native-room-world');
const {catCommandResponse}=load('@/utils/native-cat-expression');
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const world={width:390,height:420,catScale:.5,radius:.15,home:[0,FLOOR_Y,0],objects:[]};
const feet=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const yaw=bone=>Math.atan2(bone[8],bone[10]);
const metrics=[];
enableActorCrossfade();
assert.equal(catCommandResponse(2,1,1).look,0);
assert.equal(catCommandResponse(2,1,1).earLift,0);
for(const skin of ['orange','grey','white'])for(const fps of [30,60,120])for(const mode of ['idle','walk','jump','reduced']) {
  const runs=[];
  for(const acknowledged of [false,true]) {
    openSkin(skin);resetCatActor();
    render({active:true,world,playback:idle,travel:{path:[world.home],heading:0,duration:0,distance:0,jump:false}});drawCat(0);
    const jumping=mode==='jump',moving=jumping||mode==='walk';
    const travel=moving?{path:[world.home,[0,jumping?FLOOR_Y+.3:FLOOR_Y,1]],duration:jumping?1:3,distance:1,jump:jumping,awaitCompletion:true}
      :{path:[world.home],heading:0,duration:5,distance:0,jump:false};
    let completed=0;
    let props={active:true,world,playback:jumping?{kind:'segment',segment:{assetKey:'jumpOn',loop:false}}:moving?walking:idle,
      activityKey:mode,travel,reduceMotion:mode==='reduced',onRoomStepComplete:()=>completed++};
    render(props);
    const frames=[];let previous;
    for(let frame=0;frame<fps*2.4;frame++) {
      if(frame===Math.round(fps*.3) || frame===Math.round(fps*.65)) {
        const id=actorState().id,elapsed=actorState().elapsed;
        if(acknowledged)props={...props,commandAttention:{id:frame+1,target:[frame<fps*.5?1:-1,FLOOR_Y+.5,1],issuedAt:Date.now()}};
        render(props);
        assert.equal(actorState().id,id,'Publishing attention does not replace the travel command');
        assert.equal(actorState().elapsed,elapsed,'A queued cue cannot reset the travel clock');
      }
      drawCat(1/fps);
      const state=actorState(),bones=actorBones();
      if(previous&&acknowledged&&(mode==='idle'||mode==='walk'))assert.ok(Math.abs(delta(yaw(bones.head),yaw(previous.head)))<5/fps,`Rapid retargeting blends the head: ${skin}/${fps}/${mode}/${frame} delta=${Math.abs(delta(yaw(bones.head),yaw(previous.head)))} attention=${state.attentionYaw}`);
      frames.push({position:[...state.position],elapsed:state.elapsed,head:bones.head,ears:[bones['ear.L'],bones['ear.R']],feet:feet.map(n=>bones[n]),attention:state.attentionYaw,earYaw:state.earYaw});
      previous=bones;
      if(frame===fps) {
        const before=bones,clock=state.noticeTime;render({...props,active:false});drawCat(.5);
        for(const [name,matrix]of Object.entries(before))assert.ok(distance(matrix,actorBones()[name])<1e-7,'Pause retains the acknowledgment pose');
        assert.equal(actorState().noticeTime,clock);render(props);drawCat(0);
      }
    }
    runs.push({frames,completed});
  }
  const [baseline,noticed]=runs;
  let earChange=0,headChange=0,firstEar;
  for(let i=0;i<baseline.frames.length;i++) {
    const a=baseline.frames[i],b=noticed.frames[i];
    assert.ok(distance(a.position,b.position)<1e-8,'Acknowledgment preserves the complete root trajectory');
    assert.equal(a.elapsed,b.elapsed,'Acknowledgment preserves the activity clock');
    for(let p=0;p<4;p++)assert.ok(distance(a.feet[p],b.feet[p])<1e-7,'Acknowledgment preserves each paw position and sole rotation');
    const ear=Math.max(...a.ears.map((m,k)=>distance(m,b.ears[k])));
    earChange=Math.max(earChange,ear);headChange=Math.max(headChange,distance(a.head,b.head));
    if(ear>.01&&firstEar===undefined)firstEar=(i+1)/fps-.3;
    if(mode==='reduced')assert.ok(ear<1e-8&&distance(a.head,b.head)<1e-8,'Reduce Motion adds no response motion');
    if(mode==='jump'&&i/fps<.8)assert.ok(distance(a.head,b.head)<1e-8,'The airborne head retains its landing aim');
  }
  assert.equal(baseline.completed,noticed.completed,'The journey completes exactly as before');
  if(mode!=='reduced') {
    assert.ok(earChange>.05,'The ears visibly acknowledge the request');
    assert.ok(firstEar<=.11,`Ear response begins within 110 ms: ${firstEar}`);
    if(mode==='idle'||mode==='walk')assert.ok(headChange>.05,'The awake head notices the target');
  }
  if(mode==='idle') {
    assert.ok(noticed.frames[Math.round(fps*.55)].attention>0,'First target receives a rightward look');
    assert.ok(noticed.frames[Math.round(fps*.95)].attention<0,'The latest target receives the next look');
    assert.ok(Math.abs(noticed.frames.at(-1).attention)<.01,'Attention releases after the short acknowledgment');
  }
  metrics.push({skin,fps,mode,firstEar,earChange,headChange});
}
// An old cue must not replay when a cached room mounts later.
openSkin('orange');resetCatActor();
render({active:true,world,playback:idle,commandAttention:{id:1,target:[1,1,1],issuedAt:Date.now()-5000}});drawCat(.1);
assert.equal(actorState().noticeTime,2);assert.equal(actorState().earYaw,0);
fs.writeFileSync('/tmp/brainpet-command-attention-metrics.json',JSON.stringify(metrics,null,2));
console.log('Verified three coats at 30/60/120 FPS: prompt directional acknowledgment, rapid retargeting, unchanged roots/paws/clocks/completion, airborne aim, pause/resume, stale cues and Reduce Motion.');
