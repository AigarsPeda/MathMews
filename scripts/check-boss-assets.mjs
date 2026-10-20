import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { bossStories } from './puzzles/boss-stories.mjs';

const catalog = JSON.parse(await fs.readFile('assets/3d/bosses/catalog.json', 'utf8'));
const lessons=JSON.parse(await fs.readFile('data/lesson-boss-scenes.json','utf8'));
const lessonIds=new Set(lessons.map(scene=>scene.id));
assert.deepEqual([...catalog.scenes].sort(), [...Object.keys(bossStories),...lessonIds].sort());
const curriculum=JSON.parse(await fs.readFile('data/puzzle-curriculum.json','utf8'));
assert.deepEqual(curriculum.lessons.flatMap(lesson=>lesson.levels.filter(level=>level.kind==='boss').map(level=>level.story.sceneId)).sort(),[...catalog.scenes].sort(),'Each lesson owns exactly one registered scene');
assert.equal(new Set(lessons.map(scene=>scene.name)).size,lessons.length,'Every added boss has a different character name');
const originalModelHashes = new Set();
const lessonModelHashes = new Set();
const endings=new Set();
const registration = await fs.readFile('constants/boss-scene-assets.ts', 'utf8');
for (const id of catalog.scenes) {
  const ext=lessonIds.has(id)?'webp':'png';
  const states = [];
  for (let stage = 0; stage <= 3; stage++) {
    const file = `assets/3d/bosses/${id}/state-${stage}.${ext}`;
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
  (lessonIds.has(id) ? lessonModelHashes : originalModelHashes).add(staging.modelSha256);
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
  const file = `assets/3d/bosses/${id}/${prefix}.${ext}`;
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
  if(prefix==='outcome') {
    const fingerprint=crypto.createHash('sha256').update(hashes.join(',')).digest('hex');
    assert.ok(!endings.has(fingerprint),`${id}: an ending cannot reuse another boss animation`);endings.add(fingerprint);
  }
  }
  assert.ok((await fs.stat(`prototypes/boss-scenes/${lessonIds.has(id)?'lessons/':''}${id}.blend`)).size > 10000, `${id}: editable Blender source retained`);
  if(lessonIds.has(id)) {
    const choreography=JSON.parse(await fs.readFile(`assets/3d/bosses/${id}/lesson-staging.json`,'utf8'));
    assert.equal(choreography.spec.id,id);
    assert.equal(choreography.motionFingerprints.length,32);
    for(const [start,end] of [[0,8],[8,16],[16,32]]) assert.ok(new Set(choreography.motionFingerprints.slice(start,end)).size>=6,`${id}: the boss and machinery move during each clip`);
  }
}
// The original finales retain their shipped renders. New scenes use the current
// GLB export, whose binary hash can change when the same character is exported.
assert.equal(originalModelHashes.size, 1, 'Original finales retain one cat model revision');
assert.equal(lessonModelHashes.size, 1, 'Lesson scenes share one cat model revision');
assert.ok(lessonModelHashes.has(crypto.createHash('sha256').update(await fs.readFile(catalog.actor.model)).digest('hex')), 'New lessons use the current shipped cat');
console.log(`Verified ${catalog.scenes.length} individual Blender missions, ${catalog.scenes.length*4} visible cat checkpoints, ${catalog.scenes.length*2} task reactions and ${endings.size} different animated endings.`);
