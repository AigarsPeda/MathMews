/** Compare actual shipped rigs with and without object-reaching corrections. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorBones,actorState,load} from './check-cat-turning.mjs';
const {FLOOR_Y}=load('@/utils/native-room-world');
const {pawReachWeight,pawContactImpulse}=load('@/utils/native-paw-contact');
const {hangingToyContact}=load('@/utils/native-hanging-toy');
const world={width:390,height:420,catScale:.5,radius:.52,home:[0,FLOOR_Y,0],objects:[]};
const names=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const metrics=[];
for(const skin of ['orange','grey','white'])for(const fps of [30,60,120])for(const kind of ['floor','hanging','leaf']) {
  const center=kind==='floor'?[0,FLOOR_Y+.12,.42]:[0,FLOOR_Y+.35,.40],radius=kind==='floor'?.12:kind==='hanging'?.08:0;
  const runs=[];
  for(const targeted of [false,true]) {
    openSkin(skin);resetCatActor();
    const props={active:true,world,playback:{kind:'segment',segment:{assetKey:'batToy',loop:true}},
      travel:{path:[world.home],heading:0,duration:2,distance:0,jump:false,playTargetId:'ball',pawTargetRadius:radius,treePlay:kind==='hanging',plantPlay:kind==='leaf'},
      ...(targeted?{floorToy:{value:{instanceId:'ball',position:center,radius}},hangingBall:{value:center},plantLeaf:{value:center}}:{})};
    render(props);const frames=[];
    for(let frame=0;frame<fps*2;frame++) {
      drawCat(1/fps);const bones=actorBones();
      frames.push({bones,time:actorState().clipTime,root:[...actorState().position]});
      if(frame===Math.round(fps*.65)) {
        render({...props,active:false});drawCat(.25);
        for(const name of Object.keys(bones))assert.ok(distance(bones[name],actorBones()[name])<1e-7,'Pause freezes every contact joint');
        render(props);drawCat(0);
        for(const name of Object.keys(bones))assert.ok(distance(bones[name],actorBones()[name])<1e-7,'Zero-time resume preserves contact');
      }
    }
    runs.push(frames);
  }
  let nearest=Infinity,peakSpeed=0,hits=0,prior,touching=false;
  for(let i=0;i<runs[0].length;i++) {
    const baseline=runs[0][i],actual=runs[1][i],phase=(i+1)/fps/2;
    assert.ok(distance(baseline.root,actual.root)<1e-8,'Reaching never moves the navigation root');
    for(let p=0;p<4;p++) {
      const a=baseline.bones[names[p]],b=actual.bones[names[p]];
      if(p>=2 || pawReachWeight(phase,p)===0)assert.ok(distance(a,b)<1e-5,'Supporting paws retain their complete authored transforms');
      if(p<2) {
        nearest=Math.min(nearest,distance(b.slice(12,15),center));
        for(const column of [0,4,8])assert.ok(distance(a.slice(column,column+3),b.slice(column,column+3))<1e-4,'Reaching preserves the authored wrist orientation');
        if(i>0)peakSpeed=Math.max(peakSpeed,distance(b.slice(12,15),runs[1][i-1].bones[names[p]].slice(12,15))*fps);
      }
    }
    const paws=names.slice(0,2).map(n=>actual.bones[n].slice(12,15));
    const index=hangingToyContact(center,paws,radius+.0375,prior);
    if(index>=0&&!touching&&pawContactImpulse(center,paws[index],prior?.paws[index],1/fps,radius+.0375))hits++;
    touching=index>=0;prior={ball:center,paws};
  }
  assert.ok(nearest<=radius+.038,`${skin}/${fps}/${kind} reaches the visible surface: ${nearest}`);
  assert.ok(nearest>=radius-.006,'The paw pivot never stabs through the object center');
  assert.ok(peakSpeed<2.5,`No sudden reach/release snap: ${peakSpeed}`);
  assert.ok(hits>=1,'The actual paw sweep causes contact');
  metrics.push({skin,fps,kind,nearest,peakSpeed,hits});
}
assert.equal(pawContactImpulse([0,0,0],[.1,0,0],[.1,0,0],1/60,.1),undefined,'A stationary paw cannot kick');
assert.equal(pawContactImpulse([0,0,0],[.2,0,0],[.1,0,0],1/60,.1),undefined,'A withdrawing paw cannot kick');
assert.equal(pawContactImpulse([0,0,0],[0,0,0],[2,0,0],1/60,.1),undefined,'A teleport cannot kick');
// A target moving after commitment must not drag the paw through its release.
openSkin('orange');resetCatActor();
const toy={value:{instanceId:'ball',position:[0,FLOOR_Y+.12,.42],radius:.12}};
const props={active:true,world,playback:{kind:'segment',segment:{assetKey:'batToy',loop:true}},travel:{path:[world.home],heading:0,duration:2,distance:0,jump:false,playTargetId:'ball'},floorToy:toy};
render(props);for(let i=0;i<36;i++)drawCat(1/60);
const committed=[...actorState().playTargets[0]];toy.value={...toy.value,position:[1,1,1]};drawCat(1/60);
assert.ok(distance(committed,actorState().playTargets[0])<1e-8,'A swat does not chase a moving object');
// Reduce Motion keeps the ordinary still pose and publishes no contact paws.
for(const targeted of [false,true]) {
  openSkin('orange');resetCatActor();const paws={value:[]};
  render({...props,reduceMotion:true,floorToy:targeted?toy:undefined,pawPositions:paws});drawCat(.6);
  const before=actorBones();drawCat(.3);
  for(const name of Object.keys(before))assert.ok(distance(before[name],actorBones()[name])<1e-7,'Reduce Motion holds the still pose');
  assert.equal(paws.value.length,0,'Reduce Motion cannot trigger object contact');
}
// A detached final leaf does not cancel the arm halfway through its withdrawal.
openSkin('orange');resetCatActor();const leaf={value:[0,FLOOR_Y+.35,.40]};
render({...props,travel:{...props.travel,plantPlay:true},plantLeaf:leaf});
for(let i=0;i<40;i++)drawCat(1/60);
const before=actorBones()['L.front.paw'].slice(12,15);leaf.value=undefined;drawCat(1/60);
assert.ok(distance(before,actorBones()['L.front.paw'].slice(12,15))<.03,'Losing the last leaf preserves a smooth release');
// The saved room exposed a grazing contact: exact tangency arrived at zero
// paw speed. Exercise its approach at several viewport heights before release.
const w=load('@/utils/native-room-world');
const layout=JSON.parse(fs.readFileSync('scripts/fixtures/paw-contact-room.json'));
for(const height of [390,410,430])for(const fps of [30,60,120]) {
  const room=w.buildNativeRoomWorld({width:390,height,petSize:80,sizeScale:1.15,decorations:layout.placedDecorations,toys:layout.placedToys,homeOffset:layout.roomPetOffset});
  const object=room.objects.find(o=>o.modelId==='toy-blueBall'),center=object.min.map((v,i)=>(v+object.max[i])/2);
  const radius=Math.max(object.max[0]-object.min[0],object.max[2]-object.min[2])/2;
  const plan={kind:'toyPlay',targetInstanceId:object.instanceId,steps:[]};
  const walk=w.prepareNativeStep(plan,{position:{x:0,y:0},animation:'walk',durationMs:1000},w.catScreenPoint(room.home,room),room,w.FLOOR_Y);
  assert.equal(walk.native.blocked,false);const approach=walk.native.path.at(-1);
  const bat=w.prepareNativeStep(plan,{position:w.catScreenPoint(approach,room),animation:'batToy',durationMs:2000},w.catScreenPoint(approach,room),room,w.FLOOR_Y);
  openSkin('orange');resetCatActor();
  render({active:true,world:room,playback:props.playback,travel:bat.native,initialPosition:approach,floorToy:{value:{instanceId:object.instanceId,position:center,radius}}});
  let prior,touching=false,hits=0;
  for(let frame=0;frame<fps*2;frame++) {
    drawCat(1/fps);const paws=names.slice(0,2).map(n=>actorBones()[n].slice(12,15));
    const index=hangingToyContact(center,paws,radius+.075*room.catScale,prior);
    const hit=index>=0?pawContactImpulse(center,paws[index],prior?.paws[index],1/fps,radius):undefined;
    if(!touching&&hit)hits++;touching=index>=0&&(touching||!!hit);prior={ball:center,paws};
  }
  assert.ok(hits>0,`Saved-room surface contact triggers before the paw stops: ${height}/${fps}`);
}
fs.writeFileSync('/tmp/brainpet-paw-contact-metrics.json',JSON.stringify(metrics,null,2));
console.log('Verified surface reach, wrist orientation, supporting paws, contact impulses, bounded speed, pause/resume and committed swats on three coats at 30/60/120 FPS.');
