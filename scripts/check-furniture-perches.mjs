/** Audit every seat/top, actual seated paws, cramped approaches and interrupted exits. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatFurniture} from './3d/build-cat-furniture.mjs';
import {load,openSkin,resetCatActor,render,drawCat,point,actorState,idle,enableActorCrossfade} from './check-cat-turning.mjs';
const w=load('@/utils/native-room-world');
const {CAT_FURNITURE}=load('@/constants/cat-furniture');
const variants=load('@/constants/decoration-variants');
const {CHAIR_DECORATION_IDS}=load('@/constants/cat-decorations');
const {isCatSeatDecorationId}=load('@/constants/sofa-decorations');
const {isKitchenChairDecorationId}=load('@/constants/kitchen-activities');
const {getRoomCommands,roomCommandLabel}=load('@/constants/room-commands');
const {buildRoomActivity,buildRoomExit}=load('@/utils/room-activities');
const {catJumpPoint}=load('@/utils/native-cat-locomotion');
const {buildCatTraversalLinks}=load('@/utils/native-cat-traversal');
assert.deepEqual(JSON.parse(JSON.stringify(CAT_FURNITURE)),buildCatFurniture(),'Perch geometry matches the shipped meshes');
for(const id of CHAIR_DECORATION_IDS)assert.ok(CAT_FURNITURE[id]||isCatSeatDecorationId(id)||isKitchenChairDecorationId(id),`${id}: every store chair has a seating interaction`);
function setup(id,rotationDegrees=0,scale=/^chair/.test(id)?2:/^kitchenBarStool/.test(id)?1.8:1.4) {
  const group=variants.getDecorationRotationGroup(id);
  const item={decorationId:group?.[0]??id,rotationIndex:group?.indexOf(id)??0,instanceId:'target',offset:{x:0,y:id==='japaneseShelf'?-.4:0},rotationDegrees,scale};
  const options={width:390,height:420,petSize:80,sizeScale:1.15,homeOffset:{x:0,y:.4},decorations:[item],toys:[],ownedToyIds:[]};
  const world=w.buildNativeRoomWorld(options),object=world.objects[0];
  assert.equal(object.modelId,id,'Exercise the actual rotated catalog model');
  return {options,world,object,item};
}
function runPlan(options,world,plan,at=world.home) {
  for(let index=0;index<plan.steps.length;index++) {
    const step=w.prepareNativeStep(plan,plan.steps[index],w.catScreenPoint(at,world),world,at[1]);
    assert.equal(step.native.blocked,false,`${world.objects[0].modelId}/${index}: complete the selected furniture activity`);
    if(step.native.jump) {
      const support=world.objects.find(o=>o.instanceId===(step.targetInstanceId??plan.targetInstanceId));
      const meta=w.NATIVE_MODEL_CATALOG[support.modelId];
      for(let sample=0;sample<=100;sample++) {
        const p=catJumpPoint(step.native.path[0],step.native.path.at(-1),sample/100,step.native.arcHeight,true);
        const dx=(p[0]-support.position[0])/support.scale,dz=(p[2]-support.position[2])/support.scale;
        const x=Math.cos(support.heading)*dx-Math.sin(support.heading)*dz,z=Math.sin(support.heading)*dx+Math.cos(support.heading)*dz;
        for(const box of meta.collisionBoxes??[meta]) {
          if(box.max[1]*support.scale+support.position[1]<=p[1]+.025*world.catScale || box.min[1]*support.scale+support.position[1]>=p[1]+1.25*world.catScale)continue;
          const gap=Math.hypot(x-Math.max(box.min[0],Math.min(box.max[0],x)),z-Math.max(box.min[2],Math.min(box.max[2],z)))*support.scale;
          assert.ok(gap>=.28*world.catScale-1e-6,`${support.modelId}/${index}/${sample}: lift above the support edge instead of passing through it`);
        }
      }
    }
    at=step.native.path.at(-1);
    plan={...plan,steps:plan.steps.map((old,i)=>i===index?step:old)};
  }
  return {plan,at};
}
let checked=0;
for(const id of Object.keys(CAT_FURNITURE))for(const rotation of [0,53,180,270]) {
  const {options,world,object,item}=setup(id,rotation,id==='bedroomWardrobe'?1:undefined);
  const commands=getRoomCommands({kind:'decoration',...item});
  assert.ok(commands.some(c=>c.kind==='sofaSit'),`${id}: jump/sit is available in the item menu`);
  assert.ok(!commands.some(c=>c.kind==='sofaSleep'),'New perches do not invent unsupported sleep poses');
  assert.equal(roomCommandLabel('sofaSit',item.decorationId),'furnitureSit');
  const perch=w.findFurniturePerch(world.home,object,world);
  if(['bedroomNightstand','bedroomQuiltChest'].includes(id)) {
    assert.equal(perch,undefined,`${id}: built-in vase/books or folded quilts occupy the small top`);
    const plan=buildRoomActivity({...options,nativeWorld:world},0,'sofaSit','target');
    assert.ok(w.prepareNativeStep(plan,plan.steps[0],w.catScreenPoint(world.home,world),world,w.FLOOR_Y).native.blocked,
      'An obstructed furnishing reports an unreachable command instead of overlapping its props');
    checked++;continue;
  }
  assert.ok(perch,`${id}/${rotation}: a sufficiently sized surface is reachable`);
  assert.ok(w.isFree(perch.approach,world),'Takeoff and landing retain full walking clearance');
  let plan=buildRoomActivity({...options,nativeWorld:world},0,'sofaSit','target');
  const result=runPlan(options,world,plan);
  assert.ok(w.hasNativeArrived(result.at,world.home),'The full activity returns home');
  const seated=result.plan.steps[2];
  assert.ok(w.hasNativeArrived(seated.native.path[0],perch.seat),'Held sitting uses the selected free surface');
  const exit=buildRoomExit({...options,nativeWorld:world},result.plan,2,w.catScreenPoint(perch.seat,world));
  const leaving=runPlan(options,world,exit,perch.seat);
  assert.ok(w.hasNativeArrived(leaving.plan.steps[0].seatPosition,perch.seat),'Interrupted roof departures retain the selected top, not a drawer/cupboard interior');
  assert.ok(leaving.at[1]===w.FLOOR_Y,'An interrupted perch command exits to the floor');
  // Block the whole usable top, including the alternative corners.
  const blocked={...world,objects:[...world.objects,{instanceId:'occupied-top',modelId:'test-blocker',solid:true,
    position:object.position,heading:0,scale:1,min:[object.min[0]-.2,perch.seat[1],object.min[2]-.2],max:[object.max[0]+.2,perch.seat[1]+2,object.max[2]+.2]}]};
  assert.equal(w.findFurniturePerch(world.home,object,blocked),undefined,'An occupied top cannot be used');
  const lowCeiling={...world,objects:[...world.objects,{...blocked.objects.at(-1),min:[object.min[0]-.2,perch.seat[1]+.2,object.min[2]-.2]}]};
  assert.equal(w.findFurniturePerch(world.home,object,lowCeiling),undefined,'Headroom is required above the paws');
  checked++;
}
for(const id of ['chairOfficeA','chairGamingA','kitchenBarStoolOak']) {
  const {world,object,options}=setup(id,0,.7);
  assert.equal(w.findFurniturePerch(world.home,object,world),undefined,'Miniature seats cannot support all four paws');
  assert.ok(buildCatTraversalLinks(world,p=>w.isFree(p,world)).every(link=>link.from[1]===w.FLOOR_Y && link.to[1]===w.FLOOR_Y),
    'Navigation can hop over a miniature, but cannot stand on it as an intermediate perch');
  const plan=buildRoomActivity({...options,nativeWorld:world},0,'sofaSit','target');
  assert.equal(w.prepareNativeStep(plan,plan.steps[0],w.catScreenPoint(world.home,world),world,w.FLOOR_Y).native.blocked,true);
}
const tall=setup('kitchenBarStoolOak',0,2.2);
assert.equal(w.findFurniturePerch(tall.world.home,tall.object,tall.world),undefined,'An oversized high stool exceeds direct jump reach');
for(const id of ['chairOfficeB','chairClassicA','livingTable']) {
  const {world}=setup(id,0,/^chair/.test(id)?2:1.4);
  const links=buildCatTraversalLinks(world,p=>w.isFree(p,world));
  assert.ok(links.some(link=>link.leg.supportId==='target' && link.leg.kind==='hop'),`${id}: pathfinding can use a sufficiently large furnishing`);
}
// A table lamp occupies one part of a top. Retain the other exposed end.
const tabletop=setup('livingTable',53,1.8),center=tabletop.object.seat;
const withProp={...tabletop.world,objects:[...tabletop.world.objects,{instanceId:'table-prop',modelId:'test-blocker',solid:true,
  min:[center[0]-.10,center[1],center[2]-.10],max:[center[0]+.10,center[1]+.6,center[2]+.10],position:center,heading:0,scale:1}]};
const exposed=w.findFurniturePerch(withProp.home,tabletop.object,withProp);
assert.ok(exposed,'An exposed table end remains usable beside a prop');
assert.ok(w.pathLength([exposed.seat,center])>.2,'The cat avoids the occupied table center');
// Existing sofas/beds also use compact jumping clearance, rather than a full
// walking circle rejecting a neighbor outside the tucked body envelope.
for(const id of ['sofaA','sofaBlueClassic','bedroomDoubleBed']) {
  const {world,object}=setup(id,0,1.4),seat=object.seat;
  const side=seat[0]+.85*world.catScale;
  const adjacent={...world,objects:[...world.objects,{instanceId:'neighbor',modelId:'test-blocker',solid:true,position:[side,seat[1],seat[2]],heading:0,scale:1,
    min:[side-.02,seat[1],seat[2]-.02],max:[side+.02,seat[1]+.4,seat[2]+.02]}]};
  assert.ok(w.findSeatApproach(world.home,object,adjacent),`${id}: nearby furniture outside the jumping body allows access`);
}
// Verify the shipped animation's four planted paws fit the chosen mesh top.
openSkin('orange');enableActorCrossfade();
for(const id of ['chairOfficeB','chairClassicD','chairGamingB','kitchenBarStoolMetal','bedroomBench','kitchenDiningTable','deskWoodB'])for(const fps of [30,60,120]) {
  const {world,object}=setup(id,53);
  const perch=w.findFurniturePerch(world.home,object,world);
  assert.ok(perch);
  resetCatActor();
  render({active:true,world:{...world,home:perch.seat},playback:idle,travel:{path:[perch.seat],heading:object.seatHeading,duration:0,distance:0,jump:false}});drawCat(0);
  render({active:true,world,activityKey:'sit',playback:{kind:'segment',segment:{assetKey:'sit',loop:false}},
    travel:{path:[perch.seat],heading:object.seatHeading,duration:.3,distance:0,jump:false}});
  for(let frame=0;frame<3*fps;frame++)drawCat(1/fps);
  assert.ok(w.hasNativeArrived(actorState().position,perch.seat));
  for(const name of ['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw']) {
    const p=point(name),dx=(p[0]-object.position[0])/object.scale,dz=(p[2]-object.position[2])/object.scale;
    const x=Math.cos(object.heading)*dx-Math.sin(object.heading)*dz,z=Math.sin(object.heading)*dx+Math.cos(object.heading)*dz;
    assert.ok(CAT_FURNITURE[id].surfaces.some(top=>top.footprint.every((a,i,poly)=>{const b=poly[(i+1)%poly.length];
      return (b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])>=-1e-5;})),`${id}/${fps}: ${name} stays on the usable seat/top`);
  }
}
for(const locale of ['en','lv'])assert.ok(JSON.parse(fs.readFileSync(`locales/${locale}.json`)).home.catCommands.furnitureSit);
// Playback must use exactly the collision-tested arc and retain it when a
// same-seat command replaces a request in midair.
for(const fps of [30,60,120]) {
  const {options,world,object}=setup('chairGamingB');
  const perch=w.findFurniturePerch(world.home,object,world),from=perch.approach;
  const plan=buildRoomActivity({...options,nativeWorld:world},0,'sofaSit','target');
  const step=w.prepareNativeStep(plan,{...plan.steps[1],seatPosition:perch.seat,seatApproach:from},w.catScreenPoint(from,world),world,from[1]);
  resetCatActor();
  const heading=Math.atan2(perch.seat[0]-from[0],perch.seat[2]-from[2]);
  render({active:true,world:{...world,home:from},playback:idle,travel:{path:[from],duration:0,distance:0,jump:false,heading}});drawCat(0);
  let complete=0;
  const props={active:true,world,activityKey:'jump',playback:{kind:'segment',segment:{assetKey:'jumpOn',loop:false}},travel:{...step.native,awaitCompletion:true},onRoomStepComplete:()=>complete++};
  render(props);
  const drawJump=()=>{
    drawCat(1/fps);
    if(actorState().jumpPhase<=.2)return;
    const head=point('head'),dx=(head[0]-object.position[0])/object.scale,dz=(head[2]-object.position[2])/object.scale;
    const x=Math.cos(object.heading)*dx-Math.sin(object.heading)*dz,z=Math.sin(object.heading)*dx+Math.cos(object.heading)*dz,r=.25*world.catScale;
    for(const box of w.NATIVE_MODEL_CATALOG[object.modelId].collisionBoxes) {
      if(box.max[1]*object.scale+object.position[1]<=head[1]-r || box.min[1]*object.scale+object.position[1]>=head[1]+r)continue;
      const gap=Math.hypot(x-Math.max(box.min[0],Math.min(box.max[0],x)),z-Math.max(box.min[2],Math.min(box.max[2],z)))*object.scale;
      assert.ok(gap>=r,`${fps}: the rendered head clears the chair back through flight and landing`);
    }
  };
  while(actorState().jumpPhase<.45)drawJump();
  const state=actorState(),flight=(state.jumpPhase-.2)/.5;
  assert.ok(w.pathLength([state.position,catJumpPoint(from,perch.seat,flight,step.native.arcHeight,true)])<1e-6,'Playback follows the validated arc');
  const before=[...state.position],height=state.jumpArcHeight;
  render({...props,activityKey:'same-seat-refresh',travel:{...props.travel,path:[before,perch.seat],arcHeight:height+.2}});drawCat(0);
  assert.equal(actorState().jumpArcHeight,height,'A refreshed command cannot change the airborne arc');
  assert.ok(w.pathLength([before,actorState().position])<1e-6,'The arc cannot restart in midair');
  for(let frame=0;frame<fps*3;frame++)drawJump();
  assert.equal(complete,1);assert.ok(w.hasNativeArrived(actorState().position,perch.seat));
}
console.log(`Verified ${checked} furniture/rotation combinations, all store chairs, occupied/miniature/high perches, alternate table ends, safe exits and actual seated paws at 30/60/120 FPS.`);
