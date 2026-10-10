import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import babel from '@babel/core';

const cache = new Map(), mocks = {};
function load(id) {
  if (id in mocks) return mocks[id];
  const file = path.resolve(id.startsWith('@/') ? id.slice(2) : id);
  if (/\.(png|glb)$/.test(file)) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  else vm.runInNewContext(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, require: load, React: mocks.react });
  return module.exports;
}
const { WALL_SPOTLIGHT_DECORATION_IDS: ids } = load('@/constants/home-details-decorations');
const placement = load('@/utils/room-placement');
const store = load('@/utils/decoration-store');
const { buildNativeRoomWorld } = load('@/utils/native-room-world');
const { lampLightConfig } = load('@/utils/native-lamp-light');
const { canFlipWallDecoration } = load('@/constants/decoration-variants');
const { roomItemAtPoint, roomItemAnchor } = load('@/utils/room-item-placement');
const data = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const english = data('locales/en.json'), latvian = data('locales/lv.json');
assert.equal(ids.length, 6);
for (const id of ids) {
  assert.ok(store.LAMP_DECORATION_STORE_IDS.includes(id));
  assert.ok(canFlipWallDecoration(id));
  const price = store.getDecorationStorePrice(id);
  assert.equal(price.kind, 'coins');
  assert.ok(price.amount > 0);
  const purchase = store.tryPurchaseDecoration({ decorationId: id, walletCoins: 100, decorationsUnlocked: [] });
  assert.equal(purchase.result, 'purchased');
  assert.equal(purchase.walletCoins, 100 - price.amount);
  assert.ok(english.store.decorationName[id] && latvian.store.decorationName[id]);
  assert.ok(fs.existsSync(`assets/3d/decoration/${id}.png`));
  const bytes = fs.readFileSync(`assets/3d/native/${id}.glb`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const head = gltf.nodes.find(node => node.name === 'Spotlight head');
  assert.ok(head && head.children.length === 2, 'Head and lens share the movable pivot');
  assert.ok(head.children.some(index => gltf.nodes[index].name === 'Spotlight lens'));
  assert.ok(!head.children.some(index => gltf.nodes[index].name === 'Wall backplate'));
  for (const width of [320, 414, 768]) for (const wallFlipped of [false, true]) {
    const placed = { decorationId: id, instanceId: 'spot', offset: { x: wallFlipped ? -.2 : .2, y: -.7 }, wallFlipped, poweredOn: true };
    const world = buildNativeRoomWorld({ width, height: width * 1.1, petSize: width / 3, sizeScale: width / 390, decorations: [placed], toys: [] });
    const object = world.objects[0], normal = wallFlipped ? 0 : 2;
    assert.equal(object.wallAxis, normal);
    assert.equal(object.solid, false);
    assert.ok(Math.abs(object.min[normal] + 2.35) < .002, `The backplate mounts flush to the wall: ${id} ${width} ${normal} ${object.min[normal]}`);
    const floor = lampLightConfig(object);
    assert.ok(floor.direction[normal] > 0 && floor.direction[1] < 0, 'Area preset aims inward and downward');
    const picture = lampLightConfig({ ...object, spotlightAngle: 55 });
    assert.ok(picture.direction[normal] < 0 && picture.direction[1] < 0, 'Painting preset aims back toward the wall');
    const t = (-2.35 - picture.position[normal]) / picture.direction[normal];
    assert.ok(t > 0 && picture.position[1] + picture.direction[1] * t > .2, 'Beam reaches the wall above the floor');
    assert.equal(lampLightConfig({ ...object, poweredOn: false }), undefined);
    const anchor = roomItemAnchor(object, width);
    const moved = roomItemAtPoint(object, { x: anchor.x + 20, y: anchor.y + 10 }, width);
    assert.equal(moved.position[normal], object.position[normal], 'Dragging stays on the mounting plane');
  }
  const saved = placement.normalizePlacedDecorations([{ decorationId: id, instanceId: 'one', offset: { x: .2, y: -.7 }, poweredOn: true, spotlightAngle: 55 }]);
  assert.equal(saved[0].spotlightAngle, 55);
  const adjusted = placement.aimPlacedSpotlightByInstance([...saved, { ...saved[0], instanceId: 'two' }], 'one', -40);
  assert.equal(adjusted[0].spotlightAngle, -40);
  assert.equal(adjusted[1].spotlightAngle, 55, 'Angle is saved independently per spotlight');
  assert.equal(placement.normalizePlacedDecorations([{ ...saved[0], spotlightAngle: Infinity }])[0].spotlightAngle, -25);
  assert.equal(placement.normalizePlacedDecorations([{ ...saved[0], spotlightAngle: 999 }])[0].spotlightAngle, 75);
  const flipped = placement.updatePlacedDecorationWallFlipByInstance(saved, 'one', true);
  assert.equal(flipped[0].offset.x, -.2);
  assert.equal(flipped[0].spotlightAngle, 55);
  assert.equal(flipped[0].offset.y, saved[0].offset.y);
  assert.equal(placement.updatePlacedDecorationWallFlipByInstance(flipped, 'one', false)[0].offset.x, .2);
  const repaired = buildNativeRoomWorld({ width: 390, height: 430, petSize: 90, sizeScale: 1,
    decorations: [{ ...saved[0], wallFlipped: true }], toys: [] }).objects[0];
  assert.ok(repaired.min[2] >= -2.301, 'A legacy flip beyond the corner is brought back onto the visible wall');
  assert.ok(repaired.placementOffset, 'The corrected anchor can be persisted by the editor');
}

// Exercise the actual native head component, including multiple previews.
const writes = [];
const makeMatrix = (ops = []) => ({ translation: [0, .3, .4],
  translate: value => makeMatrix([...ops, ['translate', [...value]]]),
  rotate: (angle, axis) => makeMatrix([...ops, ['rotate', angle, [...axis]]]), ops });
const entity = { id: 1 }, backplate = { id: 2 }, matrix = makeMatrix();
mocks.react = { useMemo: fn => fn() };
mocks['react-native-filament'] = {
  useFilamentContext: () => ({ nameComponentManager: { getEntityName: entity => entity.id === 1 ? 'Spotlight head' : 'Wall backplate' },
    transformManager: { getTransform: () => matrix, setTransform: (entity, matrix) => writes.push([entity, matrix.ops]) } }),
  useWorkletEffect: fn => fn(),
};
const { NativeSpotlightHead } = load('@/components/pet/native/NativeSpotlightHead');
for (const angle of [-25, 55, -60, 75]) NativeSpotlightHead({ asset: { getEntities: () => [entity, backplate] }, angle });
assert.equal(writes.length, 4);
for (const [index, [target, ops]] of writes.entries()) {
  assert.equal(target, entity, 'Aiming never transforms the backplate');
  assert.deepEqual(ops[0], ['translate', [-0, -.3, -.4]]);
  assert.equal(ops[1][1], [-25, 55, -60, 75][index] * Math.PI / 180);
  assert.deepEqual(ops[2], ['translate', [0, .3, .4]]);
}
console.log('Verified six purchasable spotlight finishes, emitted lens assets, both wall mounts, beam targets, drag planes, saved angles and native head pivots.');

// Compile with Metro's React Compiler and worklet plugins, as on the device.
for (const filename of ['NativeSpotlightHead', 'NativeLampLight', 'NativeLampGlow']) {
  const code = babel.transformFileSync(`components/pet/native/${filename}.tsx`, {
    caller: { name: 'metro', platform: 'ios', engine: 'hermes', isDev: true, bundler: 'metro', supportsReactCompiler: true },
  }).code;
  assert.ok(code.includes('__workletHash'));
  assert.ok(!code.includes('_temp'), 'Native closures must not capture compiler-hoisted regular callbacks');
}

let callback, lastConfig, handle, creates = 0, effectLight;
const poses = [], directions = [], applied = { value: [] };
mocks.react.useEffect = (fn, deps) => {
  if (effectLight !== deps[1]) { effectLight = deps[1]; fn(); }
};
mocks.react.createElement = (type, props) => ({ type, props });
mocks['react-native-worklets-core'] = { useSharedValue: () => applied };
Object.assign(mocks['react-native-filament'], {
  useFilamentContext: () => ({ scene: {}, lightManager: {
    setPosition: (_light, position) => poses.push([...position]),
    setDirection: (_light, direction) => directions.push([...direction]),
  } }),
  useLightEntity: (_manager, config) => {
    const key = JSON.stringify(config);
    if (key !== lastConfig) { lastConfig = key; handle = { id: ++creates }; }
    return handle;
  },
  useEntityInScene: () => {},
  RenderCallbackContext: { useRenderCallback: fn => { callback = fn; } },
});
const { NativeLampLight } = load('@/components/pet/native/NativeLampLight');
const object = buildNativeRoomWorld({ width: 390, height: 430, petSize: 90, sizeScale: 1,
  decorations: [{ decorationId: ids[0], instanceId: 'spot', offset: { x: .2, y: -.7 }, poweredOn: true }], toys: [] }).objects[0];
const preview = { value: undefined };
for (const angle of [-25, 0, 55, 75]) {
  const node = NativeLampLight({ object: { ...object, spotlightAngle: angle }, active: true, editingObject: preview });
  node.type(node.props); callback();
  const light = lampLightConfig({ ...object, spotlightAngle: angle });
  assert.deepEqual(directions.at(-1), Array.from(light.direction));
  assert.deepEqual(poses.at(-1), Array.from(light.position));
}
assert.equal(creates, 1, 'Angle previews retain the same native light entity');
const updates = poses.length;
for (let i = 0; i < 120; i++) callback();
assert.equal(poses.length, updates, 'An unmoving spotlight has no idle native writes');
preview.value = { ...object, position: object.position.map((v, i) => v + (i === 0 ? .2 : 0)), heading: Math.PI / 2 };
callback();
assert.ok(directions.at(-1)[0] < 0 && Math.abs(directions.at(-1)[2]) < 1e-6, 'Preview heading rotates the beam with the mounted fixture');
assert.equal(creates, 1, 'Dragging updates the existing light');
console.log('Verified device Babel compilation, native beam/head previews, drawing-thread pose changes, retained light handles and idle work.');

// Native host arrays can expose iterators tied to the originating JS runtime.
// Drawing-thread updates must read their numeric elements without iterating them.
const lampModule = load('@/utils/native-lamp-light');
const originalConfig = lampModule.lampLightConfig;
function hostArray(values) {
  Object.defineProperty(values, Symbol.iterator, { value() { throw new Error('Cross-runtime array iterator'); } });
  return values;
}
lampModule.lampLightConfig = object => {
  const config = originalConfig(object);
  if (config) { hostArray(config.position); hostArray(config.direction); }
  return config;
};
try {
  preview.value = undefined;
  const node = NativeLampLight({ object, active: true, editingObject: preview });
  node.type(node.props); callback();
  assert.deepEqual(poses.at(-1), Array.from(originalConfig(object).position));
} finally { lampModule.lampLightConfig = originalConfig; }

const emissions = [];
const glowMaterial = { setFloat4Parameter: (name, value) => emissions.push([name, Array.from(value)]) };
mocks.react.useMemo = fn => hostArray(fn());
mocks['react-native-filament'].useFilamentContext = () => ({
  renderableManager: { getPrimitiveCount: () => 1, getMaterialInstanceAt: () => glowMaterial },
  nameComponentManager: { getEntityName: () => 'Spotlight lens' },
});
const { NativeLampGlow } = load('@/components/pet/native/NativeLampGlow');
for (const poweredOn of [true, false, true]) NativeLampGlow({
  asset: { getRenderableEntities: () => [entity] }, modelId: 'wallSpotBellBrass', poweredOn,
});
assert.deepEqual(emissions.map(([, values]) => values), [[1, .78, .44, 1], [0, 0, 0, 1], [1, .78, .44, 1]]);
console.log('Verified beam and lens power updates without cross-runtime array iterators.');

mocks['react-native-filament'].useFilamentContext = () => ({ scene: {}, lightManager: {
  setPosition: (_light, position) => poses.push(Array.from(position)),
  setDirection: (_light, direction) => directions.push(Array.from(direction)),
} });
// A replacement light starts at the origin and must get the unchanged saved pose.
lastConfig = undefined;
const beforeReplacement = poses.length;
const replacement = NativeLampLight({ object, active: true, editingObject: preview });
replacement.type(replacement.props); callback();
assert.equal(poses.length, beforeReplacement + 1, 'Light replacement invalidates its applied pose cache');
assert.deepEqual(poses.at(-1), Array.from(originalConfig(object).position));
console.log('Verified replacement light entities reapply their saved pose after refresh.');
