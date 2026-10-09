/** New shop items remain purchasable, placeable and persistent. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const root = process.cwd(), cache = new Map(), stored = new Map();
const storage = {
  getItem: async key => stored.get(key) ?? null,
  multiSet: async entries => { for (const [key, value] of entries) stored.set(key, value); },
  multiRemove: async keys => { keys.forEach(key => stored.delete(key)); },
};
function load(id) {
  if (id === 'react') return {};
  if (id === 'react-native') return { Dimensions: { get: () => ({ width: 390, height: 844 }) }, PixelRatio: { roundToNearestPixel: n => n } };
  if (id === '@react-native-async-storage/async-storage') return storage;
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : id;
  if (/\.(png|webp|mp4)$/.test(file)) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8')); return module.exports; }
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: load, Date, Math, Set, Map });
  return module.exports;
}
const catalog = load('@/constants/cat-decorations').CAT_DECORATION_CATALOG;
const sections = load('@/utils/decoration-store-sections');
const sofaIds = Array.from(load('@/constants/sofa-decorations').SOFA_DECORATION_IDS).filter(id => !['sofaA', 'sofaB', 'sofaPillow'].includes(id));
const bathtubIds = ['bathroomBathOvalWhite', 'bathroomBathOvalSage', 'bathroomBathOvalRose',
  'bathroomBathOvalCharcoal', 'bathroomBathClawfootCream', 'bathroomBathClawfootNavy',
  'bathroomJacuzziWhite', 'bathroomJacuzziSage'];
const newBathroomIds = ['bathroomDoubleVanity', 'bathroomShowerCabin', 'bathroomLaundryHamper', 'bathroomTowelStand', ...bathtubIds];
const collections = {
  chairs: ['kitchenBarStoolOak', 'kitchenBarStoolMetal', 'kitchenBarStoolVelvet', 'kitchenChairWindsor', 'kitchenChairMint', 'kitchenChairUpholstered', 'kitchenChairBistro', 'chairRockingOak'],
  living: ['chairRockingOak', 'livingFireplaceCream'],
  sofas: sofaIds, bathroom: newBathroomIds,
  carpets: Array.from(sections.DECORATION_IDS_BY_STORE_TAB.carpets).filter(id => id.startsWith('rug')),
  windows: ['windowWhiteClassic', 'windowOakWide', 'windowArched', 'windowRoundPorthole'],
  doors: ['doorOakPanel', 'doorMintGlass', 'doorBarnSliding'],
  lamps: ['lampFloorArc', 'lampFloorTripod', 'lampFloorPaper', 'lampTableMushroom', 'lampTableCeramic', 'lampTableBanker'],
  curtains: Array.from(sections.DECORATION_IDS_BY_STORE_TAB.curtains),
  kitchen: Array.from(sections.DECORATION_IDS_BY_STORE_TAB.kitchen).filter(id => id.startsWith('kitchen')),
  bedroom: Array.from(sections.DECORATION_IDS_BY_STORE_TAB.bedroom).filter(id => id.startsWith('bedroom')),
  halloween: Array.from(sections.DECORATION_IDS_BY_STORE_TAB.halloween) };
const ids = Array.from(new Set(Object.values(collections).flat()));
assert.equal(ids.length, 68);
const { tryPurchaseDecoration, getDecorationStorePrice } = load('@/utils/decoration-store');
const { appendPlacedDecoration } = load('@/utils/room-placement');
const { createDefaultGameSave, parseGameSaveFromValue } = load('@/utils/game-storage');
const { canFlipWallDecoration } = load('@/constants/decoration-variants');
const native = load('@/utils/native-room-world');
const { buildRoomActivity } = load('@/utils/room-activities');
const en = JSON.parse(fs.readFileSync('locales/en.json', 'utf8')).store;
const lv = JSON.parse(fs.readFileSync('locales/lv.json', 'utf8')).store;
const base = { width: 390, height: 420, petSize: 96, sizeScale: 1, decorations: [], toys: [],
  homeOffset: { x: -.3, y: .3 }, ownedToyIds: [], hungry: false, asleep: false };
for (const [section, items] of Object.entries(collections)) {
  assert.ok(sections.DECORATION_STORE_TABS.includes(section));
  for (const id of items) {
    assert.ok(sections.DECORATION_IDS_BY_STORE_TAB[section].includes(id), `${id}: reachable from the shop`);
    assert.ok(fs.existsSync(catalog[id].source), `${id}: thumbnail exists`);
    const thumbnail = await sharp(catalog[id].source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = thumbnail.info;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (x < 4 || x >= width - 4 || y < 4 || y >= height - 4) {
        assert.equal(thumbnail.data[(y * width + x) * channels + 3], 0, `${id}: thumbnail has a clear margin without clipping`);
      }
    }
    assert.ok(en.decorationName[id] && lv.decorationName[id], `${id}: both languages have a name`);
    const price = getDecorationStorePrice(id);
    assert.equal(price.kind, 'coins');
    assert.ok(price.amount > 0);
    const poor = tryPurchaseDecoration({ decorationId: id, walletCoins: price.amount - 1, decorationsUnlocked: [] });
    assert.equal(poor.result, 'insufficient_funds');
    assert.equal(poor.decorationsUnlocked.length, 0);
    const bought = tryPurchaseDecoration({ decorationId: id, walletCoins: 100, decorationsUnlocked: [] });
    assert.equal(bought.result, 'purchased');
    assert.equal(bought.walletCoins, 100 - price.amount);
    const placed = appendPlacedDecoration([], id);
    placed[0].offset = { x: .15, y: -.2 };
    placed[0].scale = 1.3;
    placed[0].wallFlipped = canFlipWallDecoration(id);
    const initial = createDefaultGameSave();
    const save = { ...initial, wallet: { ...initial.wallet, coins: bought.walletCoins },
      progress: { ...initial.progress, decorationsUnlocked: bought.decorationsUnlocked, decorationQuantities: { [id]: 1 } },
      pet: { ...initial.pet, placedDecorations: placed } };
    const reopened = parseGameSaveFromValue(JSON.stringify(save)).save;
    const savedItem = reopened.pet.placedDecorations.find(item => item.decorationId === id);
    assert.ok(savedItem, `${id}: saved placement survives reload`);
    assert.equal(savedItem.scale, 1.3);
    assert.equal(savedItem.offset.x, .15);
    assert.ok(reopened.progress.decorationsUnlocked.includes(id));
    const world = native.buildNativeRoomWorld({ ...base, decorations: [savedItem] });
    const model = world.objects.find(item => item.instanceId === savedItem.instanceId);
    assert.equal(model.modelId, id);
    if (section === 'carpets') {
      assert.equal(model.solid, false, `${id}: the cat can walk across rugs`);
      assert.equal(model.collidable, false, `${id}: rugs never obstruct the tail`);
    }
    if (['windows', 'doors', 'curtains'].includes(section) || id.startsWith('kitchenWallCabinet')) {
      assert.equal(model.solid, false, `${id}: wall fixtures stay off the floor route`);
      assert.equal(canFlipWallDecoration(id), true, `${id}: supports both room walls`);
      assert.equal(savedItem.wallFlipped, true, `${id}: wall orientation survives reload`);
    }
    assert.ok([...model.position, ...model.min, ...model.max].every(Number.isFinite));
    const bytes = fs.readFileSync(`assets/3d/native/${id}.glb`);
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.ok(gltf.meshes.length > 1, `${id}: authored model has recognizable details`);
  }
}
for (const id of sofaIds) for (const wallFlipped of [false, true]) {
  const decoration = { decorationId: id, instanceId: id, offset: { x: 0, y: -.25 }, scale: 1.8, wallFlipped };
  const room = { ...base, decorations: [decoration] };
  const world = native.buildNativeRoomWorld(room), sofa = world.objects[0];
  assert.ok(sofa.seat && sofa.approach && sofa.collisionBoxes.length > 5, `${id}: usable seat and separate collision parts`);
  assert.ok((Math.sin(sofa.seatHeading) + Math.cos(sofa.seatHeading)) / Math.SQRT2 > .5);
  for (const kind of ['sofaSit', 'sofaSleep']) {
    const plan = buildRoomActivity(room, 0, kind, id);
    assert.equal(plan.kind, kind);
    let position = world.home;
    for (const step of plan.steps) {
      const prepared = native.prepareNativeStep(plan, step, native.catScreenPoint(position, world), world, position[1]);
      assert.equal(prepared.native.blocked, false, `${id}/${wallFlipped}/${step.animation}: cat can reach and leave the new sofa`);
      position = prepared.native.path.at(-1);
    }
  }
}
console.log(`Verified all ${ids.length} added models, store sections, localized names, purchases, save reloads and sofa sit/sleep routes.`);

// New fridges match the kitchen reference without changing existing saved sizes.
const fridge = appendPlacedDecoration([], 'kitchenFridge')[0];
assert.equal(fridge.scale, 1.5);
const referenceFridge = { ...fridge, scale: 1.5 };
const placedFridgeModel = native.buildNativeRoomWorld({ ...base, decorations: [fridge] }).objects[0];
const referenceFridgeModel = native.buildNativeRoomWorld({ ...base, decorations: [referenceFridge] }).objects[0];
assert.deepEqual(Array.from(placedFridgeModel.min), Array.from(referenceFridgeModel.min));
assert.deepEqual(Array.from(placedFridgeModel.max), Array.from(referenceFridgeModel.max));
for (const scale of [undefined, 1, 1.5, 2.2]) {
  const save = createDefaultGameSave();
  save.progress.decorationsUnlocked = ['kitchenFridge'];
  save.progress.decorationQuantities = { kitchenFridge: 1 };
  save.pet.placedDecorations = [{ ...fridge, scale }];
  const reopened = parseGameSaveFromValue(JSON.stringify(save)).save;
  const before = native.buildNativeRoomWorld({ ...base, decorations: save.pet.placedDecorations }).objects[0];
  const after = native.buildNativeRoomWorld({ ...base, decorations: reopened.pet.placedDecorations }).objects[0];
  assert.equal(after.scale, before.scale, 'Existing fridge dimensions survive the new placement default');
  assert.deepEqual(Array.from(after.min), Array.from(before.min));
  assert.deepEqual(Array.from(after.max), Array.from(before.max));
}
console.log('Verified fridge placement matches the 1.5-scale kitchen reference and existing fridge sizes survive reload.');

// The brass arc lamp in the reference room is 1.8 times its original size.
const lamp = appendPlacedDecoration([], 'lampFloorArc')[0];
assert.equal(lamp.scale, 1.8);
for (const scale of [undefined, .7, 1, 1.8, 2.2]) {
  const save = createDefaultGameSave();
  save.progress.decorationsUnlocked = ['lampFloorArc'];
  save.progress.decorationQuantities = { lampFloorArc: 1 };
  save.pet.placedDecorations = [{ ...lamp, scale }];
  const reopened = parseGameSaveFromValue(JSON.stringify(save)).save;
  const before = native.buildNativeRoomWorld({ ...base, decorations: save.pet.placedDecorations }).objects[0];
  const after = native.buildNativeRoomWorld({ ...base, decorations: reopened.pet.placedDecorations }).objects[0];
  assert.equal(after.scale, before.scale, 'Saved lamp sizes retain their dimensions, including old defaults');
}
const lampBytes = fs.readFileSync('assets/3d/native/lampFloorArc.glb');
const lampJsonLength = lampBytes.readUInt32LE(12);
const lampGltf = JSON.parse(lampBytes.subarray(20, 20 + lampJsonLength).toString());
const stemNode = lampGltf.nodes.find(node => node.name === 'Brass arch stem');
const stemAccessor = lampGltf.accessors[lampGltf.meshes[stemNode.mesh].primitives[0].attributes.POSITION];
const stemView = lampGltf.bufferViews[stemAccessor.bufferView];
assert.equal(stemAccessor.componentType, 5126);
let uprightVertices = 0;
for (let i = 0; i < stemAccessor.count; i++) {
  const offset = 28 + lampJsonLength + (stemView.byteOffset ?? 0) + (stemAccessor.byteOffset ?? 0) + i * (stemView.byteStride ?? 12);
  const x = lampBytes.readFloatLE(offset), y = lampBytes.readFloatLE(offset + 4);
  if (y > .25 && y < 1.2) {
    uprightVertices++;
    assert.ok(Math.abs(x + .30) <= .02601, 'The exported upright stays inside a straight vertical tube, without a bowed middle');
  }
}
assert.ok(uprightVertices > 100, 'Check the shipped stem geometry throughout the upright');
console.log('Verified the 1.8-scale lamp placement, saved resizing, and a straight upright in the exported model.');

// Fresh purchases match the actual bathroom reference. Resizing and legacy
// placements retain their saved dimensions, including an omitted old scale.
for (const [id, expectedScale] of [['bathroomBathAni', 1.8], ['bathroomWcAni', 1.3], ...bathtubIds.map(id => [id, 1.8])]) {
  const placed = appendPlacedDecoration([], id)[0];
  assert.equal(placed.scale, expectedScale, `${id}: bathroom default size`);
  assert.equal(canFlipWallDecoration(id), true, `${id}: can face either wall`);
  for (const scale of [undefined, .7, 1, expectedScale, 2.2]) {
    const save = createDefaultGameSave();
    save.progress.decorationsUnlocked = [id];
    save.progress.decorationQuantities = { [id]: 1 };
    save.pet.placedDecorations = [{ ...placed, scale }];
    const reopened = parseGameSaveFromValue(JSON.stringify(save)).save;
    const before = native.buildNativeRoomWorld({ ...base, decorations: save.pet.placedDecorations }).objects[0];
    const after = native.buildNativeRoomWorld({ ...base, decorations: reopened.pet.placedDecorations }).objects[0];
    assert.equal(after.scale, before.scale, `${id}: saved size survives reload`);
    assert.deepEqual(Array.from(after.min), Array.from(before.min));
    assert.deepEqual(Array.from(after.max), Array.from(before.max));
  }
}
for (const id of bathtubIds) {
  const bytes = fs.readFileSync(`assets/3d/native/${id}.glb`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const names = gltf.nodes.map(node => node.name ?? '');
  assert.ok(names.includes('Recessed bath water'), `${id}: water is inside the basin`);
  const style = id.includes('Clawfoot') ? 'Clawfoot bath shell' : id.includes('Jacuzzi') ? 'Jetted tub shell' : 'Oval bath shell';
  assert.ok(names.includes(style), `${id}: distinct authored tub style`);
  if (id.includes('Jacuzzi')) {
    assert.equal(names.filter(name => name.startsWith('Jacuzzi jet nozzle')).length, 4);
    assert.equal(names.filter(name => name.startsWith('Jacuzzi headrest')).length, 2);
    assert.ok(names.includes('Jacuzzi control panel'));
  }
}
console.log('Verified bathroom default sizes, saved resizing, rotation, and all eight bathtub models.');
