import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
const files = ['assets/3d/cat-pages','assets/3d/play-prop-pages'].flatMap(dir=>fs.readdirSync(dir).filter(file=>file.endsWith('.webp')).map(file=>`${dir}/${file}`));
const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
assert.ok(bytes <= 120 * 1024 ** 2, 'Cat textures exceed the 120 MiB compressed budget');
let largestDecoded = 0;
for (let start = 0; start < files.length; start += 32) {
  const metadata = await Promise.all(files.slice(start, start + 32).map(file => sharp(file).metadata()));
  for (const image of metadata) largestDecoded = Math.max(largestDecoded, image.width * image.height * 4);
}
assert.ok(largestDecoded <= 9 * 1024 ** 2, 'A decoded page exceeds the 9 MiB RGBA budget');
console.log(`Cat and play-prop texture budget: ${files.length} pages, ${(bytes / 1024 ** 2).toFixed(2)} MiB compressed; largest page ${(largestDecoded / 1024 ** 2).toFixed(2)} MiB decoded. Each active layer retains its current/next pages only.`);
