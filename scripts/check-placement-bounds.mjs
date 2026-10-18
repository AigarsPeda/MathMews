/** Audit placement data against every shipped mesh, including the room edges. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readModel } from './3d/build-placement-bounds.mjs';
import { placementPrisms, compactPrisms } from './3d/placement-shapes.mjs';
const catalog=JSON.parse(fs.readFileSync('assets/3d/native/catalog.json'));
const data=JSON.parse(fs.readFileSync('constants/room-placement-bounds.json'));
for(const meta of Object.values(data))if(meta.placementBoxesFrom) {
  assert.ok(data[meta.placementBoxesFrom]?.placementBoxes,'Shared placement shapes resolve directly to a model');
  meta.placementBoxes=data[meta.placementBoxesFrom].placementBoxes;
}
const contains=(box,p)=>[0,1,2].every(k=>p[k]>=box.min[k]-2e-6&&p[k]<=box.max[k]+2e-6)
  && (!box.footprint||box.footprint.every((a,i,poly)=>{const b=poly[(i+1)%poly.length];return (b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-2e-6;}));
// A thick closed ring exercises both its open center and its solid interior.
// Surface-only partitions would let a small decoration disappear inside the rim.
{
  const triangles=[],segments=24;
  const point=(radius,angle,y)=>[radius*Math.cos(angle),y,radius*Math.sin(angle)];
  const quad=(a,b,c,d)=>triangles.push([a,b,c],[a,c,d]);
  for(let i=0;i<segments;i++) {
    const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
    const lo=[point(.5,a,0),point(1,a,0),point(1,b,0),point(.5,b,0)];
    const hi=lo.map(([x,,z])=>[x,.5,z]);
    quad(...lo);quad(...hi);
    quad(lo[0],lo[3],hi[3],hi[0]);quad(lo[1],hi[1],hi[2],lo[2]);
  }
  const shapes=compactPrisms(placementPrisms({points:triangles.flat(),triangles}));
  assert.ok(!shapes.some(box=>contains(box,[0,.25,0])),'A concave ring keeps its open center');
  for(const y of [.05,.25,.45])for(let i=0;i<segments;i++) {
    const p=point(.75,(i+.5)*Math.PI*2/segments,y);
    assert.ok(shapes.some(box=>contains(box,p)),'Closed physical parts retain filled interiors');
  }
}
let models=0, parts=0, placements=0;
const uncovered=[];
for(const [id,meta] of Object.entries(catalog)) {
  if(meta.kind==='room') continue;
  models++;
  const meshes=readModel(id,{triangles:true}), derived=data[id];
  assert.ok(derived?.placementHull.length>=3,`${id} has a footprint`);
  assert.ok(derived.placementHull.every(p=>p.length===2&&p.every(Number.isFinite)));
  for(const box of derived.placementBoxes??[]) {
    placements++;
    if(box.footprint)assert.ok(box.footprint.length>=3);
    box.footprint?.forEach((p,i,polygon)=>{
      const next=polygon[(i+1)%polygon.length];
      assert.ok(p.every(Number.isFinite)&&Math.hypot(p[0]-next[0],p[1]-next[1])>1e-8,`${id}: rounded placement polygons have finite, nonzero collision axes`);
    });
  }
  const boards = meshes.filter(mesh=>/^(Rounded tabletop|Wall shelf(?:\.\d+)?|Shelf(?:\.\d+)?|Broad fireplace mantel|Thick stone worktop(?:\.\d+)?)$/.test(mesh.name));
  assert.equal(derived.supportSurfaces?.length ?? 0,boards.length,`${id}: support surfaces match authored boards`);
  boards.forEach((board,i)=>{
    const surface=derived.supportSurfaces[i];
    for(const k of [0,1,2]) {
      assert.ok(Math.abs(surface.min[k]-Math.min(...board.points.map(p=>p[k])))<1e-6);
      assert.ok(Math.abs(surface.max[k]-Math.max(...board.points.map(p=>p[k])))<1e-6);
    }
  });
  const backplate=meshes.find(mesh=>mesh.name==='Wall backplate');
  if(backplate) for(const k of [0,1,2]) {
    assert.ok(Math.abs(derived.wallMountBounds.min[k]-Math.min(...backplate.points.map(p=>p[k])))<1e-6);
    assert.ok(Math.abs(derived.wallMountBounds.max[k]-Math.max(...backplate.points.map(p=>p[k])))<1e-6);
  }
  else assert.equal(derived.wallMountBounds,undefined);
  for(const mesh of meshes) for(const point of mesh.points) {
    for(let i=0;i<derived.placementHull.length;i++) {
      const a=derived.placementHull[i],b=derived.placementHull[(i+1)%derived.placementHull.length];
      const cross=(b[0]-a[0])*(point[2]-a[1])-(b[1]-a[1])*(point[0]-a[0]);
      assert.ok(cross>=-1e-5,`${id}: footprint encloses actual geometry`);
    }
  }
  if(meta.collisionBoxes || meta.animated) assert.equal(derived.collisionBoxes,undefined,`${id}: keep authored shapes/animation envelope`);
  else {
    const physicalMeshes=meshes.filter(mesh=>!/^Interaction (water|power LED)/.test(mesh.name));
    assert.equal(derived.collisionBoxes.length,physicalMeshes.length,`${id}: physical parts collide; water and status lights do not`);
    physicalMeshes.forEach((mesh,i)=>{
      const box=derived.collisionBoxes[i];parts++;
      if (/^(Round oak tabletop|Dining chair seat)$/.test(mesh.name)) {
        assert.ok(box.footprint.length > 8, 'Round dining parts retain their curved outline');
        for (const p of mesh.points) for (let edge=0;edge<box.footprint.length;edge++) {
          const a=box.footprint[edge],b=box.footprint[(edge+1)%box.footprint.length];
          assert.ok((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-1e-5,
            `${id}/${mesh.name}: collider footprint encloses the authored mesh`);
        }
      }
      for(const p of mesh.points) for(const k of [0,1,2]) {
        assert.ok(p[k]>=box.min[k]-1e-6&&p[k]<=box.max[k]+1e-6,`${id}/${mesh.name}: collider contains the mesh`);
      }
    });
  }
  const physical=meshes.filter(mesh=>!/^(Interaction (water|power LED)|Flowing water|Bath water glint|Bathroom (wash ripple|water drop)|Recessed bath water)/.test(mesh.name));
  const selected=meta.leaves||/^(catTree(Tan|Blue|Pink)|toy-scratchPost)/.test(id)
    ? physical.filter(mesh=>meta.collisionBoxes.some(box=>[0,1,2].every(k=>
      Math.abs(Math.min(...mesh.points.map(p=>p[k]))-box.min[k])<1e-5&&Math.abs(Math.max(...mesh.points.map(p=>p[k]))-box.max[k])<1e-5))) : physical;
  assert.ok(derived.placementBoxes.length>0,`${id}: every model has placement geometry`);
  for(const mesh of selected) {
    // Vertices and triangle centers catch missing caps, narrow parts and slices.
    const samples=[...mesh.points,...mesh.triangles.map(t=>[0,1,2].map(k=>t.reduce((v,p)=>v+p[k],0)/3))];
    for(const p of samples)if(!derived.placementBoxes.some(box=>contains(box,p))){uncovered.push(`${id}/${mesh.name} at ${p}`);break;}
  }
}
assert.deepEqual(uncovered,[],'Every physical mesh retains vertex and triangle-center coverage');
const lampBoxes=data.lampFloorArc.placementBoxes;
const base=lampBoxes.find(box=>box.min[1]===0);
assert.ok(base.footprint.length>=24,'The floor-lamp base has its actual rounded footprint');
console.log(`Verified placement coverage of vertices and triangle centers for all ${models} models (${placements} prisms), shared variants, rounded footprints and navigation bounds.`);
assert.equal(Object.keys(data).length,models,'Removed assets do not retain stale bounds');
const room=readModel('room1');
const floor=room.find(mesh=>mesh.name==='Cream floor').points.filter(p=>p[1]>.06799);
const edge=Math.max(...floor.map(p=>p[0]));
assert.ok(Math.abs(edge-2.46)<1e-5,'Open edge uses the flat floor, before the rounded bevel');
const skirting=room.find(mesh=>mesh.name==='Left skirting');
assert.ok(Math.abs(Math.max(...skirting.points.map(p=>p[0]))+2.3075)<1e-5,'Wall limit follows the skirting inner face');
console.log(`Verified placement hulls for ${models} models and ${parts} static mesh-part colliders against the actual GLBs; retained authored/animated bounds and checked physical room edges.`);
