/** Validate authored exports and keep decorative artwork outside every playable tile. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const catalog = JSON.parse(fs.readFileSync('prototypes/education-props/catalog.json', 'utf8'));
assert.equal(catalog.objects.length, 9);
assert.equal(new Set(catalog.objects.map(item => item.id)).size, 9);
let packedBytes = 0;
for (const item of catalog.objects) {
  assert.ok(fs.statSync(item.source).size > 1000, `${item.name}: editable source exists`);
  const bytes = fs.readFileSync(item.model);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const model = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.equal(model.scenes.length, 1);
  const roots = model.scenes[0].nodes;
  assert.equal(roots.length, 1, `${item.name}: one reusable placement root`);
  assert.equal(model.nodes[roots[0]].name, item.id);
  assert.ok(model.nodes.every(node => !node.camera && !node.extensions?.KHR_lights_punctual));
  assert.ok(!model.animations?.length);
  assert.ok(!model.images?.length, `${item.name}: self-contained PBR colors, no external textures`);
  assert.equal(item.origin, 'bottom-center');
  assert.ok(Math.abs(item.min[1]) < .0001, `${item.name}: floor contact at Y=0`);
  for (const axis of [0, 2]) assert.ok(Math.abs(item.max[axis] + item.min[axis]) < .0001);
  assert.ok(item.triangles > 0 && item.triangles < 40000, `${item.name}: bounded geometry budget`);
  const image = sharp(item.preview);
  const metadata = await image.metadata();
  assert.equal(metadata.width, 384); assert.equal(metadata.height, 384); assert.ok(metadata.hasAlpha);
  const alpha = await image.extractChannel('alpha').raw().toBuffer();
  assert.ok(alpha.some(value => value === 255));
  for (let i = 0; i < 384; i++) {
    assert.equal(alpha[i], 0, `${item.name}: no top crop`);
    assert.equal(alpha[383 * 384 + i], 0, `${item.name}: no bottom crop`);
    assert.equal(alpha[i * 384], 0, `${item.name}: no left crop`);
    assert.equal(alpha[i * 384 + 383], 0, `${item.name}: no right crop`);
  }
  packedBytes += fs.statSync(item.preview).size;
}
assert.ok(packedBytes < 400000, 'Nine previews stay under 400 KB combined');
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/topic-path-layout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports });
const { getTopicPathLayout, getTopicPathDecorations, getTopicSceneryOffset, getTopicSceneryShapes, TOPIC_SCENERY_DRIFT } = module.exports;
const shapeCounts = new Set();
const shapeKinds = new Set();
let previousCount;
for (let seed = 0; seed < 40; seed += 2) {
  const shapes = getTopicSceneryShapes(seed);
  assert.equal(JSON.stringify(shapes), JSON.stringify(getTopicSceneryShapes(seed)), 'Scenery never reshuffles on render');
  assert.ok(shapes.length >= 2 && shapes.length <= 6);
  assert.notEqual(shapes.length, previousCount, 'Neighboring locations visibly vary in density');
  previousCount = shapes.length;
  shapeCounts.add(shapes.length);
  for (const shape of shapes) {
    shapeKinds.add(shape.kind);
    assert.ok(shape.x >= 2 && shape.y >= 2 && shape.x + shape.width <= 98 && shape.y + shape.height <= 98,
      'Varied shapes stay within their reserved area, including stroke clearance');
  }
  const connected = new Set([0]);
  for (let pass = 0; pass < shapes.length; pass++) shapes.forEach((shape, index) => {
    if (shapes.some((other, j) => connected.has(j) && shape.x < other.x + other.width && shape.x + shape.width > other.x
      && shape.y < other.y + other.height && shape.y + shape.height > other.y)) connected.add(index);
  });
  assert.equal(connected.size, shapes.length, 'Compositions interlock instead of scattering isolated shapes');
}
assert.equal(shapeCounts.size, 5, 'The growing trail uses all five group sizes');
assert.equal(shapeKinds.size, 6, 'Include stepped and elbow outlines alongside simple shapes');
assert.equal(getTopicSceneryOffset(100, 600, 400, false), 0);
assert.ok(getTopicSceneryOffset(150, 600, 400, false) > 0, 'Scenery moves slower than the trail');
for (const scroll of [-100, 0, 100, 1000, 100000]) {
  assert.equal(getTopicSceneryOffset(scroll, 600, 400, true), 0, 'Reduce Motion disables parallax');
  assert.ok(Math.abs(getTopicSceneryOffset(scroll, 600, 400, false)) <= TOPIC_SCENERY_DRIFT);
}
let cases = 0;
for (const width of [232, 276, 320, 360, 390, 460]) for (const count of [0, 1, 10, 40]) for (let current = -1; current < count; current++) {
  const { points, height } = getTopicPathLayout(width, count, current);
  const art = getTopicPathDecorations(width, points, height);
  if (count) assert.ok(art.length > 0);
  for (const original of art) for (const drift of [-TOPIC_SCENERY_DRIFT, 0, TOPIC_SCENERY_DRIFT]) {
    const placement = { ...original, top: original.top + drift };
    assert.ok(placement.left >= 0 && placement.left + placement.size <= width);
    assert.ok(placement.top >= 0 && placement.top + placement.size <= height);
    for (const tile of points) assert.ok(placement.left + placement.size + 16 <= tile.x - tile.radius
      || placement.left >= tile.x + tile.radius + 16 || placement.top + placement.size + 16 <= tile.y - tile.radius
      || placement.top >= tile.y + tile.radius + 16, 'Artwork leaves a 16-point gap around every tile and halo');
  }
  cases++;
}
console.log(`Verified nine Blender/GLB/WebP assets (${Math.round(packedBytes / 1024)} KB of app images) and ${cases} growing trail layouts.`);
