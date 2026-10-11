import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd(), cache = new Map();
let now = 1_790_000_000_000, renderFrame, shared, created = 0, lightUpdates = 0, collectEffects = false;
const effects = [];
const nativeLights = new Map(), sceneLights = new Set();
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useMemo: fn => fn(), useCallback: fn => fn, useEffect(fn) { if (collectEffects) effects.push(fn); },
  useState: value => [typeof value === 'function' ? value() : value, () => {}],
};
const mocks = {
  react,
  './NativeWindowLight': { NativeWindowLight: 'WindowLight' },
  '@react-native-async-storage/async-storage': {},
  '@/hooks/use-world-clock-now': { useWorldClockNow: () => now },
  'react-native-worklets-core': { useSharedValue: initial => shared ??= { value: initial } },
  'react-native-filament': {
    EnvironmentalLight: 'Environment',
    useFilamentContext: () => ({ scene: sceneLights, lightManager: {
      setIntensity: (entity, intensity) => { entity.intensity = intensity; lightUpdates++; },
      setColor: (entity, color) => { entity.color = color; },
      setPosition: (entity, position) => { entity.position = position; },
      setDirection: (entity, direction) => { entity.direction = direction; },
    }, renderableManager: {
      getPrimitiveCount: entity => entity.materials.length,
      getMaterialInstanceAt: (entity, index) => entity.materials[index],
    }, nameComponentManager: { getEntityName: entity => entity.name } }),
    useLightEntity: (_, config) => {
      const key = config.type;
      if (JSON.stringify(nativeLights.get(key)?.config) !== JSON.stringify(config)) {
        created++; nativeLights.set(key, { ...config, config });
      }
      return nativeLights.get(key);
    },
    useEntityInScene: (scene, entity) => scene.add(entity),
    RenderCallbackContext: { useRenderCallback: callback => { renderFrame = callback; } },
  },
};
function load(id) {
  if (id in mocks) return mocks[id];
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : id;
  if (/\.(png|glb|webp)$/.test(file)) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8')); return module.exports; }
  const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: load, React: react, Date: class extends Date { static now() { return now; } }, Math });
  return module.exports;
}
const clock = load('@/utils/world-clock');
const start = clock.createWorldClock(now);
assert.equal(clock.worldClockReading(start, now).time, '09:00');
assert.equal(clock.worldClockReading(start, now + 60_000).time, '10:00');
assert.equal(clock.worldClockReading(start, now + 24 * 60_000).day, 2);
assert.equal(clock.worldClockReading(start, now + 24 * 60_000).time, '09:00');
assert.equal(clock.worldTime(start, now - 1000), start.worldMs, 'A reversed device clock cannot reverse the world');
const faster = clock.changeWorldClock(start, 300, undefined, now + 60_000);
assert.equal(faster.worldMs, clock.worldTime(start, now + 60_000), 'Speed changes preserve current time');
assert.equal(clock.worldClockReading(faster, now + 120_000).time, '15:00');
assert.equal(clock.changeWorldClock(faster, Infinity, undefined, now).speed, 300);
assert.equal(clock.changeWorldClock(start, 60, NaN, now).worldMs, start.worldMs);
for (const bad of [null, {}, { ...start, speed: -1 }, { ...start, realMs: NaN }, { ...start, worldMs: Infinity }]) {
  assert.deepEqual(JSON.parse(JSON.stringify(clock.normalizeWorldClock(bad, now))), JSON.parse(JSON.stringify(start)));
}
const at = hour => clock.changeWorldClock(start, 60, hour * 60, now);
assert.equal(clock.worldClockReading(at(23), now).period, 'night');
assert.equal(clock.worldDaylight(at(13), now), 1);
assert.equal(clock.worldDaylight(at(23), now), 0);
assert.ok(Math.abs(clock.worldDaylight(at(6), now) - clock.worldDaylight(at(20), now)) < 1e-8);
for (let minute = 0; minute < 1440; minute++) {
  const value = clock.worldDaylight(clock.changeWorldClock(start, 60, minute, now), now);
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
}
const hourAngles = clock.worldClockHandAngles(at(3), now);
const laterAngles = clock.worldClockHandAngles(at(3), now + 60_000);
assert.ok(Math.abs((laterAngles.hour - hourAngles.hour) + Math.PI / 6) < 1e-8);
assert.ok(Math.abs(laterAngles.minute - hourAngles.minute) < 1e-8);
console.log('Verified accelerated days, midnight rollover, offline advancement, speed continuity, time presets, malformed clocks and clock-hand angles.');

const storage = load('@/utils/game-storage');
const save = storage.createDefaultGameSave();
assert.equal(save.worldClock.speed, 60);
const oldSave = { ...save, worldClock: undefined };
assert.equal(storage.parseGameSaveFromValue(oldSave).save.worldClock.speed, 60);
const saved = { ...save, worldClock: faster };
now += 3_600_000;
const restored = storage.parseGameSaveFromValue(JSON.parse(JSON.stringify(saved))).save;
assert.equal(clock.worldTime(restored.worldClock, now), clock.worldTime(faster, now));
const slowSave = storage.parseGameSaveFromValue({ ...saved, worldClock: { ...faster, speed: 1 } }).save;
assert.deepEqual(JSON.parse(JSON.stringify(restored.pet.stats)), JSON.parse(JSON.stringify(slowSave.pet.stats)), 'Accelerated time must not accelerate care decay');
console.log('Verified legacy save migration, save/reload continuity and independent real-time care decay.');

const mood = load('@/pet-display/engine/derive-mood');
const pet = { ...save.pet, type: 'cat', stats: { hunger: 90, happiness: 90, cleanliness: 90, level: 1 }, lastInteractionAt: now - 45_000, isAsleep: false };
assert.equal(mood.derivePetMood(pet, now, false), 'idle');
assert.equal(mood.derivePetMood(pet, now, true), 'resting');
assert.equal(mood.derivePetVideoMood(pet, false, now, false, true), 'lyingDown');
assert.equal(mood.derivePetVideoMood(pet, false, now, true, true), 'resting');
assert.equal(mood.derivePetVideoMood({ ...pet, lastInteractionAt: now }, false, now, false, true), 'idle', 'Interacting wakes the cat from night rest');
assert.equal(mood.derivePetMood({ ...pet, stats: { ...pet.stats, hunger: 10 } }, now, true), 'sad');
assert.equal(mood.derivePetVideoMood({ ...pet, isAsleep: true }, true, now, true, true), 'sleeping');
console.log('Verified night rest, completed lying transitions, interaction priority, hunger priority and preserved sleep.');

const undisturbed = { ...pet, lastInteractionAt: now - 35 * 60_000 };
assert.equal(mood.derivePetMood(undisturbed, now, false), 'idle', 'Daytime does not fall back to permanent inactivity sleep');
assert.equal(mood.derivePetVideoMood({ ...undisturbed, isAsleep: true }, true, now, true, false), 'idle', 'Dawn wakes a previously saved sleeping cat');
assert.equal(mood.derivePetVideoMood(undisturbed, false, now, false, true), 'lyingDown');
assert.equal(mood.derivePetVideoMood(undisturbed, false, now, true, true), 'fallingAsleep');
assert.equal(mood.derivePetVideoMood(undisturbed, true, now, true, true), 'sleeping');
assert.equal(mood.derivePetVideoMood({ ...undisturbed, lastInteractionAt: now }, true, now, true, true), 'idle', 'An interaction interrupts clock-driven sleep');
assert.equal(mood.derivePetVideoMood({ ...undisturbed, isAsleep: true, stats: { ...pet.stats, hunger: 10 } }, true, now, true, true), 'sad', 'Hunger takes priority over night sleep');
for (const speed of [1, 60, 300]) {
  const eveningStart = clock.changeWorldClock(start, speed, 21 * 60, now);
  const fresh = { ...pet, lastInteractionAt: now };
  assert.equal(mood.derivePetMood(fresh, now + 60_000, clock.worldClockReading(eveningStart, now + 60_000).period === 'night'), 'sleeping', 'A cat without furniture can fall asleep within a night, even at 300×');
  const beforeDawn = clock.changeWorldClock(start, speed, 5 * 60 + 59, now);
  const later = now + 60_000 / speed;
  assert.equal(mood.derivePetMood(undisturbed, now, clock.worldClockReading(beforeDawn, now).period === 'night'), 'sleeping');
  assert.equal(mood.derivePetMood(undisturbed, later, clock.worldClockReading(beforeDawn, later).period === 'night'), 'idle');
}
console.log('Verified night sleep transitions, daytime wakefulness, saved sleep at dawn, interaction/hunger priority and dawn at every clock speed.');

// Exercise the actual display hook's completion callbacks and phase resets.
const originalUseState = react.useState, moodSlots = [];
let moodCursor = 0;
react.useState = initial => {
  const index = moodCursor++;
  if (!(index in moodSlots)) moodSlots[index] = typeof initial === 'function' ? initial() : initial;
  return [moodSlots[index], value => { moodSlots[index] = typeof value === 'function' ? value(moodSlots[index]) : value; }];
};
function renderMood(pet, worldClock) {
  moodCursor = 0;
  // The VM executes the real hook with a state dispatcher and controlled clock.
  return mood.usePetBaseMood(pet, worldClock);
}
const nightRoutine = at(23), dayRoutine = at(13);
let routine = renderMood(undisturbed, nightRoutine);
assert.equal(routine.mood, 'lyingDown');
routine.onLieDownComplete(); routine = renderMood(undisturbed, nightRoutine);
assert.equal(routine.mood, 'fallingAsleep');
routine.onFallAsleepComplete(); routine = renderMood(undisturbed, nightRoutine);
assert.equal(routine.mood, 'sleeping', 'Night-only sleep completes without a saved asleep flag');
assert.equal(undisturbed.isAsleep, false);
renderMood(undisturbed, dayRoutine);
assert.equal(renderMood(undisturbed, dayRoutine).mood, 'idle');
renderMood(undisturbed, nightRoutine);
assert.equal(renderMood(undisturbed, nightRoutine).mood, 'lyingDown', 'The next night replays the lying/sleep transitions');
const newlyTouched = { ...undisturbed, lastInteractionAt: now };
renderMood(newlyTouched, nightRoutine);
assert.equal(renderMood(newlyTouched, nightRoutine).mood, 'idle');
routine.onFallAsleepComplete();
assert.equal(renderMood(newlyTouched, nightRoutine).mood, 'idle', 'A stale completion cannot put a newly touched cat back to sleep');
react.useState = originalUseState;
console.log('Verified actual night lying/sleep completion, temporary sleep, dawn wake, next-night phase reset and stale completion guards.');

const { NativeWorldLighting } = load('@/components/pet/native/NativeWorldLighting');
const day = { ...clock.changeWorldClock(start, 60, 13 * 60, now), weather: 'clear' };
const environment = NativeWorldLighting({ clock: day, active: true }).props.children[0];
for (let i = 0; i < 120; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
const sun = nativeLights.get('directional'), fill = nativeLights.get('point');
const daySun = sun.intensity, dayFill = fill.intensity;
assert.ok(daySun > 10_000 && dayFill > 1_000_000);
assert.equal(lightUpdates, 2, 'Constant daylight does not send native light updates every frame');
const night = clock.changeWorldClock(day, 60, 23 * 60, now);
const nightEnvironment = NativeWorldLighting({ clock: night, active: true }).props.children[0];
for (let i = 0; i < 120; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(sun.intensity < daySun / 10 && fill.intensity < dayFill / 10);
assert.ok(sun.color[2] > sun.color[0], 'Moonlight has a cool tint');
assert.equal(environment.props.source, nightEnvironment.props.source, 'Day/night changes keep the same environment texture');
assert.equal(created, 2, 'The same native lights are reused');
const paused = sun.intensity;
NativeWorldLighting({ clock: day, active: false });
renderFrame({ timeSinceLastFrame: 1 });
assert.equal(sun.intensity, paused);
// A cached room can have last drawn during daytime before it was hidden.
collectEffects = true; effects.length = 0;
NativeWorldLighting({ clock: day, active: false }); effects.forEach(fn => fn());
effects.length = 0;
NativeWorldLighting({ clock: { ...night, weather: 'rain' }, active: true }); effects.forEach(fn => fn());
renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.equal(sun.intensity, 550, 'A returning room uses current night/cloud brightness on its first drawing turn');
assert.equal(fill.intensity, 5500, 'Fill light does not fade from the cached daytime state');
assert.equal(shared.value.daylight, 0);
assert.equal(shared.value.transmission, .55);
collectEffects = false;
NativeWorldLighting({ clock: day, active: true });
renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(shared.value.daylight > 0 && shared.value.daylight < .1, 'Visible time changes still fade smoothly');
NativeWorldLighting({ clock: night, active: true });
for (let i = 0; i < 600; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
console.log('Verified actual native lighting callbacks, smooth day/night changes, cool moonlight, stable light entities, retained environment texture and hidden-room pause.');

const worldDaylightLevel = shared;
const windows = load('@/utils/native-window-light');
const { WINDOW_DECORATION_IDS } = load('@/constants/window-decorations');
const { NATIVE_MODEL_CATALOG: catalog, FLOOR_Y } = load('@/utils/native-room-world');
for (const modelId of [...WINDOW_DECORATION_IDS, 'bathroomBathWindow']) {
  assert.equal(windows.isWindowLightSource(modelId), true);
  for (const heading of [0, Math.PI / 2, Math.PI / 4, Math.PI * 1.5]) for (const scale of [.5, 1, 1.8]) {
    const object = { modelId, instanceId: modelId, position: [-1.2, .8, -2], heading, scale };
    const source = windows.windowLightConfig(object), meta = catalog[modelId];
    const dx = (source.position[0] - object.position[0]) / scale, dz = (source.position[2] - object.position[2]) / scale;
    assert.ok(Math.abs((Math.sin(heading) * dx + Math.cos(heading) * dz) - meta.max[2] - .06) < 1e-8, 'Light starts beyond the glass and frame on either wall');
    assert.ok(Math.abs(Math.hypot(...source.direction) - 1) < 1e-8 && source.direction[1] < 0);
    const reach = (source.position[1] - FLOOR_Y) / -source.direction[1];
    assert.ok(reach > 0 && source.area > 0, 'The window illuminates a downward path into the room');
    assert.ok(Math.abs(source.direction[0] - Math.sin(heading) / Math.hypot(1, .65)) < 1e-8);

  }
}
assert.equal(windows.isWindowLightSource('sofaA'), false);
const windowObject = { modelId: 'windowOakWide', instanceId: 'window', position: [0, .7, -2.3], heading: 0, scale: .7 };
const windowSource = windows.windowLightConfig(windowObject);
const resizedSource = windows.windowLightConfig({ ...windowObject, scale: .35 });
assert.ok(Math.abs(resizedSource.area / windowSource.area - .25) < 1e-8, 'Light power scales with window area');
const clear = windows.windowLightConfig({ ...windowObject, modelId: 'windowPlain' });
// Compare equal physical areas. The Plain Window no longer includes a sill.
const clearMeta = catalog.windowPlain, blindsMeta = catalog.windowBlinds;
const boundsArea = model => (model.max[0]-model.min[0])*(model.max[1]-model.min[1]);
const blinds = windows.windowLightConfig({ ...windowObject, modelId: 'windowBlinds',
  scale: windowObject.scale * Math.sqrt(boundsArea(clearMeta)/boundsArea(blindsMeta)) });
assert.ok(Math.abs(blinds.area / clear.area - .45) < 1e-8, 'Blinds filter incoming light');

const { NativeWindowLight } = load('@/components/pet/native/NativeWindowLight');
const daylight = { value: { daylight: 0 } };
shared = undefined; collectEffects = true;
const renderWindow = props => {
  effects.length = 0;
  NativeWindowLight({ object: windowObject, active: true, daylight, ...props });
  effects.forEach(fn => fn());
  renderFrame({ timeSinceLastFrame: 1 / 60 });
  return nativeLights.get('spot');
};
const beforeWindow = created;
const moon = renderWindow({});
assert.equal(created - beforeWindow, 1, 'One runtime window source; frame illumination uses the single area-light bake');
assert.ok(sceneLights.has(moon) && moon.intensity > 100_000 && moon.color[2] > moon.color[0]);
assert.equal(moon.castShadows, false, 'Window light does not allocate extra shadow maps');
const constantUpdates = lightUpdates;
for (let i = 0; i < 60; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.equal(lightUpdates, constantUpdates, 'Steady moonlight has no repeated native updates');
const windowPreview={value:{...windowObject,position:[.5,.7,-2.3]}};
renderWindow({editingObject:windowPreview});
assert.ok(Math.abs(moon.position[0]-windowSource.position[0]-.5)<1e-8,'Moonlight follows live window movement');
const afterMovingWindow=lightUpdates;
for(let i=0;i<60;i++)renderFrame({timeSinceLastFrame:1/60});
assert.equal(lightUpdates,afterMovingWindow,'A stopped window preview sends no repeated light updates');
const moonPower = moon.intensity;
daylight.value = { daylight: 1 }; renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(moon.intensity > moonPower && moon.color[0] > moon.color[2]);
daylight.value = { daylight: 0 }; renderFrame({ timeSinceLastFrame: 1 / 60 });
const moved = renderWindow({ object: { ...windowObject, heading: Math.PI / 2, position: [-2.3, .5, .4] } });
assert.equal(moved, moon, 'Decorating reuses the same native light');
assert.ok(moved.intensity > 0 && moved.direction[0] > .8, 'Moving a window immediately updates its source and keeps its moonlight on');
const pausedPower = moved.intensity;
renderWindow({ object: { ...windowObject, heading: Math.PI / 2, position: [-2.3, .5, .4] }, active: false });
daylight.value = { daylight: 1 }; renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.equal(moved.intensity, pausedPower, 'Hidden windows stop light updates');
daylight.value = { daylight: 0 };
const resized = renderWindow({ object: { ...windowObject, scale: .35 } });
assert.ok(Math.abs(resized.intensity / moonPower - .25) < 1e-8, 'Resizing updates native power immediately');
assert.equal(resized, moon);
collectEffects = false; shared = worldDaylightLevel;
const windowScene = NativeWorldLighting({ clock: night, active: true, objects: [windowObject, { ...windowObject, instanceId: 'second-window' }, { ...windowObject, modelId: 'sofaA' }] });
const windowChildren = windowScene.props.children.flat(Infinity).filter(child => child.type === 'WindowLight');
assert.equal(windowChildren.length, 2, 'Only windows emit window light');
assert.ok(windowChildren.every(child => child.props.daylight === worldDaylightLevel && child.props.active));
collectEffects = true; effects.length = 0;
nativeLights.delete('directional');
NativeWorldLighting({ clock: night, active: true }); effects.forEach(fn => fn());
renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(nativeLights.get('directional').intensity < 3000, 'Rebuilt daylight entities immediately restore night brightness');
console.log('Verified every window type, both walls, arbitrary rotations, resizing, filtered glass, illuminated pane/frame/sill, native moonlight/daylight, stable frame updates, repositioning and hidden-room pause.');

const { NativeWindowPane } = load('@/components/pet/native/NativeWindowPane');
let materialUpdates = 0;
function windowAsset(modelId) {
  const data = fs.readFileSync(path.join(root, 'assets/3d/native', modelId + '.glb'));
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const materials = gltf.materials.map(meta => ({ meta, parameters: {}, setFloat4Parameter(name, value) {
    this.parameters[name] = value; materialUpdates++;
  } }));
  const nodes = gltf.nodes.filter(node => node.mesh !== undefined).map(node => ({ name: node.name,
    materials: gltf.meshes[node.mesh].primitives.map(primitive => materials[primitive.material]) }));
  assert.equal(gltf.images.length, 1, 'Each window carries one rectangular area-light bake');
  return { materials, getRenderableEntities: () => nodes, getFirstEntityByName: name => nodes.find(node => node.name === name) };
}
function renderPane(asset, clock, active = true, lightning) {
  effects.length = 0; collectEffects = true;
  NativeWindowPane({ asset, clock, active, lightning }); effects.forEach(fn => fn());
  renderFrame({ timeSinceLastFrame: 1 / 60 });
}
for (const id of [...WINDOW_DECORATION_IDS, 'bathroomBathWindow']) {
  shared = undefined;
  const asset = windowAsset(id);
  renderPane(asset, night);
  const panes = asset.materials.filter(material => material.meta.extensions?.KHR_materials_unlit);
  assert.ok(panes.length > 0, `${id}: Blender exports outside sky without indoor reflections`);
  assert.ok(panes.every(material => material.parameters.baseColorFactor), `${id}: every pane receives its night sky color`);
  assert.ok(asset.materials.filter(material => !material.meta.extensions?.KHR_materials_unlit)
    .every(material => !material.parameters.baseColorFactor), `${id}: the wood frame and sill retain normal lighting`);
  const frames = asset.materials.filter(material => !material.meta.extensions?.KHR_materials_unlit);
  assert.ok(frames.every(material => material.meta.emissiveTexture && material.parameters.emissiveFactor),
    'Every frame material receives the same rectangular bake and runtime moonlight tint');
  const frameColor = frames[0].parameters.emissiveFactor;
  const roomColor = windows.windowLightColor(0);
  assert.ok(frameColor[2] > frameColor[0]);
  frameColor.slice(0, 3).forEach((value, channel) => assert.ok(Math.abs(value / roomColor[channel] - .035) < 1e-8),
    'The frame reflects a faint cold tint at night without glowing like a light source');
  const constant = materialUpdates;
  for (let i = 0; i < 60; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
  assert.equal(materialUpdates, constant, 'Steady sky color has no native updates each frame');
  const nightColor = panes[0].parameters.baseColorFactor;
  renderPane(asset, day);
  for (let i = 0; i < 180; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
  const dayColor = panes[0].parameters.baseColorFactor;
  assert.ok(dayColor[0] > nightColor[0] && dayColor[2] > nightColor[2], 'The sky brightens smoothly during daylight');
  renderPane(asset, night, false);
  assert.deepEqual(panes[0].parameters.baseColorFactor, dayColor, 'Hidden rooms pause their sky updates');
  renderPane(asset, night);
  assert.deepEqual(panes[0].parameters.baseColorFactor, nightColor, 'Returning windows show the night sky immediately');
}
console.log('Verified Blender sky materials and actual day/night material callbacks for all 18 windows, one continuous area-light bake, matching cold frame/floor tint, steady-frame updates and hidden-room pause.');

for (const weather of ['auto', 'clear', 'rain', 'snow', 'leaves']) {
  const restoredWeather = storage.parseGameSaveFromValue(JSON.parse(JSON.stringify({ ...save, worldClock: { ...day, weather } }))).save;
  assert.equal(restoredWeather.worldClock.weather, weather, 'Weather choices survive a full game save/reload');
}
shared = undefined;
NativeWorldLighting({ clock: day, active: true }); effects.forEach(fn => fn());
for (let i = 0; i < 600; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
const clearSun = nativeLights.get('directional').intensity;
NativeWorldLighting({ clock: { ...day, weather: 'rain' }, active: true }); effects.forEach(fn => fn());
for (let i = 0; i < 600; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(Math.abs(nativeLights.get('directional').intensity / clearSun - .55) < .001, 'Rain clouds dim daylight without changing the clock');
const rainyUpdates = lightUpdates;
for (let i = 0; i < 60; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.equal(lightUpdates, rainyUpdates, 'Settled cloudy lighting does not keep updating native lights');
shared = undefined;
const rainyWindow = windowAsset('windowOakWide');
renderPane(rainyWindow, { ...night, weather: 'rain' });
const rainyFrame = rainyWindow.materials.find(material => material.meta.emissiveTexture).parameters.emissiveFactor;
assert.ok(Math.abs(rainyFrame[2] / windows.windowFrameEmission(0)[2] - .55) < 1e-8, 'Clouds attenuate the sill and frame moonlight too');
console.log('Verified persistent game weather choices, smooth cloud lighting, matching frame attenuation and no repeated native updates after weather settles.');

for (const hour of [13, 23]) {
  const storm = clock.changeWorldClock({ ...day, weather: 'rain' }, 60, hour * 60, now);
  const flash = { value: 0 };
  shared = undefined;
  const sky = windowAsset('windowOakWide');
  renderPane(sky, storm, true, flash);
  const glass = sky.materials.find(material => material.meta.extensions?.KHR_materials_unlit);
  const frame = sky.materials.find(material => material.meta.emissiveTexture);
  const normalSky = glass.parameters.baseColorFactor, normalFrame = frame.parameters.emissiveFactor;
  flash.value = 1; renderFrame({ timeSinceLastFrame: 1 / 60 });
  assert.ok(glass.parameters.baseColorFactor[2] > normalSky[2], 'Lightning lights the outside sky during both day and night');
  assert.ok(frame.parameters.emissiveFactor[2] > normalFrame[2], 'The window-facing frame and sill pick up the same strike');
  assert.ok(glass.parameters.baseColorFactor[2] > glass.parameters.baseColorFactor[0], 'The flash is cold');
  flash.value = 0; renderFrame({ timeSinceLastFrame: 1 / 60 });
  assert.deepEqual(glass.parameters.baseColorFactor, normalSky);
  assert.deepEqual(frame.parameters.emissiveFactor, normalFrame);
  const stable = materialUpdates;
  for (let i = 0; i < 60; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
  assert.equal(materialUpdates, stable, 'Pane and frame materials stop updating after lightning');

  shared = undefined;
  const props = { object: windowObject, active: true, lightning: flash,
    daylight: { value: { daylight: hour === 13 ? 1 : 0, transmission: .55 } } };
  effects.length = 0; NativeWindowLight(props); effects.forEach(fn => fn());
  renderFrame({ timeSinceLastFrame: 1 / 60 });
  const light = nativeLights.get('spot'), baseline = light.intensity, entities = created;
  flash.value = 1; renderFrame({ timeSinceLastFrame: 1 / 60 });
  assert.ok(light.intensity > baseline * 5, 'The actual window light illuminates room objects and the cat during a strike');
  assert.ok(light.color[2] > light.color[0]);
  assert.equal(created, entities, 'Lightning reuses the existing light without allocation');
  flash.value = 0; renderFrame({ timeSinceLastFrame: 1 / 60 });
  assert.equal(light.intensity, baseline);
  const settled = lightUpdates;
  for (let i = 0; i < 60; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
  assert.equal(lightUpdates, settled, 'Room lighting stops updating between strikes');
  NativeWindowLight({ ...props, active: false }); effects.forEach(fn => fn());
  flash.value = 1; const hidden = lightUpdates;
  renderFrame({ timeSinceLastFrame: 1 / 60 });
  assert.equal(lightUpdates, hidden, 'Hidden window lights ignore flashes');
}
console.log('Verified native lightning sky, frame/sill and room illumination in day/night rain, cool tint, light reuse, normal-light restoration and no idle/hidden native writes.');

// Read the real clock hook with a cached daytime polling state, before effects.
const mockedClockHook = mocks['@/hooks/use-world-clock-now'];
delete mocks['@/hooks/use-world-clock-now'];
mocks['@/hooks/use-animation-activity'] = { useAnimationActivity: () => ({ active: true }) };
const { useWorldClockNow } = load('@/hooks/use-world-clock-now');
const storedNow = now;
let clockReading = { running: false, now: storedNow };
react.useState = () => [clockReading, next => { clockReading = typeof next === 'function' ? next(clockReading) : next; }];
function renderClock(enabled) {
  const previous = clockReading;
  // Exercise the hook through the test's state dispatcher.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const value = useWorldClockNow(5000, enabled);
  // React retries render-time state adjustments before committing children.
  return previous === clockReading ? value : renderClock(enabled);
}
collectEffects = false;
now += 10_000;
assert.equal(renderClock(false), storedNow, 'Hidden clocks retain their polling state');
assert.equal(renderClock(true), now, 'A newly visible room reads current time before any timer/effect runs');
react.useState = originalUseState;
mocks['@/hooks/use-world-clock-now'] = mockedClockHook;
console.log('Verified fresh time on room activation without waiting for the clock poll.');
