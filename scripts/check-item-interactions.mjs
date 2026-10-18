/** Verify catalog interactions, saved states, drawer navigation and native drawing callbacks. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache = new Map(), mocks = {};
function load(id) {
  if (id in mocks) return mocks[id];
  const file = id.startsWith('@/') ? path.resolve(id.slice(2)) : id;
  if (/\.(png|webp|glb)$/.test(file)) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts','.tsx','.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(resolved,'utf8'));
  else vm.runInNewContext(ts.transpileModule(fs.readFileSync(resolved,'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module, exports: module.exports, require: load, Math, Date, Map, Set });
  return module.exports;
}
const placement=load('@/utils/room-placement');
const profiles=load('@/data/item-interactions.json');
const catalog=load('@/assets/3d/native/catalog.json');
const {isDecorationOpen}=load('@/constants/item-interactions');
const {isPoweredDecorationId}=load('@/constants/decoration-motion');
const {getRoomCommands}=load('@/constants/room-commands');
const {buildNativeRoomWorld,prepareNativeStep,catScreenPoint,FLOOR_Y,hasNativeArrived,isFree}=load('@/utils/native-room-world');
const {buildRoomActivity,buildRoomReturn}=load('@/utils/room-activities');
const prices=load('@/data/store-prices.json');
assert.deepEqual(Object.keys(profiles).sort(),Object.keys(prices.decoration).sort(),'Every catalog decoration has been reviewed');
let openCount=0,powerCount=0;
for(const [id,profile] of Object.entries(profiles)) {
  const item={decorationId:id,instanceId:'one',offset:{x:0,y:0}};
  const other={...item,instanceId:'two'};
  if(profile.open) {
    openCount++;
    const opened=placement.togglePlacedDecorationOpenByInstance([item,other],'one');
    assert.equal(opened[0].opened,!isDecorationOpen(item));assert.equal(opened[1],other);
    const saved=placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(opened)));
    assert.equal(saved[0].opened,opened[0].opened,id+' saves an explicit open or closed value');
    assert.equal(placement.togglePlacedDecorationOpenByInstance(saved,'one')[0].opened,isDecorationOpen(item));
    assert.ok(catalog[id].interactionParts?.some(p=>p.mode==='open'),id+' has movable geometry');
  }
  if(profile.power) {
    powerCount++;
    assert.equal(isPoweredDecorationId(id),true);
    const powered=placement.togglePlacedDecorationPowerByInstance([item,other],'one');
    assert.equal(powered[0].poweredOn,true);assert.equal(powered[1],other);
    assert.equal(placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(powered)))[0].poweredOn,true);
    assert.ok(catalog[id].powerMaterials?.length || catalog[id].interactionParts?.some(p=>p.mode!=='open'),id+' has visible power feedback');
  }
  const bytes=fs.readFileSync(`assets/3d/native/${id}.glb`),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  for(const part of catalog[id].interactionParts??[]) {
    const node=gltf.nodes.find(n=>n.name===part.node);
    assert.ok(node?.children?.length,id+' includes '+part.node);
    assert.ok(part.pivot.every(Number.isFinite));assert.ok(part.offset.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...part.axis)-1)<1e-6);
  }
  for(const material of catalog[id].powerMaterials??[])assert.ok(gltf.nodes.some(n=>n.name===material.node),id+' glow entity exists');
  const commands=getRoomCommands({kind:'decoration',decorationId:id,instanceId:'one'});
  assert.ok(commands.length,id+' offers a cat interaction');
}
assert.equal(placement.normalizePlacedDecorations([{decorationId:'sofaA',instanceId:'bad',offset:{x:0,y:0},opened:true,poweredOn:true}])[0].opened,undefined);
console.log(`Verified all ${Object.keys(profiles).length} decorations, ${openCount} opening models, ${powerCount} power controls, independent copies and save restoration.`);
for(const id of ['bedroomDresser','bedroomNightstand','bedroomVanity','japaneseClosetDrawerClosed','kitchenModernCounterNavy','kitchenModernIslandSage','bedroomWardrobe','japaneseCloset','officeWoodClosetAni','officeMetallicClosetAni'])for(const rotationDegrees of [0,90,180,270]) {
  const item={decorationId:id,instanceId:'drawer',offset:{x:0,y:0},opened:true,rotationDegrees,
    ...(profiles[id].cat==='cupboardHide' && id!=='bedroomWardrobe'?{scale:1.4}:{})};
  const options={width:390,height:420,petSize:80,sizeScale:1.15,decorations:[item],toys:[],ownedToyIds:[],homeOffset:{x:.6,y:.6},hungry:false,asleep:false,nativeStepCompletion:true};
  const world=buildNativeRoomWorld(options);options.nativeWorld=world;
  const kind=profiles[id].cat==='cupboardHide'?'cupboardHide':'drawerHide';
  const plan=buildRoomActivity(options,0,kind,'drawer');
  assert.ok(plan,id+' builds the selected drawer plan');assert.equal(plan.targetInstanceId,'drawer');
  let screen=catScreenPoint(world.home,world),height=FLOOR_Y;
  const actual=[];
  for(let index=0;index<3;index++) {
    const step=prepareNativeStep(plan,plan.steps[index],screen,world,height);
    assert.equal(step.native.blocked,false,id+' '+rotationDegrees+' step '+index+' can reach the drawer');
    plan.steps[index]=step;actual.push(step);screen=step.position;height=step.native.path.at(-1)[1];
  }
  assert.equal(actual[2].hold,true);assert.ok(hasNativeArrived(actual[1].native.path.at(-1),world.objects[0][kind==='cupboardHide'?'cupboard':'drawer']));
  if(kind==='cupboardHide') {
    assert.equal(world.objects[0].cupboardFits,true);
    assert.ok(Math.abs(actual[2].native.heading-rotationDegrees*Math.PI/180)<1e-6,'The hiding cat faces out of the cupboard');
    const small=buildNativeRoomWorld({...options,decorations:[{...item,scale:.7}]});
    assert.equal(prepareNativeStep(plan,plan.steps[1],screen,small,height).native.blocked,true,'A cupboard that is too small cannot be entered');
  }
  assert.ok(height>FLOOR_Y,'The cat sits in the tray above the floor');
  const exit=buildRoomReturn(options,plan,2,screen);
  assert.equal(exit.steps[0].animation,'jumpOff');
  const leaving=prepareNativeStep(exit,exit.steps[0],screen,world,height);
  assert.equal(leaving.native.blocked,false,id+' can safely jump out');
  const closed=buildNativeRoomWorld({...options,decorations:[{...item,opened:false}]});
  assert.equal(prepareNativeStep(plan,plan.steps[1],screen,closed,height).native.blocked,true,'A closed drawer cannot be entered');
}
console.log('Verified drawer/cupboard entry, landing height, held hiding, outward facing, all four rotations, size/closing guards and safe jump-off.');
for(const id of ['bedroomSlippers','poster1','booksPile','officeCalculator','carpetRound','bathroomMirror']) {
 const options={width:390,height:420,petSize:80,sizeScale:1.15,decorations:[{decorationId:id,instanceId:'target',offset:{x:0,y:0}}],toys:[],ownedToyIds:[],homeOffset:{x:.6,y:.6},hungry:false,asleep:false,nativeStepCompletion:true};
 options.nativeWorld=buildNativeRoomWorld(options);
 const plan=buildRoomActivity(options,0,'investigate','target');assert.ok(plan);
 const step=prepareNativeStep(plan,plan.steps[0],catScreenPoint(options.nativeWorld.home,options.nativeWorld),options.nativeWorld,FLOOR_Y);
 assert.equal(step.native.blocked,false,id+' can be investigated');assert.equal(isFree(step.native.path.at(-1),options.nativeWorld),true);
}
console.log('Verified passive items use a reachable floor approach without walking through furniture.');

// Execute the real compiled drawing callback, including retained-asset remounts.
const {default:babel}=await import('@babel/core');
const filename=path.resolve('components/pet/native/NativeItemInteraction.tsx');
const compiled=babel.transformSync(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,
}}).outputText,{filename,babelrc:false,configFile:false,plugins:[['react-native-worklets/plugin',{processNestedWorklets:true}]]}).code;
let cursor=0,frame,effects=[];const hooks=[],writes=[],colors=[];
const same=(a,b)=>a&&a.length===b.length&&b.every((v,i)=>v===a[i]);
const matrix=(ops=[])=>({
 scaling(v){return matrix([...ops,['scale',Array.from(v)]])},
 rotate(a,v){return matrix([...ops,['rotate',a,Array.from(v)]])},
 translate(v){return matrix([...ops,['translate',Array.from(v)]])},ops,
});
const metadata=catalog.kitchenModernSinkNavy;
const entities=[...(metadata.interactionParts??[]).map(p=>({name:p.node})),...(metadata.powerMaterials??[]).map(p=>({name:p.node}))];
const material={getFloat4Parameter(){throw Error('Retained material values must not define authored colors')},setFloat4Parameter(key,value){colors.push({key,value:Array.from(value)})}};
const asset={getFirstEntityByName:name=>entities.find(e=>e.name===name),getRenderableEntities:()=>entities.filter(e=>metadata.powerMaterials?.some(p=>p.node===e.name))};
mocks.react={useMemo(fn,deps){const i=cursor++;if(!same(hooks[i]?.deps,deps))hooks[i]={deps,value:fn()};return hooks[i].value},
 useEffect(fn,deps){const i=cursor++;if(!same(hooks[i]?.deps,deps)){hooks[i]={deps};effects.push(fn)}}};
mocks['react-native-worklets-core']={useSharedValue(initial){const i=cursor++;return hooks[i]??(hooks[i]={value:initial})}};
mocks['react-native-filament']={useFilamentContext:()=>({
 transformManager:{createIdentityMatrix:()=>matrix(),setTransform(entity,pose){writes.push({name:entity.name,ops:pose.ops})}},
 nameComponentManager:{getEntityName:e=>e.name},renderableManager:{getPrimitiveCount:()=>1,getMaterialInstanceAt:()=>material},
}),RenderCallbackContext:{useRenderCallback(fn){frame=fn}}};
const runtime={exports:{}};vm.runInNewContext(compiled,{module:runtime,exports:runtime.exports,require:load,Math,Map,Set,global:{Error}});
let object={modelId:'kitchenModernSinkNavy',instanceId:'one',opened:false,poweredOn:false};
function render(extra={}){cursor=0;effects=[];runtime.exports.NativeItemInteraction({asset,object,active:true,reduceMotion:false,...extra});for(const effect of effects)effect()}
render();frame({timeSinceLastFrame:1/60});const initialWrites=writes.length;
for(let i=0;i<120;i++)frame({timeSinceLastFrame:1/60});assert.equal(writes.length,initialWrites,'Closed idle objects do not repeat native writes');
object={...object,opened:true,poweredOn:true};render();
for(let i=0;i<120;i++)frame({timeSinceLastFrame:1/60});
assert.ok(writes.some(w=>w.ops.some(op=>op[0]==='rotate'&&Math.abs(op[1])>1)),'Cupboard leaves actually swing');
const water=metadata.interactionParts.find(p=>p.mode==='water');assert.ok(water);
assert.deepEqual(writes.filter(w=>w.name===water.node).at(-1).ops[0],['scale',[1,1,1]],'Water becomes visible');
const openedWrites=writes.length;render({active:false});for(let i=0;i<60;i++)frame({timeSinceLastFrame:1/60});assert.equal(writes.length,openedWrites);
object={...object,opened:false,poweredOn:false};render({reduceMotion:true});frame({timeSinceLastFrame:1/60});
assert.deepEqual(writes.filter(w=>w.name===water.node).at(-1).ops[0],['scale',[1,0,1]],'Water stops with Reduce Motion');
for(const part of metadata.interactionParts.filter(p=>p.mode==='open'))assert.ok(Math.abs(writes.filter(w=>w.name===part.node).at(-1).ops[1][1])===0,'Closed doors return to their authored hinge');
hooks.length=0;render();frame({timeSinceLastFrame:1/60});assert.ok(writes.length>openedWrites,'A retained model reapplies its saved state after remount');
console.log('Verified compiled cupboard and water callbacks, opening, closing, Reduce Motion, hidden-room pause, retained remounts and no idle writes.');

// The reported wardrobe has a bed beside its front, so approach the open gap.
{
 const fixture=load('@/scripts/fixtures/cupboard-bedroom.json');
 for(const ratio of [1,1.05,1.1]) {
  const options={width:390,height:390*ratio,petSize:80,sizeScale:1.15,bedId:fixture.bedId,bedOffset:fixture.roomBedOffset,
   bedFlipped:fixture.bedFlipped,homeOffset:fixture.roomPetOffset,decorations:fixture.placedDecorations,toys:[],ownedToyIds:[],hungry:false,asleep:false,nativeStepCompletion:true};
  const world=buildNativeRoomWorld(options);options.nativeWorld=world;
  const object=world.objects.find(o=>o.modelId==='bedroomWardrobe');
  const plan=buildRoomActivity(options,0,'cupboardHide',object.instanceId);
  let screen=catScreenPoint(world.home,world),height=FLOOR_Y;
  for(let index=0;index<3;index++) {
   const step=prepareNativeStep(plan,plan.steps[index],screen,world,height);
   assert.equal(step.native.blocked,false,'The reported bed/wardrobe layout has a reachable entry at '+ratio);
   plan.steps[index]=step;screen=step.position;height=step.native.path.at(-1)[1];
  }
  const exit=buildRoomReturn(options,plan,2,screen);
  assert.equal(prepareNativeStep(exit,exit.steps[0],screen,world,height).native.blocked,false,'The cat can leave past the bed');
 }
 console.log('Verified hiding and safe exit in the reported furnished bedroom at three viewport heights.');
}
