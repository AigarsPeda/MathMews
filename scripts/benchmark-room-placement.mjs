/** Local JS placement benchmark. Optional argument: a previous room-item-placement.ts. */
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
const points = Array.from({ length: 2000 }, (_, i) => ({
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
  for (let i = 0; i < 7; i++) { const start = performance.now(); run(api); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  return Number((samples[3] / points.length).toFixed(4));
}
const result = { objects: world.objects.length, moves: points.length, medianMsPerMove: benchmark(current) };
if (process.argv[2]) {
  const before = loader()(process.argv[2]);
  // The movement policy intentionally differs: the current version checks on drop.
  result.baselineMsPerMove = benchmark(before);
  result.speedup = Number((result.baselineMsPerMove / result.medianMsPerMove).toFixed(2));
}
const resolver=current.createRoomPlacementResolver(world);
const drops=[];
for(let run=0;run<7;run++) {
  const start=performance.now();
  for(const point of points) {
    const drop=resolver.drop('drag',point);
    assert.ok(!drop.accepted || resolver.canPlace(drop.object));
  }
  drops.push((performance.now()-start)/points.length);
}
drops.sort((a,b)=>a-b);
result.medianMsPerDrop=Number(drops[3].toFixed(4));
console.log(JSON.stringify(result));
