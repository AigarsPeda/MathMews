/** Exercise saved curtain controls, actual exported panels, and native drawing callbacks. */
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
const placement = load('@/utils/room-placement');
const motion = load('@/utils/native-curtains');
const { CURTAIN_FABRIC_BOUNDS } = load('@/constants/decoration-motion');
const { buildNativeRoomWorld } = load('@/utils/native-room-world');
const curtainIds = ['curtainRoseTieback','curtainBlueDrape','curtainCreamLinen'];
const fabricBounds = new Map();
const mounts=load('@/constants/window-mount-bounds.json');
for (const id of curtainIds) {
  const items = [{ decorationId:id, instanceId:'one', offset:{x:0,y:0} },
    { decorationId:id, instanceId:'two', offset:{x:.2,y:.2} },
    { decorationId:'sofaA', instanceId:'sofa', offset:{x:0,y:0} }];
  const closed = placement.togglePlacedCurtainByInstance(items,'one');
  assert.equal(closed[0].curtainOpen,false);
  assert.equal(items[0].curtainOpen,undefined,'Previous save stays unchanged');
  assert.equal(closed[1],items[1]);
  assert.equal(placement.togglePlacedCurtainByInstance(items,'sofa')[2],items[2]);
  const saved = placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(closed)));
  assert.equal(saved[0].curtainOpen,false,'Closed state survives reload');
  assert.equal(saved[1].curtainOpen,undefined,'Legacy curtains start open');
  assert.equal(placement.togglePlacedCurtainByInstance(saved,'one')[0].curtainOpen,true);
  const buffer=fs.readFileSync(`assets/3d/native/${id}.glb`);
  const gltf=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
  for (const side of ['Left','Right']) {
    const panel=gltf.nodes.find(n=>n.name===`${side} curtain panel`);
    assert.ok(panel?.children.length);
    assert.ok(Math.abs(panel.scale[0]-.28)<1e-7);
    assert.ok(Math.abs(Math.abs(panel.translation[0])-.8)<1e-7);
    const fabric=gltf.materials.find(m=>m.name.startsWith(`${side} curtain fabric`));
    assert.ok(fabric && fabric.name !== 'gold','Fabric has its own lit material');
    const cloth=panel.children.map(index=>gltf.nodes[index]).find(n=>n.name.startsWith('Folded curtain fabric'));
    const bounds=gltf.accessors[gltf.meshes[cloth.mesh].primitives[0].attributes.POSITION];
    assert.ok(Math.abs(bounds.min[2]-CURTAIN_FABRIC_BOUNDS.minZ)<1e-7);
    assert.ok(Math.abs(bounds.max[2]-CURTAIN_FABRIC_BOUNDS.maxZ)<1e-7);
    for (const open of [0,.5,1]) {
      const pose=motion.curtainPanelPose(open,side==='Left'?-1:1);
      assert.ok(pose.x+bounds.min[0]*pose.width>=CURTAIN_FABRIC_BOUNDS.minX-1e-7);
      assert.ok(pose.x+bounds.max[0]*pose.width<=CURTAIN_FABRIC_BOUNDS.maxX+1e-7);
    }
    fabricBounds.set(id,bounds);
  }
  for (const fps of [30,60,120]) {
    let open=1;
    for(let i=0;i<fps;i++) open=motion.advanceCurtain(open,0,1/fps,false);
    assert.equal(open,0);
    const left=motion.curtainPanelPose(open,-1),right=motion.curtainPanelPose(open,1);
    assert.equal(left.x+.45*left.width,right.x-.45*right.width,'Closed panels meet without a gap');
    for(let i=0;i<fps;i++) open=motion.advanceCurtain(open,1,1/fps,false);
    assert.equal(open,1);
  }
}
assert.equal(motion.advanceCurtain(.5,0,0,false),.5);
assert.equal(motion.advanceCurtain(1,0,1/60,true),0);
const options={width:400,height:420,petSize:80,sizeScale:1,toys:[],decorations:[]};
// Transform the exported cloth bounds with the real panel poses, not the rod/tassel bounds.
function fabricBack(object,open,normal) {
  const bounds=fabricBounds.get(object.modelId), points=[];
  for(const side of [-1,1]) {
    const pose=motion.curtainPanelPose(open,side);
    for(const x of [bounds.min[0],bounds.max[0]]) for(const z of [bounds.min[2],bounds.max[2]]) {
      const px=pose.x+x*pose.width;
      const depth=normal===0?px*Math.cos(object.heading)+z*Math.sin(object.heading):
        -px*Math.sin(object.heading)+z*Math.cos(object.heading);
      points.push(object.position[normal]+depth*object.scale);
    }
  }
  return Math.min(...points);
}
function sillClearance(curtain,window) {
  const tilt=motion.curtainPanelTilt(curtain,[window]),mount=mounts[window.modelId];
  const z=fabricBounds.get(curtain.modelId).min[2];
  const height=(window.position[1]+mount.sill.max[1]*window.scale-curtain.position[1])/(.76*curtain.scale);
  const y=motion.CURTAIN_ROD_HEIGHT+(height-motion.CURTAIN_ROD_HEIGHT-z*Math.sin(tilt))/Math.cos(tilt);
  const depth=-(y-motion.CURTAIN_ROD_HEIGHT)*Math.sin(tilt)+z*Math.cos(tilt);
  const normal=curtain.wallAxis===0?0:2;
  return curtain.position[normal]+depth*curtain.scale-window.max[normal];
}
for (const flipped of [false,true]) {
  const window={decorationId:'windowOakWide',instanceId:'window',offset:{x:.4,y:-.3},scale:1.6,wallFlipped:flipped};
  const placed=placement.appendPlacedDecoration([window],'curtainRoseTieback');
  assert.equal(placed[1].wallFlipped,flipped);
  const world=buildNativeRoomWorld({...options,decorations:placed});
  const curtain=motion.curtainAtWindow(world.objects[1],world.objects[0]);
  assert.equal(curtain.collidable,false,'Window curtains intentionally layer over wall fixtures');
  const { createRoomPlacementResolver } = load('@/utils/room-item-placement');
  assert.ok(createRoomPlacementResolver(world).canPlace(curtain),'A purchased pair fits inside the room');
  const fitted=motion.curtainAtWindow(curtain,world.objects[0]);
  assert.ok(createRoomPlacementResolver(world).canPlace(fitted));
  assert.ok(motion.curtainWindowCoverage(world.objects[0],fitted)>.8,'Fitted panels cover the aperture');
  const normal=flipped?0:2;
  const windowFront=world.objects[0].position[normal]+mounts.windowOakWide.frame.max[2]*world.objects[0].scale;
  for(const open of [0,.5,1]) {
    const clearance=fabricBack(curtain,open,flipped?0:2)-windowFront;
    assert.ok(clearance>.014 && clearance<.016,`Curtain mounting closely clears the frame (${clearance})`);
  }
  assert.ok(Math.abs(sillClearance(curtain,world.objects[0])-.015)<1e-6,'Draped fabric clears the deep sill while its rod stays near the frame');
  const coverage=motion.curtainWindowCoverage(world.objects[0],curtain);
  assert.ok(coverage>.6,`New curtains cover their window (${coverage})`);
  assert.equal(motion.curtainWindowCoverage(world.objects[0],{...curtain,heading:curtain.heading+Math.PI/2}),0);
  assert.equal(motion.curtainWindowCoverage(world.objects[0],{...curtain,position:[8,8,8]}),0);
  const curtains=motion.windowCurtains(world.objects[0],[world.objects[0],curtain]);
  assert.equal(motion.curtainLightTransmission(curtains,{[curtain.instanceId]:1}),1);
  const closed=motion.curtainLightTransmission(curtains,{[curtain.instanceId]:0});
  assert.ok(closed<.5 && closed>.1,'Closed fabric dims the room without making it black');
}
for(const id of curtainIds) for(const flipped of [false,true]) for(const scale of [.7,1,1.6]) {
  const window={decorationId:'windowOakWide',instanceId:'window',offset:{x:.1,y:-.3},scale,wallFlipped:flipped};
  const placed=placement.appendPlacedDecoration([window],id);
  const room=buildNativeRoomWorld({...options,decorations:placed});
  const curtain=motion.curtainAtWindow(room.objects[1],room.objects[0]),normal=flipped?0:2;
  for(const open of [0,.5,1]) {
    const frameFront=room.objects[0].position[normal]+mounts.windowOakWide.frame.max[2]*room.objects[0].scale;
    const clearance=fabricBack(curtain,open,normal)-frameFront;
    assert.ok(clearance>.014 && clearance<.016,`${id} at scale ${scale} mounts close to its frame`);
    assert.ok(Math.abs(sillClearance(curtain,room.objects[0])-.015)<1e-6,`${id} drapes over its sill at scale ${scale}`);
  }
  const remote={...window,instanceId:'remote',offset:{x:-.9,y:.8},scale:2.4};
  const withRemote=buildNativeRoomWorld({...options,decorations:[remote,...placed]});
  assert.equal(withRemote.objects[2].position[normal],curtain.position[normal],
    'A deeper, distant window does not push these curtains away from their wall');
  const bare=buildNativeRoomWorld({...options,decorations:[placed[1]]}).objects[0];
  assert.equal(motion.curtainPanelTilt(bare,[]),0,'Bare-wall panels remain vertical');
  assert.ok(bare.min[normal]>-2.35,'Hardware does not clip through a bare wall');
  assert.ok(bare.min[normal]<-2.32,'Hardware sits close to a bare wall');
}
// Boundary placement with a full room and a window near the top-right corner.
for (const width of [300,350,366,400]) {
  const placed=placement.appendPlacedDecoration([{ decorationId:'windowOakWide',instanceId:'corner-window',
    offset:{x:.6863,y:-.44644},scale:1.6 }],'curtainRoseTieback');
  const room=buildNativeRoomWorld({...options,width,sizeScale:1.17,decorations:placed});
  assert.ok(load('@/utils/room-item-placement').createRoomPlacementResolver(room).canPlace(room.objects[1]),
    `Curtains fit at the wall boundary on a ${width}-point room`);
}
const night=motion.curtainEmission([1,1,1],0,1,1,0);
// User placements may extend past the full-model wall/sprite bounds.
const { roomItemAnchor, createRoomPlacementResolver } = load('@/utils/room-item-placement');
const { roomOffsetToPoint } = load('@/utils/room-activities');
for (const id of curtainIds) for (const flipped of [false,true]) for (const width of [320,414,768]) {
  const height=width*1.1;
  const saved={decorationId:id,instanceId:'free-curtain',offset:{x:1.25,y:-1.4},wallFlipped:flipped,rotationDegrees:20,scale:1.4};
  const restored=placement.normalizePlacedDecorations(JSON.parse(JSON.stringify([saved])))[0];
  assert.deepEqual({...restored.offset},{...saved.offset},'Reload retains curtain offsets beyond the old +/-1 limit');
  const room=buildNativeRoomWorld({...options,width,height,decorations:[restored]});
  const object=room.objects[0];
  assert.equal(object.placementOffset,undefined,'Building a saved curtain never relocates its chosen anchor');
  const size=object.scale*width*load('@/utils/native-room-world').NATIVE_MODEL_CATALOG[id].renderScale/load('@/utils/native-room-world').ROOM_SPAN;
  const anchor=roomItemAnchor(object,width),expected=roomOffsetToPoint(saved.offset,width,height,size);
  assert.ok(Math.hypot(anchor.x-expected.x,anchor.y-expected.y)<1e-7,'The visible model preserves the exact saved screen anchor');
  const resolver=createRoomPlacementResolver(room);
  assert.ok(resolver.canPlace(object),'Curtains can extend beyond the wall edges and ceiling');
  const target={x:anchor.x+65,y:anchor.y-85},moved=resolver.move(object.instanceId,target);
  assert.ok(Math.hypot(moved.point.x-target.x,moved.point.y-target.y)<1e-7,'Dragging is not stopped by the full curtain bounds');
  assert.equal(moved.object.heading,object.heading,'Movement keeps the chosen angle');
  assert.equal(moved.object.position[object.wallAxis],object.position[object.wallAxis],'Free curtain movement stays mounted on its chosen wall');
  const offset={x:moved.point.x/Math.max(1,(width-size)/2),y:moved.point.y/Math.max(1,(height-size)/2)};
  const reloaded=placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(placement.updatePlacedDecorationOffsetByInstance([saved],saved.instanceId,offset))));
  const rebuilt=buildNativeRoomWorld({...options,width,height,decorations:reloaded}).objects[0];
  assert.ok(rebuilt.position.every((v,i)=>Math.abs(v-moved.object.position[i])<1e-7),'Moved curtain positions survive saving and reopening');
}
assert.equal(placement.normalizePlacedDecorations([{decorationId:'curtainRoseTieback',offset:{x:Infinity,y:0}}]).length,0,'Invalid numeric positions are rejected');
assert.equal(placement.normalizePlacedDecorations([{decorationId:'sofaA',offset:{x:1.25,y:-1.4}}])[0].offset.x,1,'Furniture keeps its existing saved bounds');
console.log('Verified unrestricted curtain anchors, movement on both walls, retained angles and exact save/reload at three room sizes.');
assert.ok(night[2]>night[0],'Moonlight on fabric is cold');
assert.equal(motion.curtainEmission([1,1,1],0,1,0,0)[2],0,'Curtains away from a window do not glow');
assert.ok(motion.curtainEmission([1,1,1],0,.4,1,0)[2]<night[2],'Cloudy weather dims the cloth');

let renderFrame,sharedIndex=0,writes=0,materialWrites=0,transformWrites=0,fabricEmission;
const shared=[];
function matrix(scale=[1,1,1],translation=[0,0,0],angle=0) {
  return {scale,translation,angle,scaling:next=>matrix(next,translation,angle),
    translate:next=>matrix(scale,next.map((v,i)=>v+translation[i]),angle),
    rotate:next=>matrix(scale,translation,next)};
}
const identity=matrix();
const entities=new Map(['Left','Right'].flatMap(side=>[[`${side} curtain panel`,side],[`${side} curtain tieback`,side+'Tie']]));
const transforms=new Map();
mocks.react={useMemo:fn=>fn(),useEffect:()=>{}};
mocks['@/hooks/use-world-clock-now']={useWorldClockNow:()=>0};
mocks['react-native-worklets-core']={useSharedValue:initial=>shared[sharedIndex++]??={value:initial}};
mocks['react-native-filament']={RenderCallbackContext:{useRenderCallback:fn=>{renderFrame=fn;}},useFilamentContext:()=>({
  transformManager:{createIdentityMatrix:()=>identity,getTransform:()=>identity,setTransform:(entity,value)=>{transformWrites++;transforms.set(entity,value);}},
  nameComponentManager:{getEntityName:()=> 'Folded curtain fabric'},
  renderableManager:{getPrimitiveCount:()=>1,getMaterialInstanceAt:()=>({getFloat4Parameter:()=>[1,1,1,1],setFloat4Parameter:(_name,value)=>{materialWrites++;fabricEmission=value;}})},
})};
const { NativeCurtain }=load('@/components/pet/native/NativeCurtain');
const world=buildNativeRoomWorld({...options,decorations:placement.appendPlacedDecoration([
  {decorationId:'windowOakWide',instanceId:'window',offset:{x:.4,y:-.3},scale:1.6},
],'curtainRoseTieback')});
let current={};
const progress={get value(){return current;},set value(value){writes++;current=value;}};
const props={asset:{getFirstEntityByName:name=>entities.get(name),getRenderableEntities:()=>['fabric']},
  object:world.objects[1],windows:[world.objects[0]],progress,active:true,reduceMotion:false};
function render(extra={}) {sharedIndex=0;NativeCurtain({...props,...extra});}
render();renderFrame({timeSinceLastFrame:1/60});
assert.equal(transforms.get('Left').angle,-motion.curtainPanelTilt(props.object,props.windows),'The real native callback applies the sill-clearance slope');
assert.equal(transforms.get('Left').translation[1],0,'Panel tilting pivots around the hanging rod');
const stable=[writes,materialWrites,transformWrites];
for(let i=0;i<120;i++)renderFrame({timeSinceLastFrame:1/60});
assert.deepEqual([writes,materialWrites,transformWrites],stable,'Idle curtains do no repeated native work');
render({object:{...props.object,curtainOpen:false}});
renderFrame({timeSinceLastFrame:1/60});
assert.ok(current[props.object.instanceId]>0 && current[props.object.instanceId]<1);
render({object:{...props.object,curtainOpen:false},active:false});
const paused=current[props.object.instanceId];
for(let i=0;i<120;i++)renderFrame({timeSinceLastFrame:1/60});
assert.equal(current[props.object.instanceId],paused);
render({object:{...props.object,curtainOpen:false}});
for(let i=0;i<120;i++)renderFrame({timeSinceLastFrame:1/60});
assert.equal(current[props.object.instanceId],0);
assert.equal(transforms.get('Left').translation[0],-.45);
render({reduceMotion:true});renderFrame({timeSinceLastFrame:1/60});
assert.equal(current[props.object.instanceId],1,'Reduced Motion opens instantly');
const normalFabric=fabricEmission, idleTransforms=transformWrites, flash={value:0};
render({lightning:flash}); renderFrame({timeSinceLastFrame:1/60});
flash.value=1; renderFrame({timeSinceLastFrame:1/60});
assert.ok(fabricEmission[2]>normalFabric[2],'Window-backed fabric catches lightning');
assert.equal(transformWrites,idleTransforms,'A flash changes the cloth material without moving the curtain');
flash.value=0; renderFrame({timeSinceLastFrame:1/60});
assert.deepEqual(fabricEmission,normalFabric,'Cloth returns to its normal tint after the strike');
console.log('Verified curtain store placements, independent saved switches, exported panels, 30/60/120 FPS movement, window overlap, moonlight, room dimming, pause, Reduced Motion and idle native work.');

let windowPower=0;
shared.length=0; sharedIndex=0;
mocks['react-native-filament']={...mocks['react-native-filament'],useLightEntity:()=>({}),useEntityInScene:()=>{},
 useFilamentContext:()=>({scene:{},lightManager:{setPosition(){},setDirection(){},setColor(){},setIntensity(_entity,intensity){windowPower=intensity;}}})};
const { NativeWindowLight }=load('@/components/pet/native/NativeWindowLight');
const curtain=motion.curtainAtWindow(world.objects[1],world.objects[0]);
const curtains=motion.windowCurtains(world.objects[0],[curtain]);
progress.value={[curtain.instanceId]:1};
NativeWindowLight({object:world.objects[0],daylight:{value:{daylight:0,transmission:1}},active:true,curtains,curtainProgress:progress});
renderFrame({timeSinceLastFrame:1/60});
const openPower=windowPower;
progress.value={[curtain.instanceId]:0};renderFrame({timeSinceLastFrame:1/60});
assert.ok(windowPower>0 && windowPower<openPower*.3,'Real native window light follows the panel progress');
progress.value={[curtain.instanceId]:1};renderFrame({timeSinceLastFrame:1/60});
assert.equal(windowPower,openPower,'Reopening restores the same window light');
sharedIndex=0;
NativeWindowLight({object:world.objects[0],daylight:{value:{daylight:0,transmission:.55}},lightning:flash,active:true,curtains,curtainProgress:progress});
flash.value=1;renderFrame({timeSinceLastFrame:1/60});
const openFlash=windowPower;
progress.value={[curtain.instanceId]:0};renderFrame({timeSinceLastFrame:1/60});
assert.ok(windowPower>0 && windowPower<openFlash*.3,'Closed curtains attenuate the actual lightning light too');
console.log('Verified native lightning on curtain fabric and attenuation through closed panels.');
