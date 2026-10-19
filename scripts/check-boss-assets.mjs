import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { bossStories } from './puzzles/boss-stories.mjs';

const catalog = JSON.parse(await fs.readFile('assets/3d/bosses/catalog.json', 'utf8'));
assert.deepEqual(catalog.scenes.sort(), Object.keys(bossStories).sort());
const modelHashes = new Set();
const registration = await fs.readFile('constants/boss-scene-assets.ts', 'utf8');
for (const id of catalog.scenes) {
  const states = [];
  for (let stage = 0; stage <= 3; stage++) {
    const file = `assets/3d/bosses/${id}/state-${stage}.png`;
    assert.ok(registration.includes(file), `${id}: static Metro registration`);
    const { width, height, hasAlpha } = await sharp(file).metadata();
    assert.deepEqual([width, height, hasAlpha], [768, 480, true], `${id}: native checkpoint dimensions`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 128) {
        assert.ok(x > 2 && y > 2 && x < info.width - 3 && y < info.height - 3, `${id}/${stage}: scene geometry is cropped`);
      }
    }
    states.push(crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'));
  }
  assert.equal(new Set(states).size, 4, `${id}: every successful task must visibly change its scene`);
  const staging = JSON.parse(await fs.readFile(`assets/3d/bosses/${id}/cat-staging.json`, 'utf8'));
  modelHashes.add(staging.modelSha256);
  assert.equal(staging.model, catalog.actor.model, `${id}: reuse the shipped cat`);
  assert.ok(staging.rigBones >= 50, `${id}: actual skeletal character`);
  assert.equal(staging.poses.length, 36, `${id}: four cat checkpoints and 32 reaction/outcome frames`);
  for (const pose of staging.poses) {
    const [left,bottom,right,top] = pose.bounds;
    assert.ok(left>0 && bottom>0 && right<1 && top<1, `${id}/${pose.pose}: cat fits inside the scene`);
    assert.ok((top-bottom)*480 > 60, `${id}/${pose.pose}: cat is large enough to see`);
    assert.ok(pose.visibleHeadRays > 0, `${id}/${pose.pose}: scenery cannot hide the cat's head`);
  }
  for (const prefix of ['reaction-1','reaction-2','outcome']) {
    const poses = staging.poses.filter(pose => pose.pose.startsWith(prefix));
    assert.ok(new Set(poses.map(pose => pose.bonePoseSha256)).size >= 6, `${id}/${prefix}: the cat itself reacts, independently of moving scenery`);
  }
  for (const [prefix,stage,last] of [['reaction-1',1,'07'],['reaction-2',2,'07'],['outcome',3,'15']]) {
    const ending = staging.poses.find(pose => pose.pose === `${prefix}-${last}`);
    const checkpoint = staging.poses.find(pose => pose.pose === `state-${stage}`);
    // Matrix interpolation can change the last few float bits. Compare the
    // projected body geometry, where a visible end-of-clip snap would occur.
    assert.ok(ending.bounds.every((value,i) => Math.abs(value-checkpoint.bounds[i]) < .002), `${id}/${prefix}: finishing holds the checkpoint pose without snapping`);
    assert.deepEqual(ending.position, checkpoint.position);
  }
  for (const [prefix, count] of [['reaction-1',8],['reaction-2',8],['outcome',16]]) {
  const file = `assets/3d/bosses/${id}/${prefix}.png`;
  assert.ok(registration.includes(file));
  const atlas = sharp(file), info = await atlas.metadata();
  assert.deepEqual([info.width, info.height], [2048, count / 4 * 320], `${id}: atlas fits native texture limits`);
  const hashes = [];
  for (let frame = 0; frame < count; frame++) {
    const pixels = await atlas.clone().extract({ left: frame % 4 * 512, top: Math.floor(frame / 4) * 320, width: 512, height: 320 }).raw().toBuffer();
    hashes.push(crypto.createHash('sha256').update(pixels).digest('hex'));
    for (let x = 0; x < 512; x++) for (const y of [0, 1, 318, 319]) {
      assert.ok(pixels[(y * 512 + x) * 4 + 3] < 129, `${id}/${frame}: ending cropped at top or bottom`);
    }
    for (let y = 0; y < 320; y++) for (const x of [0, 1, 510, 511]) {
      assert.ok(pixels[(y * 512 + x) * 4 + 3] < 129, `${id}/${frame}: ending cropped at left or right`);
    }
  }
  assert.ok(new Set(hashes).size >= Math.min(8,count), `${id}: the ending must animate, rather than repeat a still`);
  }
  assert.ok((await fs.stat(`prototypes/boss-scenes/${id}.blend`)).size > 10000, `${id}: editable Blender source retained`);
}
assert.equal(modelHashes.size, 1, 'All bosses use the same shipped cat model revision');
console.log(`Verified ${catalog.scenes.length} distinct Blender missions, 72 visible cat checkpoints, 36 task reactions and 18 animated cat outcomes.`);
