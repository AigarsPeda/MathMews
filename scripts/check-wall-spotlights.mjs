import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import babel from '@babel/core';
import { readModel } from './3d/build-placement-bounds.mjs';

const cache = new Map(), mocks = {};
function load(id) {
  if (id in mocks) return mocks[id];
  const file = path.resolve(id.startsWith('@/') ? id.slice(2) : id);
  if (/\.(png|glb)$/.test(file)) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  else vm.runInNewContext(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, require: load, React: mocks.react });
  return module.exports;
}
const { WALL_SPOTLIGHT_DECORATION_IDS: ids } = load('@/constants/home-details-decorations');
const placement = load('@/utils/room-placement');
const store = load('@/utils/decoration-store');
const { buildNativeRoomWorld, nativeWallPlacementBounds } = load('@/utils/native-room-world');
const { lampLightConfig } = load('@/utils/native-lamp-light');
const { canFlipWallDecoration } = load('@/constants/decoration-variants');
const { roomItemAtPoint, roomItemAnchor, createRoomPlacementResolver } = load('@/utils/room-item-placement');
const { WALL_PLACEMENT_MIN, WALL_PLACEMENT_MAX } = load('@/constants/room-geometry');
const data = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const english = data('locales/en.json'), latvian = data('locales/lv.json');
assert.equal(ids.length, 6);
for (const id of ids) {
  assert.ok(store.LAMP_DECORATION_STORE_IDS.includes(id));
  assert.ok(canFlipWallDecoration(id));
  const price = store.getDecorationStorePrice(id);
  assert.equal(price.kind, 'coins');
  assert.ok(price.amount > 0);
  const purchase = store.tryPurchaseDecoration({ decorationId: id, walletCoins: 100, decorationsUnlocked: [] });
  assert.equal(purchase.result, 'purchased');
  assert.equal(purchase.walletCoins, 100 - price.amount);
  assert.ok(english.store.decorationName[id] && latvian.store.decorationName[id]);
  assert.ok(fs.existsSync(`assets/3d/decoration/${id}.png`));
  const bytes = fs.readFileSync(`assets/3d/native/${id}.glb`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const head = gltf.nodes.find(node => node.name === 'Spotlight head');
  assert.ok(head && head.children.length === 2, 'Head and lens share the movable pivot');
  assert.ok(head.children.some(index => gltf.nodes[index].name === 'Spotlight lens'));
  assert.ok(!head.children.some(index => gltf.nodes[index].name === 'Wall backplate'));
  // Audit the shipped geometry, not just the transform: a pivot can stay
  // stationary while its visible side hinges detach during sideways aiming.
  const joint = gltf.nodes.find(node => node.name === 'Spotlight ball joint');
  assert.ok(joint, `${id}: a fixed ball joint connects the head to its stem`);
  assert.ok(joint.translation.every((v, i) => Math.abs(v - head.translation[i]) < 1e-6));
  assert.ok(!gltf.nodes.some(node => node.name.startsWith('Swivel joint')), 'No detached side hinges remain');
  const meshes = readModel(id);
  const geometryBounds = name => {
    const points = meshes.find(mesh => mesh.name === name).points;
    return { min: [0,1,2].map(k => Math.min(...points.map(p => p[k]))),
      max: [0,1,2].map(k => Math.max(...points.map(p => p[k]))) };
  };
  const stem = geometryBounds('Spotlight support arm'), plate = geometryBounds('Wall backplate');
  const ball = geometryBounds('Spotlight ball joint');
  for (const connected of [plate, ball]) for (const axis of [0,1,2]) {
    assert.ok(stem.max[axis] >= connected.min[axis] && stem.min[axis] <= connected.max[axis],
      `${id}: the visible stem reaches both the wall plate and the joint`);
  }
  const binary = bytes.subarray(28 + bytes.readUInt32LE(12));
  const accessorValues = index => {
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
    const width = accessor.type === 'VEC3' ? 3 : 1;
    const [size, read] = { 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'],
      5123: [2, 'readUInt16LE'], 5121: [1, 'readUInt8'] }[accessor.componentType];
    return Array.from({ length: accessor.count }, (_, row) => Array.from({ length: width }, (_, axis) =>
      binary[read]((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + row * (view.byteStride ?? width * size) + axis * size)));
  };
  const housing = gltf.nodes[head.children.find(index => gltf.nodes[index].name !== 'Spotlight lens')];
  assert.equal(housing.rotation, undefined);
  const radius = Math.max(...joint.scale);
  for (const primitive of gltf.meshes[housing.mesh].primitives) {
    const points = accessorValues(primitive.attributes.POSITION).map(p =>
      p.map((v, i) => v * (housing.scale?.[i] ?? 1) + (housing.translation?.[i] ?? 0)));
    const indices = accessorValues(primitive.indices).flat();
    for (let i = 0; i < indices.length; i += 3) {
      const a = points[indices[i]], b = points[indices[i + 1]], c = points[indices[i + 2]];
      const u = b.map((v, k) => v - a[k]), v = c.map((value, k) => value - a[k]);
      const normal = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      const length = Math.hypot(...normal);
      if (length < 1e-12) continue;
      const clearance = Math.abs(a.reduce((sum, value, k) => sum + value * normal[k], 0)) / length;
      assert.ok(clearance >= radius - 1e-6,
        `${id}: the spherical joint stays inside the convex housing through every tilt and swivel`);
    }
  }
  for (const width of [320, 414, 768]) for (const wallFlipped of [false, true]) {
    const placed = { decorationId: id, instanceId: 'spot', offset: { x: wallFlipped ? -.2 : .2, y: -.7 }, wallFlipped, poweredOn: true };
    const world = buildNativeRoomWorld({ width, height: width * 1.1, petSize: width / 3, sizeScale: width / 390, decorations: [placed], toys: [] });
    const object = world.objects[0], normal = wallFlipped ? 0 : 2;
    assert.equal(object.wallAxis, normal);
    assert.equal(object.solid, false);
    assert.ok(Math.abs(object.min[normal] + 2.35) < .002, `The backplate mounts flush to the wall: ${id} ${width} ${normal} ${object.min[normal]}`);
    const floor = lampLightConfig(object);
    assert.ok(floor.direction[normal] > 0 && floor.direction[1] < 0, 'Area preset aims inward and downward');
    const picture = lampLightConfig({ ...object, spotlightAngle: 55 });
    assert.ok(picture.direction[normal] < 0 && picture.direction[1] < 0, 'Painting preset aims back toward the wall');
    const t = (-2.35 - picture.position[normal]) / picture.direction[normal];
    assert.ok(t > 0 && picture.position[1] + picture.direction[1] * t > .2, 'Beam reaches the wall above the floor');
    assert.equal(lampLightConfig({ ...object, poweredOn: false }), undefined);
    const anchor = roomItemAnchor(object, width);
    const moved = roomItemAtPoint(object, { x: anchor.x + 20, y: anchor.y + 10 }, width);
    assert.equal(moved.position[normal], object.position[normal], 'Dragging stays on the mounting plane');
    // The old 2.32 limit rejected a mount still inside the visible wall.
    const along = normal===0 ? 2 : 0;
    const nearEdge = { ...object, position: [...object.position], min: [...object.min], max: [...object.max] };
    const shift = 2.42-object.max[along];
    for (const point of [nearEdge.position,nearEdge.min,nearEdge.max]) point[along]+=shift;
    const resolver=createRoomPlacementResolver(world);
    const drop=resolver.drop('spot',roomItemAnchor(nearEdge,width));
    assert.equal(drop.accepted,true,'A spotlight fits between the old limit and the actual wall edge');
    const farther=roomItemAtPoint(nearEdge,{x:roomItemAnchor(nearEdge,width).x+(normal===0?-1:1)*width/7.45*Math.SQRT1_2*.4,
      y:roomItemAnchor(nearEdge,width).y},width);
    const rejected=resolver.drop('spot',roomItemAnchor(farther,width));
    assert.equal(rejected.accepted,false,'The fixture still cannot extend beyond the wall');
    assert.ok(rejected.feedback.boundaries.includes('wallEnd'),'Feedback identifies the wall edge instead of a floor edge');
    const size=object.scale*width*load('@/utils/native-room-world').NATIVE_MODEL_CATALOG[id].renderScale/7.45;
    const reloaded=buildNativeRoomWorld({width,height:world.height,petSize:width/3,sizeScale:width/390,
      decorations:[{...placed,offset:{x:drop.point.x/((width-size)/2),y:drop.point.y/((world.height-size)/2)}}],toys:[]}).objects[0];
    assert.ok(reloaded.position.every((v,i)=>Math.abs(v-drop.object.position[i])<1e-8),'Saved edge placement is not clamped back inward');
    assert.ok(nativeWallPlacementBounds(reloaded).max[along]<=WALL_PLACEMENT_MAX+1e-5);
    const overhang={...nearEdge,position:[...nearEdge.position],min:[...nearEdge.min],max:[...nearEdge.max]};
    const atMountEdge=WALL_PLACEMENT_MAX-nativeWallPlacementBounds(overhang).max[along]-.005;
    for(const point of [overhang.position,overhang.min,overhang.max])point[along]+=atMountEdge;
    if (!id.includes('Cylinder')) {
      assert.ok(overhang.max[along]>WALL_PLACEMENT_MAX,'The wider lamp head may extend past the wall edge');
    }
    const overhangingDrop=resolver.drop('spot',roomItemAnchor(overhang,width));
    assert.equal(overhangingDrop.accepted,true,'Only the backplate must fit on the mounting wall');
  }
  const saved = placement.normalizePlacedDecorations([{ decorationId: id, instanceId: 'one', offset: { x: .2, y: -.7 }, poweredOn: true, spotlightAngle: 55 }]);
  assert.equal(saved[0].spotlightAngle, 55);
  const adjusted = placement.aimPlacedSpotlightByInstance([...saved, { ...saved[0], instanceId: 'two' }], 'one', -40);
  assert.equal(adjusted[0].spotlightAngle, -40);
  assert.equal(adjusted[1].spotlightAngle, 55, 'Angle is saved independently per spotlight');
  assert.equal(placement.normalizePlacedDecorations([{ ...saved[0], spotlightAngle: Infinity }])[0].spotlightAngle, -25);
  assert.equal(placement.normalizePlacedDecorations([{ ...saved[0], spotlightAngle: 999 }])[0].spotlightAngle, 75);
  assert.equal(placement.normalizePlacedDecorations([{ ...saved[0], spotlightAngle: -999 }])[0].spotlightAngle, -180);
  const flipped = placement.updatePlacedDecorationWallFlipByInstance(saved, 'one', true);
  assert.equal(flipped[0].offset.x, -.2);
  assert.equal(flipped[0].spotlightAngle, 55);
  assert.equal(flipped[0].offset.y, saved[0].offset.y);
  assert.equal(placement.updatePlacedDecorationWallFlipByInstance(flipped, 'one', false)[0].offset.x, .2);
  const repaired = buildNativeRoomWorld({ width: 390, height: 430, petSize: 90, sizeScale: 1,
    decorations: [{ ...saved[0], wallFlipped: true }], toys: [] }).objects[0];
  assert.ok(repaired.min[2] >= WALL_PLACEMENT_MIN-1e-5, 'A legacy flip beyond the corner is brought back onto the visible wall');
  assert.ok(repaired.placementOffset, 'The corrected anchor can be persisted by the editor');
}

// Turn the head toward a toy to either side on either mounting wall.
for (const id of ids) for (const wallFlipped of [false,true]) {
  const placed={decorationId:id,instanceId:'aimed',offset:{x:wallFlipped?-.3:.3,y:-.5},poweredOn:true,spotlightAngle:-41,spotlightSwivel:-30};
  const world=buildNativeRoomWorld({width:390,height:430,petSize:90,sizeScale:1,decorations:[placed],toys:[]});
  const mount=world.objects[0], heading=mount.heading, c=Math.cos(heading), sn=Math.sin(heading);
  const pivot=[mount.position[0]+(c*0+sn*.4)*mount.scale,mount.position[1]+.3*mount.scale,mount.position[2]+c*.4*mount.scale];
  // A toy below and sideways from the lamp; the requested beam must hit it.
  const height=.65, tilt=-41*Math.PI/180, turn=-30*Math.PI/180;
  const reach=(pivot[1]-height)/Math.cos(tilt);
  const localX=-Math.sin(tilt)*Math.sin(turn)*reach,localZ=-Math.sin(tilt)*Math.cos(turn)*reach;
  const toy=[pivot[0]+c*localX+sn*localZ,height,pivot[2]-sn*localX+c*localZ];
  const light=lampLightConfig(mount),distance=(height-light.position[1])/light.direction[1];
  for(const i of [0,2]) assert.ok(Math.abs(light.position[i]+light.direction[i]*distance-toy[i])<1e-8,'The sideways beam reaches the toy on either wall');
  const changed=placement.aimPlacedSpotlightByInstance([placed,{...placed,instanceId:'other'}],'aimed',-41,30);
  assert.equal(changed[0].spotlightSwivel,30);assert.equal(changed[1].spotlightSwivel,-30,'Each head keeps its own swivel');
  const restored=placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(changed)));
  const restoredMount=buildNativeRoomWorld({width:390,height:430,petSize:90,sizeScale:1,decorations:restored,toys:[]}).objects[0];
  assert.equal(restoredMount.spotlightSwivel,30,'Swivel survives save and native reload');
  assert.deepEqual(Array.from(restoredMount.position),Array.from(mount.position),'Aiming never moves the fixture');
  assert.equal(restoredMount.heading,mount.heading,'Aiming never rotates the wall mounting');
  assert.equal(placement.aimPlacedSpotlightByInstance(restored,'aimed',55)[0].spotlightSwivel,30,'Legacy tilt-only callers retain the swivel');
  for(const [input,expected] of [[undefined,0],[Infinity,0],[999,85],[-999,-85]]) {
    assert.equal(placement.normalizePlacedDecorations([{...placed,spotlightSwivel:input}])[0].spotlightSwivel,expected);
  }
}
console.log('Verified sideways toy targets on both walls, stationary mounts, independent swivels, clamping and reload.');

// Exercise the actual native head component, including multiple previews.
const writes = [];
const makeMatrix = (ops = []) => ({ translation: [0, .3, .4],
  translate: value => makeMatrix([...ops, ['translate', [...value]]]),
  rotate: (angle, axis) => makeMatrix([...ops, ['rotate', angle, [...axis]]]), ops });
const entity = { id: 1 }, backplate = { id: 2 }, matrix = makeMatrix();
mocks.react = { useMemo: fn => fn(), useEffect: fn => fn() };
let headFrame;
mocks['react-native-worklets-core'] = { useSharedValue: value => ({value}) };
mocks['react-native-filament'] = {
  useFilamentContext: () => ({ nameComponentManager: { getEntityName: entity => entity.id === 1 ? 'Spotlight head' : 'Wall backplate' },
    transformManager: { getTransform: () => matrix, setTransform: (entity, matrix) => writes.push([entity, matrix.ops]) } }),
  useWorkletEffect: fn => fn(),
  RenderCallbackContext: { useRenderCallback: fn => { headFrame = fn; fn(); } },
};
const { NativeSpotlightHead } = load('@/components/pet/native/NativeSpotlightHead');
for (const angle of [-25, 55, -180, 75]) NativeSpotlightHead({ instanceId: 'spot', asset: { getEntities: () => [entity, backplate] }, angle });
assert.equal(writes.length, 4);
for (const [index, [target, ops]] of writes.entries()) {
  assert.equal(target, entity, 'Aiming never transforms the backplate');
  assert.deepEqual(ops[0], ['translate', [-0, -.3, -.4]]);
  assert.equal(ops[1][1], [-25, 55, -180, 75][index] * Math.PI / 180);
  assert.deepEqual(ops[2], ['rotate', 0, [0, 1, 0]]);
  assert.deepEqual(ops[3], ['translate', [0, .3, .4]]);
}
for(const swivel of [-85,-30,30,85]) {
  NativeSpotlightHead({ instanceId: 'spot', asset:{ getEntities:()=>[entity,backplate] }, angle:-41, swivel });
  const [target,ops]=writes.at(-1);
  assert.equal(target,entity,'Only the head subtree is written');
  assert.equal(ops[2][1],swivel*Math.PI/180);
  // Apply the real component's operations using Filament's pre-multiply order.
  let center=[0,.3,.4], lens=[0,.14,.4];
  const apply=(point,op)=>{
    if(op[0]==='translate') return point.map((v,i)=>v+op[1][i]);
    const [x,y,z]=point,cos=Math.cos(op[1]),sin=Math.sin(op[1]);
    return op[2][0]===1 ? [x,cos*y-sin*z,sin*y+cos*z] : [cos*x+sin*z,y,-sin*x+cos*z];
  };
  for(const op of ops){center=apply(center,op);lens=apply(lens,op);}
  assert.ok(center.every((v,i)=>Math.abs(v-[0,.3,.4][i])<1e-8),'The actual head pivot stays seated on the fixed ball joint');
  const light=lampLightConfig({modelId:ids[0],position:[0,0,0],heading:0,scale:1,poweredOn:true,spotlightAngle:-41,spotlightSwivel:swivel});
  assert.ok(lens.every((v,i)=>Math.abs(v-light.position[i])<1e-8),'Native head/lens and beam rotate together');
}
const sharedAim={value:{instanceId:'spot',angle:-41,swivel:30}};
NativeSpotlightHead({instanceId:'spot',asset:{getEntities:()=>[entity,backplate]},angle:-25,swivel:0,pose:sharedAim});
const idleHeadWrites=writes.length;
for(let i=0;i<120;i++)headFrame();
assert.equal(writes.length,idleHeadWrites,'A settled head does not write native transforms');
sharedAim.value={instanceId:'spot',angle:-180,swivel:40};
headFrame();
assert.equal(writes.at(-1)[1][1][1],-Math.PI,'Shared input can turn the head straight up without React rendering');
sharedAim.value=undefined;headFrame();
assert.equal(writes.at(-1)[1][1][1],-25*Math.PI/180,'Cancel restores the persisted tilt');
console.log('Verified six purchasable spotlight finishes, emitted lens assets, both wall mounts, beam targets, drag planes, saved angles and native head pivots.');

// Compile with Metro's React Compiler and worklet plugins, as on the device.
for (const filename of ['NativeSpotlightHead', 'NativeLampLight', 'NativeLampGlow']) {
  const code = babel.transformFileSync(`components/pet/native/${filename}.tsx`, {
    caller: { name: 'metro', platform: 'ios', engine: 'hermes', isDev: true, bundler: 'metro', supportsReactCompiler: true },
  }).code;
  assert.ok(code.includes('__workletHash'));
  assert.ok(!code.includes('_temp'), 'Native closures must not capture compiler-hoisted regular callbacks');
}

let callback, lastConfig, handle, creates = 0, effectLight;
const poses = [], directions = [], applied = { value: [] };
mocks.react.useEffect = (fn, deps) => {
  if (effectLight !== deps[1]) { effectLight = deps[1]; fn(); }
};
mocks.react.createElement = (type, props) => ({ type, props });
mocks['react-native-worklets-core'] = { useSharedValue: () => applied };
Object.assign(mocks['react-native-filament'], {
  useFilamentContext: () => ({ scene: {}, lightManager: {
    setPosition: (_light, position) => poses.push([...position]),
    setDirection: (_light, direction) => directions.push([...direction]),
  } }),
  useLightEntity: (_manager, config) => {
    const key = JSON.stringify(config);
    if (key !== lastConfig) { lastConfig = key; handle = { id: ++creates }; }
    return handle;
  },
  useEntityInScene: () => {},
  RenderCallbackContext: { useRenderCallback: fn => { callback = fn; } },
});
const { NativeLampLight } = load('@/components/pet/native/NativeLampLight');
const object = buildNativeRoomWorld({ width: 390, height: 430, petSize: 90, sizeScale: 1,
  decorations: [{ decorationId: ids[0], instanceId: 'spot', offset: { x: .2, y: -.7 }, poweredOn: true }], toys: [] }).objects[0];
const preview = { value: undefined };
for (const [angle,swivel] of [[-25,0],[0,0],[55,30],[75,-85],[-41,-30],[-41,30]]) {
  const node = NativeLampLight({ object: { ...object, spotlightAngle: angle, spotlightSwivel:swivel }, active: true, editingObject: preview });
  node.type(node.props); callback();
  const light = lampLightConfig({ ...object, spotlightAngle: angle, spotlightSwivel:swivel });
  assert.deepEqual(directions.at(-1), Array.from(light.direction));
  assert.deepEqual(poses.at(-1), Array.from(light.position));
}
assert.equal(creates, 1, 'Angle previews retain the same native light entity');
const updates = poses.length;
for (let i = 0; i < 120; i++) callback();
assert.equal(poses.length, updates, 'An unmoving spotlight has no idle native writes');
preview.value = { ...object, position: object.position.map((v, i) => v + (i === 0 ? .2 : 0)), heading: Math.PI / 2 };
callback();
assert.deepEqual(directions.at(-1),Array.from(lampLightConfig({...preview.value,spotlightAngle:-41,spotlightSwivel:30}).direction),'Preview heading rotates the beam with the mounted fixture');
assert.equal(creates, 1, 'Dragging updates the existing light');
console.log('Verified device Babel compilation, native beam/head previews, drawing-thread pose changes, retained light handles and idle work.');

// Native host arrays can expose iterators tied to the originating JS runtime.
// Drawing-thread updates must read their numeric elements without iterating them.
const lampModule = load('@/utils/native-lamp-light');
const originalConfig = lampModule.lampLightConfig;
function hostArray(values) {
  Object.defineProperty(values, Symbol.iterator, { value() { throw new Error('Cross-runtime array iterator'); } });
  return values;
}
lampModule.lampLightConfig = object => {
  const config = originalConfig(object);
  if (config) { hostArray(config.position); hostArray(config.direction); }
  return config;
};
try {
  preview.value = undefined;
  const node = NativeLampLight({ object, active: true, editingObject: preview });
  node.type(node.props); callback();
  assert.deepEqual(poses.at(-1), Array.from(originalConfig(object).position));
} finally { lampModule.lampLightConfig = originalConfig; }

const emissions = [];
const glowMaterial = { setFloat4Parameter: (name, value) => emissions.push([name, Array.from(value)]) };
mocks.react.useMemo = fn => hostArray(fn());
mocks['react-native-filament'].useFilamentContext = () => ({
  renderableManager: { getPrimitiveCount: () => 1, getMaterialInstanceAt: () => glowMaterial },
  nameComponentManager: { getEntityName: () => 'Spotlight lens' },
});
const { NativeLampGlow } = load('@/components/pet/native/NativeLampGlow');
for (const poweredOn of [true, false, true]) NativeLampGlow({
  asset: { getRenderableEntities: () => [entity] }, modelId: 'wallSpotBellBrass', poweredOn,
});
assert.deepEqual(emissions.map(([, values]) => values), [[1, .78, .44, 1], [0, 0, 0, 1], [1, .78, .44, 1]]);
console.log('Verified beam and lens power updates without cross-runtime array iterators.');

mocks['react-native-filament'].useFilamentContext = () => ({ scene: {}, lightManager: {
  setPosition: (_light, position) => poses.push(Array.from(position)),
  setDirection: (_light, direction) => directions.push(Array.from(direction)),
} });
// A replacement light starts at the origin and must get the unchanged saved pose.
lastConfig = undefined;
const beforeReplacement = poses.length;
const replacement = NativeLampLight({ object, active: true, editingObject: preview });
replacement.type(replacement.props); callback();
assert.equal(poses.length, beforeReplacement + 1, 'Light replacement invalidates its applied pose cache');
assert.deepEqual(poses.at(-1), Array.from(originalConfig(object).position));
console.log('Verified replacement light entities reapply their saved pose after refresh.');

// The displayed sweep keeps existing persisted angles, including the expanded up range.
for (const heading of [0,Math.PI/2]) for (const [angle,normal,vertical] of [[15,-Math.sin(Math.PI/12),-Math.cos(Math.PI/12)],[0,0,-1],[-90,1,0],[-180,0,1]]) {
  const light=lampLightConfig({...object,heading,spotlightAngle:angle,spotlightSwivel:0});
  const axis=heading===0?2:0;
  assert.ok(Math.abs(light.direction[axis]-normal)<.3,'Head moves from wall to down to room to up');
  assert.ok(Math.abs(light.direction[1]-vertical)<.05);
}
const {advanceSpotlightAim}=load('@/utils/native-spotlight-aim');
const start={instanceId:'spot',angle:15,swivel:-30}, target={instanceId:'spot',angle:-180,swivel:40};
let reference;
for(const fps of [30,60,120]){
  let pose=start;
  for(let frame=0;frame<fps/10;frame++){
    const next=advanceSpotlightAim(pose,target,1/fps);
    assert.ok(next.angle<=pose.angle && next.angle>=target.angle,'Tilt converges without overshoot');
    assert.ok(next.swivel>=pose.swivel && next.swivel<=target.swivel,'Swivel converges without overshoot');
    pose=next;
  }
  if(reference)assert.ok(Math.abs(reference.angle-pose.angle)<1e-8,'Smoothing speed is independent of frame rate');
  reference=pose;
}
assert.equal(advanceSpotlightAim(start,target,1/60,true),target,'Reduced motion is immediate');
assert.equal(advanceSpotlightAim(start,undefined,1/60),undefined,'Cancel removes the preview');
assert.equal(advanceSpotlightAim(start,{...target,instanceId:'other'},1/60).instanceId,'other','Changing selection never reuses another head angle');
let settled=start;
for(let i=0;i<120;i++)settled=advanceSpotlightAim(settled,target,1/60);
assert.equal(settled,target,'Animation settles exactly so native idle writes stop');

const {configureRoomCamera,ROOM_CAMERA_DISTANCE}=load('@/utils/native-room-camera');
const {projectWorld}=load('@/utils/native-room-world');
let projection,eye;
configureRoomCamera({setProjection:(...args)=>projection=args,lookAt:value=>eye=value},.8);
assert.equal(projection.length,5,'The native camera binding receives its required direction argument');
assert.equal(projection[4],'vertical');
assert.ok(projection[3]<100 && projection[2]>0,'The room stays inside the renderer lighting range');
assert.equal(eye[0],eye[2],'The camera keeps the isometric azimuth');
let maximumError=0;
for(const x of [-2.465,0,2.465])for(const z of [-2.465,0,2.465])for(const y of [.055,.9,2.745]){
  const point=[x,y,z], ortho=projectWorld(point,390);
  const depth=(56*x+42.7*(y-.9)+56*z)/ROOM_CAMERA_DISTANCE;
  assert.ok(ROOM_CAMERA_DISTANCE-depth>projection[2] && ROOM_CAMERA_DISTANCE-depth<projection[3],'Room corners are never clipped');
  const factor=ROOM_CAMERA_DISTANCE/(ROOM_CAMERA_DISTANCE-depth);
  maximumError=Math.max(maximumError,Math.hypot(ortho.x*(factor-1),ortho.y*(factor-1)));
}
assert.ok(maximumError<5,'Distant perspective keeps editor projection within five points across the room: '+maximumError);
console.log('Verified full wall/down/room/up sweep, frame-rate-independent smoothing, exact settling, native projection arguments and preserved room framing.');

// Head and beam consume the exact same intermediate pose, without new light entities.
const aimPose={value:{instanceId:object.instanceId,angle:-25,swivel:0}};
const liveLight=NativeLampLight({object,active:true,spotlightPose:aimPose});
liveLight.type(liveLight.props);
const priorCreates=creates;
for(let i=0;i<30;i++){
  aimPose.value=advanceSpotlightAim(aimPose.value,{instanceId:object.instanceId,angle:-180,swivel:40},1/60);
  callback();
  const expected=originalConfig({...object,spotlightAngle:aimPose.value.angle,spotlightSwivel:aimPose.value.swivel});
  assert.deepEqual(directions.at(-1),Array.from(expected.direction),'Beam follows every smoothed head pose without lag');
  assert.deepEqual(poses.at(-1),Array.from(expected.position),'Lens origin follows the smoothed head pivot');
}
assert.equal(creates,priorCreates,'Shared aiming never recreates the light');
console.log('Verified smoothing uses the same pose for lens and beam without React rendering or light recreation.');
