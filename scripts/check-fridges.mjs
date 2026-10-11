/** Exercise fridge state, shipped interiors, reversible hinges and retained native lights. */
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
const motion=load('@/utils/native-fridge');
const {buildNativeRoomWorld}=load('@/utils/native-room-world');
const ids=['kitchenFridge',...['White','Sage','Navy','Charcoal'].map(f=>'kitchenModernFridge'+f)];
for(const id of ids) {
  const items=[{decorationId:id,instanceId:'one',offset:{x:0,y:0}},
    {decorationId:id,instanceId:'two',offset:{x:.3,y:.3}},
    {decorationId:'sofaA',instanceId:'sofa',offset:{x:0,y:0},fridgeOpen:true,fridgeHingeSide:'right'}];
  const opened=placement.togglePlacedFridgeByInstance(items,'one');
  assert.equal(opened[0].fridgeOpen,true);assert.equal(items[0].fridgeOpen,undefined);
  assert.equal(opened[1],items[1]);
  const flipped=placement.flipPlacedFridgeHingeByInstance(opened,'one');
  assert.equal(flipped[0].fridgeHingeSide,id==='kitchenFridge'?'left':'right');
  const restored=placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(flipped)));
  assert.equal(restored[0].fridgeOpen,true);assert.equal(restored[0].fridgeHingeSide,flipped[0].fridgeHingeSide);
  assert.equal(restored[1].fridgeOpen,undefined);assert.equal(restored[2].fridgeOpen,undefined);assert.equal(restored[2].fridgeHingeSide,undefined);
  assert.equal(placement.togglePlacedFridgeByInstance(restored,'one')[0].fridgeOpen,undefined);
  const world=buildNativeRoomWorld({width:390,height:420,petSize:80,sizeScale:1.15,toys:[],decorations:restored});
  assert.equal(world.objects[0].fridgeOpen,true);assert.equal(world.objects[0].fridgeHingeSide,flipped[0].fridgeHingeSide);
  const cracked=placement.togglePlacedFridgeByInstance(restored,'one','ajar');
  assert.equal(cracked[0].fridgeOpen,'ajar');assert.equal(cracked[1],restored[1]);
  const savedCrack=placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(cracked)));
  assert.equal(savedCrack[0].fridgeOpen,'ajar');assert.equal(savedCrack[0].fridgeHingeSide,flipped[0].fridgeHingeSide);
  assert.equal(buildNativeRoomWorld({width:390,height:420,petSize:80,sizeScale:1.15,toys:[],decorations:savedCrack}).objects[0].fridgeOpen,'ajar');
  assert.equal(placement.togglePlacedFridgeByInstance(savedCrack,'one','full')[0].fridgeOpen,true);
  assert.equal(placement.togglePlacedFridgeByInstance(savedCrack,'one')[0].fridgeOpen,undefined);
  assert.equal(placement.normalizePlacedDecorations([{...items[2],fridgeOpen:'ajar'}])[0].fridgeOpen,undefined);
  const bytes=fs.readFileSync(`assets/3d/native/${id}.glb`),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  const hinge=gltf.nodes.find(n=>n.name==='Fridge door hinge');
  assert.ok(hinge?.children.length>=3,id+' has a real hinged door');
  assert.ok(hinge.children.some(i=>gltf.nodes[i].name==='Fridge door handle'));
  const pull=gltf.nodes.find(n=>n.name==='Fridge door handle');
  const retro=id==='kitchenFridge';
  for(const [actual,expected] of [[hinge.translation,retro?[.51,0,.46]:[-.585,0,.55]],
    [pull.translation,retro?[-.85,1.16,.08]:[1.085,1.54,.024]]])
    actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-6,'Runtime closed pose matches the shipped model'));
  assert.ok(!hinge.children.some(i=>gltf.nodes[i].name.includes('housing')),'The housing stays fixed');
  assert.ok(gltf.nodes.some(n=>n.name==='Fridge interior LED'));
  assert.ok(gltf.nodes.filter(n=>n.name.startsWith('Fridge food')).length>=2);
  assert.ok(gltf.nodes.filter(n=>n.name.startsWith('Fridge juice bottle')).length>=3);
  assert.ok(gltf.nodes.filter(n=>n.name.startsWith('Fridge interior shelf')).length>=3);
  for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const scale of [.25,.6,1]) {
    const object={modelId:id,position:[1,.068,-1],heading,scale};
    const top=motion.fridgeLightPose(object,.8),bottom=motion.fridgeLightPose(object,.2);
    assert.ok(top.position[1]>bottom.position[1]);
    assert.ok(top.direction[1]<0,'Opening directs cold light to the floor');
    assert.ok(Math.abs(Math.hypot(...top.direction)-1)<1e-8);
    const floorDistance=(bottom.position[1]-.068)/-bottom.direction[1];
    assert.ok(floorDistance<3,'Floor illumination stays within the native light falloff');
    assert.equal(motion.fridgeLightIntensity(0,scale),0);
    assert.ok(motion.fridgeLightIntensity(.2,scale)<motion.fridgeLightIntensity(1,scale));
  }
}
for(const fps of [30,60,120]) {
  let open=0;
  for(let i=0;i<fps;i++) {const next=motion.advanceFridge(open,1,1/fps,false);assert.ok(next>=open&&next<=1);open=next;}
  assert.equal(open,1);
  for(let i=0;i<fps;i++) {const next=motion.advanceFridge(open,20/85,1/fps,false);assert.ok(next<=open&&next>=20/85);open=next;}
  assert.equal(open,20/85);
  for(let i=0;i<fps;i++)open=motion.advanceFridge(open,0,1/fps,false);
  assert.equal(open,0);
}
assert.equal(motion.advanceFridge(.5,0,0,false),.5);
assert.equal(motion.advanceFridge(0,1,1/60,true),1);
assert.equal(motion.advanceFridge(1,20/85,1/60,true),20/85);
assert.ok(motion.fridgeLightIntensity(20/85,.4)>0);
assert.ok(motion.fridgeLightIntensity(20/85,.4)<motion.fridgeLightIntensity(1,.4));
console.log('Verified all five fridge saves, independent state, hinge choice, shipped food/shelves/handles, floor-reaching cool light and smooth motion at 30/60/120 FPS.');

// Execute the compiled render worklet with persistent React/shared-value hooks.
const {default:babel}=await import('@babel/core');
const filename=path.resolve('components/pet/native/NativeFridge.tsx');
const compiled=babel.transformSync(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,
}}).outputText,{filename,babelrc:false,configFile:false,plugins:[['react-native-worklets/plugin',{processNestedWorklets:true}]]}).code;
const hooks=[],writes=[],intensities=[],positions=[],colors=[],emissions=[];
let cursor=0,frame,lightCount=0,effects=[];
const same=(a,b)=>a&&a.length===b.length&&b.every((v,i)=>v===a[i]);
function hook(){return cursor++;}
const matrix=(translation=[0,0,0],ops=[],rotation=0)=>({translation,ops,rotation,
  translate(delta){return matrix(translation.map((v,i)=>v+delta[i]),[...ops,['translate',Array.from(delta)]],rotation);},
  rotate(angle,axis){const c=Math.cos(angle),s=Math.sin(angle);return matrix(
    [c*translation[0]+s*translation[2],translation[1],-s*translation[0]+c*translation[2]],
    [...ops,['rotate',angle,Array.from(axis)]],rotation+angle);},
});
const door={id:1},handle={id:2},liner={id:3},food={id:4};
const asset={getFirstEntityByName:name=>name==='Fridge door hinge'?door:name==='Fridge door handle'?handle:undefined,
  getRenderableEntities:()=>[liner,food]};
const material=()=>({getFloat4Parameter:()=>[.8,.9,1,1],setFloat4Parameter:(key,value)=>emissions.push(Array.from(value))});
const materials=new Map([[3,material()],[4,material()]]);
const context={scene:{},transformManager:{getTransform:()=>{throw new Error('Animated transforms cannot define the closed pose');},
  createIdentityMatrix:()=>matrix(),
  setTransform:(entity,value)=>writes.push({entity:entity.id,...value})},
  nameComponentManager:{getEntityName:e=>e===liner?'Fridge interior back':'Fridge food carton'},
  renderableManager:{getPrimitiveCount:()=>1,getMaterialInstanceAt:e=>materials.get(e.id)},
  lightManager:{setPosition:(e,v)=>positions.push({entity:e.id,value:Array.from(v)}),setDirection(){},
    setColor:(e,v)=>colors.push(Array.from(v)),setIntensity:(e,v)=>intensities.push({entity:e.id,value:v})}};
mocks.react={useMemo:(fn,deps)=>{const i=hook();if(!same(hooks[i]?.deps,deps))hooks[i]={deps,value:fn()};return hooks[i].value;},
  useEffect:(fn,deps)=>{const i=hook();if(!same(hooks[i]?.deps,deps)){hooks[i]={deps};effects.push(fn);}}};
mocks['react-native-worklets-core']={useSharedValue:value=>{const i=hook();return hooks[i]??={value};}};
mocks['react-native-filament']={useFilamentContext:()=>context,useEntityInScene(){},
  useLightEntity:()=>{const i=hook();return hooks[i]??={id:++lightCount};},
  RenderCallbackContext:{useRenderCallback:fn=>{frame=fn;}}};
const module={exports:{}};
vm.runInNewContext(compiled,{module,exports:module.exports,require:load,Math,Date,Map,Set,global:{Error}});
const editingObject={value:undefined};
let object={modelId:'kitchenModernFridgeNavy',instanceId:'fridge',position:[0,.068,0],scale:.4,heading:0,fridgeOpen:false};
function render(extra={}){cursor=0;effects=[];module.exports.NativeFridge({asset,object,editingObject,active:true,reduceMotion:false,...extra});for(const effect of effects)effect();}
render();frame({timeSinceLastFrame:1/60});
assert.equal(lightCount,2);
assert.ok(intensities.every(write=>write.value===0),'The closed fridge emits no light');
const settled=writes.length,settledLights=intensities.length;
for(let i=0;i<120;i++)frame({timeSinceLastFrame:1/60});
assert.equal(writes.length,settled);assert.equal(intensities.length,settledLights,'Idle fridges make no native light writes');
object={...object,fridgeOpen:true};render();
for(let i=0;i<120;i++)frame({timeSinceLastFrame:1/60});
assert.equal(lightCount,2,'Opening retains the two native light handles');
assert.ok(intensities.at(-1).value>0);assert.ok(emissions.at(-1).some(v=>v>0));
assert.ok(writes.filter(w=>w.entity===door.id).at(-1).ops.some(op=>op[0]==='rotate'&&op[1]<0),'Left hinges swing toward the room');
assert.equal(writes.filter(w=>w.entity===door.id).at(-1).rotation,-85*Math.PI/180,'Opening stops before a right angle');
object={...object,fridgeHingeSide:'right'};render();frame({timeSinceLastFrame:1/60});
assert.ok(writes.filter(w=>w.entity===door.id).at(-1).ops.some(op=>op[0]==='rotate'&&op[1]>0));
assert.deepEqual(writes.filter(w=>w.entity===handle.id).at(-1).ops.at(-1),['translate',[-1,0,0]],'The pull follows the hinge side');
editingObject.value={...object,position:[1,.068,-1],heading:Math.PI/2,scale:.5};frame({timeSinceLastFrame:1/60});
assert.deepEqual(positions.at(-1).value,Array.from(motion.fridgeLightPose(editingObject.value,.2).position));
assert.ok(colors.every(c=>c[2]>c[0]),'Both retained sources have a cool blue-white color');
editingObject.value=undefined;
const beforePause=writes.length,lightPause=intensities.length;render({active:false});
for(let i=0;i<60;i++)frame({timeSinceLastFrame:1/60});
assert.equal(writes.length,beforePause);assert.equal(intensities.length,lightPause);
object={...object,fridgeOpen:false};render({reduceMotion:true});frame({timeSinceLastFrame:1/60});
assert.equal(intensities.at(-1).value,0,'Closing removes the floor light immediately with Reduce Motion');
assert.equal(lightCount,2);
// A retained model can remount while open. Each side must still close flush,
// without accumulating a prior door angle or moving the handle repeatedly.
for(const modelId of ids)for(const fridgeHingeSide of ['left','right']) {
  hooks.length=0;object={...object,modelId,fridgeHingeSide,fridgeOpen:true};
  render();frame({timeSinceLastFrame:1/60});
  const openedDoor=writes.filter(w=>w.entity===door.id).at(-1);
  assert.equal(openedDoor.rotation,(fridgeHingeSide==='right'?1:-1)*85*Math.PI/180);
  // Simulate remounting with the same, already-open asset.
  hooks.length=0;render();frame({timeSinceLastFrame:1/60});
  assert.equal(writes.filter(w=>w.entity===door.id).at(-1).rotation,openedDoor.rotation);
  const fullIntensity=intensities.at(-1).value;
  object={...object,fridgeOpen:'ajar'};render();
  for(let i=0;i<120;i++)frame({timeSinceLastFrame:1/60});
  const crackedDoor=writes.filter(w=>w.entity===door.id).at(-1);
  assert.ok(Math.abs(crackedDoor.rotation-(fridgeHingeSide==='right'?1:-1)*20*Math.PI/180)<1e-12,'The crack is exactly 20 degrees on either hinge');
  assert.ok(intensities.at(-1).value>0&&intensities.at(-1).value<fullIntensity,'The cracked door spills less cool light');
  const crackWrites=writes.length,crackLights=intensities.length;
  for(let i=0;i<120;i++)frame({timeSinceLastFrame:1/60});
  assert.equal(writes.length,crackWrites);assert.equal(intensities.length,crackLights);
  hooks.length=0;render();frame({timeSinceLastFrame:1/60});
  assert.equal(writes.filter(w=>w.entity===door.id).at(-1).rotation,crackedDoor.rotation,'The crack survives a remount without accumulating rotation');
  object={...object,fridgeOpen:true};render();
  for(let i=0;i<120;i++)frame({timeSinceLastFrame:1/60});
  assert.equal(writes.filter(w=>w.entity===door.id).at(-1).rotation,openedDoor.rotation,'The cracked door can open fully');
  object={...object,fridgeOpen:false};render();
  for(let i=0;i<120;i++)frame({timeSinceLastFrame:1/60});
  const closedDoor=writes.filter(w=>w.entity===door.id).at(-1);
  assert.equal(closedDoor.rotation,0);
  assert.deepEqual(closedDoor.translation,modelId==='kitchenFridge'?[.51,0,.46]:[-.585,0,.55]);
}
console.log('Verified compiled native fridge callbacks, exact 20-degree cracks and full opening on both hinges, flush closing after remount, retained cool floor lights, pose tracking, paused rooms and zero idle writes.');
