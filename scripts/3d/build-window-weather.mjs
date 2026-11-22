// Build a small reusable particle pool and glass outlines from the shipped models.
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearWindowTextures } from './clear-window-view.mjs';
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
function bufferView(bytes, target) {
  const padded = Buffer.alloc(Math.ceil(bytes.length / 4)*4); bytes.copy(padded);
  const index = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, target });
  chunks.push(padded); length += padded.length;
  return index;
}
function accessor(values, type, componentType, target) {
  const stride = componentType === 5126 ? 4 : componentType === 5121 ? 1 : 2;
  const bytes = Buffer.alloc(values.length * stride);
  values.forEach((v,i) => {
    if (componentType === 5126) bytes.writeFloatLE(v,i*4);
    else if (componentType === 5121) bytes.writeUInt8(Math.round(255*v),i);
    else bytes.writeUInt16LE(v,i*2);
  });
  const components = { VEC4: 4, VEC3: 3, VEC2: 2, SCALAR: 1 }[type];
  const meta = { bufferView: bufferView(bytes, target), componentType, count: values.length / components, type, ...(componentType === 5121 ? {normalized:true} : {}) };
  if (type === 'VEC3') {
    meta.min = [0,1,2].map(k => Math.min(...values.filter((_,i) => i%3===k)));
    meta.max = [0,1,2].map(k => Math.max(...values.filter((_,i) => i%3===k)));
  }
  gltf.accessors.push(meta); return gltf.accessors.length - 1;
}
function particlePool(kind, count, points, triangles, layers) {
  const material = gltf.materials.length;
  gltf.materials.push({ name: kind, doubleSided: true, alphaMode: 'BLEND', extensions: { KHR_materials_unlit: {} },
    pbrMetallicRoughness: { baseColorFactor: [1,1,1,1], metallicFactor: 0, roughnessFactor: 1 } });
  const POSITION = accessor(points.flatMap(([x,y])=>[x,y,0]),'VEC3',5126,34962);
  const indices = accessor(triangles,'SCALAR',5123,34963);
  const first = gltf.meshes.length;
  for (const colors of layers) {
    const COLOR_0 = accessor(colors.flat(), 'VEC4', 5121, 34962);
    gltf.meshes.push({ primitives: [{ attributes: { POSITION, COLOR_0 }, indices, material }] });
  }
  for (let i=0; i<count; i++) {
    gltf.nodes[0].children.push(gltf.nodes.length);
    gltf.nodes.push({ name: `${kind} ${i}`, mesh: first + i % layers.length, scale: [.00001,.00001,.00001], translation: [0,0,-10] });
  }
}
function fan(rim, center) {
  return Array.from({length:rim},(_,i)=>[center,i,(i+1)%rim]).flat();
}
const rain = [[0,-.5],[.40,-.39],[.5,-.15],[.19,.23],[0,.5],[-.19,.23],[-.5,-.15],[-.40,-.39],[0,-.24]];
particlePool('rain',24,rain,fan(8,8),[.39,.68,.96].map(opacity=>
  [.65,.47,.35,.19,0,.19,.35,.47,1].map(a=>[1,1,1,a*opacity])));

// A bright, solid center and feathered six-point rim stay legible at phone scale.
const snow = [], snowTriangles = [], snowAlpha = [];
for (const outer of [false,true]) for (let i=0;i<12;i++) {
  const a = i*Math.PI/6, radius = outer ? (i%2 ? .31 : .5) : .215;
  snow.push([Math.cos(a)*radius,Math.sin(a)*radius]);
  snowAlpha.push(outer ? .04 : .96);
  if (outer) {
    const n=(i+1)%12;
    snowTriangles.push(i,12+i,12+n,i,12+n,n);
  }
}
snow.push([0,0]); snowAlpha.push(1); snowTriangles.push(...fan(12,24));
particlePool('snow',12,snow,snowTriangles,[.56,.79,1].map(opacity=>snowAlpha.map(a=>[1,1,1,a*opacity])));

// Sections along a bent midrib give each blade a stem, a folded face and a pointed tip.
const leaf = [], leafTriangles = [], leafShade = [];
const sections = [[-.49,-.08,.009],[-.31,-.05,.016],[-.25,-.04,.21],[-.10,-.015,.44],[.05,.01,.36],[.15,.035,.40],[.28,.06,.25],[.49,.12,.008]];
for (const [i,[y,mid,halfWidth]] of sections.entries()) {
  leaf.push([mid-halfWidth,y],[mid,y+.005],[mid+halfWidth*.88,y]);
  leafShade.push(.64,1,.84);
  if (i) {
    const k = 3*(i-1);
    leafTriangles.push(k,k+1,k+3,k+1,k+4,k+3,k+1,k+2,k+4,k+2,k+5,k+4);
  }
}
particlePool('leaves',8,leaf,leafTriangles,[[1,.46,.065],[.88,.16,.045],[.86,.62,.15]].map(rgb=>
  leafShade.map(shade=>[...rgb.map(channel=>channel*shade),1])));

// One set of textures for the entire catalog. Each window cuts the same view to its glass.
gltf.images = (await clearWindowTextures()).map(bytes => ({ bufferView: bufferView(bytes), mimeType: 'image/png' }));
gltf.textures = gltf.images.map((_, source) => ({ source }));
const scenery = ['Landscape', 'Wet terrain', 'Snow cover', 'Autumn foliage', 'Night lights', 'Cottage lights'].map((name, index) => ({
  // Masked terrain writes depth before Filament sorts the transparent particles and lights.
  name, material: gltf.materials.push({ name, doubleSided: true, ...(index < 4 ? { alphaMode: 'MASK', alphaCutoff: .3 } : { alphaMode: 'BLEND' }), extensions: { KHR_materials_unlit: {} },
    pbrMetallicRoughness: { baseColorTexture: { index }, baseColorFactor: [1,1,1,0], metallicFactor: 0, roughnessFactor: 1 } }) - 1,
}));
const shapeMeshes = new Map();
for (const [model, outlines] of Object.entries(panes)) {
  const key = JSON.stringify(outlines);
  if (!shapeMeshes.has(key)) {
    const xmin = Math.min(...outlines.map(p => p.min[0])), xmax = Math.max(...outlines.map(p => p.max[0]));
    const ymin = Math.min(...outlines.map(p => p.min[1])), ymax = Math.max(...outlines.map(p => p.max[1]));
    const width = Math.max(xmax-xmin, (ymax-ymin)*1.6), height = width/1.6;
    const positions = [], uv = [], triangles = [];
    for (const pane of outlines) {
      const start = positions.length/3;
      for (const [x,y] of pane.polygon) {
        positions.push(x, y, pane.z + .0008);
        uv.push(.5+(x-(xmin+xmax)/2)/width, .5-(y-(ymin+ymax)/2)/height);
      }
      for (let i=1; i < pane.polygon.length-1; i++) triangles.push(start, start+i, start+i+1);
    }
    const attributes = { POSITION: accessor(positions,'VEC3',5126,34962), TEXCOORD_0: accessor(uv,'VEC2',5126,34962) };
    const indices = accessor(triangles,'SCALAR',5123,34963);
    shapeMeshes.set(key, scenery.map(({material}) => gltf.meshes.push({ primitives: [{ attributes, indices, material }] }) - 1));
  }
  scenery.forEach(({name}, i) => {
    gltf.nodes[0].children.push(gltf.nodes.length);
    gltf.nodes.push({ name: `${name} ${model}`, mesh: shapeMeshes.get(key)[i], translation: [0,0,i*.0004] });
  });
}

gltf.buffers.push({ byteLength: length });
const jsonRaw = Buffer.from(JSON.stringify(gltf)), json = Buffer.alloc(Math.ceil(jsonRaw.length/4)*4,0x20); jsonRaw.copy(json);
const binary = Buffer.concat(chunks), output = Buffer.alloc(12+8+json.length+8+binary.length);
output.writeUInt32LE(0x46546c67,0); output.writeUInt32LE(2,4); output.writeUInt32LE(output.length,8);
output.writeUInt32LE(json.length,12); output.writeUInt32LE(0x4e4f534a,16); json.copy(output,20);
output.writeUInt32LE(binary.length,20+json.length); output.writeUInt32LE(0x004e4942,24+json.length); binary.copy(output,28+json.length);
fs.writeFileSync(path.join(native,'window-weather.glb'),output);
console.log(`Built a ${output.length}-byte weather pool and glass outlines for ${Object.keys(panes).length} windows.`);
