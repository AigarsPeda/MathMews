/** Validate authored exports and keep decorative artwork outside every playable tile. */
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
const { getTopicPathLayout, getTopicPathDecorations, getTopicSceneryOffset, getTopicPathCallout, TOPIC_SCENERY_DRIFT, TRAIL_PROP_KINDS, TRAIL_COLLECTIONS, TOPIC_TRAIL_THEMES, getTopicTrailProps } = module.exports;
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
assert.equal(getTopicSceneryOffset(100, 600, 400, false), 0);
assert.ok(getTopicSceneryOffset(150, 600, 400, false) > 0, 'Scenery moves slower than the trail');
for (const scroll of [-100, 0, 100, 1000, 100000]) {
  assert.equal(getTopicSceneryOffset(scroll, 600, 400, true), 0, 'Reduce Motion disables parallax');
  assert.ok(Math.abs(getTopicSceneryOffset(scroll, 600, 400, false)) <= TOPIC_SCENERY_DRIFT);
}
const learningCatalog = JSON.parse(fs.readFileSync('data/puzzle-curriculum.json', 'utf8'));
const tracks = [];
for (const difficulty of ['easy', 'medium', 'hard']) {
  const topics = [...new Set(learningCatalog.lessons.filter(lesson => lesson.difficulty === difficulty).map(lesson => lesson.topicId))];
  const heroes = new Set(), assigned = new Set(), actuallyPlaced = new Set();
  for (const topicId of topics) {
    tracks.push({ topicId, difficulty });
    assert.ok(TOPIC_TRAIL_THEMES[difficulty][topicId], `${difficulty}/${topicId}: curated art theme`);
    const kinds = getTopicTrailProps(topicId, difficulty);
    assert.equal(new Set(kinds).size, kinds.length);
    assert.ok(kinds.every(kind => TRAIL_COLLECTIONS[difficulty].includes(kind)));
    TOPIC_TRAIL_THEMES[difficulty][topicId].forEach(kind => assigned.add(kind));
    const layout = getTopicPathLayout(320, 10, 0);
    const visible = getTopicPathDecorations(320, layout.points, layout.height, 0, topicId, difficulty);
    heroes.add(visible[0].kind);
    for (let current = 0; current < 10; current++) {
      const actual = getTopicPathLayout(320, 10, current);
      getTopicPathDecorations(320, actual.points, actual.height, current, topicId, difficulty)
        .forEach(prop => actuallyPlaced.add(prop.kind));
    }
  }
  assert.equal(assigned.size, 20, `${difficulty}: all 20 approved assets are assigned to real tracks`);
  assert.equal(actuallyPlaced.size, 20, `${difficulty}: all 20 assets appear in actual ten-level layouts`);
  assert.equal(heroes.size, topics.length, `${difficulty}: distinct opening hero for each topic`);
}
let cases = 0;
for (const { topicId, difficulty } of tracks) for (const width of [232, 276, 320, 360, 390, 460]) for (const count of [0, 1, 10, 40]) for (let current = -1; current < count; current++) {
  const { points, height, finish } = getTopicPathLayout(width, count, current);
  const art = getTopicPathDecorations(width, points, height, current, topicId, difficulty);
  assert.equal(new Set(art.map(item => item.kind)).size, art.length, 'No decorative prop repeats within a topic trail');
  const caption = current >= 0 ? getTopicPathCallout(width, points[current]) : undefined;
  if (finish) {
    assert.ok(finish.y > points.at(-1).y + points.at(-1).radius + 60);
    assert.ok(finish.y + 60 < height, 'Finish line remains reachable above the fixed action');
  }
  const baseline = getTopicPathLayout(width, count, -1).points;
  points.forEach((point, index) => {
    assert.equal(point.x, baseline[index].x); assert.equal(point.y, baseline[index].y);
    assert.ok(point.x - point.radius >= 12 && point.x + point.radius <= width - 12);
    if (index) assert.ok(point.y - point.radius >= points[index-1].y + points[index-1].radius + 24);
  });
  if (caption) assert.ok(caption.left >= 0 && caption.left + caption.width <= width);
  for (const original of art) for (const drift of [-TOPIC_SCENERY_DRIFT, 0, TOPIC_SCENERY_DRIFT]) {
    const placement = { ...original, top: original.top + drift };
    assert.ok(placement.left >= 0 && placement.left + placement.size <= width);
    assert.ok(placement.top >= 0 && placement.top + placement.size <= height);
    if (caption) assert.ok(placement.left + placement.size + 12 <= caption.left || placement.left >= caption.left + caption.width + 12
      || placement.top + placement.size + 12 <= caption.top || placement.top >= caption.top + caption.height + 12,
      'Blender props leave the active lesson caption clear');
    for (const tile of points) assert.ok(placement.left + placement.size + 16 <= tile.x - tile.radius
      || placement.left >= tile.x + tile.radius + 16 || placement.top + placement.size + 16 <= tile.y - tile.radius
      || placement.top >= tile.y + tile.radius + 16, 'Artwork leaves a 16-point gap around every tile and halo');
  }
  cases++;
}
console.log(`Verified ${TRAIL_PROP_KINDS.length} collection sprites, a finish marker, ${tracks.length} difficulty/topic themes and ${cases} growing trail layouts.`);
