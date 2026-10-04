/** Labelled review boards for every placeable item and expressive cat key poses. */
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
  const animated=entry.animated||['toy-orangeBall','toy-blueBall','toy-pinkBall','toy-mouse'].includes(entry.id);
  const source=animated?`assets/3d/frames/${entry.id}/000.png`:`assets/3d/${entry.kind}/${entry.id}.png`;
  cells.push({input:await sharp(source).resize(140,140).png().toBuffer(),left:x+10,top:y});
  labels+=`<text x="${x+80}" y="${y+151}" text-anchor="middle">${escape(entry.id)}</text>`;
 }
 cells.push({input:Buffer.from(`<svg width="1120" height="1280"><g font-family="Arial" font-size="10" fill="#454852">${labels}</g></svg>`),left:0,top:0});
 await sharp({create:{width:1120,height:1280,channels:4,background:'#FFF5EB'}}).composite(cells).png().toFile(`docs/art/review/items-${page+1}.png`);
}
const poses=[['idle',0,'Curious idle'],['correct',5,'Crouch'],['correct',15,'First hop'],['correct',36,'Paw wave'],['incorrect',17,'Puzzled'],['incorrect',39,'Ready to retry'],['lieDown',43,'Lying down'],['sleep',24,'Sleeping']];
const cells=[];let labels='';
for(const [index,[state,frame,label]] of poses.entries()){
 const x=index%4*256,y=Math.floor(index/4)*280;
 const source=`assets/3d/frames/cat-orange-${state}/${String(frame).padStart(3,'0')}.png`;
 cells.push({input:await sharp(source).resize(256,256).png().toBuffer(),left:x,top:y});
 labels+=`<text x="${x+128}" y="${y+270}" text-anchor="middle">${label}</text>`;
}
cells.push({input:Buffer.from(`<svg width="1024" height="560"><g font-family="Arial" font-size="15" fill="#454852">${labels}</g></svg>`),left:0,top:0});
await sharp({create:{width:1024,height:560,channels:4,background:'#FFF5EB'}}).composite(cells).png().toFile('docs/art/cat-motion-keyposes.png');
console.log(`Generated key poses and ${Math.ceil(entries.length/56)} boards for all ${entries.length} placeable items.`);
