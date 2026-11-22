import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const root = process.cwd(), cache = new Map();
let now = 1_790_000_000_000, frame, slots = [], cursor = 0, model, writes = 0;
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
  'react-native-worklets-core': { useSharedValue: initial => slots[cursor++] ??= (
    initial && typeof initial === 'object' && 'placement' in initial
      ? { get value() { return initial; }, set value(next) { Object.assign(initial,next); } }
      : { value: initial }
  ) },
  'react-native-filament': {
    useModel: () => model,
    useWorkletEffect: fn => effects.push(fn),
    useFilamentContext: () => ({ scene: {
      addEntities(entities) { model.visibleEntities = entities; }, removeEntities() {},
    }, transformManager: {
      createIdentityMatrix: matrix,
      openLocalTransformTransaction() {}, commitLocalTransformTransaction() {},
      setTransform(entity, transform) { entity.transform = transform; writes++; },
    }, renderableManager: { getMaterialInstanceAt: entity => entity.material, setCastShadow() {} } }),
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
      if (!pose.visible) continue;
      visible++;
      if (kind === 'rain') {
        const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation);
        for (const dx of [-pose.sx/2, pose.sx/2]) for (const dy of [-pose.sy/2, pose.sy/2])
          assert.ok(weather.insideWeatherPane(pane, pose.x+c*dx-s*dy, pose.y+s*dx+c*dy, -1e-8), 'The whole streak fits inside the glass');
      } else assert.ok(weather.insideWeatherPane(pane,pose.x,pose.y,Math.max(pose.sx,pose.sy)*.55));
    }
    assert.ok(visible>0,`${kind} is visible in every pane`);
  }
}
// At startup and with Reduce Motion, drops must cover the view in two dimensions.
const unitPane = { min: [0,0], max: [1,1], polygon: [[0,0],[1,0],[1,1],[0,1]], z: 0 };
for (const t of [0,.4,1.6,5.1]) {
  const drops = Array.from({length:24}, (_,i) => weather.weatherParticle('rain',i,t,unitPane)).filter(p => p.visible);
  const bins = new Set(drops.map(p => Math.floor(p.x*4)+4*Math.floor(p.y*4)));
  assert.ok(bins.size >= 9, 'Rain fills the window instead of forming a diagonal band');
}
const dropAt = (t, seed) => weather.weatherParticle('rain', 0, t, unitPane, seed);
assert.notEqual(dropAt(0,0).x,dropAt(0,123).x,'Adjacent windows have independent showers');
const lanes = Array.from({length:10}, (_,i) => Math.floor(dropAt(i*1.7,0).x*5));
assert.ok(new Set(lanes).size>=4,'Successive drops use different lanes');
for (const kind of ['snow', 'leaves']) {
  const count = weather.WEATHER_PARTICLES[kind];
  const poses = Array.from({length: count}, (_, i) => weather.weatherParticle(kind, i, 0, unitPane, 123));
  const bins = new Set(poses.filter(p => p.visible).map(p => Math.floor(p.x*4) + 4*Math.floor(p.y*4)));
  assert.ok(bins.size >= 4, `Still ${kind} covers the glass`);
  assert.notEqual(poses[0].x, weather.weatherParticle(kind, 0, 0, unitPane, 456).x);
}
const snowAt = (index, t) => weather.weatherParticle('snow', index, t, unitPane);
const sizes = [0, 1, 2].map(i => Math.max(...Array.from({length:100}, (_,t) => snowAt(i,t/10).sx)));
const speeds = [0, 1, 2].map(i => snowAt(i,0).y - snowAt(i,.01).y);
assert.ok(sizes[0] < sizes[1] && sizes[1] < sizes[2] && speeds[0] < speeds[1] && speeds[1] < speeds[2],
  'Foreground snow is larger and falls faster');
const leafWidths = Array.from({length:120}, (_,i) => weather.weatherParticle('leaves', 0, i/30, unitPane))
  .filter(p => p.visible).map(p => p.sx / p.sy);
assert.ok(Math.min(...leafWidths) < .20 && Math.max(...leafWidths) > .65, 'A falling leaf rolls edge-on and opens again');
const data=fs.readFileSync(path.join(root,'assets/3d/native/window-weather.glb'));
const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
assert.ok(data.length < 96*1024, 'The particle pool and all seasons share a compact model');
const terrainLayers = ['Landscape', 'Wet terrain', 'Snow cover', 'Autumn foliage'];
const sceneryLayers = [...terrainLayers, 'Night lights', 'Cottage lights'];
assert.equal(gltf.images.length, sceneryLayers.length, 'All windows share the seasonal artwork and lights');
const particleName = name => /^(rain|leaves|snow) \d+$/.test(name);
assert.equal(gltf.nodes.filter(n => particleName(n.name)).length, 44);
assert.ok(gltf.materials.every(m=>m.extensions.KHR_materials_unlit && m.alphaMode===(terrainLayers.includes(m.name) ? 'MASK' : 'BLEND')));
const rainMeshes = [...new Set(gltf.nodes.filter(n=>n.name.startsWith('rain ')).map(n=>n.mesh))];
assert.equal(rainMeshes.length,3);
const raw=data.subarray(28+data.readUInt32LE(12));
for (const name of terrainLayers.slice(1)) {
  const mat = gltf.materials.find(m=>m.name===name);
  const texture = gltf.textures[mat.pbrMetallicRoughness.baseColorTexture.index];
  const view = gltf.bufferViews[gltf.images[texture.source].bufferView];
  const { data: rgba, info } = await sharp(raw.subarray(view.byteOffset,view.byteOffset+view.byteLength)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const pixel = (x,y) => rgba.subarray((y*info.width+x)*4,(y*info.width+x)*4+4);
  assert.equal(pixel(103,100)[3],0,'Seasonal terrain leaves the sky transparent');
  const roof = pixel(211,296), crown = pixel(57,282), field = pixel(260,350);
  assert.ok([roof,crown,field].every(p=>p[3]/255 > mat.alphaCutoff));
  if (name === 'Wet terrain') {
    assert.ok(pixel(216,297)[2] > pixel(216,293)[2]+60, 'Wet shingles catch a narrow sky reflection');
    for (const [x,y] of [[210,337],[279,330],[450,316]]) {
      const water = pixel(x,y);
      assert.ok(water[2] > field[2]+35 && water[3]/255 > mat.alphaCutoff, 'A reflective puddle is visible near each cottage');
    }
  } else if (name === 'Snow cover') assert.ok([roof,crown,field].every(p=>Math.min(...p.subarray(0,3))>215),'Snow covers roofs, treetops and fields');
  else assert.ok([crown,field].every(p=>p[0]>p[1]+30 && p[1]>p[2]+30),'Autumn warms the canopy and fields');
}
for (const [id, outlines] of Object.entries(panes)) {
  for (const layer of sceneryLayers) {
    const node = gltf.nodes.find(n => n.name === `${layer} ${id}`);
    const mesh = gltf.meshes[node.mesh].primitives[0];
    const position = gltf.accessors[mesh.attributes.POSITION], uv = gltf.accessors[mesh.attributes.TEXCOORD_0];
    const offset = gltf.bufferViews[position.bufferView].byteOffset;
    assert.equal(position.count, outlines.reduce((n, pane) => n+pane.polygon.length, 0));
    assert.equal(uv.count, position.count);
    let vertex = 0;
    for (const pane of outlines) for (const [x, y] of pane.polygon) {
      assert.ok(Math.abs(raw.readFloatLE(offset+vertex*12)-x) < 1e-5);
      assert.ok(Math.abs(raw.readFloatLE(offset+vertex*12+4)-y) < 1e-5);
      const z = raw.readFloatLE(offset+vertex*12+8) + node.translation[2];
      assert.ok(z > pane.z && z < pane.z+.003, 'Scenery sits between the glass and outdoor particles');
      vertex++;
    }
  }
}
const opacities=rainMeshes.map(i=>{
  const colors=gltf.accessors[gltf.meshes[i].primitives[0].attributes.COLOR_0], offset=gltf.bufferViews[colors.bufferView].byteOffset;
  assert.equal(colors.normalized,true);
  const alpha=Array.from({length:colors.count},(_,j)=>raw.readUInt8(offset+4*j+3)/255);
  assert.equal(Math.min(...alpha),0,'The tip fades out');
  return Math.max(...alpha);
});
assert.ok(opacities[0]<opacities[1] && opacities[1]<opacities[2],'Distant streaks are more translucent');
function asset() {
  const materials=gltf.materials.map(meta=>({ meta, color: undefined, setFloat4Parameter(name,value) {
    assert.equal(name,'baseColorFactor'); this.color=value; writes++;
  } }));
  const entities=gltf.nodes.slice(1).map(node=>({ name:node.name, material:materials[gltf.meshes[node.mesh].primitives[0].material] }));
  return { particles: entities.filter(e=>particleName(e.name)), materials, getFirstEntityByName: name=>entities.find(e=>e.name===name) };
}
const { NativeWindowWeather }=load('@/components/pet/native/NativeWindowWeather');
function render(props) {
  cursor=0; effects.length=0;
  NativeWindowWeather(props); effects.forEach(fn=>fn());
}
for (const fps of [30,60,120]) for (const hour of [13,23]) for (const kind of ['rain','snow','leaves']) {
  slots=[];const pool=asset();model={state:'loaded',asset:pool,rootEntity:{name:'root'}};
  const props={object:{modelId:'windowOakWide',position:[-1,.7,-2],heading:Math.PI/4,scale:.7},
    clock:{...start,worldMs:hour*3_600_000,weather:kind},active:true,reduceMotion:false};
  render(props);
  frame({timeSinceLastFrame:1/fps});
  const landscape = pool.getFirstEntityByName('Landscape windowOakWide').material;
  const cottages = pool.getFirstEntityByName('Cottage lights windowOakWide').material;
  const wetTerrain = pool.getFirstEntityByName('Wet terrain windowOakWide').material;
  const snowCover = pool.getFirstEntityByName('Snow cover windowOakWide').material;
  const foliage = pool.getFirstEntityByName('Autumn foliage windowOakWide').material;
  assert.equal(snowCover.color[3], Number(kind==='snow'));
  assert.equal(foliage.color[3], Number(kind==='leaves'));
  assert.equal(wetTerrain.color[3], Number(kind==='rain'));
  assert.deepEqual([...wetTerrain.color].slice(0,3), [...landscape.color].slice(0,3));
  assert.deepEqual([...snowCover.color].slice(0,3), [...landscape.color].slice(0,3),'Seasonal terrain shares the landscape lighting');
  assert.equal(landscape.color[3], 1, `The landscape is visible on the first ${kind} frame`);
  assert.equal(cottages.color[3], hour===23 ? weather.weatherTransmission(kind) : 0);
  for(let i=0;i<fps*5;i++)frame({timeSinceLastFrame:1/fps});
  assert.equal(landscape.color[3], 1, `The landscape stays visible during ${kind}`);
  assert.ok(pool.particles.some(e=>e.name.startsWith(kind)&&e.transform.position[2]>-1));
  assert.ok(pool.particles.filter(e=>!e.name.startsWith(kind)).every(e=>e.transform.position[2]===-10));
  const positions=pool.particles.map(e=>e.transform.position);
  frame({timeSinceLastFrame:1/fps});
  assert.ok(pool.particles.some((e,i)=>e.name.startsWith(kind)&&e.transform.position[1]!==positions[i][1]));
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
  assert.ok(pool.particles.every(e=>e.transform.position[2]===-10));
  assert.equal(model.visibleEntities.length, 50);
  assert.equal(wetTerrain.color[3], 0);
  assert.equal(snowCover.color[3], 0);
  assert.equal(foliage.color[3], 0);
  assert.equal(pool.getFirstEntityByName('Landscape windowOakWide').material.color[3], 1);
  assert.equal(pool.getFirstEntityByName('Night lights windowOakWide').material.color[3], hour===23 ? 1 : 0);
  const clear=writes;frame({timeSinceLastFrame:1/fps});assert.equal(writes,clear,'Clear skies need no particle updates');
}
slots=[]; const clearPool=asset(); model={state:'loaded',asset:clearPool,rootEntity:{name:'root'}};
const clearProps={object:{modelId:'windowArched',position:[0,0,0],heading:0,scale:1},
  clock:{...start,worldMs:23*3_600_000,weather:'clear'},active:true,reduceMotion:false};
render(clearProps); frame({timeSinceLastFrame:1/60});
const moon=clearPool.getFirstEntityByName('Night lights windowArched').material;
const hills=clearPool.getFirstEntityByName('Landscape windowArched').material;
const cottages=clearPool.getFirstEntityByName('Cottage lights windowArched').material;
assert.equal(moon.color[3],1,'A newly opened clear night shows the moon immediately');
render({...clearProps,clock:{...clearProps.clock,weather:'snow'}}); frame({timeSinceLastFrame:1/60});
assert.ok(moon.color[3]>0 && moon.color[3]<1,'The moon fades as the sky clouds over');
for(let i=0;i<360;i++) {
  frame({timeSinceLastFrame:1/60});
  assert.ok(hills.color[3] === 1 && cottages.color[3] > 0, 'The horizon and cottage lights persist through a weather change');
}
assert.equal(moon.color[3],0);
const snowCover=clearPool.getFirstEntityByName('Snow cover windowArched').material;
const foliage=clearPool.getFirstEntityByName('Autumn foliage windowArched').material;
render({...clearProps,clock:{...clearProps.clock,weather:'leaves'}}); frame({timeSinceLastFrame:1/60});
assert.ok(snowCover.color[3] > 0 && snowCover.color[3] < 1 && foliage.color[3] > 0 && foliage.color[3] < 1,
  'Snow retreats while autumn color arrives');
const lightning = { value: 0 };
render({...clearProps,clock:{...clearProps.clock,weather:'rain'},lightning});
const wetTerrain=clearPool.getFirstEntityByName('Wet terrain windowArched').material;
frame({timeSinceLastFrame:1/60});
assert.ok(wetTerrain.color[3]>0 && wetTerrain.color[3]<1, 'Rain wets the ground during the weather transition');
for(let i=0;i<360;i++) frame({timeSinceLastFrame:1/60});
const stormColor=[...hills.color];
lightning.value=1; frame({timeSinceLastFrame:1/60});
assert.ok(hills.color[3]===1 && hills.color.slice(0,3).every((v,i)=>v>stormColor[i]),'A lightning flash illuminates the landscape');
assert.deepEqual([...wetTerrain.color], [...hills.color], 'Roof and puddle highlights receive the same lightning flash as the hills');
lightning.value=0; frame({timeSinceLastFrame:1/60}); assert.deepEqual([...hills.color],stormColor);
console.log('Verified automatic day/night forecasts, persistent choices, clock changes, all 18 glass outlines, bounded particle counts, native rain/snow/leaves at 30/60/120 FPS, transitions, placement, hidden-room pause and Reduce Motion.');

slots=[];model={state:'loaded',asset:asset(),rootEntity:{name:'root'}};
const windowObject={instanceId:'drag-window',modelId:'windowOakWide',position:[-1,.7,-2],heading:.4,scale:.7};
const preview={value:{...windowObject,position:[-.5,.9,-2]}};
render({object:windowObject,editingObject:preview,clock:{...start,weather:'leaves'},active:true,reduceMotion:false});
frame({timeSinceLastFrame:1/60});
assert.deepEqual([...model.rootEntity.transform.position],preview.value.position,'Outdoor weather follows the live window preview');
assert.equal(model.rootEntity.transform.rotation,windowObject.heading);
preview.value=undefined;frame({timeSinceLastFrame:1/60});
assert.deepEqual([...model.rootEntity.transform.position],windowObject.position,'Clearing a preview restores the saved window position');
render({object:windowObject,editingObject:preview,clock:{...start,weather:'rain'},active:true,reduceMotion:true});
frame({timeSinceLastFrame:1/60});
preview.value={...windowObject,heading:1.1,scale:1.4};
frame({timeSinceLastFrame:1/60});
assert.equal(model.rootEntity.transform.rotation,1.1);
assert.deepEqual([...model.rootEntity.transform.scale],[1.4,1.4,1.4],'Still rain follows window resizing and rotation in place');
console.log('Verified weather follows shared window movement without a React update.');

for (const weatherKind of ['clear', 'rain', 'snow', 'leaves']) {
  slots = [];
  const pool = asset();
  model = { state: 'loaded', asset: pool, rootEntity: { name: 'root' } };
  const watchTarget = { value: undefined };
  const liveWindow = { ...windowObject, position: [.3, .8, -.9], heading: 1.1, scale: 1.4 };
  const editingObject = { value: undefined };
  const props = { object: windowObject, editingObject, clock: { ...start, weather: weatherKind },
    active: true, reduceMotion: false, watchTarget };
  render(props);
  const leaf = pool.getFirstEntityByName('leaves 0');
  const pane = panes[windowObject.modelId][0];
  const points = [];
  for (let i = 0; i < 300; i++) {
    if (i === 60) editingObject.value = liveWindow;
    frame({ timeSinceLastFrame: 1/60 });
    const [x, y, z] = leaf.transform.position;
    if (z === -10) continue;
    assert.ok(weather.insideWeatherPane(pane, x, y, leaf.transform.scale[0]*.55));
    const { heading, position, scale } = editingObject.value ?? windowObject;
    const expected = [position[0] + scale*(Math.cos(heading)*x+Math.sin(heading)*z),
      position[1]+scale*y, position[2] + scale*(Math.cos(heading)*z-Math.sin(heading)*x)];
    assert.deepEqual([...watchTarget.value], expected);
    points.push([...watchTarget.value]);
  }
  assert.ok(points.length > 30);
  assert.ok(Math.abs(points[0][0]-points.at(-1)[0]) > .05);
  assert.equal(leaf.transform.position[2], -10);
  assert.deepEqual([...watchTarget.value], points.at(-1), 'Gaze lingers where the leaf disappeared');
  render({ ...props, reduceMotion: true });
  frame({ timeSinceLastFrame: 1/60 });
  const still = writes;
  for (let i = 0; i < 60; i++) frame({ timeSinceLastFrame: 1/60 });
  assert.equal(writes, still);
}
console.log('Verified the visible leaf and gaze point coincide in all weather, linger after it exits, and stay still with Reduce Motion.');

const { NativeLightning } = load('@/components/pet/native/NativeLightning');
for (const fps of [30, 60, 120]) for (const speed of [1, 60, 300]) {
  slots = [];
  let flash = 0, flashWrites = 0;
  const lightning = { get value() { return flash; }, set value(value) { flash = value; flashWrites++; } };
  const storm = { clock: { ...start, weather: 'rain', speed }, active: true, reduceMotion: false, flash: lightning };
  const renderStorm = extra => { cursor = 0; NativeLightning({ ...storm, ...extra }); };
  renderStorm({});
  let peak = 0;
  for (let i = 0; i < fps * 6.2; i++) { frame({ timeSinceLastFrame: 1 / fps }); peak = Math.max(peak, flash); }
  assert.ok(peak > .95 && peak <= 1, 'The first visible strike uses real time at every refresh rate and clock speed');
  renderStorm({ active: false });
  const paused = flash, elapsed = slots[0].value, pausedWrites = flashWrites;
  for (let i = 0; i < fps * 20; i++) frame({ timeSinceLastFrame: 1 / fps });
  assert.equal(slots[0].value, elapsed); assert.equal(flash, paused); assert.equal(flashWrites, pausedWrites);
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
