/** Register usable furniture tops from the shipped mesh geometry. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readModel} from './build-placement-bounds.mjs';
import {bounds,hull} from './placement-shapes.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'assets/3d/native/catalog.json')));
export function buildCatFurniture() {
  const result={};
  for(const id of Object.keys(catalog)) {
    if(!/^(chair(Office|Classic|Gaming)|kitchenBarStool|bedroom(Bench|Dresser|Nightstand|Wardrobe|Vanity|QuiltChest)$|table(Tan|Pink|Blue|Purple)$|desk|japanese(Table|Shelf)$|living(SmallTable|Table)$|office(DrawingTable|KitchenTable)$|kitchenDiningTable$|kitchenModernFloorShelf)/.test(id))continue;
    const meshes=readModel(id);
    const surfaces=meshes.filter(m=>/^(Seat|Rounded bar stool seat|Mint bar stool seat|Tufted bench cushion|Rounded tabletop|Round oak tabletop|Rounded cabinet top|Vanity tabletop|Chest lid|Wall shelf|Thick stone worktop)$/.test(m.name))
      .map(m=>({...bounds(m.points),footprint:hull(m.points)}));
    if(!surfaces.length)throw new Error(`Missing cat support surface: ${id}`);
    const back=meshes.find(m=>/^(Backrest|Low mint stool back|Velvet bar stool back)$/.test(m.name));
    let front=0;
    if(back) {
      const b=bounds(back.points),seat=surfaces[0];
      front=Math.atan2(seat.min[0]+seat.max[0]-b.min[0]-b.max[0],seat.min[2]+seat.max[2]-b.min[2]-b.max[2]);
    }
    else if(surfaces[0].max[0]-surfaces[0].min[0]>(surfaces[0].max[2]-surfaces[0].min[2])*1.25)front=Math.PI/2;
    result[id]={front,allSides:!back,surfaces};
  }
  return JSON.parse(JSON.stringify(result,(_k,v)=>typeof v==='number'?Math.round(v*1e6)/1e6:v));
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const result=buildCatFurniture();
  fs.writeFileSync(path.join(root,'constants/cat-furniture-surfaces.json'),JSON.stringify(result)+'\n');
  console.log(`Registered mesh-derived cat perches on ${Object.keys(result).length} chairs, stools, benches, tables and desks.`);
}
