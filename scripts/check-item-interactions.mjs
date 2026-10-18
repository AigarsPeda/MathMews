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

// Exercise the actual fireplace callback and the shipped flame vertices.
{
 const fireFile=path.resolve('components/pet/native/NativeFireplace.tsx');
 const fireCode=babel.transformSync(ts.transpileModule(fs.readFileSync(fireFile,'utf8'),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,
 }}).outputText,{filename:fireFile,babelrc:false,configFile:false,plugins:[['react-native-worklets/plugin',{processNestedWorklets:true}]]}).code;
 const bytes=fs.readFileSync('assets/3d/native/livingFireplaceCream.glb');
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),binary=bytes.subarray(28+bytes.readUInt32LE(12));
 const {FIREPLACE_FLAMES,fireplaceLightPosition}=load('@/utils/native-fireplace');
 const flameVertices=new Map(FIREPLACE_FLAMES.map(part=>{
  const node=gltf.nodes.find(n=>n.name===part.node),primitive=gltf.meshes[node.mesh].primitives[0];
  const a=gltf.accessors[primitive.attributes.POSITION],v=gltf.bufferViews[a.bufferView];
  assert.ok(a.count>=240,'Curved flame silhouettes retain their smooth geometry');
  assert.equal(gltf.materials[primitive.material].alphaMode,'BLEND','Flame edges support translucent fading');
  const tint=gltf.accessors[primitive.attributes.COLOR_0],colors=gltf.bufferViews[tint.bufferView];
  const [size,read,divisor]={5121:[1,'readUInt8',255],5123:[2,'readUInt16LE',65535],5126:[4,'readFloatLE',1]}[tint.componentType];
  const alpha=Array.from({length:tint.count},(_,i)=>binary[read]((colors.byteOffset??0)+(tint.byteOffset??0)+i*(colors.byteStride??size*4)+3*size)/divisor);
  assert.ok(Math.min(...alpha)<.01&&Math.max(...alpha)>.7&&Math.max(...alpha)<.95,'Flames fade from translucent bodies to invisible tips');
  return [part.node,Array.from({length:a.count},(_,i)=>[0,1,2].map(axis=>binary.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??12)+axis*4)))];
 }));
 const fireAsset={getFirstEntityByName:name=>gltf.nodes.find(n=>n.name===name)};
 const poses=new Map(),emissions=new Map();let intensity=0,position=[],lightConfig,lightCreates=0,fireWrites=0;
 const lightManager={setIntensity(_light,value){assert.ok(Number.isFinite(value)&&value>=0);intensity=value;fireWrites++},
  setPosition(_light,value){position=Array.from(value);fireWrites++},setFalloff(){fireWrites++}};
 mocks['react-native-filament'].useFilamentContext=()=>({lightManager,scene:{},
  transformManager:{createIdentityMatrix:()=>matrix(),setTransform(entity,pose){poses.set(entity.name,pose.ops);fireWrites++}},
  renderableManager:{getPrimitiveCount:()=>1,getMaterialInstanceAt:entity=>({setFloat4Parameter(_key,value){emissions.set(entity.name,Array.from(value));fireWrites++}})},
 });
 mocks['react-native-filament'].useLightEntity=(_manager,config)=>mocks.react.useMemo(()=>{lightConfig=config;lightCreates++;return {id:lightCreates}},[config.falloffRadius]);
 mocks['react-native-filament'].useEntityInScene=()=>{};
 const fireRuntime={exports:{}};vm.runInNewContext(fireCode,{module:fireRuntime,exports:fireRuntime.exports,require:load,Math,Map,Set,global:{Error}});
 function transformed(point,ops) {
  let p=point;
  for(const op of ops) {
   if(op[0]==='translate')p=p.map((v,i)=>v+op[1][i]);
   if(op[0]==='scale')p=p.map((v,i)=>v*op[1][i]);
   if(op[0]==='rotate'){const c=Math.cos(op[1]),s=Math.sin(op[1]);p=[p[0]*c-p[1]*s,p[0]*s+p[1]*c,p[2]]}
  }
  return p;
 }
 for(const fps of [30,60,120])for(const wallFlipped of [false,true]) {
  hooks.length=0;poses.clear();emissions.clear();lightCreates=0;
  const room=buildNativeRoomWorld({width:390,height:420,petSize:80,sizeScale:1,toys:[],decorations:[
   {decorationId:'livingFireplaceCream',instanceId:'fire',offset:{x:0,y:0},scale:wallFlipped?1.7:.7,wallFlipped,rotationDegrees:37},
  ]});
  let fireObject=room.objects[0];const preview={value:undefined};
  function renderFire(extra={}){cursor=0;effects=[];fireRuntime.exports.NativeFireplace({asset:fireAsset,object:fireObject,active:true,reduceMotion:false,editingObject:preview,...extra});effects.forEach(fn=>fn())}
  renderFire();frame({timeSinceLastFrame:1/fps});assert.equal(intensity,0);
  const idle=fireWrites;for(let i=0;i<fps;i++)frame({timeSinceLastFrame:1/fps});assert.equal(fireWrites,idle,'An unlit fireplace has no idle native writes');
  fireObject={...fireObject,poweredOn:true};renderFire();const heights=[],lightLevels=[];
  for(let i=0;i<fps*3;i++) {
   frame({timeSinceLastFrame:1/fps});
   heights.push(poses.get(FIREPLACE_FLAMES[1].node).find(op=>op[0]==='scale')[1][1]);
   if(i>fps)lightLevels.push(intensity);
   if(i%15===0)for(const part of FIREPLACE_FLAMES)for(const vertex of flameVertices.get(part.node)) {
    const p=transformed(vertex,poses.get(part.node));
    assert.ok(Math.abs(p[0])<.49&&p[1]>=.23&&p[1]<.94&&p[2]>-.02&&p[2]<.30,`Animated flame meshes stay inside the firebox: ${part.node}/${i} ${JSON.stringify(p)}`);
   }
  }
  assert.ok(Math.max(...heights)-Math.min(...heights)>.15,'Lit flames visibly rise and fall');
  assert.ok(Math.max(...lightLevels)/Math.min(...lightLevels)>1.05,'The warm room light flickers with the fire');
  assert.equal(lightConfig.type,'point');assert.equal(lightConfig.colorKelvin,1900);assert.equal(lightCreates,1);
  assert.ok([...emissions.values()].every(color=>color[0]>3*color[1]&&color[1]>color[2]&&color[0]>.5&&color[0]<1),
   'Flames keep a soft orange emission without bleaching to white');
  assert.ok(position.every((v,i)=>Math.abs(v-fireplaceLightPosition(fireObject)[i])<1e-8),'The light follows rotated/scaled fireplaces');
  const frozen=fireWrites;renderFire({active:false});for(let i=0;i<fps;i++)frame({timeSinceLastFrame:1/fps});assert.equal(fireWrites,frozen,'Hidden rooms freeze flame and light work');
  renderFire({reduceMotion:true});frame({timeSinceLastFrame:1/fps});
  for(const part of FIREPLACE_FLAMES)assert.deepEqual(poses.get(part.node).find(op=>op[0]==='scale')[1],[1,1,1],'Reduce Motion keeps a steady visible fire');
  const still=fireWrites;for(let i=0;i<fps;i++)frame({timeSinceLastFrame:1/fps});assert.equal(fireWrites,still,'Reduce Motion has no flicker or repeated native writes');
  preview.value={...fireObject,position:[1,.068,1],heading:Math.PI/2};frame({timeSinceLastFrame:1/fps});
  assert.ok(position.every((v,i)=>Math.abs(v-fireplaceLightPosition(preview.value)[i])<1e-8),'Light follows live dragging without handle recreation');assert.equal(lightCreates,1);
  fireObject={...fireObject,poweredOn:false};renderFire();for(let i=0;i<fps*2;i++)frame({timeSinceLastFrame:1/fps});assert.equal(intensity,0,'Extinguishing removes all room light');
  for(const part of FIREPLACE_FLAMES)assert.deepEqual(poses.get(part.node).find(op=>op[0]==='scale')[1],[0,0,0],'Extinguished flames disappear');
  fireObject={...fireObject,poweredOn:true};hooks.length=0;renderFire();frame({timeSinceLastFrame:1/fps});assert.ok(intensity>0,'A saved lit fireplace restores after remount');
 }
 console.log('Verified real fireplace flames, warm flickering light, both orientations/scales, ignition/extinguishing, drag previews, remounts, pauses and Reduce Motion at 30/60/120 FPS.');
}

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
