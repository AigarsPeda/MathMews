import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { performance } from 'node:perf_hooks';

function sourceModule(file, require, globals = {}, module = { exports: {} }) {
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports, require, performance, setTimeout, ...globals });
  return module.exports;
}
const modules = new Map();
function load(id) {
  const file = path.resolve(id.startsWith('@/') ? id.slice(2) : id);
  if (/\.(png|webp)$/.test(file)) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (!modules.has(resolved)) {
    const module = { exports: {} };
    modules.set(resolved, module.exports);
    modules.set(resolved, resolved.endsWith('.json') ? JSON.parse(fs.readFileSync(resolved, 'utf8')) : sourceModule(resolved, load, {}, module));
  }
  return modules.get(resolved);
}
const { buildNativeRoomWorld, isFree, nearestFree, prepareNativeStep, catScreenPoint, FLOOR_Y, NATIVE_MODEL_CATALOG } = load('@/utils/native-room-world');
const { buildRoomActivity } = load('@/utils/room-activities');
const { createRoomPlacementResolver, roomItemAnchor } = load('@/utils/room-item-placement');
const { switchHomeRoom } = load('@/utils/home-rooms');
const { syncPetLayerOrder } = load('@/utils/room-layer-order');

// Reproduce the crowded kitchen where a routine cat route blocked menus for
// 1–2 seconds. Include rotated, tucked chairs, worktop objects and an ajar door.
const kitchenDecorations = [
  ['kitchenMixerStand', -.127808, -.289269, undefined, true],
  ['windowPlain', -.436638, -.445452, 1.5, true],
  ['kitchenModernCounterNavy', .066554, -.227017, 1.1],
  ['kitchenModernInductionNavy', -.541971, -.064618, 1.1, true],
  ['kitchenModernWallCabinetNavy', -.680536, -.408272, undefined, true],
  ['kitchenModernShelfNavy', -.687272, -.297922, undefined, true],
  ['kitchenModernFridgeNavy', .420374, -.273608, 1.1],
  ['kitchenModernIslandNavy', .016234, .164976, undefined, true],
  ['kitchenModernSinkNavy', -.266843, -.177663, 1.1, true],
  ['lampTableMushroom', .046002, .020355, .8],
  ['halloweenGhostLantern', -.001554, -.373176, undefined, false, 46.2],
  ['kitchenDiningTable', .638747, .130002, 1.1],
  ['kitchenChairUpholstered', .403048, .094123, undefined, false, 118.1],
  ['kitchenChairUpholstered', .743921, .094446, undefined, false, 312.7],
  ['kitchenChairUpholstered', .569364, .050935, undefined, false, 58],
  ['kitchenChairUpholstered', .490390, .167665, undefined, false, 202.3],
  ['lampFloorArc', .889975, -.072156, 1.4, false, 231.6],
].map(([decorationId, x, y, scale, wallFlipped, rotationDegrees], i) => ({
  decorationId, instanceId: `kitchen-${i}`, offset: { x, y }, scale, wallFlipped, rotationDegrees,
  ...(decorationId === 'kitchenModernFridgeNavy' ? { fridgeOpen: 'ajar', fridgeHingeSide: 'left' } : {}),
}));
const crowdedKitchen = { width: 390, height: 448, petSize: 80, sizeScale: 1.15,
  homeOffset: { x: 0, y: .12 }, decorations: kitchenDecorations, toys: [], ownedToyIds: [], hungry: false, asleep: false };
crowdedKitchen.nativeWorld = buildNativeRoomWorld(crowdedKitchen);
const timings = [];
for (const kind of ['chairNap', 'fridgeInvestigate', 'islandSit']) {
  let elapsed = Infinity;
  // Use the best of three fresh searches to exclude unrelated simulator/GC
  // scheduling pauses while still catching the original multi-second search.
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = performance.now();
    const plan = buildRoomActivity(crowdedKitchen, 0, kind);
    assert.ok(plan);
    const step = prepareNativeStep(plan, plan.steps[0], catScreenPoint(crowdedKitchen.nativeWorld.home, crowdedKitchen.nativeWorld), crowdedKitchen.nativeWorld, FLOOR_Y);
    elapsed = Math.min(elapsed, performance.now() - started);
    assert.equal(step.native.blocked, kind === 'chairNap', 'Optimization retains reachable worktops and the blocked tucked chair');
  }
  assert.ok(elapsed < 250, `${kind} blocked input for ${elapsed.toFixed(0)} ms`);
  timings.push(`${kind}: ${elapsed.toFixed(0)} ms`);
}
console.log(`Verified crowded-kitchen navigation stays below 250 ms without changing clearance (${timings.join(', ')}).`);

// Detailed placement shapes must keep release validation responsive as well.
{
  const world=crowdedKitchen.nativeWorld,object=world.objects.find(o=>o.modelId==='lampFloorArc');
  let elapsed=Infinity;
  for(let attempt=0;attempt<3;attempt++) {
    const start=performance.now(),resolver=createRoomPlacementResolver(world);
    const result=resolver.drop(object.instanceId,roomItemAnchor(object,world.width));
    assert.ok(result.object,'A release always returns a valid saved or accepted object');
    elapsed=Math.min(elapsed,performance.now()-start);
  }
  assert.ok(elapsed<250,`Detailed crowded-kitchen placement blocked input for ${elapsed.toFixed(0)} ms`);
  console.log(`Verified detailed placement setup and release in a crowded kitchen (${elapsed.toFixed(0)} ms).`);
}

// Compare with the exhaustive floor search's observable result, including
// constrained furniture clearances and the overfilled-room fallback.
function referenceFloor(point, world) {
  if (isFree(point, world)) return point;
  let best, distance = Infinity;
  for (let x = -2.2; x <= 2.2; x += .1) for (let z = -2.2; z <= 2.2; z += .1) {
    const p = [x, FLOOR_Y, z], d = Math.hypot(x - point[0], z - point[2]);
    if (d < distance && isFree(p, world)) { best = p; distance = d; }
  }
  if (best) return best;
  const top = world.objects.filter(o => o.solid && point[0] > o.min[0] - world.radius && point[0] < o.max[0] + world.radius
    && point[2] > o.min[2] - world.radius && point[2] < o.max[2] + world.radius).reduce((y, o) => Math.max(y, o.max[1]), FLOOR_Y);
  return [point[0], top + .01, point[2]];
}
for (const width of [320, 768]) {
  const world = buildNativeRoomWorld({ width, height: width * 1.1, petSize: width / 5, sizeScale: width / 390,
    decorations: ['sofaA', 'catTreeClassic', 'plantPotted', 'lampFloorArc'].map((decorationId, i) => ({
      decorationId, instanceId: `obstacle-${i}`, offset: { x: (i % 2 - .5) * .4, y: (Math.floor(i / 2) - .5) * .4 }, scale: .7,
    })), toys: [] });
  for (const point of [[0, FLOOR_Y, 0], [-2, FLOOR_Y, -2], [1.1, FLOOR_Y, -.3], [3, FLOOR_Y, 3]]) {
    const actual = nearestFree(point, world), expected = referenceFloor(point, world);
    assert.ok(actual.every((v, i) => Math.abs(v - expected[i]) < 1e-8), 'Cached floor repair preserves the closest free position');
  }
  const object = world.objects[0], resolver = createRoomPlacementResolver(world);
  const free = resolver.nearestFree(object);
  const controller = new AbortController();
  const asyncFree = await resolver.nearestFreeAsync(object, controller.signal);
  assert.equal(JSON.stringify(asyncFree), JSON.stringify(free), 'Yielding placement gives the same result');
  controller.abort();
  assert.equal(await resolver.nearestFreeAsync(object, controller.signal), undefined, 'Canceled searches cannot edit a switched room');
}
const huge = buildNativeRoomWorld({ width: 390, height: 420, petSize: 80, sizeScale: 1,
  decorations: [{ decorationId: 'sofaA', instanceId: 'full', offset: { x: 0, y: 0 }, scale: 8 }], toys: [] });
assert.equal(JSON.stringify(nearestFree([0, FLOOR_Y, 0], huge)), JSON.stringify(referenceFloor([0, FLOOR_Y, 0], huge)));
// Actual first render has no layout dimensions yet. Indexing those temporary
// world-sized models previously allocated millions of cells and crashed Hermes.
const unmeasured = buildNativeRoomWorld({ width: 0, height: 0, petSize: 80, sizeScale: 1,
  decorations: ['sofaA', 'catTreeClassic', 'lampFloorArc'].map((decorationId, i) => ({
    decorationId, instanceId: `initial-${i}`, offset: { x: 0, y: 0 }, scale: 1,
  })), toys: [] });
const initialResolver = createRoomPlacementResolver(unmeasured);
assert.equal(initialResolver.canPlace(unmeasured.objects[0]), false);
// An oversized object's detailed collision boxes must still block valid items.
const wideMeta = NATIVE_MODEL_CATALOG[huge.objects[0].modelId];
const wideBox = wideMeta.collisionBoxes?.[0] ?? wideMeta;
const wideObstacle = { ...huge.objects[0], collidable: true, heading: 0, scale: 10000,
  position: wideBox.min.map((v, i) => -(v + wideBox.max[i]) / 2 * 10000) };
const tinyWorld = buildNativeRoomWorld({ width: 390, height: 420, petSize: 80, sizeScale: 1,
  decorations: [{ decorationId: 'plantPotted', instanceId: 'tiny', offset: { x: 0, y: 0 }, scale: .2 }], toys: [] });
const withHuge = { ...tinyWorld, objects: [wideObstacle, ...tinyWorld.objects] };
assert.equal(createRoomPlacementResolver(withHuge).canPlace(tinyWorld.objects[0]), false, 'Oversized boxes retain exact collision checks');
const pet = { type: 'cat', homeRoomId: 'livingRoom', placedDecorations: [], placedToys: [], roomLayerOrder: [], homeRooms: {} };
assert.equal(syncPetLayerOrder(pet), pet, 'Unchanged layer order retains its references');
const kitchen = switchHomeRoom(pet, 'kitchen'), returned = switchHomeRoom(kitchen, 'livingRoom');
assert.equal(returned.roomLayerOrder, pet.roomLayerOrder, 'A prepared room does not rebuild because its layer order was copied');

let memoryWarning, reads = 0;
const masters = [];
function buffer(size = 10 * 1024 * 1024) {
  return { isValid: true, byteLength: size, clone() { return buffer(size); }, release() { this.isValid = false; } };
}
const cache = sourceModule('scripts/native/filament-recovery/AssetBufferCache.ts.txt', id => {
  if (id === 'react-native') return { AppState: { addEventListener(_event, listener) { memoryWarning = listener; } } };
  if (id === '../native/FilamentProxy') return { FilamentProxy: { async loadAsset() { reads++; const b = buffer(); masters.push(b); return b; } } };
  throw new Error(id);
});
const [a, b] = await Promise.all([cache.acquireAssetBuffer('a'), cache.acquireAssetBuffer('a')]);
assert.equal(reads, 1, 'Concurrent rooms share one file read');
assert.notEqual(a, b);
a.release(); assert.ok(b.isValid, 'Removing one consumer cannot invalidate another');
await cache.acquireAssetBuffer('b'); await cache.acquireAssetBuffer('c'); await cache.acquireAssetBuffer('d');
assert.equal(masters[0].isValid, false, 'LRU eviction bounds cached source bytes');
assert.ok(b.isValid, 'Eviction does not release an active model buffer');
await cache.acquireAssetBuffer('a'); assert.equal(reads, 5, 'An evicted file loads again');
memoryWarning(); assert.ok(masters.every(master => !master.isValid)); assert.ok(b.isValid);
const late = cache.acquireAssetBuffer('late'); memoryWarning(); const lateBuffer = await late;
assert.ok(lateBuffer.isValid); assert.equal(masters.at(-1).isValid, false, 'An in-flight read after a memory warning leaves no retained master');
lateBuffer.release(); b.release();

const { loadModelResources } = sourceModule('scripts/native/filament-recovery/loadModelResources.ts.txt', () => { throw new Error('Unexpected runtime import'); });
const events = [];
let failUpdate = false;
const engine = {
  isValid: true,
  beginLoadAsset() {},
  retain() {
    let updates = 0;
    events.push('retain');
    return { isValid: true, beginLoadAsset(_buffer, count) { events.push(`begin:${count}`); return buffer(1); },
      updateAssetLoad() { events.push('update'); if (failUpdate) { failUpdate = false; throw new Error('decode failed'); } return ++updates / 2; },
      cancelAssetLoad() { events.push('cancel'); }, release() { events.push('release'); this.isValid = false; } };
  },
};
const context = { async runAsync(fn) { return fn(); } };
const first = buffer(), second = buffer();
const [one, two] = await Promise.all([loadModelResources(engine, context, first), loadModelResources(engine, context, second, 2)]);
assert.ok(one.isValid && two.isValid);
assert.deepEqual(events, ['retain', 'begin:1', 'update', 'update', 'release', 'retain', 'begin:2', 'update', 'update', 'release'], 'Resource jobs serialize and retain the engine until completion');
assert.ok(!first.isValid && !second.isValid, 'Source holders release after completion');
failUpdate = true;
await assert.rejects(loadModelResources(engine, context, buffer()), /decode failed/);
assert.ok(events.includes('cancel'));
assert.ok((await loadModelResources(engine, context, buffer())).isValid, 'A failed decode does not poison the load queue');
const disposed = buffer(); engine.isValid = false;
assert.equal(await loadModelResources(engine, context, disposed), undefined);
assert.equal(disposed.isValid, false, 'Queued work after engine disposal cleans up its buffer');
console.log('Verified closest floor repair, yielding/canceled placement, stable room references, bounded shared buffers, memory pressure, serialized native decoding, cleanup and recovery.');

let clearWarmups, decodes = 0;
const prepared = [];
const poolApi = sourceModule('scripts/native/filament-recovery/PreparedModels.ts.txt', id => {
  if (id === 'react-native') return { AppState: { addEventListener(_event, listener) { clearWarmups = listener; } }, Image: { resolveAssetSource: source => ({ uri: `model-${source}` }) } };
  if (id === './AssetBufferCache') return { acquireAssetBuffer: async () => buffer() };
  if (id === './loadModelResources') return { async loadModelResources(_engine, _context, bytes) {
    decodes++; bytes.release(); const asset = buffer(1); prepared.push(asset); return asset;
  } };
  throw new Error(id);
});
const poolEngine = { isValid: true };
poolApi.prepareModel(poolEngine, context, 1); poolApi.prepareModel(poolEngine, context, 1);
const consumer = buffer();
const warmed = await poolApi.loadPreparedModel(poolEngine, context, consumer, 1, 1);
assert.equal(decodes, 1, 'Preview preparation and purchase share the destination-engine decode');
assert.equal(warmed, prepared[0]); assert.equal(consumer.isValid, false);
const repeat = await poolApi.loadPreparedModel(poolEngine, context, buffer(), 1, 1);
assert.notEqual(repeat, warmed, 'Repeat purchases have independent assets and materials');
for (const id of [2, 3, 4]) poolApi.prepareModel(poolEngine, context, id);
for (let i = 0; i < 10; i++) await Promise.resolve();
assert.equal(decodes, 4, 'An evicted queued warmup stops before decoding');
clearWarmups();
for (let i = 0; i < 10; i++) await Promise.resolve();
assert.ok(warmed.isValid && repeat.isValid, 'Memory pressure cannot evict claimed room objects');
assert.ok(prepared.slice(2).every(asset => !asset.isValid), 'Memory pressure releases only unclaimed prepared models');
poolApi.prepareModel(poolEngine, context, 5); poolApi.clearPreparedModels(poolEngine);
for (let i = 0; i < 10; i++) await Promise.resolve();
assert.equal(decodes, 4, 'Scene disposal cancels queued warmups');
console.log('Verified prepared preview purchases avoid a second decode, independent materials, bounded spare models, eviction and scene teardown.');
