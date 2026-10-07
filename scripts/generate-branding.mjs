/** Generate app branding from the current native GLB portraits. */
import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'assets/images');
await fs.mkdir(out,{recursive:true});
const portrait=path.join(root,'assets/3d/cat-preview.png');
async function catIcon(file,size,transparent=false,monochrome=false){
 const inner=Math.round(size*.78);let pixels=await sharp(portrait).trim().resize(inner,inner,{fit:'contain',background:'#00000000'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(monochrome)for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=69;pixels.data[i+1]=72;pixels.data[i+2]=82;}
 const png=await sharp(pixels.data,{raw:pixels.info}).png().toBuffer();
 const background=transparent?'#00000000':'#FFF5EB';
 await sharp({create:{width:size,height:size,channels:4,background}}).composite([{input:png,left:Math.round((size-inner)/2),top:Math.round((size-inner)/2)}]).png().toFile(path.join(out,file));
}
if (!process.argv.includes('--splash-only')) {
 await catIcon('icon.png',1024);
 await catIcon('android-icon-foreground.png',1024,true);
 await catIcon('android-icon-monochrome.png',1024,true,true);
}
// Captured at the idle clip's first frame in NativeCatDisplay. Blender's
// lighting/tone mapping cannot reproduce Filament's DefaultLight exactly.
const nativePortrait='docs/art/startup-cat-native.png';
await sharp(path.join(root,nativePortrait)).resize(192,192).png().toFile(path.join(root,'assets/3d/cat-splash.png'));
const sourceFile=path.join(root,'scripts/3d/branding-source.json');
const sources=JSON.parse(await fs.readFile(sourceFile,'utf8'));
for (const file of [nativePortrait,'assets/3d/cat-splash.png'])
 sources[file]=createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
await fs.writeFile(sourceFile,JSON.stringify(sources,null,2)+'\n');
await sharp({create:{width:1,height:1,channels:4,background:'#FFF5EB'}}).png().toFile(path.join(out,'splash-background.png'));
// Native launch branding is available before JavaScript starts. Its transparent
// margins match the cream background rather than introducing letterbox bars.
// A 240 pt square in both the native launch screen and React Native. Its cat
// occupies the same 192 pt window as the bundled startup portrait.
const splashCat=await sharp(path.join(root,'assets/3d/cat-splash.png')).resize(512,512).png().toBuffer();
const title=Buffer.from('<svg width="640" height="112"><text x="320" y="86" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="800" font-size="85.333" fill="#293334">Math Mews</text></svg>');
await sharp({create:{width:640,height:640,channels:4,background:'#00000000'}})
 .composite([{input:splashCat,left:64,top:0},{input:title,left:0,top:528}]).png().toFile(path.join(out,'splash-brand.png'));
// The system launch screen is a centered 320 pt square. Keep the 240 pt
// branding centered inside it and place the empty loading track at center+152.
// iOS shows this asset before any JavaScript or image decoding in React.
const launchBrand=await sharp(path.join(out,'splash-brand.png')).resize(720,720).png().toBuffer();
const launchTrack=Buffer.from('<svg width="720" height="24"><rect width="720" height="24" rx="12" fill="#FFE0CC"/></svg>');
await sharp({create:{width:960,height:960,channels:4,background:'#00000000'}})
 .composite([{input:launchBrand,left:120,top:120},{input:launchTrack,left:120,top:936}]).png().toFile(path.join(out,'splash-launch.png'));
console.log('Generated modern 3D branding.');
