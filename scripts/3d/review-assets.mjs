/** Labelled review boards from the bundled catalog thumbnails. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { Buffer } from 'node:buffer';
const entries=JSON.parse(await fs.readFile('scripts/3d/inventory.json','utf8')).entries.filter(e=>e.kind!=='room');
await fs.mkdir('docs/art/review',{recursive:true});
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
for(let page=0;page<Math.ceil(entries.length/56);page++){
 const cells=[];let labels='';
 for(const [index,entry] of entries.slice(page*56,(page+1)*56).entries()){
  const x=index%7*160,y=Math.floor(index/7)*160;
  const source=entry.animated?`assets/3d/atlases/${entry.id}.png`:`assets/3d/${entry.kind}/${entry.thumbnailId??entry.id}.png`;
  const thumbnail=sharp(source);
  if(entry.animated)thumbnail.extract({left:0,top:0,width:192,height:192});
  cells.push({input:await thumbnail.resize(140,140).png().toBuffer(),left:x+10,top:y});
  labels+=`<text x="${x+80}" y="${y+151}" text-anchor="middle">${escape(entry.id)}</text>`;
 }
 cells.push({input:Buffer.from(`<svg width="1120" height="1280"><g font-family="Arial" font-size="10" fill="#454852">${labels}</g></svg>`),left:0,top:0});
 await sharp({create:{width:1120,height:1280,channels:4,background:'#FFF5EB'}}).composite(cells).png().toFile(`docs/art/review/items-${page+1}.png`);
}
console.log(`Generated ${Math.ceil(entries.length/56)} boards for all ${entries.length} placeable items.`);
