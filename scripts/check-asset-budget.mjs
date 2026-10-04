import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
const dir = 'assets/3d/cat-pages';
const files = fs.readdirSync(dir).filter(file => file.endsWith('.webp'));
const bytes = files.reduce((sum, file) => sum + fs.statSync(`${dir}/${file}`).size, 0);
assert.ok(bytes <= 120 * 1024 ** 2, 'Cat textures exceed the 120 MiB compressed budget');
let largestDecoded = 0;
for (let start = 0; start < files.length; start += 32) {
  const metadata = await Promise.all(files.slice(start, start + 32).map(file => sharp(`${dir}/${file}`).metadata()));
  for (const image of metadata) largestDecoded = Math.max(largestDecoded, image.width * image.height * 4);
}
assert.ok(largestDecoded <= 9 * 1024 ** 2, 'A decoded page exceeds the 9 MiB RGBA budget');
console.log(`Cat texture budget: ${files.length} pages, ${(bytes / 1024 ** 2).toFixed(2)} MiB compressed; largest page ${(largestDecoded / 1024 ** 2).toFixed(2)} MiB decoded. Runtime retains current/next pages only.`);
