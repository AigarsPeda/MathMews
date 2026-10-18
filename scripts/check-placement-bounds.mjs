/** Audit placement data against every shipped mesh, including the room edges. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readModel } from './3d/build-placement-bounds.mjs';
const catalog=JSON.parse(fs.readFileSync('assets/3d/native/catalog.json'));
const data=JSON.parse(fs.readFileSync('constants/room-placement-bounds.json'));
let models=0, parts=0;
for(const [id,meta] of Object.entries(catalog)) {
  if(meta.kind==='room') continue;
  models++;
  const meshes=readModel(id), derived=data[id];
  assert.ok(derived?.placementHull.length>=3,`${id} has a footprint`);
  assert.ok(derived.placementHull.every(p=>p.length===2&&p.every(Number.isFinite)));
  for(const box of derived.placementBoxes??[]) {
    assert.ok(box.footprint.length>=3);
    box.footprint.forEach((p,i,polygon)=>{
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
  if (meta.leaves) {
    assert.equal(derived.placementBoxes.length,meta.collisionBoxes.length,`${id}: decorating retains all solid planter parts`);
    derived.placementBoxes.forEach((box,i)=>{
      assert.deepEqual(box.min,meta.collisionBoxes[i].min.map(v=>Math.round(v*1e6)/1e6));
      assert.deepEqual(box.max,meta.collisionBoxes[i].max.map(v=>Math.round(v*1e6)/1e6));
      assert.ok(box.footprint?.length>=8,`${id}: round planters do not acquire square corners`);
    });
  }
}
const lamp=readModel('lampFloorArc',{triangles:true});
const lampBoxes=data.lampFloorArc.placementBoxes;
const contains=(box,p)=>[0,1,2].every(k=>p[k]>=box.min[k]-1e-6&&p[k]<=box.max[k]+1e-6)
  && box.footprint.every((a,i,poly)=>{const b=poly[(i+1)%poly.length];return (b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-1e-6;});
for(const mesh of lamp)for(const triangle of mesh.triangles)
  assert.ok(lampBoxes.some(box=>triangle.every(p=>contains(box,p))),`${mesh.name}: every physical triangle remains inside a placement collider`);
for(const box of lampBoxes.filter(box=>box.max[2]-box.min[2]<.06))for(const k of [0,1,2])
  assert.ok(box.max[k]-box.min[k]<.18,'Stem cells never fill the empty space under the arch');
const base=lampBoxes.find(box=>box.min[1]===0);
assert.ok(base.footprint.length>=24,'The floor-lamp base has its actual rounded footprint');
console.log('Verified round lamp bases and planters, small arch cells, and complete triangle coverage of the lamp without removing physical parts.');
assert.equal(Object.keys(data).length,models,'Removed assets do not retain stale bounds');
const room=readModel('room1');
const floor=room.find(mesh=>mesh.name==='Cream floor').points.filter(p=>p[1]>.06799);
const edge=Math.max(...floor.map(p=>p[0]));
assert.ok(Math.abs(edge-2.46)<1e-5,'Open edge uses the flat floor, before the rounded bevel');
const skirting=room.find(mesh=>mesh.name==='Left skirting');
assert.ok(Math.abs(Math.max(...skirting.points.map(p=>p[0]))+2.3075)<1e-5,'Wall limit follows the skirting inner face');
console.log(`Verified placement hulls for ${models} models and ${parts} static mesh-part colliders against the actual GLBs; retained authored/animated bounds and checked physical room edges.`);
