/** Every sale item is reachable, with sensible cross-pack category assignments. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
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
const { CAT_DECORATION_IDS, CAT_DECORATION_CATALOG } = load('@/constants/cat-decorations');
const { isCanonicalDecorationStoreId } = load('@/constants/decoration-variants');
const { getDecorationStorePrice } = load('@/utils/decoration-store');
const { DECORATION_STORE_TABS, DECORATION_STORE_CATEGORY_GROUPS, DECORATION_IDS_BY_STORE_TAB, DECORATION_STORE_SUBTITLE_KEY } = load('@/utils/decoration-store-sections');
const canonicalIds = Array.from(CAT_DECORATION_IDS).filter(isCanonicalDecorationStoreId);
const tabs = Array.from(DECORATION_STORE_TABS);
assert.equal(new Set(tabs).size, tabs.length, 'Each category appears once in the picker');
assert.deepEqual(tabs.toSorted(), Object.keys(DECORATION_IDS_BY_STORE_TAB).toSorted(), 'Every category can be selected');
const reachable = new Set();
for (const tab of tabs) {
  const ids = Array.from(DECORATION_IDS_BY_STORE_TAB[tab]);
  assert.ok(ids.length > 0, `${tab}: no empty categories`);
  assert.equal(new Set(ids).size, ids.length, `${tab}: no repeated cards`);
  for (const id of ids) {
    assert.ok(CAT_DECORATION_CATALOG[id], `${tab}/${id}: valid catalog item`);
    assert.ok(isCanonicalDecorationStoreId(id), `${tab}/${id}: orientation variants stay in the editor`);
    const price = getDecorationStorePrice(id);
    assert.ok(price.kind === 'free' || (price.kind === 'coins' && Number.isFinite(price.amount) && price.amount > 0), `${id}: valid sale price`);
    reachable.add(id);
  }
}
assert.deepEqual([...reachable].toSorted(), canonicalIds.toSorted(), 'Every purchasable decoration remains reachable');
const expected = {
  lamps: ['bedroomFloorLamp', 'japaneseLamp', 'lavaLampOff', 'lavaLampAni', 'halloweenGhostLantern'],
  carpets: ['bathroomBathCarpet'], plants: ['japaneseBonsai', 'japanesePlant'],
  chairs: ['chairRockingOak', 'japaneseSeat', 'kitchenBarStoolOak', 'kitchenChairMint'],
  desks: ['officeDrawingTable'], tables: ['livingTable', 'japaneseTable', 'kitchenIsland', 'kitchenDiningTable'],
  furniture: ['bedroomWardrobe', 'kitchenWallCabinetOak', 'livingShelvingA', 'bathroomSmallShelf', 'officeRack'],
  appliances: ['kitchenFridge', 'kitchenMixerHand', 'cleaningRobot', 'officeRumbaRobot', 'livingAirCon'],
  doors: ['japaneseDoorAni', 'japaneseSlidingDoorAni'], windows: ['bathroomBathWindow'],
  books: ['livingBook', 'officePaper1', 'officeStickyNoteBlue', 'officePencilHolder'],
  posters: ['portraitCat', 'japaneseCanvas', 'officeClockAni', 'bathroomMirror'],
  tvs: ['officeTvOff', 'livingSpeaker'], accessories: ['sofaPillow', 'japaneseVase'],
  living: ['sofaCornerSage', 'chairRockingOak', 'livingFireplaceCream', 'lampFloorArc'],
  bedroom: ['bedroomDoubleBed', 'bedroomWardrobe', 'bedroomFloorLamp'],
  kitchen: ['kitchenIsland', 'kitchenChairMint', 'kitchenBarStoolOak', 'kitchenMixerStand'],
};
for (const [tab, ids] of Object.entries(expected)) for (const id of ids) {
  assert.ok(DECORATION_IDS_BY_STORE_TAB[tab].includes(id), `${id}: available in ${tab}`);
}
for (const id of ['lavaLampAni', 'cleaningRobot', 'tableTan']) assert.ok(!DECORATION_IDS_BY_STORE_TAB.furniture.includes(id), `${id}: moved out of storage`);
assert.ok(!DECORATION_IDS_BY_STORE_TAB.sofas.includes('sofaPillow'), 'Cushions belong to small decor');
for (const locale of ['en', 'lv']) {
  const translations = JSON.parse(fs.readFileSync(`locales/${locale}.json`, 'utf8')).store;
  for (const tab of tabs) {
    assert.ok(translations[`tab${tab[0].toUpperCase()}${tab.slice(1)}`], `${locale}/${tab}: category label`);
    assert.ok(translations[DECORATION_STORE_SUBTITLE_KEY[tab].split('.')[1]], `${locale}/${tab}: subtitle`);
  }
  for (const group of DECORATION_STORE_CATEGORY_GROUPS) assert.ok(translations[group.titleKey.split('.')[1]], `${locale}: group heading`);
  for (const id of canonicalIds) assert.ok(translations.decorationName[id], `${locale}/${id}: item name`);
}
console.log(`Verified all ${canonicalIds.length} purchasable decorations across ${tabs.length} grouped categories in both languages.`);
