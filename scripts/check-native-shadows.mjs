import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd(), cache = new Map(), flags = [], lights = [];
let supported, renderCallbacks = 0, enumerations = 0;
const manager = { get shadowMapsSupported() { return supported; } };
const mocks = {
  react: { useMemo: fn => fn(), useEffect() {} },
  '@/hooks/use-world-clock-now': { useWorldClockNow: () => 1_790_000_000_000 },
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
  'react-native-worklets-core': { useSharedValue: value => ({ value }) },
  'react-native-filament': {
    useFilamentContext: () => ({ lightManager: manager, scene: {}, renderableManager: {
      setCastShadow: (entity, value) => flags.push([entity.id, 'cast', value]),
      setReceiveShadow: (entity, value) => flags.push([entity.id, 'receive', value]),
    } }),
    useWorkletEffect: fn => fn(),
    useLightEntity: (_manager, config) => { lights.push(config); return config; },
    useEntityInScene() {}, EnvironmentalLight: 'Environment',
    RenderCallbackContext: { useRenderCallback() { renderCallbacks++; } },
  },
};
function load(id, parent = root) {
  if (id in mocks) return mocks[id];
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(parent, id);
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  else {
    const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require: id => load(id, path.dirname(resolved)), Math, Map, Set });
  }
  return module.exports;
}
const { useModelShadows: renderShadowHook } = load('@/components/pet/native/use-model-shadows');
const asset = { getRenderableEntities() { enumerations++; return [{ id: 1 }, { id: 2 }]; } };
for (supported of [false, undefined]) {
  renderShadowHook(asset);
  assert.equal(enumerations, 0, 'Simulator and older native binaries retain the shadow fallback');
}
supported = true;
renderShadowHook(undefined);
assert.equal(flags.length, 0, 'A loading model is safe');
renderShadowHook(asset);
assert.deepEqual(flags, [[1, 'cast', true], [1, 'receive', true], [2, 'cast', true], [2, 'receive', true]]);
assert.equal(renderCallbacks, 0, 'Shadow flags do not add per-frame JS/native work');

const { shadowCastingLampIds } = load('@/utils/native-shadows');
const lamp = (modelId, instanceId, poweredOn = true) => ({ modelId, instanceId, poweredOn,
  position: [0, .068, 0], heading: 0, scale: 1 });
const objects = [lamp('sofaA', 'sofa'), lamp('lavaLampAni', 'lava'), lamp('bedroomFloorLamp', 'off', false),
  lamp('wallSpotBarChrome', 'spot'), lamp('lampFloorTripod', 'floor'), lamp('bedroomFloorLamp', 'third')];
const chosen = shadowCastingLampIds(objects);
assert.deepEqual([...chosen], ['spot', 'floor'], 'Off/point lights do not consume the two spotlight maps');
assert.deepEqual([...shadowCastingLampIds(objects.slice(0, 3))], []);
const { NativeWorldLighting } = load('@/components/pet/native/NativeWorldLighting');
const { NativeLampLight } = load('@/components/pet/native/NativeLampLight');
const clock = { realMs: 1_790_000_000_000, worldMs: 13 * 3_600_000, speed: 60, weather: 'clear' };
for (supported of [false, true, undefined]) {
  lights.length = 0;
  NativeWorldLighting({ clock, active: true });
  assert.equal(lights[0].castShadows, supported === true);
  assert.equal(lights[1].castShadows, false, 'Ambient fill stays inexpensive');
  for (const object of objects.slice(1)) {
    const node = NativeLampLight({ object, active: true, castShadows: chosen.has(object.instanceId) });
    if (!object.poweredOn) { assert.equal(node, null); continue; }
    node.type(node.props);
    assert.equal(lights.at(-1).castShadows, supported === true && chosen.has(object.instanceId));
  }
}
console.log('Verified model cast/receive flags, loading safety, simulator/old-binary fallback, device sun/lamps, bounded local maps and no per-frame shadow setup.');
