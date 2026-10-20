/** Transparent WebP atlases keep 162 separate Blender animations small on the phone. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { registerBossScenes } from './register-boss-scenes.mjs';
import { packAchievementMedia } from './pack-achievement-media.mjs';
const specs=JSON.parse(await fs.readFile('data/lesson-boss-scenes.json','utf8'));
const input=process.env.BRAINPET_LESSON_BOSS_RENDER_DIR??'/tmp/brainpet-lesson-boss-renders';
const selected=process.argv.includes('--id')?specs.filter(s=>process.argv[process.argv.indexOf('--id')+1].split(',').includes(s.id)):specs;
const watching=process.argv.includes('--watch');
const done=new Set();
async function pack(id) {
 const from=path.join(input,id),to=path.join('assets/3d/bosses',id);
 await fs.mkdir(to,{recursive:true});
 for(let n=0;n<4;n++) await sharp(path.join(from,`state-${n}.png`)).webp({quality:88,alphaQuality:100,effort:5}).toFile(path.join(to,`state-${n}.webp`));
 for(const [prefix,count] of [['reaction-1',8],['reaction-2',8],['outcome',16]]) {
  const frames=Array.from({length:count},(_,n)=>({input:path.join(from,`${prefix}-${String(n).padStart(2,'0')}.png`),left:n%4*512,top:Math.floor(n/4)*320}));
  await sharp({create:{width:2048,height:count/4*320,channels:4,background:'#00000000'}}).composite(frames).webp({quality:86,alphaQuality:100,effort:5}).toFile(path.join(to,`${prefix}.webp`));
 }
 for(const file of ['cat-staging.json','lesson-staging.json']) await fs.copyFile(path.join(from,file),path.join(to,file));
 console.log(`Packed ${id}`);
}
do {
 for(const {id} of selected) {
  if(done.has(id)) continue;
  if(watching && !await fs.access(path.join(input,id,'lesson-staging.json')).then(()=>true,()=>false)) continue;
  await pack(id);done.add(id);
 }
 if(done.size===selected.length) break;
 if(!watching) throw new Error('Missing Blender scene output');
 await new Promise(resolve=>setTimeout(resolve,5000));
} while(watching);
await registerBossScenes();
await packAchievementMedia([...done]);
console.log(`Registered ${done.size} individual lesson bosses and the eighteen existing finales.`);
