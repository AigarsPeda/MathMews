import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root = process.cwd(), cache = new Map();
let now = 1_790_000_000_000, frame, shared, model, writes = 0;
const effects = [];
function matrix(scale = [1,1,1], rotation = 0, position = [0,0,0]) {
  return { scale, rotation, position,
    scaling: value => matrix(value, rotation, position),
    rotate: value => matrix(scale, value, position),
    translate: value => matrix(scale, rotation, value) };
}
const mocks = {
  react: { useMemo: fn => fn(), useEffect: fn => effects.push(fn) },
  '@/hooks/use-world-clock-now': { useWorldClockNow: () => now },
  'react-native-worklets-core': { useSharedValue: initial => shared ??= { value: initial } },
  'react-native-filament': {
    useModel: () => model,
    useFilamentContext: () => ({ transformManager: {
      createIdentityMatrix: matrix,
      openLocalTransformTransaction() {}, commitLocalTransformTransaction() {},
      setTransform(entity, transform) { entity.transform = transform; writes++; },
    }, renderableManager: { getMaterialInstanceAt: entity => entity.material } }),
    RenderCallbackContext: { useRenderCallback: fn => { frame = fn; } },
  },
};
function load(id) {
  if (id in mocks) return mocks[id];
  const file = id.startsWith('@/') ? path.join(root,id.slice(2)) : id;
  if (file.endsWith('.glb')) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);
  assert.ok(resolved,id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved,module);
  if (resolved.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(resolved,'utf8')); return module.exports; }
  const code = ts.transpileModule(fs.readFileSync(resolved,'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code,{ module, exports: module.exports, require: load, Math, Date: class extends Date { static now() { return now; } } });
  return module.exports;
}
const clock = load('@/utils/world-clock'), weather = load('@/utils/world-weather');
const start = clock.createWorldClock(now);
for (const period of [0,12]) {
  const seen = new Set();
  for (let day=0; day<6; day++) for (let hour=period; hour<period+12; hour++) {
    seen.add(weather.worldWeather({ ...start, worldMs: (day*24+hour)*3_600_000 },now));
  }
  assert.deepEqual([...seen].sort(),['clear','leaves','rain','snow']);
}
for (const kind of ['clear','rain','snow','leaves']) {
  const forced = { ...start, weather: kind };
  assert.equal(weather.worldWeather(forced,now+7*86_400_000),kind);
  assert.equal(clock.changeWorldClock(forced,300,23*60,now).weather,kind);
  assert.equal(clock.normalizeWorldClock(JSON.parse(JSON.stringify(forced)),now).weather,kind);
}
assert.equal(clock.normalizeWorldClock({ ...start, weather: 'bad' },now).weather,'auto');
assert.equal(weather.worldWeather(start,now+60_000),weather.worldWeather(clock.changeWorldClock(start,300,undefined,now+60_000),now+60_000));
const panes = load('@/constants/window-weather-panes.json');
assert.equal(Object.keys(panes).length,18);
for (const outlines of Object.values(panes)) for (const pane of outlines) {
  assert.ok(pane.polygon.length>=3 && pane.max[0]>pane.min[0] && pane.max[1]>pane.min[1]);
  for (const kind of ['rain','snow','leaves']) {
    let visible=0;
    for(let i=0;i<weather.WEATHER_PARTICLES[kind];i++) for(let t=0;t<15;t+=.1) {
      const pose=weather.weatherParticle(kind,i,t,pane);
      assert.ok(Object.values(pose).every(v=>typeof v==='boolean'||Number.isFinite(v)));
      if(pose.visible) { visible++; assert.ok(weather.insideWeatherPane(pane,pose.x,pose.y,Math.max(pose.sx,pose.sy)*.55)); }
    }
    assert.ok(visible>0,`${kind} is visible in every pane`);
  }
}
const data=fs.readFileSync(path.join(root,'assets/3d/native/window-weather.glb'));
const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
assert.ok(data.length<10_000);
assert.equal(gltf.nodes.length,45);
assert.ok(gltf.materials.every(m=>m.extensions.KHR_materials_unlit && m.alphaMode==='BLEND'));
function asset() {
  const materials=gltf.materials.map(meta=>({ meta, color: undefined, setFloat4Parameter(name,value) {
    assert.equal(name,'baseColorFactor'); this.color=value; writes++;
  } }));
  const entities=gltf.nodes.slice(1).map(node=>({ name:node.name, material:materials[gltf.meshes[node.mesh].primitives[0].material] }));
  return { entities, materials, getFirstEntityByName: name=>entities.find(e=>e.name===name) };
}
const { NativeWindowWeather }=load('@/components/pet/native/NativeWindowWeather');
function render(props) {
  effects.length=0;
  NativeWindowWeather(props); effects.forEach(fn=>fn());
}
for (const fps of [30,60,120]) for (const hour of [13,23]) for (const kind of ['rain','snow','leaves']) {
  shared=undefined;const pool=asset();model={state:'loaded',asset:pool,rootEntity:{name:'root'}};
  const props={object:{modelId:'windowOakWide',position:[-1,.7,-2],heading:Math.PI/4,scale:.7},
    clock:{...start,worldMs:hour*3_600_000,weather:kind},active:true,reduceMotion:false};
  render(props);
  for(let i=0;i<fps*5;i++)frame({timeSinceLastFrame:1/fps});
  assert.ok(pool.entities.some(e=>e.name.startsWith(kind)&&e.transform.position[2]>-1));
  assert.ok(pool.entities.filter(e=>!e.name.startsWith(kind)).every(e=>e.transform.position[2]===-10));
  const positions=pool.entities.map(e=>e.transform.position);
  frame({timeSinceLastFrame:1/fps});
  assert.ok(pool.entities.some((e,i)=>e.name.startsWith(kind)&&e.transform.position[1]!==positions[i][1]));
  assert.equal(model.rootEntity.transform.rotation,Math.PI/4);
  assert.deepEqual([...model.rootEntity.transform.scale],[.7,.7,.7]);
  render({...props,active:false});const before=writes;
  for(let i=0;i<fps;i++)frame({timeSinceLastFrame:1/fps});
  assert.equal(writes,before,'Hidden rooms perform no particle or material writes');
  render({...props,reduceMotion:true});frame({timeSinceLastFrame:1/fps});const still=writes;
  for(let i=0;i<fps;i++)frame({timeSinceLastFrame:1/fps});
  assert.equal(writes,still,'Reduce Motion renders a still weather scene');
  render({...props,clock:{...props.clock,weather:'clear'}});
  for(let i=0;i<fps*6;i++)frame({timeSinceLastFrame:1/fps});
  assert.ok(pool.entities.every(e=>e.transform.position[2]===-10));
  const clear=writes;frame({timeSinceLastFrame:1/fps});assert.equal(writes,clear,'Clear skies need no particle updates');
}
console.log('Verified automatic day/night forecasts, persistent choices, clock changes, all 18 glass outlines, bounded particle counts, native rain/snow/leaves at 30/60/120 FPS, transitions, placement, hidden-room pause and Reduce Motion.');

shared=undefined;model={state:'loaded',asset:asset(),rootEntity:{name:'root'}};
const windowObject={instanceId:'drag-window',modelId:'windowOakWide',position:[-1,.7,-2],heading:.4,scale:.7};
const preview={value:{...windowObject,position:[-.5,.9,-2]}};
render({object:windowObject,editingObject:preview,clock:{...start,weather:'leaves'},active:true,reduceMotion:false});
frame({timeSinceLastFrame:1/60});
assert.deepEqual([...model.rootEntity.transform.position],preview.value.position,'Outdoor weather follows the live window preview');
assert.equal(model.rootEntity.transform.rotation,windowObject.heading);
preview.value=undefined;frame({timeSinceLastFrame:1/60});
assert.deepEqual([...model.rootEntity.transform.position],windowObject.position,'Clearing a preview restores the saved window position');
console.log('Verified weather follows shared window movement without a React update.');

const { NativeLightning } = load('@/components/pet/native/NativeLightning');
for (const fps of [30, 60, 120]) for (const speed of [1, 60, 300]) {
  shared = undefined;
  let flash = 0, flashWrites = 0;
  const lightning = { get value() { return flash; }, set value(value) { flash = value; flashWrites++; } };
  const storm = { clock: { ...start, weather: 'rain', speed }, active: true, reduceMotion: false, flash: lightning };
  const renderStorm = extra => NativeLightning({ ...storm, ...extra });
  renderStorm({});
  let peak = 0;
  for (let i = 0; i < fps * 6.2; i++) { frame({ timeSinceLastFrame: 1 / fps }); peak = Math.max(peak, flash); }
  assert.ok(peak > .95 && peak <= 1, 'The first visible strike uses real time at every refresh rate and clock speed');
  renderStorm({ active: false });
  const paused = flash, elapsed = shared.value, pausedWrites = flashWrites;
  for (let i = 0; i < fps * 20; i++) frame({ timeSinceLastFrame: 1 / fps });
  assert.equal(shared.value, elapsed); assert.equal(flash, paused); assert.equal(flashWrites, pausedWrites);
  renderStorm({});
  for (let i = 0; i < fps * 3; i++) frame({ timeSinceLastFrame: 1 / fps });
  assert.equal(flash, 0, 'The flash returns to normal lighting after resuming');
  const settled = flashWrites;
  for (let i = 0; i < fps * 10; i++) frame({ timeSinceLastFrame: 1 / fps });
  assert.equal(flashWrites, settled, 'The shared brightness has no repeated writes between strikes');
  renderStorm({ reduceMotion: true }); frame({ timeSinceLastFrame: 1 / fps });
  const reduced = flashWrites;
  for (let i = 0; i < fps * 80; i++) frame({ timeSinceLastFrame: 1 / fps });
  assert.equal(flash, 0); assert.equal(flashWrites, reduced, 'Reduce Motion suppresses every flash');
  renderStorm({});
  for (let i = 0; i < fps * 6.2; i++) frame({ timeSinceLastFrame: 1 / fps });
  assert.ok(flash > 0);
  renderStorm({ clock: { ...storm.clock, weather: 'clear' } }); frame({ timeSinceLastFrame: 1 / fps });
  assert.equal(flash, 0, 'Stopping rain immediately clears an active flash');
}
for (const kind of ['clear', 'snow', 'leaves']) for (let t = 0; t < 120; t += .1)
  assert.equal(weather.weatherLightning(kind, t), 0);
let bursts = 0, wasLit = false;
for (let t = 0; t < 180; t += .01) {
  const flash = weather.weatherLightning('rain', t);
  assert.ok(Number.isFinite(flash) && flash >= 0 && flash <= 1);
  if (flash > 0 && !wasLit) bursts++;
  wasLit = flash > 0;
}
assert.ok(bursts >= 8 && bursts <= 12, 'Lightning remains occasional rather than flashing continuously');
console.log('Verified real native lightning callbacks at 30/60/120 FPS and every clock speed, occasional bounded pulses, hidden-room pause, rain-only flashes, Reduce Motion and no idle brightness writes.');
