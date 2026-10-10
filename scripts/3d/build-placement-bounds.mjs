/** Derive placement footprints and missing static colliders from shipped GLB vertices. */
import fs from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const native = path.join(root, 'assets/3d/native');
const catalog = JSON.parse(fs.readFileSync(path.join(native, 'catalog.json')));
const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply = (a,b) => Array.from({length:16}, (_,i) => [0,1,2,3].reduce((sum,k) => sum+a[k*4+i%4]*b[Math.floor(i/4)*4+k],0));
function matrix(node) {
  if (node.matrix) return node.matrix;
  const [x,y,z,w] = node.rotation ?? [0,0,0,1], s = node.scale ?? [1,1,1], t = node.translation ?? [0,0,0];
  return [(1-2*(y*y+z*z))*s[0],2*(x*y+z*w)*s[0],2*(x*z-y*w)*s[0],0,
    2*(x*y-z*w)*s[1],(1-2*(x*x+z*z))*s[1],2*(y*z+x*w)*s[1],0,
    2*(x*z+y*w)*s[2],2*(y*z-x*w)*s[2],(1-2*(x*x+y*y))*s[2],0,...t,1];
}
export function readModel(id) {
  const data = fs.readFileSync(path.join(native, id+'.glb')), length = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20,20+length)), binary = data.subarray(28+length), meshes = [];
  function visit(index, parent) {
    const node = gltf.nodes[index], transform = multiply(parent,matrix(node));
    if (node.mesh !== undefined) {
      const points = [];
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const accessor = gltf.accessors[primitive.attributes.POSITION], view = gltf.bufferViews[accessor.bufferView];
        if (accessor.componentType !== 5126 || accessor.type !== 'VEC3') throw new Error(`Unsupported positions: ${id}`);
        for (let i=0;i<accessor.count;i++) {
          const offset = (view.byteOffset??0)+(accessor.byteOffset??0)+i*(view.byteStride??12);
          const p = [0,1,2].map(k => binary.readFloatLE(offset+k*4));
          points.push([0,1,2].map(k => transform[k]*p[0]+transform[k+4]*p[1]+transform[k+8]*p[2]+transform[k+12]));
        }
      }
      meshes.push({name:node.name,points});
    }
    for (const child of node.children??[]) visit(child,transform);
  }
  for (const index of gltf.scenes[gltf.scene??0].nodes) visit(index,identity);
  return meshes;
}
const bounds = points => ({min:[0,1,2].map(k=>points.reduce((v,p)=>Math.min(v,p[k]),Infinity)),
  max:[0,1,2].map(k=>points.reduce((v,p)=>Math.max(v,p[k]),-Infinity))});
function hull(points) {
  const sorted = [...new Map(points.map(p=>[[p[0],p[2]].join(','),[p[0],p[2]]])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross = (a,b,p) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const half = list => {const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
}
export function derivePlacementBounds() {
  const result = {};
  for (const [id,meta] of Object.entries(catalog)) {
    if (meta.kind==='room') continue;
    const meshes = readModel(id), points = meshes.flatMap(mesh=>mesh.points);
    const actual = bounds(points);
    // A bad transform would invalidate the audit, so fail instead of shipping it.
    for(const axis of [0,1,2]) if(actual.min[axis]<meta.min[axis]-.025 || actual.max[axis]>meta.max[axis]+.025)
      throw new Error(`GLB exceeds catalog bounds: ${id}, axis ${axis}`);
    result[id] = {placementHull:hull(points)};
    // Retain deliberately authored shapes and animation envelopes. Static
    // furniture gets one box per part instead of a box full of empty air.
    if (!meta.collisionBoxes && !meta.animated) result[id].collisionBoxes = meshes.map(mesh=>bounds(mesh.points));
  }
  return result;
}
if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const result = derivePlacementBounds();
  fs.writeFileSync(path.join(root,'constants/room-placement-bounds.json'),JSON.stringify(result,(_key,value)=>typeof value==='number'?Math.round(value*1e6)/1e6:value)+'\n');
  console.log(`Audited ${Object.keys(result).length} placeable models; added per-part colliders to ${Object.values(result).filter(m=>m.collisionBoxes).length} static models.`);
}
