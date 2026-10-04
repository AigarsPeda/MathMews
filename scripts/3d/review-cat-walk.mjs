/** Preview floor travel with the actual packed walk, at the gameplay cadence. */
import fs from 'node:fs/promises';
import sharp from 'sharp';

const width = 480, height = 220, petSize = 160, cell = Math.floor(petSize * .9);
const stride = cell * .5 / 2.7;
const textures = await Promise.all([0, 1].map(page => sharp(`assets/3d/cat-pages/cat-orange-walk-0${page}.webp`).ensureAlpha().raw().toBuffer()));
const floor = Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#FFF5EB"/><g stroke="#ECDDD0" stroke-width="1"><path d="M0 168H480 M0 198H480 M40 150V220 M120 150V220 M200 150V220 M280 150V220 M360 150V220 M440 150V220"/></g><text x="20" y="28" font-family="Arial" font-size="15" fill="#454852">Standing walk with planted paws</text></svg>`);
const frames = [];
for (let i = 0; i < 192; i++) {
  const index = i % 24, leftward = i >= 96;
  let picture = sharp(textures[Math.floor(index / 12)], { raw: { width: 1536, height: 1152, channels: 4 } })
    .extract({ left: index % 4 * 384, top: Math.floor(index % 12 / 4) * 384, width: 384, height: 384 }).resize(cell, cell);
  if (leftward) picture = picture.flop();
  const x = 80 + stride * (leftward ? (192 - i) / 24 : i / 24);
  frames.push(await sharp(floor).composite([{ input: await picture.png().toBuffer(), left: Math.round(x), top: 45 }]).ensureAlpha().raw().toBuffer());
}
await fs.mkdir('docs/art', { recursive: true });
await sharp(Buffer.concat(frames), { raw: { width, height: height * frames.length, channels: 4, pageHeight: height } })
  .gif({ loop: 0, delay: frames.map((_, i) => i % 9 === 0 ? 20 : 30), effort: 7, dither: .3 }).toFile('docs/art/cat-walk.gif');
console.log('Created docs/art/cat-walk.gif from packed walking textures and matched floor travel.');

const cellSize = 230, boardWidth = cellSize * 3, boardHeight = cellSize + 36;
const views = [ ['idle', 'Front', 0], ['walk', 'Side', 8], ['walkAway', 'Rear', 8] ];
const labels = Buffer.from(`<svg width="${boardWidth}" height="${boardHeight}"><g font-family="Arial" font-size="16" fill="#454852" text-anchor="middle">${views.map(([, label], column) => `<text x="${column * cellSize + cellSize / 2}" y="25">${label}</text>`).join('')}</g></svg>`);
const pictures = await Promise.all(views.map(async ([clip, , index]) => {
  const moving = clip !== 'idle', cellsPerPage = moving ? 12 : 4, frameSize = moving ? 384 : 768, columns = moving ? 4 : 2;
  const page = Math.floor(index / cellsPerPage), cellIndex = index % cellsPerPage;
  return sharp(`assets/3d/cat-pages/cat-orange-${clip}-${String(page).padStart(2, '0')}.webp`)
    .extract({ left: cellIndex % columns * frameSize, top: Math.floor(cellIndex / columns) * frameSize, width: frameSize, height: frameSize })
    .resize(cellSize, cellSize).png().toBuffer();
}));
await sharp({ create: { width: boardWidth, height: boardHeight, channels: 4, background: '#FFF5EB' } })
  .composite([{ input: labels, left: 0, top: 0 }, ...pictures.map((input, column) => ({ input, left: column * cellSize, top: 36 }))])
  .png().toFile('docs/art/cat-room-coat.png');
console.log('Created docs/art/cat-room-coat.png with front, side, and rear views from gameplay textures.');
