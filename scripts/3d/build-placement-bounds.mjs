/** Derive placement footprints and missing static colliders from shipped GLB vertices. */
import fs from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bounds, hull, placementPrisms, compactPrisms } from './placement-shapes.mjs';
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
// Only these horizontal parts can carry decor. A back cushion, armrest or
// decorative pillow is never a substitute for the usable part of a seat.
const boardPart = /^(Rounded tabletop|Wall shelf|Shelf|Broad fireplace mantel|Thick stone worktop)$/;
const topPart = /^(Round oak tabletop|Rounded cabinet top|Vanity tabletop|Chest lid)$/;
const seatPart = /^(Seat|Dining chair seat|Rounded bar stool seat|Mint bar stool seat|Tufted bench cushion|Seat cushion|Corner sofa seat cushion|Long chaise cushion)$/;

const cushionItems = [
  /^toy-(orangeBall|pinkBall|blueBall|mouse)$/, /^yarn(Red|Blue)$/, /^sofaPillow$/,
  /^bathroom(Towel(Blue|Green|Red)|Duck)$/, /^bedroomSlippers$/, /^halloweenWitchHat$/,
  /^office(Headset|Paper[1-6]|StickyNote.+|Blueprint|RolledPapers)$/,
  /^computerMacbook/, /^console(Gameboy.*|Psp|Switch)$/,
];
const hardSurfaceItems = [
  /^(computer|console)/, /^bowl(Tan|Blue|Purple|Pink)$/,
  /^japanese(Bonsai|Candle|BaseCup|Cup|Dish|Tea|Vase|Lamp|CartonBox|Plant)$/,
  /^bathroom(Soap.+|Tissues|ToiletPaper)$/,
  /^office(Calculator|PencilHolder|Telephone|Ruler|PrinterAni|ProjectorAni|MedicalKitAni|CartonBox|WhiteBox|TvOff|WhiteboardEraser)$/,
  /^tv(BigOff|BigAniA|BigAniB|DvdAni)$/, /^plant(Small|A|B|E|Potted|Sunflower|CactusA|CactusB)$/,
  /^kitchen(BreadBasket|Microwave)$/, /^(foodBag|halloweenPumpkin|livingSpeaker)$/,
];
function portableItem(id) {
  if (/^(livingBook|books(BookGreen|Pile|Notebooks|RingBinder.+))$/.test(id)) return 'book';
  if (cushionItems.some(pattern => pattern.test(id))) return 'soft';
  if (hardSurfaceItems.some(pattern => pattern.test(id))) return 'hard';
}

export function itemSupportSurfaces(id, meshes) {
  const result = [], cushions = [];
  // The cabinet shell uses the same board for its bottom and its lid.
  // Only the exposed upper board carries items when the doors are shut.
  if (/^(japanese(ClothesCase|Closet)|office(Metallic|Wood)ClosetAni|kitchen(Modern)?WallCabinet.*)$/.test(id)) {
    const boards = meshes.filter(m => /^(Storage inner floor|Cabinet top and bottom)(\.\d+)?$/.test(m.name))
      .map(m => bounds(m.points)).sort((a,b) => b.max[1] - a.max[1]);
    if (boards.length >= 2) result.push({ ...boards[0], kind: 'top' });
  }
  // The quilt chest ships with folded linen already on it.
  const foldedTop = meshes.filter(m => /^Folded quilt(\.\d+)?$/.test(m.name))
    .sort((a, b) => bounds(b.points).max[1] - bounds(a.points).max[1])[0];
  for (const mesh of meshes) {
    const name = mesh.name.replace(/\.\d+$/, '');
    const box = bounds(mesh.points);
    if (name === 'Soft quilt cloth') {
      // Keep the curved drape off the placement area. The raised seams belong
      // to the same quilt and must clear the bottom of the placed object.
      const seamTop = Math.max(box.max[1], ...meshes.filter(m => m.name.startsWith('Quilt stitching')).map(m => bounds(m.points).max[1]));
      result.push({ min: [box.min[0] + .06, box.min[1], box.min[2] + .04],
        max: [box.max[0] - .06, seamTop, box.max[2] - .06], kind: 'seat' });
    } else if (name === 'Pet bed cushion' || mesh === foldedTop || name === 'Bedside book') {
      const contactDepth = name === 'Pet bed cushion' ? .025 : .002;
      const footprint = hull(mesh.points.filter(p => p[1] >= box.max[1] - contactDepth));
      if (footprint.length >= 3) result.push({ ...box, footprint, kind: name === 'Bedside book' ? 'book' : 'seat' });
    } else if (name === 'Stone counter' || name === 'Vanity top') {
      // Offer the dry strips beside each basin. The rim encloses empty space.
      const basins = meshes.filter(m => /^(Porcelain basin rim|Sink rim)/.test(m.name))
        .map(m => bounds(m.points)).sort((a, b) => a.min[0] - b.min[0]);
      let left = box.min[0];
      for (const [index, x] of [...basins.map(b => b.min[0]), box.max[0]].entries()) {
        if (x > left) result.push({ min: [left, box.min[1], box.min[2]], max: [x, box.max[1], box.max[2]], kind: 'top' });
        left = basins[index]?.max[0] ?? x;
      }
    } else if (boardPart.test(name)) result.push(box);
    else if (/^sofa/.test(id) && seatPart.test(name)) cushions.push(box);
    else if (seatPart.test(name) || topPart.test(name)) {
      const footprint = hull(mesh.points.filter(p => p[1] >= box.max[1] - .002));
      if (footprint.length >= 3) result.push({ ...box, footprint, kind: seatPart.test(name) ? 'seat' : 'top' });
    }
  }
  // Adjacent cushions form one usable seat across their narrow seam. Keep
  // a corner sofa's longer chaise separate so its empty corner stays empty.
  for (const box of cushions) {
    const neighbor = result.find(other => other.kind === 'seat' && [0, 2].some(axis => {
      const across = 2 - axis;
      return Math.abs(other.max[1] - box.max[1]) < .001
        && Math.abs(other.min[across] - box.min[across]) < .005 && Math.abs(other.max[across] - box.max[across]) < .005
        && Math.max(other.min[axis], box.min[axis]) - Math.min(other.max[axis], box.max[axis]) < .09;
    }));
    if (neighbor) {
      neighbor.min = neighbor.min.map((v, i) => Math.min(v, box.min[i]));
      neighbor.max = neighbor.max.map((v, i) => Math.max(v, box.max[i]));
    } else result.push({ ...box, kind: 'seat' });
  }
  if (/^(livingBook|booksBookGreen|booksNotebooks|booksPile)$/.test(id)) {
    const cover = meshes.filter(m => /^Book cover/.test(m.name)).sort((a,b) => bounds(b.points).max[1] - bounds(a.points).max[1])[0];
    const suffix = cover.name.slice('Book cover'.length);
    const points = meshes.filter(mesh => mesh === cover || mesh.name === 'Spine' + suffix || mesh.name === 'Pages' + suffix)
      .flatMap(mesh => mesh.points);
    result.push({ ...bounds(points), footprint: hull(points), kind: 'book' });
  }
  return result;
}
export function derivePlacementBounds() {
  const result = {};
  for (const [id,meta] of Object.entries(catalog)) {
    if (meta.kind==='room') continue;
    const meshes = readModel(id, {triangles:true}), points = meshes.flatMap(mesh=>mesh.points);
    const actual = bounds(points);
    // A bad transform would invalidate the audit, so fail instead of shipping it.
    for(const axis of [0,1,2]) if(actual.min[axis]<meta.min[axis]-.025 || actual.max[axis]>meta.max[axis]+.025)
      throw new Error(`GLB exceeds catalog bounds: ${id}, axis ${axis}`);
    result[id] = {placementHull:hull(points)};
    const physical = meshes.filter(mesh => !/^(Interaction (water|power LED)|Soft teardrop flame|Grate penumbra|Flowing water|Bath water glint|Bathroom (wash ripple|water drop)|Recessed bath water)/.test(mesh.name));
    // Preserve the authored choice to ignore leaves and loose cat-tree toys.
    // All other items use their physical model parts, including animated items.
    const selected = meta.leaves || /^(catTree(Tan|Blue|Pink)|toy-scratchPost)/.test(id)
      ? physical.filter(mesh=>{const b=bounds(mesh.points);return meta.collisionBoxes.some(box=>[0,1,2].every(k=>Math.abs(b.min[k]-box.min[k])<1e-5&&Math.abs(b.max[k]-box.max[k])<1e-5));})
      : physical;
    result[id].placementBoxes = compactPrisms(selected.flatMap(mesh => id==='lampFloorArc' && mesh.name==='Brass arch stem'
      ? curvedPartBoxes(mesh) : placementPrisms(mesh)));
    const openingBounds=(meta.interactionParts??[]).filter(part=>part.mode==='open').flatMap(part=>{
      const points=meshes.filter(mesh=>mesh.ancestors.includes(part.node)).flatMap(mesh=>mesh.points);
      return points.length ? [{node:part.node,...bounds(points)}] : [];
    });
    if(openingBounds.length)result[id].interactionBounds=openingBounds;
    // Only authored horizontal boards can support objects. Brackets, backs,
    // shades and decorative trim must not become accidental placement targets.
    const surfaces = itemSupportSurfaces(id, meshes);
    if (surfaces.length) result[id].supportSurfaces = surfaces;
    const wallMount = meshes.find(mesh => mesh.name === 'Wall backplate');
    if (wallMount) result[id].wallMountBounds = bounds(wallMount.points);
    if (/^(lavaLamp|lampTable|kitchenMixer)/.test(id) || id === 'halloweenGhostLantern') {
      const bases = meshes.filter(mesh => bounds(mesh.points).min[1] <= meta.min[1] + .02)
        .sort((a,b) => bounds(a.points).max[1] - bounds(b.points).max[1]);
      const feet = /^kitchenMixer/.test(id) ? bases : bases.slice(0,1);
      if (feet.length) result[id].baseHull = hull(feet.flatMap(mesh=>mesh.points));
    }
    const use = portableItem(id);
    if (use) {
      result[id].surfaceUse = use;
      // Use the full width of a ball so it cannot balance on a narrow rim.
      // For other objects the lower mesh includes feet, book covers and bases.
      const bottom = points.filter(p => p[1] <= actual.min[1] + .025);
      const base = hull(/Ball$|^yarn/.test(id) ? points : bottom);
      result[id].baseHull = base.length >= 3 ? base : result[id].placementHull;
    }
    // Retain deliberately authored shapes and animation envelopes. Static
    // furniture gets one box per part instead of a box full of empty air.
    if (!meta.collisionBoxes && !meta.animated) result[id].collisionBoxes = meshes.filter(mesh => !/^(Interaction (water|power LED)|Soft teardrop flame|Grate penumbra)/.test(mesh.name)).map(mesh => ({
      ...bounds(mesh.points),
      // Round dining parts must not collide with the empty corners of their box.
      ...(/^(Round oak tabletop|Dining chair seat)$/.test(mesh.name) ? { footprint: hull(mesh.points) } : {}),
    }));
  }
  // Round before rebuilding polygons: clipping can create vertices that become
  // identical at export precision, which must not produce zero-length SAT axes.
  for(const meta of Object.values(result))for(const box of meta.placementBoxes)if(box.footprint) {
    const footprint=hull(box.footprint.map(([x,z])=>[Math.round(x*1e6)/1e6,0,Math.round(z*1e6)/1e6]));
    if(footprint.length>=3)box.footprint=footprint;else delete box.footprint;
  }
  // Color variants share their geometry instead of duplicating placement data.
  const shared = new Map();
  for (const [id,meta] of Object.entries(result)) {
    const key=JSON.stringify(meta.placementBoxes,(_k,v)=>typeof v==='number'?Math.round(v*1e6)/1e6:v);
    if(shared.has(key)){meta.placementBoxesFrom=shared.get(key);delete meta.placementBoxes;}
    else shared.set(key,id);
  }
  return result;
}
if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const result = derivePlacementBounds();
  fs.writeFileSync(path.join(root,'constants/room-placement-bounds.json'),JSON.stringify(result,(_key,value)=>typeof value==='number'?Math.round(value*1e6)/1e6:value)+'\n');
  console.log(`Audited ${Object.keys(result).length} placeable models; added per-part colliders to ${Object.values(result).filter(m=>m.collisionBoxes).length} static models.`);
}
