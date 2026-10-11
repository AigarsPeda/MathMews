/** Desktop CPU study of room/purchase work. No renderer, GPU or device latency. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import ts from 'typescript';
import { performance } from 'node:perf_hooks';
import { Buffer } from 'node:buffer';

const cache = new Map();
function load(id) {
  const file = path.resolve(id.startsWith('@/') ? id.slice(2) : id);
  if (/\.(png|webp)$/.test(file)) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} };
  cache.set(resolved, module);
  if (resolved.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  else vm.runInNewContext(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: load });
  return module.exports;
}
const { buildNativeRoomWorld } = load('@/utils/native-room-world');
const { createRoomPlacementResolver } = load('@/utils/room-item-placement');
const { switchHomeRoom, previewHomeRoom, removeRoomNavigationDoors } = load('@/utils/home-rooms');
const { appendPlacedDecoration } = load('@/utils/room-placement');
const { syncPetLayerOrder } = load('@/utils/room-layer-order');
const { tryPurchaseDecoration, getDecorationOwnedCount } = load('@/utils/decoration-store');
const { withCoinDelta } = load('@/utils/coin-ledger');
const { HOME_ROOM_IDS } = load('@/constants/home-rooms');

function measure(operation, samples = 15, batch = 1) {
  operation();
  const timings = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    for (let j = 0; j < batch; j++) operation();
    timings.push((performance.now() - start) / batch);
  }
  timings.sort((a, b) => a - b);
  return { medianMs: +timings[Math.floor(samples / 2)].toFixed(3),
    p95Ms: +timings[Math.ceil(samples * .95) - 1].toFixed(3), samples, batch };
}
function layout(count) {
  const ids = ['sofaA', 'chairRockingOak', 'kitchenModernCounterNavy', 'kitchenModernSinkNavy', 'plantPotted', 'lampTableMushroom'];
  return { roomId: 'room1', roomPetOffset: { x: 0, y: .12 }, placedToys: [],
    placedDecorations: Array.from({ length: count }, (_, i) => ({
      decorationId: ids[i % ids.length], instanceId: `item-${i}`, scale: .7,
      offset: { x: (i % 5 - 2) * .24, y: (Math.floor(i / 5) % 5 - 2) * .22 },
    })) };
}
function purchase(current) {
  const id = 'halloweenGhostLantern';
  const attempt = tryPurchaseDecoration({ decorationId: id, walletCoins: current.wallet.coins,
    decorationsUnlocked: current.progress.decorationsUnlocked });
  assert.equal(attempt.result, 'purchased');
  const next = { ...current, progress: { ...current.progress, decorationsUnlocked: attempt.decorationsUnlocked,
    decorationQuantities: { ...current.progress.decorationQuantities, [id]: getDecorationOwnedCount(id, current.progress) + 1 } },
    pet: syncPetLayerOrder({ ...current.pet, placedDecorations: appendPlacedDecoration(current.pet.placedDecorations, id) }) };
  const funded = withCoinDelta(next, attempt.walletCoins - current.wallet.coins, { kind: 'store_decoration', itemId: id });
  assert.ok(funded);
  return { ...funded, pet: removeRoomNavigationDoors(funded.pet) };
}
const cases = [];
for (const count of [10, 30, 60]) {
  // Synthetic fixtures include overlaps to stress recovery, not a furnished layout recommendation.
  const room = layout(count);
  const pet = { ...room, type: 'cat', name: 'Benchmark', homeRoomId: 'livingRoom', catHomeRoomId: 'livingRoom',
    homeRooms: Object.fromEntries(HOME_ROOM_IDS.map(id => [id, layout(count)])) };
  const save = { pet, wallet: { coins: 1_000_000 }, progress: { decorationsUnlocked: [], decorationQuantities: {} } };
  const options = { width: 390, height: 420, petSize: 80, sizeScale: 1.15, homeOffset: { x: 0, y: .8 }, decorations: room.placedDecorations, toys: [] };
  const world = buildNativeRoomWorld(options);
  const candidate = buildNativeRoomWorld({ ...options, decorations: [{ decorationId: 'kitchenModernIslandNavy', instanceId: 'new',
    scale: .7, offset: { x: 0, y: 0 } }] }).objects[0];
  const resolver = createRoomPlacementResolver(world);
  const next = purchase(save);
  cases.push({ objectsPerRoom: count,
    purchaseStateOnly: measure(() => purchase(save), 100, 10),
    switchRoomStateOnly: measure(() => switchHomeRoom(pet, 'kitchen'), 100, 10),
    buildFourWorlds: measure(() => HOME_ROOM_IDS.map(id => {
      const viewed = previewHomeRoom(pet, id);
      return buildNativeRoomWorld({ ...options, decorations: viewed.placedDecorations });
    })),
    findSpaceForIsland: { ...measure(() => resolver.nearestFree(candidate), 5), foundSpace: !!resolver.nearestFree(candidate) },
    stringifySave: measure(() => JSON.stringify(next), 100, 10), saveBytes: Buffer.byteLength(JSON.stringify(next)) });
  process.stderr.write(`Measured ${count} objects per room.\n`);
}
const files = fs.readdirSync('assets/3d/native').filter(file => file.endsWith('.glb'));
const sizes = files.map(file => ({ file, bytes: fs.statSync(path.join('assets/3d/native', file)).size }));
console.log(JSON.stringify({ environment: { node: process.version, platform: process.platform, arch: process.arch,
  cpu: os.cpus()[0]?.model }, scope: 'Synthetic desktop Node/VM CPU measurements; excludes React, Hermes, asset IO, native parsing, GPU upload, drawing and persistence IO.',
  fixtures: 'Overlapping synthetic stress layouts, four rooms; each sample starts from the same snapshot.',
  assets: { glbFiles: files.length, totalFileBytes: sizes.reduce((sum, item) => sum + item.bytes, 0),
    largestFiles: sizes.sort((a, b) => b.bytes - a.bytes).slice(0, 5) }, cases }, null, 2));
