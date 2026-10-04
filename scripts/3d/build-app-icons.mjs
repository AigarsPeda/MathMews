/** Ship compact PNG assets while keeping editable Blender scenes out of the bundle. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const output = path.resolve('assets/icons');
await fs.mkdir(output, { recursive: true });
const starter = ['paw','feed','play','sofa','sleep','puzzles','settings','home'];
for (const name of starter) await sharp(`docs/art/icon-study/${name}.png`).resize(256,256).png().toFile(`${output}/${name}.png`);
for (const file of await fs.readdir('docs/art/app-icons')) {
  if (file.endsWith('.png') && file !== 'review.png') await sharp(`docs/art/app-icons/${file}`).resize(256,256).png().toFile(`${output}/${file}`);
}
for (const name of ['store','stats']) await sharp(`assets/images/${name}-icon.png`).trim().resize(224,224,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).extend({top:16,bottom:16,left:16,right:16,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(`${output}/${name}.png`);
const names = (await fs.readdir(output)).filter(file=>file.endsWith('.png')).map(file=>path.basename(file,'.png')).sort();
await fs.writeFile('constants/app-icons.ts', `/** Original Blender renders. Keep static requires so Metro bundles every icon. */\nexport const APP_ICON_SOURCES = {\n${names.map(name=>`  "${name}": require("@/assets/icons/${name}.png"),`).join('\n')}\n} as const satisfies Record<string, number>;\n\nexport type AppIconName = keyof typeof APP_ICON_SOURCES;\n`);
console.log(`Prepared ${names.length} app icons at 256px.`);
const cols=8, cell=140, rows=Math.ceil(names.length/cols), layers=[];
const labels=names.map((name,i)=>`<text x="${i%cols*cell+cell/2}" y="${Math.floor(i/cols)*cell+127}" text-anchor="middle" font-size="12" fill="#303638">${name}</text>`).join('');
for (const [i,name] of names.entries()) layers.push({input:await sharp(`${output}/${name}.png`).resize(96,96).toBuffer(),left:i%cols*cell+22,top:Math.floor(i/cols)*cell+10});
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cols*cell}" height="${rows*cell}"><rect width="100%" height="100%" fill="#fff5ec"/>${labels}</svg>`)).composite(layers).png().toFile('docs/art/app-icons/review.png');
await fs.writeFile('docs/art/app-icons/manifest.json', JSON.stringify({renderer:'Blender',size:256,status:'in-app',sources:['../icon-study/source/starter-icons.blend','source/icons.blend'],icons:names},null,2)+'\n');
