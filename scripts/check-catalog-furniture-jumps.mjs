/** Commands and exploration must share the same actual catalog supports. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,point,actorState,actorBones,idle,enableActorCrossfade} from './check-cat-turning.mjs';
import {relocate} from './fixtures/furniture-transfers.mjs';
const w=load('@/utils/native-room-world'),a=load('@/utils/room-activities');
const {CAT_FURNITURE}=load('@/constants/cat-furniture');
const {isSeatingSofaDecorationId}=load('@/constants/sofa-decorations');
const {isKitchenChairDecorationId,isKitchenIslandDecorationId}=load('@/constants/kitchen-activities');
const {getDecorationRotationGroup}=load('@/constants/decoration-variants');
const ids=[...new Set([...Object.keys(CAT_FURNITURE),...Object.keys(w.NATIVE_MODEL_CATALOG).filter(id=>
  isSeatingSofaDecorationId(id)||isKitchenChairDecorationId(id)||isKitchenIslandDecorationId(id)||/^bedroom(DoubleBed|BedRose|BedLilac)$/.test(id))])];
const offsets=[[-1.35,0],[1.35,0],[0,-1.35],[0,1.35],[-1.65,0],[1.65,0],[0,-1.65],[0,1.65],[-1.1,-.6],[1.1,.6]];
const narrowOnly=process.argv.includes('--narrow');
function scene(id,scale,x,z,angle=0) {
  const group=getDecorationRotationGroup(id);
  const options={width:390,height:420,petSize:80,sizeScale:1.15,homeOffset:{x:0,y:.4},hungry:false,asleep:false,period:'morning',decorations:[
    {decorationId:'tablePurple',instanceId:'source',offset:{x:0,y:0},scale:1.8},
    {decorationId:group?.[0]??id,rotationIndex:group?.indexOf(id)??0,instanceId:'target',offset:{x:0,y:id==='japaneseShelf'?-.4:0},scale},
  ],toys:[],ownedToyIds:[]};
  const original=w.buildNativeRoomWorld(options),source=relocate(original.objects[0],x,z,angle),target=relocate(original.objects[1],0,0,angle);
  const world={...original,objects:[source,target]};world.home=w.nearestFree([-.8*Math.cos(angle)+1.7*Math.sin(angle),w.FLOOR_Y,1.7*Math.cos(angle)+.8*Math.sin(angle)],world);
  return {options:{...options,nativeWorld:world},world,source,target};
}
function current(s) {
  const plan=a.buildRoomActivity(s.options,0,'sofaSit','source');
  return {plan:{...plan,userRequested:false,steps:[{...plan.steps[2],hold:false,seatPosition:s.source.seat,
    seatHeading:s.source.seatHeading,seatApproach:s.source.approach,targetInstanceId:'source'}]},stepIndex:0};
}
const audit=[];
for(const id of narrowOnly?[]:ids) {
  const scale=id==='bedroomWardrobe'?1:/^chair/.test(id)?2:/^kitchenBarStool/.test(id)?1.8:1.4;
  let selected;
  for(const[x,z]of offsets) {
    const s=scene(id,scale,x,z),transfer=w.findFurnitureTransfer(s.source.seat,'source','target',s.world,s.source.seatHeading);
    if(transfer){selected={x,z};break;}
  }
  if(['bedroomNightstand','bedroomQuiltChest'].includes(id)) {
    assert.equal(selected,undefined,`${id}: embedded clutter leaves no free four-paw landing`);
    audit.push({id,result:'occupied top rejected'});continue;
  }
  assert.ok(selected,`${id}: a clear catalog surface has a direct approach`);
  for(const degrees of [0,53,180,270]) {
    const s=offsets.map(([x,z])=>scene(id,scale,x,z,degrees*Math.PI/180)).find(s=>
      w.findFurnitureTransfer(s.source.seat,'source','target',s.world,s.source.seatHeading));
    if(!s) {
      // Rotating a large corner sofa can disconnect every tested floor exit
      // in this small room. Both callers must reject that arrangement.
      const blocked=scene(id,scale,selected.x,selected.z,degrees*Math.PI/180),held=current(blocked);
      const next=a.buildRoomActivity(blocked.options,0,isKitchenIslandDecorationId(id)?'islandSit':'sofaSit','target');
      assert.ok(!a.routeToSofa(blocked.options,next,w.catScreenPoint(blocked.source.seat,blocked.world),held,blocked.source.seat).steps.some(step=>step.jumpFromInstanceId));
      assert.equal(a.continueFurnitureExploration(blocked.options,held,blocked.source.seat,1),null,'An unsafe rotated layout cannot start an automatic flight');
      audit.push({id,degrees,result:'direct flight rejected; floor fallback'});continue;
    }
    const held=current(s);
    const kind=isKitchenIslandDecorationId(id)?'islandSit':'sofaSit';
    const next=a.buildRoomActivity(s.options,0,kind,'target');
    assert.ok(next,`${id}: has a manual activity`);
    const plan=a.routeToSofa(s.options,next,w.catScreenPoint(s.source.seat,s.world),held,s.source.seat);
    assert.equal(plan.steps[0].jumpFromInstanceId,'source',`${id}/${degrees}: command uses direct flight`);
    let position=s.source.seat;
    for(const step of plan.steps) {
      const prepared=w.prepareNativeStep(plan,step,w.catScreenPoint(position,s.world),s.world,position[1]);
      assert.ok(!prepared.native.blocked,`${id}/${degrees}/${step.animation}: arrival, rest and later floor exit remain usable`);
      position=prepared.native.path.at(-1);
    }
    const automatic=a.continueFurnitureExploration(s.options,held,s.source.seat,1);
    assert.equal(automatic?.steps[0].jumpFromInstanceId,'source',`${id}/${degrees}: exploration uses the same route`);
    assert.equal(automatic.targetInstanceId,'target');
    const occupied={...s.world,objects:[s.source,{...s.target,opened:true}]};
    assert.equal(w.findFurnitureTransfer(s.source.seat,'source','target',occupied),undefined,'Do not jump onto moving/open furniture');
  }
  audit.push({id,scale,sourceOffset:selected,result:'manual and automatic, four rotations'});
}
const openedScene=scene('bedroomDresser',1.4,-1.35,0);
const openedWorld={...openedScene.world,objects:openedScene.world.objects.map(o=>o.instanceId==='target'?{...o,opened:true}:o)};
const openedOptions={...openedScene.options,nativeWorld:openedWorld,decorations:openedScene.options.decorations.map(o=>o.instanceId==='target'?{...o,opened:true}:o)};
const openedCommand=a.buildRoomActivity(openedOptions,0,'sofaSit','target');
assert.ok(openedCommand,'A manual command retains a plan so its failure can be explained');
assert.ok(w.prepareNativeStep(openedCommand,openedCommand.steps[0],w.catScreenPoint(openedWorld.home,openedWorld),openedWorld,w.FLOOR_Y).native.blocked,
  'A manual request for an open cupboard top reports a blocked target');
for(let turn=0;turn<20;turn++){
  const plan=a.buildRoomActivity(openedOptions,turn);
  assert.ok(!(plan?.kind==='sofaSit'&&plan.targetInstanceId==='target'),'Idle activity never picks an open cupboard top');
}
// A long but very narrow shelf supports adducted paws. A tiny square does not.
let narrow;
for(const scale of [.8,.9,1,1.1]) {
  const s=scene('japaneseShelf',scale,-1.35,0),transfer=w.findFurnitureTransfer(s.source.seat,'source','target',s.world,s.source.seatHeading);
  if(!transfer)continue;
  const plan=a.routeToSofa(s.options,a.buildRoomActivity(s.options,0,'sofaSit','target'),w.catScreenPoint(s.source.seat,s.world),current(s),s.source.seat);
  const step=w.prepareNativeStep(plan,plan.steps[0],w.catScreenPoint(s.source.seat,s.world),s.world,s.source.seat[1]);
  if(step.native.stanceWidth<.95){narrow={s,plan,step};break;}
}
assert.ok(narrow,'A genuinely narrow authored shelf can be used with gathered legs');
const poses=[];enableActorCrossfade();
for(const skin of ['orange','grey','white'])for(const fps of [30,60,120]) {
  openSkin(skin);
  const {s,step}=narrow,heading=Math.atan2(step.native.path.at(-1)[0]-s.source.seat[0],step.native.path.at(-1)[2]-s.source.seat[2]);
  resetCatActor();render({active:true,world:{...s.world,home:s.source.seat},playback:idle,travel:{path:[s.source.seat],duration:0,distance:0,jump:false,heading}});drawCat(0);
  render({active:true,world:s.world,activityKey:'narrow',playback:{kind:'segment',segment:{assetKey:step.animation,loop:false}},travel:step.native});
  for(let i=0;i<fps*3;i++){
    drawCat(1/fps);
    if(skin==='orange'&&fps===60&&i%3===0)poses.push({action:'narrow',time:i/fps,nodes:actorBones(),position:[...actorState().position],scale:s.world.catScale,
      furnishings:[s.source,s.target].map(o=>({modelId:o.modelId,position:o.position,heading:o.heading,scale:o.scale}))});
  }
  const top=CAT_FURNITURE.japaneseShelf.surfaces[0];
  const checkPads=(allGrounded=true)=>{let grounded=0;for(const name of ['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw']) {
    const p=point(name),o=s.target,dx=(p[0]-o.position[0])/o.scale,dz=(p[2]-o.position[2])/o.scale;
    const height=(p[1]-actorState().position[1])/s.world.catScale;
    assert.ok(height>=.092,`${skin}/${fps}/${name}: a gathered paw cannot sink below the shelf`);
    if(Math.abs(height-.10)<.008)grounded++;
    const x=Math.cos(o.heading)*dx-Math.sin(o.heading)*dz,z=Math.sin(o.heading)*dx+Math.cos(o.heading)*dz;
    for(let i=0;i<16;i++) {
      const px=x+Math.cos(i*Math.PI/8)*.08*s.world.catScale/o.scale,pz=z+Math.sin(i*Math.PI/8)*.08*s.world.catScale/o.scale;
      assert.ok(top.footprint.every((a,i,poly)=>{const b=poly[(i+1)%poly.length];return (b[0]-a[0])*(pz-a[1])-(b[1]-a[1])*(px-a[0])>=-1e-4;}),`${fps}/${name}: the actual rendered paw pad stays on the narrow top`);
    }
  }assert.ok(grounded>=(allGrounded?4:3),'Sitting gestures retain three supports; standing and settled sitting retain four');};
  checkPads();
  assert.ok(w.hasNativeArrived(actorState().position,step.native.path.at(-1)));
  const rest=w.prepareNativeStep(narrow.plan,narrow.plan.steps[1],w.catScreenPoint(actorState().position,s.world),s.world,actorState().position[1]);
  render({active:true,world:s.world,activityKey:'narrow-rest',playback:{kind:'segment',segment:{assetKey:'sit',loop:false}},travel:rest.native});
  // The authored sit clip briefly raises one forepaw in its second half.
  for(let i=0;i<fps*4;i++){drawCat(1/fps);if(i>fps&&i%10===0)checkPads(false);}
  checkPads();
}
if(!narrowOnly)fs.writeFileSync('/tmp/brainpet-catalog-jump-audit.json',JSON.stringify(audit,null,2));
fs.writeFileSync('/tmp/brainpet-narrow-furniture.json',JSON.stringify(poses));
console.log(narrowOnly?'Verified actual narrow landing and sitting paw pads on all coats at 30/60/120 FPS.':`Verified ${ids.length} catalog supports: commands and autonomous transfers at four rotations, safe later exits, occupied/open top rejection and actual narrow-landing paw pads at 30/60/120 FPS.`);
