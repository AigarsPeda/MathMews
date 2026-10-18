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
export function readModel(id, { triangles: includeTriangles = false } = {}) {
  const data = fs.readFileSync(path.join(native, id+'.glb')), length = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20,20+length)), binary = data.subarray(28+length), meshes = [];
  function visit(index, parent, ancestors = []) {
    const node = gltf.nodes[index], transform = multiply(parent,matrix(node));
    if (node.mesh !== undefined) {
      const points = [], triangles = [];
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const start = points.length;
        const accessor = gltf.accessors[primitive.attributes.POSITION], view = gltf.bufferViews[accessor.bufferView];
        if (accessor.componentType !== 5126 || accessor.type !== 'VEC3') throw new Error(`Unsupported positions: ${id}`);
        for (let i=0;i<accessor.count;i++) {
          const offset = (view.byteOffset??0)+(accessor.byteOffset??0)+i*(view.byteStride??12);
          const p = [0,1,2].map(k => binary.readFloatLE(offset+k*4));
          points.push([0,1,2].map(k => transform[k]*p[0]+transform[k+4]*p[1]+transform[k+8]*p[2]+transform[k+12]));
        }
        if (includeTriangles) {
          if ((primitive.mode ?? 4) !== 4) throw new Error(`Unsupported triangles: ${id}`);
          const a = primitive.indices === undefined ? undefined : gltf.accessors[primitive.indices];
          const v = a && gltf.bufferViews[a.bufferView];
          const [bytes,read] = a ? {5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE']}[a.componentType] : [0,''];
          const index = i => a ? binary[read]((v.byteOffset??0)+(a.byteOffset??0)+i*bytes) : i;
          for (let i=0;i<(a?.count??accessor.count);i+=3) triangles.push([0,1,2].map(k=>points[start+index(i+k)]));
        }
      }
      meshes.push({name:node.name,points,ancestors,...(includeTriangles?{triangles}:{})});
    }
    for (const child of node.children??[]) visit(child,transform,[...ancestors,node.name]);
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

/** Spatial cells keep both sides of an arch separate, including at its crown.
 * Group whole triangles so no surface disappears between neighboring cells.
 */
function curvedPartBoxes(mesh) {
  const cells = new Map();
  for (const triangle of mesh.triangles) {
    const key = [0,1,2].map(k=>Math.floor(triangle.reduce((sum,p)=>sum+p[k],0)/3/.12)).join(':');
    if (!cells.has(key)) cells.set(key,[]);
    cells.get(key).push(...triangle);
  }
  return [...cells.values()].map(points=>({...bounds(points),footprint:hull(points)}));
}
export function derivePlacementBounds() {
  const result = {};
  for (const [id,meta] of Object.entries(catalog)) {
    if (meta.kind==='room') continue;
    const meshes = readModel(id, {triangles:id==='lampFloorArc'}), points = meshes.flatMap(mesh=>mesh.points);
    const actual = bounds(points);
    // A bad transform would invalidate the audit, so fail instead of shipping it.
    for(const axis of [0,1,2]) if(actual.min[axis]<meta.min[axis]-.025 || actual.max[axis]>meta.max[axis]+.025)
      throw new Error(`GLB exceeds catalog bounds: ${id}, axis ${axis}`);
    result[id] = {placementHull:hull(points)};
    if (id==='lampFloorArc') result[id].placementBoxes = meshes.map(mesh=>mesh.name==='Brass arch stem'
      ? curvedPartBoxes(mesh) : [{...bounds(mesh.points),footprint:hull(mesh.points)}]).flat();
    // Plant navigation deliberately ignores foliage. Retain that choice while
    // removing the empty square corners around round pots during decorating.
    if (meta.leaves) result[id].placementBoxes = meta.collisionBoxes.map(box=>{
      const mesh = meshes.find(mesh=>{const b=bounds(mesh.points);return [0,1,2].every(k=>Math.abs(b.min[k]-box.min[k])<1e-5&&Math.abs(b.max[k]-box.max[k])<1e-5);});
      return mesh ? {...box,footprint:hull(mesh.points)} : box;
    });
    const openingBounds=(meta.interactionParts??[]).filter(part=>part.mode==='open').flatMap(part=>{
      const points=meshes.filter(mesh=>mesh.ancestors.includes(part.node)).flatMap(mesh=>mesh.points);
      return points.length ? [{node:part.node,...bounds(points)}] : [];
    });
    if(openingBounds.length)result[id].interactionBounds=openingBounds;
    // Only authored horizontal boards can support objects. Brackets, backs,
    // shades and decorative trim must not become accidental placement targets.
    const surfaces = meshes.filter(mesh => /^(Rounded tabletop|Wall shelf(?:\.\d+)?|Shelf(?:\.\d+)?|Broad fireplace mantel|Thick stone worktop(?:\.\d+)?)$/.test(mesh.name))
      .map(mesh => bounds(mesh.points));
    if (surfaces.length) result[id].supportSurfaces = surfaces;
    const wallMount = meshes.find(mesh => mesh.name === 'Wall backplate');
    if (wallMount) result[id].wallMountBounds = bounds(wallMount.points);
    if (/^(lavaLamp|lampTable|kitchenMixer)/.test(id) || id === 'halloweenGhostLantern') {
      const bases = meshes.filter(mesh => bounds(mesh.points).min[1] <= meta.min[1] + .02)
        .sort((a,b) => bounds(a.points).max[1] - bounds(b.points).max[1]);
      const feet = /^kitchenMixer/.test(id) ? bases : bases.slice(0,1);
      if (feet.length) result[id].baseHull = hull(feet.flatMap(mesh=>mesh.points));
    }
    // Retain deliberately authored shapes and animation envelopes. Static
    // furniture gets one box per part instead of a box full of empty air.
    if (!meta.collisionBoxes && !meta.animated) result[id].collisionBoxes = meshes.filter(mesh => !/^Interaction (water|power LED)/.test(mesh.name)).map(mesh => ({
      ...bounds(mesh.points),
      // Round dining parts must not collide with the empty corners of their box.
      ...(/^(Round oak tabletop|Dining chair seat)$/.test(mesh.name) ? { footprint: hull(mesh.points) } : {}),
    }));
  }
  return result;
}
if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const result = derivePlacementBounds();
  fs.writeFileSync(path.join(root,'constants/room-placement-bounds.json'),JSON.stringify(result,(_key,value)=>typeof value==='number'?Math.round(value*1e6)/1e6:value)+'\n');
  console.log(`Audited ${Object.keys(result).length} placeable models; added per-part colliders to ${Object.values(result).filter(m=>m.collisionBoxes).length} static models.`);
}
