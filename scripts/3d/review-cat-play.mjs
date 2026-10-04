/** Review the new play choices using the packed gameplay textures. */
import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';

const clips = ['ballToss', 'yarnRoll', 'featherChase'];
const timings = JSON.parse(await fs.readFile('scripts/3d/clips.json', 'utf8'));
const cell = 280, width = cell * clips.length, height = cell + 32;
const cache = new Map();
async function frame(skin, clip, index) {
  const page = Math.floor(index / 4), key = `${skin}/${clip}`;
  let decoded = cache.get(key);
  if (decoded?.page !== page) {
    decoded = { page, pixels: await sharp(`assets/3d/cat-pages/cat-${skin}-${clip}-${String(page).padStart(2, '0')}.webp`).ensureAlpha().raw().toBuffer() };
    cache.set(key, decoded);
  }
  const cat = await sharp(decoded.pixels, { raw: { width: 1536, height: 1536, channels: 4 } })
    .extract({ left: index % 2 * 768, top: Math.floor(index % 4 / 2) * 768, width: 768, height: 768 })
    .resize(cell, cell).png().toBuffer();
  const prop = await sharp(`assets/3d/play-prop-pages/${skin}-${clip}-${String(Math.floor(index/12)).padStart(2,'0')}.webp`)
    .extract({left:index%4*192,top:Math.floor(index%12/4)*192,width:192,height:192}).resize(cell,cell).png().toBuffer();
  return sharp(cat).composite([{input:prop}]).png().toBuffer();
}
const labels = Buffer.from(`<svg width="${width}" height="${height}"><g font-family="Arial" font-size="16" fill="#454852" text-anchor="middle"><text x="140" y="23">Ball toss</text><text x="420" y="23">Yarn roll</text><text x="700" y="23">Feather chase</text></g></svg>`);
for (const skin of ['orange', 'grey', 'white']) {
  const frames = [];
  for (let i = 0; i < 144; i += 2) {
    const pictures = await Promise.all(clips.map(clip => frame(skin, clip, Math.min(i, timings[clip][0] - 1))));
    frames.push(await sharp({ create: { width, height, channels: 4, background: '#FFF5EB' } })
      .composite([{ input: labels, left: 0, top: 0 }, ...pictures.map((input, column) => ({ input, left: column * cell, top: 32 }))])
      .raw().toBuffer());
  }
  await sharp(Buffer.concat(frames), { raw: { width, height: height * frames.length, channels: 4, pageHeight: height } })
    .gif({ loop: 0, delay: frames.map((_, i) => i % 3 === 0 ? 90 : 80), effort: 7, dither: .3 })
    .toFile(`docs/art/cat-play-${skin}.gif`);
  cache.clear();
}
console.log('Reviewed packed play animations for all coats in docs/art/cat-play-*.gif.');
