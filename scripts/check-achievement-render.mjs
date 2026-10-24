/** Check image framing. Skin/prop contact has a separate Blender validator. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
const root = process.env.REWARD_RENDER_DIR ?? '/tmp/brainpet-reward-studio';
const kinds = ['bridge', 'book', 'loom', 'clock', 'balloon', 'sorter', 'boat', 'fountain', 'beacon', 'trophy'];
const results = [];
for (const kind of kinds) {
  const bounds = [512, 448, 0, 0];
  for (let n = 0; n < 48; n++) {
    const pixels = await sharp(`${root}/${kind}/frame-${String(n).padStart(2, '0')}.png`).ensureAlpha().raw().toBuffer();
    let visible = 0;
    for (let y = 0; y < 448; y++) for (let x = 0; x < 512; x++) {
      if (pixels[(y * 512 + x) * 4 + 3] < 128) continue;
      visible++;
      assert.ok(x >= 4 && x < 508 && y >= 4 && y < 444, `${kind} frame ${n}: artwork touches the safety margin at ${x},${y}`);
      bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
    }
    assert.ok(visible > 10000, `${kind} frame ${n}: actor layer is missing`);
  }
  results.push({ kind, frames: 48, bounds });
}
await fs.writeFile(`${root}/framing-check.json`, JSON.stringify(results, null, 2) + '\n');
const stages = (await fs.readdir(root)).filter(file => file.endsWith('-stage.png'));
assert.equal(stages.length, 18, 'All world stages must be rendered');
for (const file of stages) {
  const pixels = await sharp(`${root}/${file}`).ensureAlpha().raw().toBuffer();
  for (let y = 0; y < 448; y++) for (let x = 0; x < 512; x++) {
    if (pixels[(y * 512 + x) * 4 + 3] >= 128) {
      assert.ok(x >= 4 && x < 508 && y >= 4 && y < 444, `${file}: stage touches the safety margin at ${x},${y}`);
    }
  }
}
await fs.writeFile(`${root}/stage-framing-check.json`, JSON.stringify({ stages: stages.length, safetyMarginPixels: 4, passed: true }, null, 2) + '\n');
console.log('Verified all 480 actor frames and 18 stages: visible artwork and four-pixel safety margin.');
