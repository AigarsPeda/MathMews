/** Build the icon study review sheet, including real menu/button-size samples. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';

const output = path.resolve('docs/art/icon-study');
const icons = [
  ['paw', 'Pet'], ['feed', 'Feed'], ['play', 'Play'], ['sofa', 'Sofa'],
  ['sleep', 'Sleep'], ['puzzles', 'Puzzles'], ['settings', 'Settings'], ['home', 'Home'],
];
const width = 1440, height = 1080;
const labels = icons.map(([name, title], index) => {
  const x = 200 + (index % 4) * 346, y = 400 + Math.floor(index / 4) * 390;
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="25" font-weight="600">${title}</text>
    <text x="${x}" y="${y+100}" text-anchor="middle" font-size="12" fill="#888078">24 px · 32 px · 48 px</text>`;
}).join('');
const sheet = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#FFF5EC"/>
  <g font-family="Avenir Next, Arial, sans-serif" fill="#303638">
    <text x="66" y="66" font-size="13" letter-spacing="3" fill="#A96D5C">MATH MEWS · STUDY 01</text>
    <text x="66" y="124" font-size="44" font-weight="600">A shared icon style for the app</text>
    <text x="66" y="163" font-size="18" fill="#7D7771">Soft shapes, room materials, warm color. Rendered in Blender.</text>
    ${labels}
    <path d="M66 548 H1374" stroke="#E5DCD3"/>
    <path d="M66 958 H1374" stroke="#E5DCD3"/>
    <text x="66" y="1003" font-size="18" font-weight="600">Starter set for review</text>
    <text x="66" y="1036" font-size="16" fill="#7D7771">512 × 512 transparent PNGs · editable Blender scenes · large and small size comparisons</text>
  </g>
</svg>`);
const layers = [];
for (const [index, [name]] of icons.entries()) {
  const filename = path.join(output, `${name}.png`);
  const metadata = await sharp(filename).metadata();
  if (!metadata.hasAlpha || metadata.width !== 512 || metadata.height !== 512) throw new Error(`Invalid icon: ${name}`);
  const { data, info } = await sharp(filename).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let nonEmpty = 0, minX = info.width, minY = info.height, maxX = 0, maxY = 0;
  for (let y=0; y<info.height; y++) for (let x=0; x<info.width; x++) {
    if (data[(y*info.width+x)*4+3] < 10) continue;
    nonEmpty++; minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
  }
  if (nonEmpty === 0 || minX < 8 || minY < 8 || maxX > 504 || maxY > 504) throw new Error(`Empty or clipped icon: ${name}`);
  const centerX = 200+(index%4)*346, top = 204+Math.floor(index/4)*390;
  layers.push({ input: await sharp(filename).resize(192,192).toBuffer(), left: centerX-96, top });
  for (const [size, offset] of [[24,-68],[32,-16],[48,46]]) {
    layers.push({ input: await sharp(filename).resize(size,size).toBuffer(), left: centerX+offset-size/2,
      top: top+236+(48-size)/2 });
  }
}
await sharp(sheet).composite(layers).png().toFile(path.join(output, 'review.png'));
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({
  status: 'review-only', renderer: 'Blender', size: 512,
  source: 'source/starter-icons.blend',
  icons: icons.map(([id, label]) => ({ id, label, file: `${id}.png` })),
}, null, 2)+'\n');
console.log('Verified eight unclipped transparent icons and generated docs/art/icon-study/review.png.');
