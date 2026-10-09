// Build a small reusable particle pool and glass outlines from the shipped models.
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const native = path.join(root, 'assets/3d/native');
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a, b) {
  return Array.from({ length: 16 }, (_, i) => {
    const column = Math.floor(i / 4), row = i % 4;
    return [0, 1, 2, 3].reduce((sum, k) => sum + a[k * 4 + row] * b[column * 4 + k], 0);
  });
}
function matrix(node) {
  if (node.matrix) return node.matrix;
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1], s = node.scale ?? [1, 1, 1], t = node.translation ?? [0, 0, 0];
  return [(1 - 2 * (y*y + z*z)) * s[0], 2*(x*y+z*w)*s[0], 2*(x*z-y*w)*s[0], 0,
    2*(x*y-z*w)*s[1], (1-2*(x*x+z*z))*s[1], 2*(y*z+x*w)*s[1], 0,
    2*(x*z+y*w)*s[2], 2*(y*z-x*w)*s[2], (1-2*(x*x+y*y))*s[2], 0, ...t, 1];
}
const cross = (a, b, p) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function hull(points) {
  const sorted = [...new Map(points.map(p => [p.slice(0, 2).join(','), p.slice(0, 2)])).values()].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const half = list => { const out = []; for (const p of list) { while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 1e-8) out.pop(); out.push(p); } return out; };
  return [...half(sorted).slice(0,-1), ...half(sorted.toReversed()).slice(0,-1)];
}
const panes = {}, mounts = {};
for (const file of fs.readdirSync(native).filter(f => f !== 'window-weather.glb' && (/^window.*\.glb$/.test(f) || f === 'bathroomBathWindow.glb'))) {
  const data = fs.readFileSync(path.join(native, file)), jsonLength = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20, 20 + jsonLength)), binary = data.subarray(28 + jsonLength);
  const result = [], frame = [], sill = [];
  function visit(index, parent) {
    const node = gltf.nodes[index], transform = multiply(parent, matrix(node));
    if (node.mesh !== undefined) {
      const points = [];
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const accessor = gltf.accessors[primitive.attributes.POSITION], view = gltf.bufferViews[accessor.bufferView];
        for (let i = 0; i < accessor.count; i++) {
          const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + i * (view.byteStride ?? 12);
          const p = [0,1,2].map(k => binary.readFloatLE(offset + k * 4));
          points.push([0,1,2].map(k => transform[k]*p[0] + transform[4+k]*p[1] + transform[8+k]*p[2] + transform[12+k]));
        }
      }
      if (/^(Window glass|Sky blue glass|Arched glass lower pane|Arched sky glass|Round sky glass)(\.|$)/.test(node.name)) {
        const polygon = hull(points);
        result.push({ polygon, min: [0,1].map(k => Math.min(...points.map(p => p[k]))),
          max: [0,1].map(k => Math.max(...points.map(p => p[k]))), z: Math.max(...points.map(p => p[2])) });
      } else if (/sill/i.test(node.name)) sill.push(...points);
      else if (!/reflection|latch/i.test(node.name)) frame.push(...points);
    }
    for (const child of node.children ?? []) visit(child, transform);
  }
  for (const index of gltf.scenes[gltf.scene ?? 0].nodes) visit(index, identity);
  if (!result.length) throw new Error(`No glass in ${file}`);
  panes[file.slice(0, -4)] = result;
  const bounds = points => ({ min: [0,1,2].map(k => Math.min(...points.map(p => p[k]))),
    max: [0,1,2].map(k => Math.max(...points.map(p => p[k]))) });
  mounts[file.slice(0, -4)] = { frame: bounds(frame), ...(sill.length ? { sill: bounds(sill) } : {}) };
}
fs.writeFileSync(path.join(root, 'constants/window-weather-panes.json'), JSON.stringify(panes, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'constants/window-mount-bounds.json'), JSON.stringify(mounts, null, 2) + '\n');

const gltf = { asset: { version: '2.0', generator: 'Math Mews window weather' }, scene: 0, scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Weather pool', children: [] }], meshes: [], accessors: [], bufferViews: [], materials: [],
  extensionsUsed: ['KHR_materials_unlit'], buffers: [] };
const chunks = []; let length = 0;
function accessor(values, type, componentType, target) {
  const bytes = Buffer.alloc(values.length * (componentType === 5126 ? 4 : 2));
  values.forEach((v,i) => componentType === 5126 ? bytes.writeFloatLE(v,i*4) : bytes.writeUInt16LE(v,i*2));
  const padded = Buffer.alloc(Math.ceil(bytes.length / 4)*4); bytes.copy(padded);
  const bufferView = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, target }); chunks.push(padded); length += padded.length;
  const components = type === 'VEC3' ? 3 : 1;
  const meta = { bufferView, componentType, count: values.length / components, type };
  if (type === 'VEC3') {
    meta.min = [0,1,2].map(k => Math.min(...values.filter((_,i) => i%3===k)));
    meta.max = [0,1,2].map(k => Math.max(...values.filter((_,i) => i%3===k)));
  }
  gltf.accessors.push(meta); return gltf.accessors.length - 1;
}
for (const [kind, count, polygon, color] of [
  ['rain', 24, [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]], [.45,.65,.9,.75]],
  ['snow', 12, Array.from({length:8},(_,i) => [Math.cos(i*Math.PI/4)*.5,Math.sin(i*Math.PI/4)*.5]), [.8,.88,1,1]],
  ['leaves', 8, [[0,-.5],[.45,-.15],[.35,.25],[0,.5],[-.35,.25],[-.45,-.15]], [.8,.32,.065,1]],
]) {
  const positions = polygon.flatMap(p => [...p,0]), triangles = [];
  for (let i=1; i<polygon.length-1; i++) triangles.push(0,i,i+1);
  const material = gltf.materials.length;
  gltf.materials.push({ name: kind, doubleSided: true, alphaMode: 'BLEND', extensions: { KHR_materials_unlit: {} },
    pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0, roughnessFactor: 1 } });
  const mesh = gltf.meshes.length;
  gltf.meshes.push({ primitives: [{ attributes: { POSITION: accessor(positions,'VEC3',5126,34962) },
    indices: accessor(triangles,'SCALAR',5123,34963), material }] });
  for (let i=0; i<count; i++) {
    gltf.nodes[0].children.push(gltf.nodes.length);
    gltf.nodes.push({ name: `${kind} ${i}`, mesh, scale: [.00001,.00001,.00001], translation: [0,0,-10] });
  }
}
gltf.buffers.push({ byteLength: length });
const jsonRaw = Buffer.from(JSON.stringify(gltf)), json = Buffer.alloc(Math.ceil(jsonRaw.length/4)*4,0x20); jsonRaw.copy(json);
const binary = Buffer.concat(chunks), output = Buffer.alloc(12+8+json.length+8+binary.length);
output.writeUInt32LE(0x46546c67,0); output.writeUInt32LE(2,4); output.writeUInt32LE(output.length,8);
output.writeUInt32LE(json.length,12); output.writeUInt32LE(0x4e4f534a,16); json.copy(output,20);
output.writeUInt32LE(binary.length,20+json.length); output.writeUInt32LE(0x004e4942,24+json.length); binary.copy(output,28+json.length);
fs.writeFileSync(path.join(native,'window-weather.glb'),output);
console.log(`Built a ${output.length}-byte weather pool and glass outlines for ${Object.keys(panes).length} windows.`);
