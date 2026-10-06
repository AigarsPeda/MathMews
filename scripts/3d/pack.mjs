/** Pack the eight-frame furniture/toy thumbnails and discard intermediate PNGs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const out = 'assets/3d';
const { entries } = JSON.parse(await fs.readFile('scripts/3d/inventory.json', 'utf8'));
await fs.mkdir(path.join(out, 'atlases'), { recursive: true });
for (const entry of entries) {
  if (!entry.animated) continue;
  const frames = path.join(out, 'frames', entry.id);
  if (!await fs.access(frames).then(() => true, () => false)) continue;
  const cells = await Promise.all(Array.from({ length: 8 }, (_, index) =>
    sharp(path.join(frames, String(index).padStart(3, '0') + '.png'))
      .resize(192, 192).ensureAlpha().raw().toBuffer(),
  ));
  // Copy rows rather than blending: translucent edges keep their exact pixels.
  const pixels = Buffer.alloc(1536 * 192 * 4);
  for (const [index, cell] of cells.entries()) {
    for (let row = 0; row < 192; row++) {
      cell.copy(pixels, (row * 1536 + index * 192) * 4, row * 192 * 4, (row + 1) * 192 * 4);
    }
  }
  await sharp(pixels, { raw: { width: 1536, height: 192, channels: 4 } })
    .png({ compressionLevel: 9 }).toFile(path.join(out, 'atlases', entry.id + '.png'));
  await fs.rm(frames, { recursive: true });
}
await fs.rmdir(path.join(out, 'frames')).catch(error => {
  if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error;
});
console.log('Packed catalog thumbnails; intermediate frames removed. Native cats use GLBs.');
