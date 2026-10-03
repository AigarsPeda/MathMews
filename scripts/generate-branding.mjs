/** Generate app branding from the original Blender cat and miniature models. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'assets/images');
await fs.mkdir(out,{recursive:true});
const portrait=path.join(root,'assets/3d/cat-preview.png');
async function catIcon(file,size,transparent=false,monochrome=false){
 const inner=Math.round(size*.78);let pixels=await sharp(portrait).trim().resize(inner,inner,{fit:'contain'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(monochrome)for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=69;pixels.data[i+1]=72;pixels.data[i+2]=82;}
 const png=await sharp(pixels.data,{raw:pixels.info}).png().toBuffer();
 const background=transparent?'#00000000':'#FFF5EB';
 await sharp({create:{width:size,height:size,channels:4,background}}).composite([{input:png,left:Math.round((size-inner)/2),top:Math.round((size-inner)/2)}]).png().toFile(path.join(out,file));
}
await catIcon('icon.png',1024);
await catIcon('favicon.png',48);
await catIcon('android-icon-foreground.png',1024,true);
await catIcon('android-icon-monochrome.png',1024,true,true);
for(const id of ['store','stats'])await sharp(path.join(root,`assets/3d/${id}-icon.png`)).trim().resize(256,256,{fit:'contain',background:'#00000000'}).png().toFile(path.join(out,`${id}-icon.png`));
await sharp({create:{width:1,height:1,channels:4,background:'#FFF5EB'}}).png().toFile(path.join(out,'splash-background.png'));
console.log('Generated modern 3D branding.');
