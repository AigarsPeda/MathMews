/** Verify source margins and the cat's projected silhouette after the camera edit. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { FILM_KINDS, filmShots } from './3d/achievement-film-edit.mjs';
const root = process.env.REWARD_RENDER_DIR ?? '/tmp/brainpet-reward-studio';
const results = [];
for (const kind of FILM_KINDS) {
  const bounds = [768, 672, 0, 0];
  const shots = await filmShots(root, kind);
  const blocking = JSON.parse(await fs.readFile(`${root}/${kind}/blocking.json`, 'utf8'));
  assert.equal(blocking.length, 48);
  let smallestCatMargin = Infinity;
  for (let n = 0; n < 48; n++) {
    const { data: pixels, info } = await sharp(`${root}/${kind}/frame-${String(n).padStart(2, '0')}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 768); assert.equal(info.height, 672);
    let visible = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (pixels[(y * info.width + x) * 4 + 3] < 128) continue;
      visible++;
      assert.ok(x >= 6 && x < 762 && y >= 6 && y < 666, `${kind} frame ${n}: source artwork clipped at ${x},${y}`);
      bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
    }
    assert.ok(visible > 22500, `${kind} frame ${n}: actor layer missing`);
    const shot = shots[n], cat = blocking[n].catBounds;
    const margin = Math.min(cat[0] - shot.left, cat[1] - shot.top, shot.left + shot.width - cat[2], shot.top + shot.height - cat[3]) * 512 / shot.width;
    assert.ok(margin >= 8, `${kind} frame ${n}: camera crops cat silhouette, margin ${margin.toFixed(1)}px`);
    smallestCatMargin = Math.min(smallestCatMargin, margin);
  }
  const finalMagnification = 768 / shots[47].width;
  assert.ok(finalMagnification >= 1.2, `${kind}: ending must be a closer shot`);
  results.push({ kind, frames: 48, bounds, smallestCatMargin, finalMagnification });
}
await fs.writeFile(`${root}/framing-check.json`, JSON.stringify(results, null, 2) + '\n');
const stages = (await fs.readdir(root)).filter(file => file.endsWith('-stage.png'));
assert.equal(stages.length, 18);
for (const file of stages) {
  const { data, info } = await sharp(`${root}/${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 768); assert.equal(info.height, 672);
  for (let y = 0; y < 672; y++) for (let x = 0; x < 768; x++) if (data[(y * 768 + x) * 4 + 3] >= 128) {
    assert.ok(x >= 6 && x < 762 && y >= 6 && y < 666, `${file}: source stage touches margin`);
  }
}
await fs.writeFile(`${root}/stage-framing-check.json`, JSON.stringify({ stages: stages.length, sourceSafetyMarginPixels: 6, passed: true }, null, 2) + '\n');
console.log('Verified 480 source frames, 18 stages, and full cat silhouettes throughout all ten camera edits.');
