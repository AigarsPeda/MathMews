/** A pinned tail attachment must not stretch the skin while resting on a chair. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,point,idle,enableActorCrossfade} from './check-cat-turning.mjs';
const w=load('@/utils/native-room-world');
const {resolveTailContact}=load('@/utils/native-cat-contact');
const rest={angle:0,axis:[0,1,0],blocked:false};
const points=[[0,.5,0],[0,.7,-.2],[0,.9,-.3],[0,1.1,-.3]];
const base={width:390,height:420,catScale:.5,radius:.52,home:[0,w.FLOOR_Y,0],objects:[]};
const pinned={...base,objects:[{instanceId:'backrest',solid:true,collidable:true,movable:false,
  min:[-.1,.4,-.1],max:[.1,.6,.1]}]};
assert.equal(resolveTailContact(points,pinned,rest,1/60).angle,0,'An immovable attachment cannot be cleared by rotating its tail');
for(const fps of [30,60,120]) {
  let previous={angle:Math.PI/2,axis:[1,0,0],blocked:true};
  for(let frame=0;frame<fps;frame++) {
    const next=resolveTailContact(points,pinned,previous,1/fps);
    assert.ok(next.blocked && next.angle<=previous.angle,'An earlier bad correction relaxes without growing or changing axes');
    previous=next;
  }
  assert.equal(previous.angle,0,'The previous distorted pose fully clears');
  assert.equal(resolveTailContact(points,base,previous,1/fps).blocked,false,'Contact recovers after leaving the furnishing');
}
const tipObstacle={...base,objects:[{instanceId:'fixture',solid:false,collidable:true,movable:false,
  min:[-.2,.85,-.4],max:[.2,1.2,-.2]}]};
const clearable=resolveTailContact(points,tipObstacle,rest,1/60);
assert.ok(clearable.angle>0&&!clearable.blocked,'A free hip still allows normal tail collision correction');

const fixture=JSON.parse(fs.readFileSync('scripts/fixtures/rocking-chair-navigation.json'));
const names=['tailjoint0','tailjoint1','tailjoint2','tailjoint3','tailTip'];
enableActorCrossfade();
function pose(world,position,heading,clip,fps) {
  resetCatActor();
  render({active:true,world:{...world,home:position},playback:idle,travel:{path:[position],heading,duration:0,distance:0,jump:false}});drawCat(0);
  const props={active:true,world,activityKey:clip,playback:{kind:'segment',segment:{assetKey:clip,loop:clip==='curlSleep'}},
    travel:{path:[position],heading,duration:5,distance:0,jump:false}};
  render(props);
  for(let frame=0;frame<fps*2;frame++)drawCat(1/fps);
  const before=names.map(point);
  render({...props,active:false});drawCat(.5);
  names.forEach((name,i)=>assert.ok(w.pathLength([point(name),before[i]])<1e-6,'Pause preserves every tail joint'));
  const anchor=before[0];
  return {state:actorState(),relative:before.map(p=>p.map((v,k)=>(v-anchor[k])/world.catScale))};
}
for(const coat of ['orange','grey','white']) {
  openSkin(coat);
  for(const fps of [30,60,120])for(const [width,height]of [[351,390],[366,390]])for(const clip of ['curlUp','curlSleep']) {
    const world=w.buildNativeRoomWorld({width,height,petSize:80,sizeScale:1.15,homeOffset:fixture.roomPetOffset,
      decorations:fixture.placedDecorations,toys:fixture.placedToys});
    const chair=world.objects.find(o=>o.modelId==='chairRockingOak');
    const authored=pose({...world,objects:[]},[0,chair.seat[1],0],chair.seatHeading,clip,fps);
    const seated=pose(world,chair.seat,chair.seatHeading,clip,fps);
    assert.ok(seated.state.tailContact.blocked,'Reproduce the pinned base in the reported chair layout');
    assert.equal(seated.state.tailContact.angle,0,'A held rest cannot fold the skin through a 90-degree hip correction');
    seated.relative.forEach((p,i)=>assert.ok(w.pathLength([p,authored.relative[i]])<1e-5,
      `${coat}/${fps}/${width}/${clip}: the rendered tail retains its authored curve and attachment`));
  }
}
console.log('Verified pinned tail roots, smooth recovery, normal free-tail correction and real chair-rest poses in all coats at 30/60/120 FPS.');

// Contact uses FK through the same three joints that the actor rotates.
const {bendTailPoints,tailJointAngle}=load('@/utils/native-cat-contact');
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const vector=c=>c.axis.map(v=>v*c.angle);
function limits(contact) {
  for(let i=0;i<4;i++)assert.ok(tailJointAngle(contact.angle,i)<=[35,45,45,0][i]*Math.PI/180+1e-9,'Every contact joint has an anatomical turn limit');
}
function outsideBody(authored,bent,body,radius) {
  const line=body.chest.map((v,k)=>v-body.pelvis[k]);
  const lengthSquared=line.reduce((s,v)=>s+v*v,0);
  const gap=p=>{
    const t=Math.max(0,Math.min(1,line.reduce((s,v,k)=>s+v*(p[k]-body.pelvis[k]),0)/lengthSquared));
    return distance(p,body.pelvis.map((v,k)=>v+line[k]*t));
  };
  for(let i=1;i<bent.length;i++)for(let j=1;j<=40;j++) {
    const original=authored[i-1].map((v,k)=>v+(authored[i][k]-v)*j/40);
    const actual=bent[i-1].map((v,k)=>v+(bent[i][k]-v)*j/40);
    // Allow the authored skin attachment, but no newly embedded exposed tail.
    if(gap(original)>=body.radius+radius+.002)assert.ok(gap(actual)>=body.radius+radius-.002,'The exposed tail stays outside the torso capsule');
  }
}
const foliage={...tipObstacle,objects:tipObstacle.objects.map(o=>({...o,modelId:'plantPotted'}))};
assert.equal(resolveTailContact(points,foliage,rest,1/60).angle,0,'A plant without pot/trunk boxes has no tail collider');
const pot={min:[-.1,.1,-.3],max:[.1,.3,-.1]};
foliage.objects[0].collisionBoxes=[pot];
assert.equal(resolveTailContact(points,foliage,rest,1/60).angle,0,'Leaves above the pot do not push the tail');
foliage.objects[0].collisionBoxes=[{min:[-.2,.85,-.4],max:[.2,1.2,-.2]}];
assert.ok(resolveTailContact(points,foliage,rest,1/60).angle>0,'The hard parts of a plant still constrain the tail');
const cushion={...base,objects:[{solid:true,min:[-.7,.1,-.7],max:[.7,.4,.7]},
  {solid:true,min:[-.7,.4,-.7],max:[.7,1,-.57]}]};
const sleeping=[[0,.475,-.2],[.1,.475,-.3],[.2,.475,-.4],[.3,.475,-.5],[.4,.475,-.5]];
assert.equal(resolveTailContact(sleeping,cushion,rest,1/60).angle,0,'A tail .15 rig units above a cushion and .07 world units off the backrest stays authored');

const fixtureWorld={...base,home:[0,w.FLOOR_Y,0]};
openSkin('orange');
function standing(world,heading,fps,reduceMotion=true) {
  resetCatActor();
  render({active:true,reduceMotion,world,playback:idle,travel:{path:[world.home],heading,duration:0,distance:0,jump:false}});
  for(let i=0;i<fps*2;i++)drawCat(1/fps);
  return {points:names.map(point),body:{pelvis:point('pelvis'),chest:point('chest'),radius:.4*world.catScale},contact:structuredClone(actorState().tailContact),nodes:actorBones()};
}
const authoredStanding=standing(fixtureWorld,0,60);
const wall={instanceId:'wall',modelId:'fixture',collidable:true,solid:true,movable:false,min:[-.6,.1,-.65],max:[.6,1.3,-.43]};
const behind={...fixtureWorld,objects:[wall]};
const timelines=[];
for(const fps of [30,60,120]) {
  let contact=rest;const timeline=[];
  for(let frame=0;frame<fps*2;frame++) {
    const next=resolveTailContact(authoredStanding.points,behind,contact,1/fps,authoredStanding.body);
    limits(next);
    assert.ok(distance(vector(next),vector(contact))<=2.4/fps+1e-8,'Engagement and axis changes have a time-based angular speed bound');
    outsideBody(authoredStanding.points,bendTailPoints(authoredStanding.points,next),authoredStanding.body,.105*base.catScale+.006);
    contact=next;if((frame+1)%(fps/2)===0)timeline.push(vector(contact));
  }
  assert.ok(contact.angle>.05,'The wall actually exercises distributed avoidance');
  const engaged=contact.angle;
  for(let frame=0;frame<fps*2;frame++) {
    const next=resolveTailContact(authoredStanding.points,fixtureWorld,contact,1/fps,authoredStanding.body);
    assert.ok(next.angle<=contact.angle+1e-8,'Release never grows the correction');
    assert.ok(distance(vector(next),vector(contact))<=engaged*(1-Math.exp(-4/fps))+1e-8,'Release follows the existing exponential bound');
    contact=next;if((frame+1)%(fps/2)===0)timeline.push(vector(contact));
  }
  assert.equal(contact.angle,0,'The constraint releases completely');
  timelines.push(timeline);
}
for(let rate=1;rate<timelines.length;rate++)timelines[0].forEach((v,i)=>assert.ok(distance(v,timelines[rate][i])<.035,'30/60/120 FPS agree at equal elapsed times'));
for(const heading of [0,.7,Math.PI/2,-1.2])for(const rear of [-.38,-.43,-.50]) {
  const c=Math.cos(heading),s=Math.sin(heading),corners=[];
  for(const x of [-.6,.6])for(const z of [-.7,rear])corners.push([x*c+z*s,z*c-x*s]);
  const object={...wall,min:[Math.min(...corners.map(p=>p[0])),.1,Math.min(...corners.map(p=>p[1]))],
    max:[Math.max(...corners.map(p=>p[0])),1.3,Math.max(...corners.map(p=>p[1]))]};
  const authored=standing(fixtureWorld,heading,60),actual=standing({...fixtureWorld,objects:[object]},heading,60);
  limits(actual.contact);
  // The actor may translate the whole cat away from a close obstacle.
  const offset=actual.points[0].map((v,k)=>v-authored.points[0][k]);
  const moved=authored.points.map(p=>p.map((v,k)=>v+offset[k]));
  const body={...authored.body,pelvis:authored.body.pelvis.map((v,k)=>v+offset[k]),chest:authored.body.chest.map((v,k)=>v+offset[k])};
  assert.ok(distance(body.pelvis,actual.body.pelvis)<1e-6&&distance(body.chest,actual.body.chest)<1e-6,'The paired authored torso differs only by actor translation');
  const expected=bendTailPoints(moved,actual.contact);
  actual.points.forEach((p,i)=>assert.ok(distance(p,expected[i])<1e-6,`The actor applies exactly the FK shape used for penetration tests: ${heading}/${rear}/${i} error=${distance(p,expected[i])} actual=${p} expected=${expected[i]}`));
  outsideBody(moved,actual.points,body,.105*base.catScale+.006);
}
const side={...wall,min:[.12,.65,-.6],max:[.45,1.1,-.25]};
for(const fps of [30,60,120]) {
  let contact=rest;
  for(let frame=0;frame<fps*3;frame++) {
    const obstacle=frame<fps?wall:side;
    const next=resolveTailContact(authoredStanding.points,{...fixtureWorld,objects:[obstacle]},contact,1/fps,authoredStanding.body);
    assert.ok(distance(vector(next),vector(contact))<=Math.max(2.4/fps,contact.angle*(1-Math.exp(-4/fps)))+1e-8,`Switching from rear to side contact cannot pop between axes: ${fps}/${frame} delta=${distance(vector(next),vector(contact))}`);
    outsideBody(authoredStanding.points,bendTailPoints(authoredStanding.points,next),authoredStanding.body,.105*base.catScale+.006);
    contact=next;
  }
}

const sideways=standing({...fixtureWorld,objects:[side]},0,60);
assert.ok(sideways.contact.angle>.05,'A box beside the tail produces an avoidance bend');
limits(sideways.contact);outsideBody(authoredStanding.points,sideways.points,authoredStanding.body,.105*base.catScale+.006);
// An enclosed tail accepts unresolved overlap without exceeding joint limits.
const anchor=authoredStanding.points[0];
const cage=[];
for(let axis=0;axis<3;axis++)for(const sign of [-1,1]) {
  const min=anchor.map(v=>v-2),max=anchor.map(v=>v+2);
  if(sign<0)max[axis]=anchor[axis]-.09;else min[axis]=anchor[axis]+.09;
  cage.push({...wall,min,max});
}
const enclosed={...fixtureWorld,objects:cage};
let limited=rest;
for(let frame=0;frame<120;frame++){limited=resolveTailContact(authoredStanding.points,enclosed,limited,1/60,authoredStanding.body);limits(limited);}
assert.ok(limited.blocked,'An impossible obstacle reports its limited unresolved pose');

// Drive the recorded walk, launch turn and jump through the actual actor.
const {buildRoomActivity}=load('@/utils/room-activities');
const {createRoomActivitySegment}=load('@/pet-display/registry/cat-model-registry');
const options={width:393,height:500,petSize:80,sizeScale:1.15,homeOffset:{x:0,y:.12},
  decorations:[{instanceId:'sofa',decorationId:'sofaBlueClassic',offset:{x:-.35,y:-.10},scale:1.5},
    {instanceId:'bowl',decorationId:'bowlBlue',offset:{x:.55,y:.32}},
    {instanceId:'left',decorationId:'plantPotted',offset:{x:-.65,y:.12}}],toys:[],ownedToyIds:[]};
const reproduction=w.buildNativeRoomWorld(options),plan=buildRoomActivity({...options,nativeWorld:reproduction},0,'sofaSleep','sofa');
let maximumRoot=0;
for(const fps of [30,60,120])for(const reduceMotion of [false,true]) {
  resetCatActor();render({active:true,reduceMotion,world:reproduction,playback:idle});drawCat(0);
  let at=reproduction.home;
  for(let i=0;i<2;i++) {
    const step=w.prepareNativeStep(plan,plan.steps[i],w.catScreenPoint(at,reproduction),reproduction,at[1]);at=step.native.path.at(-1);
    render({active:true,reduceMotion,world:reproduction,travel:step.native,activityKey:`repro-${i}`,
      playback:{kind:'segment',segment:createRoomActivitySegment(step.animation)}});
    for(let frame=0;frame<Math.ceil((step.native.duration+1)*fps);frame++) {
      drawCat(1/fps);const contact=actorState().tailContact;limits(contact);
      maximumRoot=Math.max(maximumRoot,tailJointAngle(contact.angle,0));
    }
  }
}
console.log(`Verified distributed FK, 35/45/45-degree limits, torso clearance, plant foliage, cushion clearance, bounded 30/60/120 FPS engage/release, Reduce Motion and recorded sofa approach. Reproduction maximum root: ${(maximumRoot*180/Math.PI).toFixed(2)} degrees.`);
