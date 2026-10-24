import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const catalog = JSON.parse(await fs.readFile('assets/3d/bosses/catalog.json', 'utf8'));
const mapping = await fs.readFile('constants/achievement-media.ts', 'utf8');
assert.equal(catalog.scenes.length, 180);
let total = 0;
for (const id of catalog.scenes) {
  assert.ok(mapping.includes(`"${id}":`), `${id}: native media registration`);
  const locked = await sharp(path.join('assets/achievements', `${id}-locked.webp`)).ensureAlpha().raw().toBuffer();
  let opaque = 0;
  for (let pixel = 0; pixel < locked.length; pixel += 4) {
    if (locked[pixel + 3] < 200) continue;
    opaque++;
    assert.ok(Math.abs(locked[pixel] - locked[pixel + 1]) <= 2 && Math.abs(locked[pixel] - locked[pixel + 2]) <= 2, `${id}: locked preview must be gray`);
  }
  assert.ok(opaque > 1000, `${id}: locked preview retains visible artwork`);
  const poster = await sharp(path.join('assets/achievements', `${id}-poster.webp`)).metadata();
  assert.equal(poster.width, 512); assert.equal(poster.height, 448);
  assert.ok(mapping.includes(`poster: require("@/assets/achievements/${id}-poster.webp")`));
  const gif = path.join('assets/achievements', `${id}.gif`);
  const metadata = await sharp(gif, { animated: true }).metadata();
  assert.equal(metadata.width, 512); assert.equal(metadata.pageHeight, 448);
  assert.ok(metadata.pages >= 24 && metadata.pages <= 48, `${id}: animated ending`);
  assert.equal(metadata.loop, 0); assert.equal(metadata.delay.reduce((a, b) => a + b, 0), 6000);
  assert.equal(metadata.hasAlpha, true, `${id}: sticker transparency`);
  const { data, info } = await sharp(gif, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const stride = info.width * metadata.pageHeight * 4;
  const frames = new Set(Array.from({ length: metadata.pages }, (_, i) => createHash('sha256').update(data.subarray(i * stride, (i + 1) * stride)).digest('hex')));
  assert.ok(frames.size >= 24, `${id}: GIF must retain motion`);
  const bytes = (await fs.stat(gif)).size;
  assert.ok(bytes < 1024 * 1024, `${id}: share file stays below 1 MiB`); total += bytes;
}
assert.ok(total < 120 * 1024 * 1024, 'The complete offline share collection stays below 120 MiB');
console.log(`Verified 180 gray previews and animated transparent GIFs, ${(total / 1024 / 1024).toFixed(2)} MiB.`);
