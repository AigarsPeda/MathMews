/** Review the actual packed gameplay frames, including all three box segments. */
import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';

const cell = 280, width = cell * 3, height = cell + 32;
const cache = new Map();
const timings = JSON.parse(await fs.readFile('scripts/3d/clips.json', 'utf8'));
const boxClips = ['box1', 'box2', 'box3'];
const boxLength = boxClips.reduce((sum, id) => sum + timings[id][0], 0);
async function frame(skin, clip, index, size = cell) {
  const page = Math.floor(index / 4);
  const file = `assets/3d/cat-pages/cat-${skin}-${clip}-${String(page).padStart(2, '0')}.webp`;
  let decoded = cache.get(`${skin}/${clip}`);
  if (decoded?.page !== page) {
    decoded = { page, pixels: await sharp(file).ensureAlpha().raw().toBuffer() };
    cache.set(`${skin}/${clip}`, decoded);
  }
  return sharp(decoded.pixels, { raw: { width: 1536, height: 1536, channels: 4 } })
    .extract({ left: (index % 2) * 768, top: Math.floor((index % 4) / 2) * 768, width: 768, height: 768 })
    .resize(size, size).png().toBuffer();
}
function boxFrame(index) {
  for (const clip of boxClips) {
    if (index < timings[clip][0]) return [clip, index];
    index -= timings[clip][0];
  }
  throw new Error('Box preview exceeds the story duration');
}
await fs.mkdir('docs/art', { recursive: true });
for (const skin of ['orange', 'grey', 'white']) {
  const labels = Buffer.from(`<svg width="${width}" height="${height}"><g font-family="Arial" font-size="16" fill="#454852" text-anchor="middle"><text x="140" y="23">Petting</text><text x="420" y="23">Box play</text><text x="700" y="23">Eating</text></g></svg>`);
  const frames = [];
  for (let i = 0; i < boxLength; i += 2) {
    const [boxClip, boxIndex] = boxFrame(i);
    const pictures = await Promise.all([
      frame(skin, 'excited', Math.min(i % 84, 59)),
      frame(skin, boxClip, boxIndex),
      frame(skin, 'eating', Math.min(i % (timings.eating[0] + 24), timings.eating[0] - 1)),
    ]);
    frames.push(await sharp({ create: { width, height, channels: 4, background: '#FFF5EB' } })
      .composite([{ input: labels, left: 0, top: 0 }, ...pictures.map((input, column) => ({ input, left: column * cell, top: 32 }))])
      .raw().toBuffer());
  }
  await sharp(Buffer.concat(frames), { raw: { width, height: height * frames.length, channels: 4, pageHeight: height } })
    .gif({ loop: 0, delay: frames.map((_, i) => i % 3 === 0 ? 90 : 80), effort: 7, dither: .3 })
    .toFile(`docs/art/cat-care-${skin}.gif`);
  cache.clear();
}
console.log('Reviewed packed care animations for all three coats in docs/art/cat-care-*.gif.');
