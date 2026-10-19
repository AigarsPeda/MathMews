/** A pinned tail attachment must not stretch the skin while resting on a chair. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,point,idle,enableActorCrossfade} from './check-cat-turning.mjs';
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
