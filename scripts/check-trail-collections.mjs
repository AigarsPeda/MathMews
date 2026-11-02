/** Validate retained Blender exports and the decoration-free level route. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/topic-path-layout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports });
const { getTopicPathLayout, getTopicPathConnection, getTopicPathCallout } = module.exports;
const TRAIL_PROP_KINDS = JSON.parse(fs.readFileSync('prototypes/trail-collections/manifest.json', 'utf8')).map(asset => asset.id);
assert.equal(TRAIL_PROP_KINDS.length, 60);
assert.equal(new Set(TRAIL_PROP_KINDS).size, 60, 'Difficulty collections never share the same asset');
// App sprites must remain transparent and retain editable Blender sources.
const spriteHashes = new Set();
let collectionBytes = 0;
for (const name of [...TRAIL_PROP_KINDS, 'milestone']) {
  const collection = { e: 'easy', m: 'medium', h: 'hard' }[name[0]];
  const source = name === 'milestone' ? 'prototypes/trail-props' : `prototypes/trail-collections/${collection}`;
  const destination = name === 'milestone' ? 'assets/3d/trail-props' : `assets/3d/trail-collections/${collection}`;
  assert.ok(fs.statSync(`${source}/${name}.blend`).size > 1000);
  const sprite = sharp(`${destination}/${name}.webp`);
  const metadata = await sprite.metadata();
  assert.equal(metadata.width, 384); assert.equal(metadata.height, 384); assert.ok(metadata.hasAlpha);
  const alpha = await sprite.extractChannel('alpha').raw().toBuffer();
  assert.ok(alpha.some(value => value === 255));
  for (let i = 0; i < 384; i++) {
    for (const index of [i, 383 * 384 + i, i * 384, i * 384 + 383]) {
      assert.ok(alpha[index] <= 2, `${name}: no artwork or baked background at image edges`);
    }
  }
  const bytes = fs.readFileSync(`${destination}/${name}.webp`);
  assert.ok(bytes.length < 100000);
  if (name !== 'milestone') {
    collectionBytes += bytes.length;
    spriteHashes.add(createHash('sha256').update(bytes).digest('hex'));
  }
}
assert.equal(spriteHashes.size, 60, 'Each collection entry has its own rendered image');
assert.ok(collectionBytes < 2_000_000, 'All sixty decorative sprites stay below 2 MB');
let cases = 0;
for (const width of [232, 276, 299, 300, 320, 360, 390, 460]) for (const count of [0, 1, 10, 40]) for (let current = -1; current < count; current++) {
  const { points, height, finish } = getTopicPathLayout(width, count, current);
  const caption = current >= 0 ? getTopicPathCallout(width, points[current]) : undefined;
  if (finish) {
    assert.ok(finish.y > points.at(-1).y + points.at(-1).radius + 60);
    assert.ok(finish.y + 60 < height, 'Finish label remains reachable above the fixed action');
  }
  const baseline = getTopicPathLayout(width, count, -1).points;
  points.forEach((point, index) => {
    assert.equal(point.x, baseline[index].x); assert.equal(point.y, baseline[index].y);
    assert.ok(point.x - point.radius >= 12 && point.x + point.radius <= width - 12);
    if (index) assert.ok(point.y - point.radius >= points[index-1].y + points[index-1].radius + 24);
    if (caption) assert.ok(caption.left + caption.width <= point.x - point.radius
      || caption.left >= point.x + point.radius || caption.top + caption.height <= point.y - point.radius
      || caption.top >= point.y + point.radius, 'Lesson caption never overlaps a playable tile');
  });
  if (caption) assert.ok(caption.left >= 0 && caption.left + caption.width <= width);
  for (const [index, destination] of [...points.slice(1), ...(finish ? [finish] : [])].entries()) {
    const source = points[index];
    const route = getTopicPathConnection(width, source, destination);
    assert.ok(!/NaN|Infinity/.test(route));
    const coordinates = route.match(/-?[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?/g).map(Number);
    let previousY = source.y;
    for (let i = 0; i < coordinates.length; i += 2) {
      const x = coordinates[i], y = coordinates[i + 1];
      assert.ok(x >= 0 && x <= width, 'Route stays inside the viewport');
      assert.ok(y >= previousY && y <= destination.y, 'Route never doubles back or crosses itself');
      previousY = y;
    }
  }
  cases++;
}
console.log(`Verified ${TRAIL_PROP_KINDS.length} retained sprites and ${cases} decoration-free route layouts.`);
