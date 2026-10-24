/** Exercise exploratory gait changes, furniture brushing and real low-pass playback. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,load,idle,walking,enableActorCrossfade,sampleCatClip} from './check-cat-turning.mjs';
const w=load('@/utils/native-room-world'),motion=load('@/utils/native-cat-locomotion');
const {buildRoomActivity}=load('@/utils/room-activities');
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const floor=w.FLOOR_Y,scale=.45;
const options={width:390,height:420,petSize:80,sizeScale:1,homeOffset:{x:0,y:.4},decorations:[],toys:[],ownedToyIds:[],hungry:false,asleep:false,period:'afternoon',nativeStepCompletion:true};
const empty=w.buildNativeRoomWorld(options);
const world={...empty,catScale:scale,radius:.30,home:[-1.4,floor,0]};
const sofa={instanceId:'edge',modelId:'sofaA',position:[0,floor,0],scale:1,heading:0,solid:true,movable:false,min:[-.4,floor,-.4],max:[.4,floor+.9,.4]};
const brushWorld={...world,objects:[sofa]};
const pass=w.findCatBrushPass(brushWorld,0);
assert.ok(pass,'A safe furniture edge has a brush pass');
assert.ok(w.isFree(pass.from,brushWorld)&&w.isFree(pass.to,brushWorld),'Approach and departure retain ordinary clearance');
assert.ok(!w.findCatBrushPass({...brushWorld,objects:[{...sofa,opened:true}]},0),'An open cupboard/fixture cannot be brushed');
assert.ok(!w.findCatBrushPass({...brushWorld,objects:[{...sofa,modelId:'lampFloorArc'}]},0),'Lamps and fragile props are not brush targets');
const planOptions={...options,nativeWorld:brushWorld};
const plans=Array.from({length:100},(_,turn)=>buildRoomActivity(planOptions,turn));
assert.ok(plans.some(plan=>plan?.steps.some(step=>step.brush)),'Autonomous daytime choices include brushing');
assert.ok(plans.some(plan=>plan?.steps.some(step=>step.gait==='run')),'Daytime floor exploration sometimes breaks into a run');
for(const period of ['night'])for(let turn=0;turn<30;turn++) {
  const plan=buildRoomActivity({...planOptions,period},turn);
  assert.ok(!plan?.steps.some(step=>step.brush||step.gait==='run'),'Night choices suppress brushing and running bursts');
}
assert.equal(buildRoomActivity({...planOptions,hungry:true},0),null,'Care still takes priority');
const brushPlan=plans.find(plan=>plan?.steps.some(step=>step.brush));
const step=brushPlan.steps.find(step=>step.brush),selected=w.findCatBrushPass(brushWorld,step.brush.choice);
const prepared=w.prepareNativeStep(brushPlan,step,w.catScreenPoint(selected.from,brushWorld),brushWorld,floor);
assert.ok(!prepared.native.blocked&&prepared.native.brushSide!==undefined);
assert.equal(prepared.native.gait,'walk');
assert.ok(prepared.native.duration>distance(selected.from,selected.to)/(1.2*scale),'Brushing is slower than an ordinary walk');
const moved={...brushWorld,objects:[{...sofa,min:[-.3,floor,-.4],max:[.5,floor+.9,.4]}]};
assert.ok(w.prepareNativeStep(brushPlan,step,w.catScreenPoint(selected.from,moved),moved,floor).native.blocked,'Moving the furniture invalidates a stale contact pass');

const panel={min:[-.13,floor+.78,-2.5],max:[.13,floor+.87,2.5]};
const legs=[-1,1].map(sign=>({min:[-.13,floor,sign<0?-2.5:2.3],max:[.13,floor+.78,sign<0?-2.3:2.5]}));
const table={...sofa,instanceId:'low-pass',modelId:'tableCoffeeGlass',min:[-.13,floor,-2.5],max:panel.max,collisionBoxes:[panel,...legs]};
const crawlWorld={...world,objects:[table]},target=[1.4,floor,0];
const route=w.findCatRoomRoute(world.home,target,crawlWorld);
assert.ok(route.legs.some(leg=>leg.animation==='crawl'));
const duration=route.legs.reduce((sum,leg)=>sum+leg.duration,0);
// Audit actual catalog geometry at all cardinal rotations, not only the test bridge.
for(const id of ['deskWoodA','deskWoodB','deskOffice','kitchenDiningTable','japaneseTable','livingSmallTable','livingTable','officeDrawingTable','officeKitchenTable'])for(const rotationDegrees of [0,90,180,270]) {
  const real=w.buildNativeRoomWorld({...options,decorations:[{decorationId:id,instanceId:id,scale:2,rotationDegrees,offset:{x:0,y:0}}]});
  const pass=w.findCatCrawlPass(real,0);
  assert.ok(pass,`${id}/${rotationDegrees}: a full-size clear opening remains discoverable`);
}
const lowOptions={...options,nativeWorld:crawlWorld};
const lowPlans=Array.from({length:70},(_,turn)=>buildRoomActivity(lowOptions,turn));
const lowPlan=lowPlans.find(plan=>plan?.steps.some(step=>step.crawl));
assert.ok(lowPlan,'Autonomous exploration deliberately visits a safe low passage');
const lowStep=lowPlan.steps.find(step=>step.crawl),lowPass=w.findCatCrawlPass(crawlWorld,lowStep.crawl.choice);
const lowPrepared=w.prepareNativeStep(lowPlan,lowStep,w.catScreenPoint(lowPass.from,crawlWorld),crawlWorld,floor);
assert.ok(!lowPrepared.native.blocked&&lowPrepared.native.legs.some(leg=>leg.animation==='crawl'));
const poses=[];enableActorCrossfade();
for(const skin of ['orange','grey','white']) {
  openSkin(skin);
  const standing=sampleCatClip('idle',0);
  for(const name of ['rubLeft','rubRight']) {
    const brushed=sampleCatClip(name,.3);
    assert.ok(Math.abs(brushed.chest[12]-standing.chest[12])>.01,'The shoulder participates in brushing');
    assert.ok(Object.values(brushed).every(matrix=>matrix.every(Number.isFinite)));
  }
  for(const fps of [30,60,120]) {
    resetCatActor();const clock={value:{}};
    const travel={path:route.path,legs:route.legs,duration,distance:w.pathLength(route.path),jump:false,awaitCompletion:true};
    let arrivals=0;
    const props={active:true,world:crawlWorld,playback:walking,travel,activityKey:'low-passage',animationTimeValue:clock,onRoomStepComplete:()=>arrivals++};
    render(props);let lowFrames=0,walkingFrames=0;
    for(let frame=0;frame<Math.ceil((duration+3)*fps);frame++) {
      drawCat(1/fps);const state=actorState();
      assert.ok(state.position.every(Number.isFinite));
      if(clock.value.name==='crawl') {
        lowFrames++;
        const bones=actorBones();
        if(Math.abs(state.position[0])<.13+.40*scale) {
          // The head and ear clearance includes a conservative skin allowance.
          const head=bones.head[13]+.38*scale;
          assert.ok(head<panel.min[1]+.005,`${skin}/${fps}: head clears the underside: ${head}/${panel.min[1]}`);
          for(const name of ['tailjoint0','tailjoint1','tailjoint2','tailjoint3','tailTip'])assert.ok(bones[name][13]+.10*scale<panel.min[1]+.005,`${skin}/${fps}: ${name} stays below the panel`);
        }
      } else if(clock.value.name==='walk')walkingFrames++;
      if(frame===Math.floor(fps*2)) {
        const before=actorBones();render({...props,active:false});drawCat(.4);
        assert.deepEqual(actorBones(),before,'Pausing a passage preserves the entire pose');render(props);drawCat(0);
      }
    }
    assert.ok(lowFrames>fps/2&&walkingFrames>0,'The real actor transitions between walking and crawling');
    assert.ok(distance(actorState().position,target)<1e-6);assert.equal(arrivals,1);
    resetCatActor();const brushClock={value:{}};
    const brushProps={active:true,world:brushWorld,playback:walking,travel:prepared.native,activityKey:'brush-edge',animationTimeValue:brushClock};
    render({...brushProps,world:{...brushWorld,home:selected.from},playback:idle,travel:undefined});drawCat(0);render(brushProps);
    let brushFrames=0;
    for(let frame=0;frame<Math.ceil((prepared.native.duration+3)*fps);frame++) {
      drawCat(1/fps);
      if(['rubLeft','rubRight'].includes(brushClock.value.name))brushFrames++;
      assert.ok(Object.values(actorBones()).every(matrix=>matrix.every(Number.isFinite)));
      if(skin==='orange'&&fps===60&&process.argv.includes('--preview')&&frame%6===0)poses.push({action:'brush',time:frame/fps,nodes:actorBones(),position:[...actorState().position],scale,furnishings:[sofa]});
    }
    assert.ok(brushFrames>fps/2,'The real actor uses the rubbing clip while passing the edge');
    assert.ok(distance(actorState().position,selected.to)<1e-6,'Brushing exits at its planned point');
  }
  console.log(`Verified ${skin}: walk/crawl/stand, headroom, pause, one completion and cheek/shoulder brushing at 30/60/120 FPS.`);
}
const fridgeMotion=load('@/utils/native-fridge'),traversal=load('@/utils/native-cat-traversal');
const raisedFridge={instanceId:'raised-fridge',modelId:'kitchenModernFridgeNavy',scale:1,heading:0,
  position:[0,floor,0],min:[-.62,floor,-.54],max:[.62,floor+2.64,.58],solid:true,collidable:true,
  movable:false,fridgeOpen:true,fridgeHingeSide:'left'};
const fridgeWorld={...world,objects:[raisedFridge],fridgeDoorClearance:raisedFridge.instanceId};
const fridgePasses=traversal.buildCatTraversalLinks(fridgeWorld,p=>w.isFree(p,fridgeWorld)).filter(link=>link.leg.animation==='crawl');
for(const skin of ['orange','grey','white'])for(const pass of fridgePasses.slice(0,2)) {
  openSkin(skin);resetCatActor();
  render({active:true,world:{...fridgeWorld,home:pass.from},playback:idle});drawCat(0);
  const travel={path:[pass.from,pass.to],legs:[pass.leg],duration:pass.leg.duration,distance:distance(pass.from,pass.to),jump:false};
  render({active:true,world:fridgeWorld,playback:walking,travel,activityKey:'under-fridge-door'});
  let beneathFrames=0;
  for(let frame=0;frame<Math.ceil((travel.duration+2)*60);frame++) {
    drawCat(1/60);
    if(fridgeMotion.fridgeDoorSweepDistance(actorState().position,raisedFridge)<.4*scale) {
      beneathFrames++;
      const bones=actorBones(),underside=floor+fridgeMotion.fridgeDoorGeometry(raisedFridge).bottom;
      assert.ok(bones.head[13]+.38*scale<underside,`${skin}: the rendered head clears the raised door`);
      for(const name of ['chest','tailjoint0','tailjoint1','tailjoint2','tailjoint3','tailTip'])
        assert.ok(bones[name][13]+.10*scale<underside,`${skin}/${name}: the rendered body stays below the raised door`);
    }
  }
  assert.ok(beneathFrames>30,'The actor actually crosses beneath the door');
  assert.ok(distance(actorState().position,pass.to)<1e-6);
}
console.log('Verified rendered head, back and tail clearance beneath raised fridge doors in both directions on all three coats.');

if(process.argv.includes('--preview')) {
  openSkin('orange');
  for(const action of ['brush','crawl']) {
    const real=w.buildNativeRoomWorld({...options,decorations:[{decorationId:action==='brush'?'sofaA':'deskWoodA',instanceId:'fixture',scale:action==='brush'?1.2:1.5,offset:{x:0,y:0}}]});
    const pass=action==='brush'?w.findCatBrushPass(real,0):w.findCatCrawlPass(real,0);
    assert.ok(pass);
    const from=pass.from,to=pass.to,path=[from,to];
    const timing=motion.catWalkTiming(motion.catPacedPath(path,real.catScale),real.catScale,'walk');
    const travel=action==='brush'?{...timing,path:motion.catPacedPath(path,real.catScale),distance:w.pathLength(path),jump:false,brushSide:pass.side}
      :{path,duration:pass.leg.duration,distance:w.pathLength(path),jump:false,legs:[pass.leg]};
    resetCatActor();render({active:true,world:{...real,home:from},playback:idle});drawCat(0);
    render({active:true,world:real,playback:walking,activityKey:action,travel});
    const records=[];
    for(let frame=0;frame<Math.ceil((travel.duration+2)*60);frame++) {
      drawCat(1/60);
      if(frame%6===0)records.push({action,time:frame/60,nodes:actorBones(),position:[...actorState().position],scale:real.catScale,furnishings:real.objects});
    }
    fs.writeFileSync(`/tmp/brainpet-exploration-${action}.json`,JSON.stringify(records));
  }
}

console.log('Verified contextual daytime bursts, night/care suppression, furniture-edge approach/departure and moved/open/fragile furniture rejection.');
