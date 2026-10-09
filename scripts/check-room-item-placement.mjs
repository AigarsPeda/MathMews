/** Exercise real rotated models, swept movement, saved angles and legacy recovery. */
import assert from 'node:assert/strict';
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
  }).outputText, { module, exports: module.exports, require: load });
  return module.exports;
}
const { buildNativeRoomWorld, projectWorld, NATIVE_MODEL_CATALOG, ROOM_SPAN } = load('@/utils/native-room-world');
const { roomItemAnchor, roomItemAtPoint, createRoomPlacementResolver } = load('@/utils/room-item-placement');
const { updatePlacedDecorationOffsetByInstance, normalizePlacedDecorations } = load('@/utils/room-placement');
function at(object, x, z, width) {
  const centerY = (object.min[1] + object.max[1]) / 2;
  return roomItemAtPoint(object, projectWorld([x, centerY, z], width), width);
}
for (const width of [320, 414, 768]) {
  const input = { width, height: width * 1.1, petSize: width / 3, sizeScale: width / 390,
    decorations: [{ decorationId: 'sofaA', instanceId: 'sofa', offset: { x: 0, y: 0 } },
      { decorationId: 'chairRockingOak', instanceId: 'chair', offset: { x: 0, y: 0 }, rotationDegrees: 20 }], toys: [] };
  const world = buildNativeRoomWorld(input);
  const sofa = at(world.objects[0], 0, -.8, width), chair = at(world.objects[1], 0, 1.4, width);
  world.objects = [sofa, chair];
  const resolver = createRoomPlacementResolver(world);
  assert.ok(resolver.canPlace(chair));
  const rotated = buildNativeRoomWorld({...input,decorations:[{...input.decorations[1],rotationDegrees:90}]}).objects[0];
  const enlarged = buildNativeRoomWorld({...input,decorations:[{...input.decorations[1],scale:1.5}]}).objects[0];
  let blockedRotation=false,blockedResize=false;
  for(let z=-.5;z<=1.6;z+=.02) {
    const before=at(rotated,0,z,width);
    if(!resolver.canPlace(before))continue;
    const afterRotation=at(chair,0,z,width),afterResize=at(enlarged,0,z,width);
    if(!resolver.canPlace(afterRotation)){assert.equal(resolver.canChange(before,afterRotation),false);blockedRotation=true;}
    if(!resolver.canPlace(afterResize)){assert.equal(resolver.canChange(before,afterResize),false);blockedResize=true;}
  }
  assert.ok(blockedRotation,'A rotation near the sofa cannot create an overlap');
  assert.ok(blockedResize,'Making a nearby chair bigger cannot intersect the sofa');
  const inside = roomItemAnchor(at(chair, 0, -.8, width), width);
  const original = JSON.stringify(world);
  const stopped = resolver.move('chair', inside);
  assert.ok(resolver.canPlace(stopped.object), 'Dragging a rotated chair cannot intersect the sofa');
  assert.ok(stopped.object.position[2] > sofa.position[2], 'The chair stops at the near edge');
  const through = resolver.move('chair', roomItemAnchor(at(chair, 0, -2, width), width));
  assert.ok(through.object.position[2] > sofa.position[2], 'A large gesture cannot tunnel through furniture');
  for (const pose of [stopped.object, through.object]) assert.equal(pose.heading, 20 * Math.PI / 180);
  let preview = chair;
  for (let frame = 0; frame < 120; frame++) {
    preview = resolver.move('chair', inside, preview).object;
    assert.equal(preview.heading, chair.heading, 'Live movement retains the exact saved angle');
    assert.ok(resolver.canPlace(preview));
  }
  assert.equal(JSON.stringify(world), original, 'Preview never mutates the saved room');
  const point = roomItemAnchor(stopped.object, width);
  const size = stopped.object.scale * width * NATIVE_MODEL_CATALOG[chair.modelId].renderScale / ROOM_SPAN;
  const offset = { x: point.x / ((width - size) / 2), y: point.y / ((input.height - size) / 2) };
  const saved = normalizePlacedDecorations(JSON.parse(JSON.stringify(updatePlacedDecorationOffsetByInstance(input.decorations, 'chair', offset))));
  const reloaded = buildNativeRoomWorld({ ...input, decorations: saved }).objects[1];
  assert.equal(reloaded.heading, chair.heading, 'Save/reload after moving retains 20 degrees');
  assert.ok(reloaded.position.every((v, i) => Math.abs(v - stopped.object.position[i]) < 1e-8));
  const legacy = at(chair, 0, -.8, width);
  const legacyWorld = { ...world, objects: [sofa, legacy] };
  const repaired = createRoomPlacementResolver(legacyWorld).move('chair', roomItemAnchor(chair, width));
  assert.ok(createRoomPlacementResolver(legacyWorld).canPlace(repaired.object), 'Existing overlaps can be pulled apart');
  const relocated = createRoomPlacementResolver(legacyWorld).nearestFree(legacy);
  assert.ok(relocated && createRoomPlacementResolver(legacyWorld).canPlace(relocated), 'New furniture can be relocated to empty space');
  assert.equal(relocated.heading,chair.heading);
  const outside = at(chair, 0, 3.2, width);
  const recovered = createRoomPlacementResolver({ ...world, objects: [outside] }).move('chair', roomItemAnchor(chair, width));
  assert.ok(resolver.canPlace(recovered.object), 'An old out-of-bounds placement can move back into the room');
}
// Thin rotated models whose axis-aligned bounds overlap can still fit side by side.
const meta = NATIVE_MODEL_CATALOG.chairRockingOak;
const synthetic = (id, x, z) => ({ instanceId: id, modelId: 'chairRockingOak', heading: Math.PI / 4,
  scale: .5, position: [x, .068, z], min: [-1, .068, -1], max: [1, 1, 1], solid: true, movable: false });
const a = synthetic('a', 0, 0), b = synthetic('b', .8, .8);
assert.ok(meta.max[0] > meta.min[0]);
assert.ok(createRoomPlacementResolver({ width: 390, objects: [a, b] }).canPlace(a), 'Rotated footprints avoid false collisions from overlapping AABBs');
const windowWorld = buildNativeRoomWorld({ width: 390, height: 420, petSize: 120, sizeScale: 1,
  decorations: [{ decorationId: 'windowOakWide', instanceId: 'window', offset: { x: .35, y: -.4 }, rotationDegrees: 20 }], toys: [] });
const window = windowWorld.objects[0];
const shifted = createRoomPlacementResolver(windowWorld).move('window', { x: 20, y: -45 }).object;
assert.equal(shifted.heading, window.heading);
assert.equal(shifted.position[window.wallAxis], window.position[window.wallAxis], 'Wall-mounted items remain on their mounting plane');
console.log('Verified rotated furniture collisions, no tunneling, retained 20-degree yaw, saved placement, wall movement and legacy overlap recovery.');
const door={decorationId:'japaneseDoorAni',instanceId:'door',offset:{x:-.4,y:-.3},rotationDegrees:20};
const movedDoor=updatePlacedDecorationOffsetByInstance([door],'door',{x:.4,y:-.3})[0];
assert.equal(movedDoor.wallFlipped,true,'Moving a legacy door across the screen does not turn it onto the other wall');
assert.equal(movedDoor.rotationDegrees,20);
