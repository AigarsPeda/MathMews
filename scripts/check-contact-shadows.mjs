import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const root = process.cwd(), cache = new Map();
let frame, cleanup, loads = 0;
const poses = [], shadowFlags = [], scene = new Set();
const matrix = (data = {}) => ({
  scaling: scale => matrix({ ...data, scale: [...scale] }),
  rotate: heading => matrix({ ...data, heading }),
  translate: position => matrix({ ...data, position: [...position] }), data,
});
const entity = { id: 123 }, parts = [{ id: 124 }];
const asset = { getRenderableEntities: () => parts };
const mocks = {
  react: { useMemo: fn => fn() },
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
  'react-native-worklets-core': { useSharedValue: value => ({ value }) },
  'react-native-filament': {
    useModel(_source, config) { loads++; assert.equal(config.addToScene, false); return { state: 'loaded', asset, rootEntity: entity }; },
    useFilamentContext: () => ({
      transformManager: { createIdentityMatrix: () => matrix(), setTransform(_entity, transform) {
        assert.ok([...transform.data.position, ...transform.data.scale, transform.data.heading].every(Number.isFinite));
        poses.push(transform.data);
      } },
      renderableManager: { setCastShadow(part, value) { shadowFlags.push([part.id, 'cast', value]); },
        setReceiveShadow(part, value) { shadowFlags.push([part.id, 'receive', value]); } },
      scene: { addEntities: values => values.forEach(value => scene.add(value)), removeEntities: values => values.forEach(value => scene.delete(value)) },
    }),
    useWorkletEffect: fn => { cleanup = fn(); },
    RenderCallbackContext: { useRenderCallback: fn => { frame = fn; } },
  },
};
function load(id) {
  if (id in mocks) return mocks[id];
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : id;
  if (file.endsWith('.glb')) { assert.ok(fs.existsSync(file)); return file; }
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8')); return module.exports; }
  const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: load, Math, Map, Set });
  return module.exports;
}
const w = load('@/utils/native-room-world'), shadows = load('@/utils/native-contact-shadow');
const { buildRugSurfaces } = load('@/utils/native-ground-support');
const room = w.buildNativeRoomWorld({ width: 390, height: 420, petSize: 80, sizeScale: 1,
  decorations: [
    { decorationId: 'chairRockingOak', instanceId: 'chair', offset: { x: -.5, y: .1 }, rotationDegrees: 20 },
    { decorationId: 'sofaA', instanceId: 'sofa', offset: { x: .3, y: -.1 }, scale: 1.5 },
    { decorationId: 'carpetRound', instanceId: 'rug', offset: { x: .3, y: -.1 }, scale: 2.2 },
    { decorationId: 'windowOakWide', instanceId: 'window', offset: { x: .7, y: -.4 } },
  ], toys: [] });
const chair = room.objects.find(object => object.instanceId === 'chair');
const sofa = room.objects.find(object => object.instanceId === 'sofa');
assert.ok(shadows.hasContactShadow(chair) && shadows.hasContactShadow(sofa));
for (const object of room.objects.filter(object => ['rug', 'window'].includes(object.instanceId)))
  assert.equal(shadows.hasContactShadow(object), false, 'Flat rugs and wall fixtures are receivers, not ground-shadow casters');
const shape = shadows.contactShadowShape(chair);
for (const heading of [0, Math.PI/2, 20*Math.PI/180]) {
  const pose = shadows.contactShadowPose({ ...chair, heading, position: [2.2, w.FLOOR_Y, 2.2] }, shape, []);
  const extentX = Math.abs(Math.cos(heading))*pose.scale[0] + Math.abs(Math.sin(heading))*pose.scale[2];
  const extentZ = Math.abs(Math.sin(heading))*pose.scale[0] + Math.abs(Math.cos(heading))*pose.scale[2];
  assert.ok(Math.abs(pose.position[0])+extentX<=2.460001 && Math.abs(pose.position[2])+extentZ<=2.460001,
    'Soft shadow geometry stays on the floor at rotated room edges');
}
const rugs = buildRugSurfaces(room);
const onRug = shadows.contactShadowPose({ ...sofa, position: room.objects.find(object => object.instanceId==='rug').position },
  shadows.contactShadowShape(sofa), rugs);
assert.ok(onRug.position[1] > rugs[0].height, 'The sofa shadow stays above the rug mesh');
const { NativeContactShadows } = load('@/components/pet/native/NativeContactShadows');
const editingObject = { value: undefined };
const nodes = NativeContactShadows({ world: room, active: true, editingObject }).props.children;
const node = nodes.find(node => node.props.object.instanceId==='chair');
node.type(node.props);
assert.ok(parts.every(part => scene.has(part)));
assert.deepEqual(shadowFlags, [[124,'cast',false],[124,'receive',false]], 'A ground-shadow decal does not cast another shadow');
frame(); const initialWrites = poses.length;
for (let i=0;i<120;i++) frame();
assert.equal(poses.length, initialWrites, 'Stationary furniture makes no repeated native shadow writes');
for (let i=0;i<120;i++) {
  editingObject.value = { ...chair, position: [chair.position[0]+i*.002,chair.position[1],chair.position[2]] };
  frame();
}
assert.equal(loads, 1, 'Dragging never reloads a shadow model');
assert.equal(poses.at(-1).heading, chair.heading, 'The 20-degree shadow follows the saved furniture angle');
const expected = shadows.contactShadowPose(editingObject.value, shape, rugs);
assert.deepEqual(poses.at(-1).position, Array.from(expected.position), 'A drag preview moves the shadow with the furniture');
editingObject.value = { instanceId: chair.instanceId, scale: undefined, position: undefined };
frame();
assert.deepEqual(poses.at(-1).position, Array.from(shadows.contactShadowPose(chair,shape,rugs).position),
  'Incomplete drag previews restore finite saved shadow coordinates');
cleanup(); assert.equal(scene.size, 0, 'Unmount removes the shadow before its asset is released');
node.type({ ...node.props, active: false });
const pausedWrites = poses.length;
for (let i=0;i<60;i++) frame();
assert.equal(poses.length, pausedWrites, 'Hidden rooms stop shadow callbacks');
cleanup(); assert.equal(scene.size, 0);

const bytes = fs.readFileSync('assets/3d/native/room-contact-shadow.glb');
const gltf = JSON.parse(bytes.subarray(20, 20+bytes.readUInt32LE(12)));
assert.equal(gltf.materials[0].alphaMode, 'BLEND');
assert.ok(gltf.materials[0].extensions.KHR_materials_unlit);
const binary = bytes.subarray(28+bytes.readUInt32LE(12)), view = gltf.bufferViews[gltf.images[0].bufferView];
const { data, info } = await sharp(binary.subarray(view.byteOffset,view.byteOffset+view.byteLength)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const alpha = (x,y) => data[(y*info.width+x)*4+3];
assert.equal(alpha(0,0), 0); assert.equal(alpha(127,127), 0);
assert.ok(alpha(64,64)>alpha(95,64) && alpha(95,64)>alpha(120,64), 'The baked contact shadow fades smoothly to a transparent edge');
for (let i=0;i<data.length;i+=4) assert.ok(data[i]===0 && data[i+1]===0 && data[i+2]===0,'No diagnostic color survives in the shadow texture');
console.log('Verified soft floor/rug shadows, 20-degree drag previews, bounded edges, no idle writes, no reloads, finite transforms and native cleanup.');
