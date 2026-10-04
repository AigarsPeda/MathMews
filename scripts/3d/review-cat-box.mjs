/** Review every coat and box clip using rebuilt frames. */
import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';

const skins = ['orange', 'grey', 'white'];
const poses = [['box1', 9], ['box2', 15], ['box3', 24]];
const cellSize = 320, rowHeight = 350;
const composites = [];
let labels = '';
for (const [row, [clip, frame]] of poses.entries()) {
  for (const [column, skin] of skins.entries()) {
    const left = column * cellSize, top = row * rowHeight;
    const source = `assets/3d/frames/cat-${skin}-${clip}/${String(frame).padStart(3, '0')}.png`;
    composites.push({ input: await sharp(source).resize(cellSize, cellSize).png().toBuffer(), left, top });
    labels += `<text x="${left + cellSize / 2}" y="${top + cellSize + 18}">${skin} · ${clip} · frame ${frame + 1}</text>`;
  }
}
composites.push({
  input: Buffer.from(`<svg width="960" height="1050"><g font-family="Arial" font-size="14" fill="#454852" text-anchor="middle">${labels}</g></svg>`),
  left: 0, top: 0,
});
await fs.mkdir('docs/art', { recursive: true });
await sharp({ create: { width: 960, height: 1050, channels: 4, background: '#FFF5EB' } })
  .composite(composites).png().toFile('docs/art/cat-box-keyposes.png');
console.log('Reviewed all nine box clips in docs/art/cat-box-keyposes.png.');
