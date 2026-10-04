/** Review facial expressions at room size and check transparent margins. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
const output='docs/art/cat-faces';
const names=['content','happy','petted','curious','surprised','disappointed','sleepy','eating'];
const labels=['Content','Happy','Being petted','Curious','Surprised','Disappointed','Sleeping','Eating'];
const width=1120,height=720,cell=280,layers=[];
const text=labels.map((label,i)=>`<text x="${140+i%4*cell}" y="${345+Math.floor(i/4)*350}" text-anchor="middle" font-size="18" fill="#303638">${label}</text>`).join('');
for(const [i,name] of names.entries()){
 const file=`${output}/${name}.png`,meta=await sharp(file).metadata();
 if(meta.width!==768||meta.height!==768||!meta.hasAlpha)throw new Error(name+' has an invalid render');
 layers.push({input:await sharp(file).resize(260,260).toBuffer(),left:i%4*cell+10,top:Math.floor(i/4)*350+60});
}
await sharp(Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff5ec"/><text x="30" y="38" font-family="Arial" font-size="24" fill="#303638">Math Mews · whiskers and expressions</text>${text}</svg>`)).composite(layers).png().toFile(`${output}/review.png`);
console.log('Generated eight-pose face review.');
