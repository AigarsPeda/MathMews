/** Compare the real actor with/without torso offsets on every shipped coat. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,load,walking,idle,enableActorCrossfade} from './check-cat-turning.mjs';
const motion=load('@/utils/native-cat-locomotion'),spine=load('@/utils/native-cat-spine');
const original=spine.catSpinePose,zero=original(0,0,0);
let enabled=true;
spine.catSpinePose=(...args)=>enabled?original(...args):zero;
const floor=.068,scale=.4,home=[-1,floor,-1],world={width:390,height:420,catScale:scale,radius:.16,home,objects:[]};
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const paws=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
const make=(points,gait)=>{const path=motion.catPacedPath(points,scale);return {path,...motion.catWalkTiming(path,scale,gait),distance:path.reduce((n,p,i)=>n+(i?distance(p,path[i-1]):0),0),jump:false};};
const poses=[],metrics=[];
enableActorCrossfade();
function record(skin,fps,kind,active) {
  enabled=active;openSkin(skin);resetCatActor();
  const base={active:true,world,playback:walking};
  render({...base,playback:idle});drawCat(0);
  let travel=make([home,[1,floor,1]],kind==='run'?'run':'walk');
  if(kind==='jump')travel={path:[home,[-.65,floor+.25,-.2]],duration:1,distance:.9,jump:true,arcHeight:.30};
  const props={...base,activityKey:'spine',travel,...(kind==='play'?{playback:{kind:'segment',segment:{assetKey:'batToy',loop:true}},travel:{path:[home],heading:0,duration:2,distance:0,jump:false}}:{})};render(props);
  const records=[];
  for(let frame=0;frame<fps*4;frame++) {
    if(kind==='turn'&&frame===fps) {
      const from=[...actorState().position];
      render({...base,activityKey:'curving',travel:make([from,[-1.1,floor,.9]],'walk')});
    }
    drawCat(1/fps);
    const bones=actorBones(),state=actorState();
    assert.ok(Object.values(bones).every(matrix=>matrix.every(Number.isFinite)),'No invalid torso/limb matrices');
    records.push({nodes:bones,position:[...state.position],heading:state.heading,scale,time:frame/fps,gait:kind,contacts:state.gaitContacts.map(p=>p&&[...p])});
    if(frame===Math.floor(fps*.7)) {
      render({...props,active:false});drawCat(.4);
      for(const name of Object.keys(bones))assert.ok(distance(actorBones()[name],bones[name])<1e-7,'Pause holds the whole flexed pose');
      render(props);drawCat(0);
      for(const name of Object.keys(bones))assert.ok(distance(actorBones()[name],bones[name])<1e-6,'Zero-time resume cannot change torso/feet');
    }
  }
  render({...base,playback:idle,activityKey:'rest'});
  for(let frame=0;frame<fps*2;frame++)drawCat(1/fps);
  assert.ok(Object.values(actorState().spinePose).every(value=>Math.abs(value)<1e-6),'Back flex settles after movement stops');
  return records;
}
for(const skin of ['orange','grey','white'])for(const fps of [30,60,120])for(const kind of ['walk','run','turn','jump','play']) {
  const before=record(skin,fps,kind,false),after=record(skin,fps,kind,true);
  let maximum=0,slip=0,head=0,bend=0,shoulder=0,peak=0,slipDetail;
  for(let i=0;i<before.length;i++) {
    const a=before[i],b=after[i];
    assert.ok(distance(a.position,b.position)<1e-8,'Back flex cannot move the navigation root');
    for(const name of paws){const d=distance(a.nodes[name].slice(12,15),b.nodes[name].slice(12,15))/scale;if(d>slip){slip=d;slipDetail={frame:i,name,a:a.nodes[name].slice(12,15),b:b.nodes[name].slice(12,15),contacts:[a.contacts,b.contacts]};}}
    shoulder=Math.max(shoulder,distance(a.nodes['L.forelegjoint0'].slice(12,15),b.nodes['L.forelegjoint0'].slice(12,15))/scale);
    const delta=distance(a.nodes.spine.slice(12,15),b.nodes.spine.slice(12,15))/scale;
    if(delta>maximum){maximum=delta;peak=i;}
    const yaw=m=>Math.atan2(m[8],m[10]);
    const difference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
    bend=Math.max(bend,Math.abs(difference(yaw(b.nodes.chest),yaw(a.nodes.chest))-difference(yaw(b.nodes.pelvis),yaw(a.nodes.pelvis))));
    head=Math.max(head,Math.abs(Math.atan2(Math.sin(yaw(a.nodes.head)-yaw(b.nodes.head)),Math.cos(yaw(a.nodes.head)-yaw(b.nodes.head)))));
  }
  assert.ok(maximum>(['walk','turn'].includes(kind)?.003:.012),`${skin}/${fps}/${kind}: visible middle-back deformation (${maximum})`);
  if(kind==='turn')assert.ok(bend>.05,`${skin}/${fps}: shoulders and hips form a curve into the turn (${bend})`);
  if(kind==='walk'||kind==='play')assert.ok(shoulder>.015,`${skin}/${fps}/${kind}: shoulders move over their supported paws (${shoulder})`);
  assert.ok(slip<.008,`${skin}/${fps}/${kind}: torso changes preserve paw paths (${slip}, ${JSON.stringify(slipDetail)})`);
  assert.ok(head<.02,`${skin}/${fps}/${kind}: the gaze remains stable (${head})`);
  if(skin==='orange'&&fps===60) {
    const indices=kind==='run'?[Math.max(0,peak-4),peak,Math.min(after.length-1,peak+5)]:[peak];
    for(const index of indices)for(const [version,records] of [['before',before],['after',after]])poses.push({...records[index],gait:`${kind}-${version}`});
    metrics.push({kind,maximum,slip,head,bend,shoulder});
  }
}
// A low passage and Reduce Motion must keep their authored envelopes/poses.
for(const [reduceMotion,crawl] of [[false,true],[true,false]]) {
  const samples=[];
  for(const active of [false,true]) {
    enabled=active;openSkin('orange');resetCatActor();
    const leg={kind:'walk',animation:crawl?'crawl':'walk',path:[home,[0,floor,1]],duration:2};
    render({active:true,reduceMotion,world,playback:walking,activityKey:'low',travel:{path:leg.path,legs:[leg],duration:2,distance:2.4,jump:false}});
    for(let i=0;i<60;i++)drawCat(1/60);
    samples.push(actorBones());
  }
  for(const name of Object.keys(samples[0]))assert.ok(distance(samples[0][name],samples[1][name])<1e-7,'Crawling/Reduce Motion preserve their original pose');
}
enabled=true;
fs.writeFileSync('/tmp/brainpet-spine-poses.json',JSON.stringify(poses));
fs.writeFileSync('/tmp/brainpet-spine-metrics.json',JSON.stringify(metrics,null,2));
console.log('Verified all coats at 30/60/120 FPS: visible back flex, fixed root/paw paths, stable gaze, pause/resume, low passages and Reduce Motion.');
