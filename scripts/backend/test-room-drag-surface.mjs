import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache = new Map();
function load(id) {
  const file = path.resolve(id.startsWith('@/') ? id.slice(2) : id);
  if (/\.(png|webp)$/.test(file)) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  else vm.runInNewContext(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: load, performance, setTimeout });
  return module.exports;
}

const { createRoomDragPlacement } = load('@/utils/room-drag-placement');
const { buildNativeRoomWorld, NATIVE_MODEL_CATALOG } = load('@/utils/native-room-world');
const { roomItemAnchor, createRoomPlacementResolver } = load('@/utils/room-item-placement');
const { transformRoomObject } = load('@/utils/room-support');
const { roomDragPreview } = load('@/utils/room-drag-motion');
const width = 390;
const world = buildNativeRoomWorld({ width, height: 420, petSize: 80, sizeScale: 1.15, toys: [], decorations: [
  { decorationId: 'kitchenModernIslandNavy', instanceId: 'table', offset: { x: 0, y: 0 } },
  { decorationId: 'lampTableMushroom', instanceId: 'lamp', offset: { x: .4, y: .4 }, scale: .6 },
] });
const table = world.objects.find(x => x.instanceId === 'table'), lamp = world.objects.find(x => x.instanceId === 'lamp');
const top = NATIVE_MODEL_CATALOG[table.modelId].supportSurfaces[0], meta = NATIVE_MODEL_CATALOG[lamp.modelId];
const height = table.position[1] + top.max[1] * table.scale + .002;
const resting = { ...transformRoomObject(lamp, [table.position[0], height - meta.min[1] * lamp.scale, table.position[2]]), supportId: table.instanceId };
const anchor = object => roomItemAnchor(object, width);
const close = (actual, expected) => { assert.ok(Math.abs(actual.x - expected.x) < 1e-7, `x ${actual.x} != ${expected.x}`); assert.ok(Math.abs(actual.y - expected.y) < 1e-7, `y ${actual.y} != ${expected.y}`); };

test('surface entry, motion and exit preserve the captured grab point without magnetic pullback', () => {
  const before = JSON.stringify(world);
  const drag = createRoomDragPlacement(lamp, world.objects, width, .65, ['lamp']);
  const center = anchor(resting), start = anchor(lamp);
  for (let i = 0; i <= 100; i++) {
    const point = { x: start.x + (center.x - start.x) * i / 100, y: start.y + (center.y - start.y) * i / 100 };
    close(anchor(drag(point).object), point);
  }
  assert.equal(drag(center).object.supportId, 'table');
  for (let i = 0; i < 20; i++) {
    const point = { x: center.x + i * .1, y: center.y };
    const object = drag(point).object;
    assert.equal(object.supportId, 'table'); close(anchor(object), point);
    // The UI has already advanced another six points when delayed JS feedback arrives.
    const motion = { session: 1, sequence: i + 1, x: point.x - start.x + 6, y: point.y - start.y, active: true, moved: true };
    const preview = roomDragPreview({ session: 1, version: i, x: point.x - start.x, y: point.y - start.y, anchor: point, width, object }, motion);
    close(anchor(preview), { x: point.x + 6, y: point.y });
  }
  const outside = { x: center.x + 250, y: center.y + 180 };
  assert.equal(drag(outside).object.supportId, undefined); close(anchor(drag(outside).object), outside);
  assert.equal(JSON.stringify(world), before);
});

test('surface edge retention prevents flicker but keeps overhanging drops invalid', () => {
  const drag = createRoomDragPlacement(resting, world.objects, width, 1, ['lamp']);
  const hullMaxX = Math.max(...meta.baseHull.map(([x]) => x * lamp.scale));
  const edge = transformRoomObject(resting, [table.position[0] + top.max[0] * table.scale - hullMaxX, resting.position[1], resting.position[2]]);
  assert.equal(drag(anchor(resting)).object.supportId, 'table');
  for (const delta of [.01, -.01, .02, -.02, .01]) {
    const point = anchor(transformRoomObject(edge, [edge.position[0] + delta, edge.position[1], edge.position[2]]));
    const result = drag(point);
    assert.equal(result.object.supportId, 'table', 'The captured table survives tiny boundary crossings');
    assert.equal(result.unsupportedSurfaceId, delta > 0 ? 'table' : undefined);
    close(anchor(result.object), point);
  }
  const far = anchor(transformRoomObject(edge, [edge.position[0] + 1, edge.position[1], edge.position[2]]));
  assert.equal(drag(far).object.supportId, undefined);
});

test('rotated and resized items retain their anchors on rotated supports at different zooms', () => {
  for (const zoom of [.65, 1, 2]) for (const angle of [.3, 1.2]) {
    const owner = transformRoomObject(table, table.position, angle);
    const item = transformRoomObject(lamp, lamp.position, -.4, lamp.scale * .8);
    const placed = transformRoomObject(item, [owner.position[0], height - meta.min[1] * item.scale, owner.position[2]]);
    const drag = createRoomDragPlacement(item, [owner, item], width, zoom, ['lamp']);
    for (const dx of [0, .2, -.2, 1, -1]) {
      const point = { x: anchor(placed).x + dx, y: anchor(placed).y };
      const result = drag(point);
      assert.equal(result.object.supportId, owner.instanceId);
      assert.equal(result.object.heading, item.heading); assert.equal(result.object.scale, item.scale);
      close(anchor(result.object), point);
    }
  }
});

test('an existing lower support wins over overlapping higher furniture until deliberately left', () => {
  const higher = { ...transformRoomObject(table, [table.position[0], table.position[1] + .1, table.position[2]]), instanceId: 'higher' };
  const drag = createRoomDragPlacement(resting, [higher, table, lamp], width, 1, ['lamp']);
  for (const dx of [0, .1, -.1, 1, -1]) {
    const point = { x: anchor(resting).x + dx, y: anchor(resting).y };
    assert.equal(drag(point).object.supportId, 'table');
  }
  const excluded = createRoomDragPlacement(lamp, [table, lamp], width, 1, ['lamp', 'table']);
  assert.equal(excluded(anchor(resting)).object.supportId, undefined, 'Carried objects cannot become their own support');
});

test('a bed crosses fireplace collision edges without snapping away from the finger', () => {
  const room = buildNativeRoomWorld({ width, height: 420, petSize: 80, sizeScale: 1.15, bedId: 'green',
    bedOffset: { x: .3, y: .3 }, toys: [], decorations: [{ decorationId: 'livingFireplaceCream', instanceId: 'fireplace', offset: { x: -.3, y: -.2 } }] });
  const bed = room.objects.find(object => object.instanceId === 'bed'), fireplace = room.objects.find(object => object.instanceId === 'fireplace');
  const drag = createRoomDragPlacement(bed, room.objects, width, .65, ['bed']);
  const validation = createRoomPlacementResolver(room, ['bed']), target = anchor(fireplace);
  let blocked = 0, previousSnapError = 0;
  for (let x = -70; x <= 70; x += 4) for (let y = -40; y <= 60; y += 4) {
    const point = { x: target.x + x, y: target.y + y }, result = drag(point);
    close(anchor(result.object), point);
    assert.equal(result.object.supportId, undefined, 'A bed cannot acquire a tabletop support');
    if (validation.feedback(result.object).blockers.some(hit => hit.instanceId === 'fireplace')) blocked++;
    if (previousSnapError <= 1) {
      const old = validation.preview('bed', point, .65);
      previousSnapError = Math.hypot(old.point.x - point.x, old.point.y - point.y);
    }
  }
  assert.ok(blocked > 0, 'The fireplace still rejects intersecting bed placements');
  assert.ok(previousSnapError > 1, 'This path includes the former magnetic pullback, not just free floor movement');
});
