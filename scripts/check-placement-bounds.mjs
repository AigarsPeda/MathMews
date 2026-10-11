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
    assert.equal(derived.collisionBoxes.length,meshes.length,`${id}: no static part is omitted`);
    meshes.forEach((mesh,i)=>{
      const box=derived.collisionBoxes[i];parts++;
      for(const p of mesh.points) for(const k of [0,1,2]) {
        assert.ok(p[k]>=box.min[k]-1e-6&&p[k]<=box.max[k]+1e-6,`${id}/${mesh.name}: collider contains the mesh`);
      }
    });
  }
}
assert.equal(Object.keys(data).length,models,'Removed assets do not retain stale bounds');
const room=readModel('room1');
const floor=room.find(mesh=>mesh.name==='Cream floor').points.filter(p=>p[1]>.06799);
const edge=Math.max(...floor.map(p=>p[0]));
assert.ok(Math.abs(edge-2.46)<1e-5,'Open edge uses the flat floor, before the rounded bevel');
const skirting=room.find(mesh=>mesh.name==='Left skirting');
assert.ok(Math.abs(Math.max(...skirting.points.map(p=>p[0]))+2.3075)<1e-5,'Wall limit follows the skirting inner face');
console.log(`Verified placement hulls for ${models} models and ${parts} static mesh-part colliders against the actual GLBs; retained authored/animated bounds and checked physical room edges.`);
