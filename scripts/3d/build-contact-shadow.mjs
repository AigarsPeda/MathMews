import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import sharp from 'sharp';

// A shared, unlit soft shadow quad, instanced for each floor-standing object.
const size = 128, rgba = Buffer.alloc(size * size * 4);
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
  const fade = Math.max(0, 1 - radius * radius);
  rgba[(y * size + x) * 4 + 3] = Math.round(160 * fade);
}
const png = await sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
const gltf = { asset: { version: '2.0', generator: 'Math Mews contact shadow' }, scene: 0,
  scenes: [{ nodes: [0] }], nodes: [{ name: 'Soft ground shadow', mesh: 0 }],
  meshes: [], accessors: [], bufferViews: [], buffers: [],
  extensionsUsed: ['KHR_materials_unlit'],
  materials: [{ name: 'Soft contact shadow', doubleSided: true, alphaMode: 'BLEND',
    extensions: { KHR_materials_unlit: {} },
    pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
  textures: [{ source: 0, sampler: 0 }], samplers: [{ magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071 }], images: [],
};
const chunks = []; let length = 0;
function bytes(data, target) {
  const index = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length, ...(target ? { target } : {}) });
  const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4); data.copy(padded);
  chunks.push(padded); length += padded.length;
  return index;
}
function accessor(values, type, componentType, components, target) {
  const data = Buffer.alloc(values.length * (componentType === 5126 ? 4 : 2));
  values.forEach((value, i) => componentType === 5126 ? data.writeFloatLE(value, i * 4) : data.writeUInt16LE(value, i * 2));
  const index = gltf.accessors.length;
  gltf.accessors.push({ bufferView: bytes(data, target), componentType, type, count: values.length / components,
    ...(type === 'VEC3' ? { min: [-1, 0, -1], max: [1, 0, 1] } : {}) });
  return index;
}
gltf.meshes.push({ primitives: [{ material: 0, attributes: {
  POSITION: accessor([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 'VEC3', 5126, 3, 34962),
  TEXCOORD_0: accessor([0, 0, 1, 0, 1, 1, 0, 1], 'VEC2', 5126, 2, 34962),
}, indices: accessor([0, 2, 1, 0, 3, 2], 'SCALAR', 5123, 1, 34963) }] });
gltf.images.push({ bufferView: bytes(png), mimeType: 'image/png' });
gltf.buffers.push({ byteLength: length });
const json = Buffer.from(JSON.stringify(gltf)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + padded.length + length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binary = Buffer.alloc(8); binary.writeUInt32LE(length); binary.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync('assets/3d/native/room-contact-shadow.glb', Buffer.concat([header, padded, binary, ...chunks]));
