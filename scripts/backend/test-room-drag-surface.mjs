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
const { buildNativeRoomWorld, hasRoomItemSupport, projectWorld, NATIVE_MODEL_CATALOG } = load('@/utils/native-room-world');
const { roomItemAnchor, createRoomPlacementResolver } = load('@/utils/room-item-placement');
const { transformRoomObject, roomSupport, moveRoomSupportGroup } = load('@/utils/room-support');
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

const { getDecorationDefaultPlacementScale } = load('@/constants/decoration-variants');
function surfaceRoom(holder, item, toy = false, shopSizes = false) {
  const guest = { instanceId: 'guest', offset: { x: .65, y: .65 } };
  const options = { width, height: 420, petSize: 48, sizeScale: 1.15,
    decorations: [{ decorationId: holder, instanceId: 'holder', scale: shopSizes ? getDecorationDefaultPlacementScale(holder) : undefined, offset: { x: 0, y: 0 } }],
    toys: [] };
  if (toy) options.toys.push({ ...guest, toyId: item, scale: .7 });
  else options.decorations.push({ ...guest, decorationId: item, scale: shopSizes ? getDecorationDefaultPlacementScale(item) : undefined });
  const scene = buildNativeRoomWorld(options);
  const [owner, child] = scene.objects;
  const surface = NATIVE_MODEL_CATALOG[owner.modelId].supportSurfaces[0];
  const pointAt = (x, z, top = surface) => {
    const c = Math.cos(owner.heading), s = Math.sin(owner.heading);
    return projectWorld([owner.position[0] + (x * c + z * s) * owner.scale,
      owner.position[1] + top.max[1] * owner.scale + .002,
      owner.position[2] + (-x * s + z * c) * owner.scale], width);
  };
  const center = pointAt((surface.max[0] + surface.min[0]) / 2, (surface.max[2] + surface.min[2]) / 2);
  return { options, scene, owner, child, surface, pointAt, center, resolver: createRoomPlacementResolver(scene, ['guest']) };
}

test('books on mantels and tables, and balls on sofa cushions, preview, drag, save and move with the furniture', () => {
  for (const [holder, item, toy] of [
    ['livingFireplaceCream', 'livingBook'], ['tableTan', 'booksBookGreen'],
    ['sofaA', 'orangeBall', true], ['sofaB', 'pinkBall', true], ['sofaCornerSage', 'blueBall', true],
  ]) {
    const { options, scene, owner, child, surface, center, resolver } = surfaceRoom(holder, item, toy);
    const result = resolver.preview('guest', center);
    assert.equal(result.accepted, true, holder);
    assert.equal(result.object.supportId, 'holder', holder);
    const drag = createRoomDragPlacement(child, scene.objects, width, 1, ['guest']);
    assert.equal(drag(result.point).object.supportId, 'holder');
    assert.equal(resolver.drop('guest', result.point).object.supportId, 'holder');
    assert.ok(Math.abs(result.object.min[1] - owner.position[1] - surface.max[1] * owner.scale - .002) < 1e-6);
    const placed = (toy ? options.toys : options.decorations).at(-1);
    placed.support = roomSupport(result.object, owner);
    const restored = buildNativeRoomWorld(options).objects;
    assert.equal(restored[1].supportId, 'holder');
    assert.ok(restored[1].position.every((v, i) => Math.abs(v - result.object.position[i]) < 1e-6));
    if (toy) {
      assert.equal(restored[1].movable, false, 'floor physics must not dislodge the arranged ball');
      const detach = createRoomDragPlacement(restored[1], restored, width, 1, ['guest'])({ x: 90, y: 80 }).object;
      assert.equal(detach.supportId, undefined);
      assert.equal(detach.movable, true);
    }
    const moved = moveRoomSupportGroup(restored, restored[0], transformRoomObject(owner, [.3, .2, .4], .9));
    const attachment = roomSupport(moved[1], moved[0]);
    assert.ok(attachment.position.every((v, i) => Math.abs(v - placed.support.position[i]) < 1e-6));
    delete placed.support;
    if (toy) assert.equal(buildNativeRoomWorld(options).objects[1].movable, true);
  }
});

test('seats reject lamps and appliances, and the empty corners of a round tabletop cannot support a book', () => {
  for (const item of ['lampTableMushroom', 'kitchenMixerHand']) {
    const { scene, child, center, resolver } = surfaceRoom('sofaA', item);
    assert.equal(resolver.preview('guest', center).feedback.unsupportedSurfaceId, 'holder');
    assert.equal(resolver.drop('guest', center).accepted, false);
    assert.equal(createRoomDragPlacement(child, scene.objects, width, 1, ['guest'])(center).unsupportedSurfaceId, 'holder');
  }
  const { resolver, pointAt, surface } = surfaceRoom('kitchenDiningTable', 'livingBook');
  assert.equal(resolver.move('guest', pointAt(surface.max[0] * .96, surface.max[2] * .96)).object.supportId, undefined);
});

test('a second book can sit on a book, and nested attachments follow a turned table', () => {
  const { options, resolver, center, owner, child } = surfaceRoom('tableTan', 'livingBook');
  const first = resolver.preview('guest', center).object;
  options.decorations[1].support = roomSupport(first, owner);
  options.decorations.push({ ...options.decorations[1], instanceId: 'second', support: undefined });
  const scene = buildNativeRoomWorld(options);
  const [table, book, second] = scene.objects;
  const cover = NATIVE_MODEL_CATALOG[book.modelId].supportSurfaces[0];
  const point = projectWorld([book.position[0], book.position[1] + cover.max[1] * book.scale, book.position[2]], width);
  const stacked = createRoomPlacementResolver(scene, ['second']).preview('second', point);
  assert.equal(stacked.accepted, true, JSON.stringify({ parent: stacked.object.supportId, blockers: stacked.feedback.blockers.map(hit => hit.instanceId), edges: stacked.feedback.boundaries }));
  assert.equal(stacked.object.supportId, 'guest');
  const arrangement = [table, book, stacked.object];
  assert.equal(hasRoomItemSupport(book, arrangement), true);
  assert.equal(hasRoomItemSupport(stacked.object, arrangement), true);
  options.decorations[2].support = roomSupport(stacked.object, book);
  const saved = buildNativeRoomWorld(options).objects;
  const turned = moveRoomSupportGroup(saved, table, transformRoomObject(table, [.4, table.position[1], .4], 1));
  assert.ok(turned.every(object => hasRoomItemSupport(object, turned)));
  assert.equal(child.scale, second.scale);
});

test('a supported sofa ball has a reachable swat and clear floor landing', () => {
  const {findSofaBallPlay} = load('@/utils/native-room-world');
  for (const holder of ['sofaA','sofaB','sofaCornerSage','sofaCreamCloud','sofaBlueClassic','sofaRoseTufted','sofaTanLeather']) {
    const { options, owner, resolver, center } = surfaceRoom(holder, 'blueBall', true, true);
    options.toys[0].support = roomSupport(resolver.preview('guest', center).object, owner);
    const scene = buildNativeRoomWorld(options);
    const play = findSofaBallPlay(scene.objects[1],scene);
    assert.ok(play, holder);
    assert.equal(play.roll.sofaId, 'holder');
    assert.ok(play.roll.end[1] < play.roll.start[1]);
  }
});

test('shelves, dressers, counters and beds accept their everyday contents at a clear spot', () => {
  for (const [holder, item] of [['shelfWood','officeStickyNoteBlue'],['bedroomDresser','japaneseCandle'],
    ['kitchenModernCounterWhite','foodBag'],['japaneseClothesCase','japaneseCup'],
    ['bedroomNightstand','officeStickyNoteBlue'],['bedroomQuiltChest','booksBookGreen'],
    ['kitchenWallCabinetOak','officeStickyNotePink'],['bedroomDoubleBed','sofaPillow'],['bedroomBedRose','livingBook'],
    ['kitchenSinkCabinet','bathroomSoapGreen'],['bathroomDoubleVanity','bathroomSoapRed']]) {
    const { resolver, pointAt, owner } = surfaceRoom(holder,item,false,true);
    let result;
    for (const top of NATIVE_MODEL_CATALOG[owner.modelId].supportSurfaces) {
      for (const x of [.5,.25,.75,.15,.85,.35,.65]) for (const z of [.5,.3,.7,.2,.8]) {
        const point = pointAt(top.min[0]+(top.max[0]-top.min[0])*x,top.min[2]+(top.max[2]-top.min[2])*z, top);
        const trial = resolver.preview('guest',point);
        if (trial.object.supportId === 'holder' && trial.accepted) { result = trial; break; }
      }
    }
    assert.ok(result, item+' on '+holder);
  }
  const dresser = surfaceRoom('bedroomDresser', 'japaneseCandle', false, true);
  const dresserTop = NATIVE_MODEL_CATALOG[dresser.owner.modelId].supportSurfaces.find(s => s.kind === 'top');
  const byVase = dresser.resolver.preview('guest', dresser.pointAt(.18, -.1, dresserTop));
  assert.equal(byVase.accepted, false, 'The built-in vase occupies this part of the dresser');
  const bed = surfaceRoom('bedroomDoubleBed','japaneseCandle');
  assert.equal(bed.resolver.drop('guest',bed.center).accepted,false,'A candle needs a hard surface');
  const sink = surfaceRoom('kitchenSinkCabinet','officeStickyNoteBlue');
  assert.equal(sink.resolver.move('guest',sink.pointAt(0,.05)).object.supportId,undefined,'Nothing floats over the basin');
});

test('a ball can rest on an equipped pet bed without starting the sofa chase', () => {
  const options = { width, height: 420, petSize: 48, sizeScale: 1.15, bedId: 'green', bedScale: 1.3,
    bedOffset: { x: 0, y: .2 }, decorations: [], toys: [{ instanceId: 'ball', toyId: 'pinkBall', offset: { x: .5, y: .3 }, scale: .7 }] };
  const scene = buildNativeRoomWorld(options);
  const owner = scene.objects.find(o => o.instanceId === 'bed');
  const top = NATIVE_MODEL_CATALOG[owner.modelId].supportSurfaces[0];
  const center = projectWorld([owner.position[0], owner.position[1] + top.max[1] * owner.scale, owner.position[2]], width);
  const placed = createRoomPlacementResolver(scene, ['ball']).preview('ball', center);
  assert.equal(placed.accepted, true);
  assert.equal(placed.object.supportId, 'bed');
  options.toys[0].support = roomSupport(placed.object, owner);
  const saved = buildNativeRoomWorld(options), ball = saved.objects.find(o => o.instanceId === 'ball');
  assert.equal(hasRoomItemSupport(ball, saved.objects), true);
  assert.equal(load('@/utils/native-room-world').findSofaBallPlay(ball, saved), undefined);
});
