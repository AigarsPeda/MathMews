/** Bounded regression for live drag previews, including crowded structural shapes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { performance } from 'node:perf_hooks';

function loader() {
  const cache = new Map();
  return function load(id) {
    const file = path.resolve(id.startsWith('@/') ? id.slice(2) : id);
    if (/\.(png|webp)$/.test(file)) return file;
    const resolved = fs.existsSync(file) ? file : ['.ts', '.json'].map(ext => file + ext).find(fs.existsSync);
    assert.ok(resolved, id);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = { exports: {} }; cache.set(resolved, module);
    if (resolved.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    else vm.runInNewContext(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, { module, exports: module.exports, require: load });
    return module.exports;
  };
}
const load = loader();
const w = load('@/utils/native-room-world');
const current = load('@/utils/room-item-placement');
const world = w.buildNativeRoomWorld({ width: 390, height: 420, petSize: 100, sizeScale: .7,
  decorations: [{ decorationId: 'chairRockingOak', instanceId: 'drag', rotationDegrees: 20, offset: { x: 0, y: .4 } },
    ...Array.from({ length: 11 }, (_, i) => ({ decorationId: ['sofaA', 'plantPotted', 'lampFloorArc', 'livingRugRound'][i % 4],
      instanceId: `obstacle-${i}`, scale: .6, rotationDegrees: i * 23, offset: { x: (i % 4 - 1.5) * .35, y: (Math.floor(i / 4) - 1) * .35 } }))],
  toys: [] });
const start = current.roomItemAnchor(world.objects[0], world.width);
// Continuous small movements and large drags through occupied floor space.
const points = Array.from({ length: 24 }, (_, i) => ({
  x: start.x + Math.sin(i * .021) * (i % 7 === 0 ? 500 : 150),
  y: start.y + Math.cos(i * .037) * 120,
}));
function run(api) {
  const resolver = api.createRoomPlacementResolver(world);
  let preview = world.objects[0];
  for (const point of points) {
    preview = resolver.move('drag', point, preview).object;
    assert.equal(preview.heading,world.objects[0].heading);
  }
}
function benchmark(api) {
  run(api); const samples = [];
  for (let i = 0; i < 3; i++) { const start = performance.now(); run(api); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  return Number((samples[1] / points.length).toFixed(4));
}
const result = { objects: world.objects.length, moves: points.length, medianMsPerMove: benchmark(current) };
const resolver=current.createRoomPlacementResolver(world);
const drops=[];
for(let run=0;run<3;run++) {
  const start=performance.now();
  for(const point of points) {
    const drop=resolver.preview('drag',point);
    assert.ok(!drop.accepted || resolver.canPlace(drop.object));
  }
  drops.push((performance.now()-start)/points.length);
}
drops.sort((a,b)=>a-b);
result.medianMsPerPreview=Number(drops[1].toFixed(4));
assert.ok(result.medianMsPerPreview < 10, `Live snapping took ${result.medianMsPerPreview} ms per preview`);
if (process.argv[2]) {
  const before = loader()(process.argv[2]).createRoomPlacementResolver(world);
  for (const point of points) {
    const a = before.preview('drag', point), b = resolver.preview('drag', point);
    assert.equal(b.accepted, a.accepted);
    assert.ok(a.object.position.every((value, i) => Math.abs(value - b.object.position[i]) < 1e-8), 'Indexing preserves the exact snapped pose');
  }
}
console.log(JSON.stringify(result));

// Real 19-object kitchen from the freeze report, with only furniture data retained.
// Per-position limits catch a single bad snap search that a batch average hides.
const kitchen = w.buildNativeRoomWorld(JSON.parse(fs.readFileSync('scripts/fixtures/crowded-kitchen.json', 'utf8')));
const kitchenTimes = [];
for (const modelId of ['kitchenModernSinkNavy', 'kitchenModernIslandNavy']) {
  const object = kitchen.objects.find(item => item.modelId === modelId);
  const resolver = current.createRoomPlacementResolver(kitchen, [object.instanceId]);
  for (const zoom of [0.65, 1, 2.5]) for (const point of [{ x: 80, y: 20 }, { x: 0, y: 20 }, { x: 60, y: -40 }, { x: -20, y: 40 }, { x: 40, y: 20 }]) {
    const samples = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const start = performance.now();
      const result = resolver.preview(object.instanceId, point, zoom);
      samples.push(performance.now() - start);
      assert.ok(!result.accepted || resolver.canPlace(result.object), 'Magnet simplification never permits a detailed collision');
    }
    samples.sort((a, b) => a - b);
    kitchenTimes.push(samples[1]);
  }
}
const worstKitchenMedian = Math.max(...kitchenTimes);
assert.ok(worstKitchenMedian < 60, `Crowded kitchen preview took ${worstKitchenMedian.toFixed(1)} ms`);
console.log(JSON.stringify({ kitchenObjects: kitchen.objects.length, kitchenPositions: kitchenTimes.length,
  worstPositionMedianMs: Number(worstKitchenMedian.toFixed(3)) }));

const candidate = kitchen.objects[0];
const feedback = { candidate, blockers: [], boundaries: [] };
assert.equal(current.roomPlacementStatus(feedback), 'checking');
assert.equal(current.roomPlacementStatus({ ...feedback, access: 'clear' }), 'ready');
assert.equal(current.roomPlacementStatus({ ...feedback, access: 'blocked', snapped: true }), 'blocked');
assert.equal(current.roomPlacementStatus({ ...feedback, access: 'clear', boundaries: ['leftWall'] }), 'blocked');
assert.equal(current.roomPlacementStatus({ ...feedback, access: 'clear', unsupportedSurfaceId: 'shelf' }), 'blocked');

const living = w.buildNativeRoomWorld(JSON.parse(fs.readFileSync('scripts/fixtures/crowded-living-room.json', 'utf8')));
const chair = living.objects.find(item => item.modelId === 'chairRockingOak');
const livingResolver = current.createRoomPlacementResolver(living, [chair.instanceId]);
const livingTimes = [];
for (const zoom of [.65, 1, 2.5]) for (const point of [{ x: 80, y: 0 }, { x: -20, y: -60 }, { x: 80, y: 60 }, { x: 40, y: -20 }, { x: -40, y: -60 }]) {
  const samples = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const start = performance.now();
    const result = livingResolver.preview(chair.instanceId, point, zoom);
    samples.push(performance.now() - start);
    assert.ok(!result.accepted || livingResolver.canPlace(result.object));
  }
  samples.sort((a, b) => a - b); livingTimes.push(samples[1]);
}
assert.ok(Math.max(...livingTimes) < 60, `Living-room preview took ${Math.max(...livingTimes).toFixed(1)} ms`);
console.log(JSON.stringify({ livingObjects: living.objects.length, livingPositions: livingTimes.length,
  worstPositionMedianMs: Number(Math.max(...livingTimes).toFixed(3)) }));
