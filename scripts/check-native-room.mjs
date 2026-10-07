/** Verify the migrated assets, legacy layout projection, collision routes and actual native cat clock. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import './check-native-cat-skin.mjs';
const root = process.cwd(), cache = new Map(), mocks = {};
let frameRequest = 0;
const frameRequests = new Map();
function load(id) {
  if (id in mocks) return mocks[id];
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : id;
  if (/\.(png|webp|glb|mp4)$/.test(file)) { assert.ok(fs.existsSync(file), file); return file; }
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} };cache.set(resolved, module);
  if (resolved.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8')); return module.exports; }
  const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: load, Math, Map, Set,
    requestAnimationFrame: fn => { const id = ++frameRequest; frameRequests.set(id, fn); return id; },
    cancelAnimationFrame: id => frameRequests.delete(id) });return module.exports;
}
function glb(id) { const b = fs.readFileSync(`assets/3d/native/${id}.glb`);assert.equal(b.readUInt32LE(0), 0x46546c67);return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); }
const inventory = JSON.parse(fs.readFileSync('scripts/3d/inventory.json')).entries;
const catalog = JSON.parse(fs.readFileSync('assets/3d/native/catalog.json'));
assert.deepEqual(Object.keys(catalog), inventory.map(e => e.id), 'Every existing catalog asset must have a native model');
for (const entry of inventory) {
  const model = glb(entry.id);assert.ok(model.meshes.length, entry.id);
  assert.ok(catalog[entry.id].renderScale > 0);
  if (/door/i.test(entry.id)) assert.ok(!model.animations?.length, 'Doors stay still until commanded');
  if (entry.id === 'sofaA') assert.ok(model.accessors.some(a => a.type === 'VEC3' && a.count > 24), 'Sofa rounding must survive export');
}
const authored = JSON.parse(fs.readFileSync('scripts/3d/clips.json'));
for (const skin of ['orange', 'grey', 'white']) {
  const model = glb('cat-' + skin);
  assert.deepEqual(model.animations.map(a => a.name), Object.keys(authored));
  assert.ok(model.skins[0].joints.length >= 16);
  for (const clip of model.animations) {
    const [frames, fps] = authored[clip.name];
    const duration = Math.max(...clip.samplers.map(s => model.accessors[s.input].max[0]));
    assert.ok(Math.abs(duration - frames / fps) < .001, `${skin}/${clip.name} preserves its duration`);
  }
  for (const term of ['Gentle frown', 'Happy crescent', 'Box bottom', 'Coral play ball', 'Food']) {
    // Expressions/props must not disappear just because they are hidden in the bind pose.
    if (term === 'Closed happy' || term === 'Sleepy') continue;
    assert.ok(model.nodes.some(n => n.name?.includes(term)), `${skin} retains ${term}`);
  }
}
const w = load('@/utils/native-room-world');
const roomScale = load('@/constants/room-scale');
for (const scale of [.2, 1, 3]) for (const angle of [0, .001, Math.PI / 2, Math.PI, Math.PI + .001]) {
  const c = Math.cos(angle) * scale, s = Math.sin(angle) * scale;
  const rotation = w.nativeBodyRotation([c, 0, -s, 0, 0, scale, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  assert.ok(rotation.axis.every(Number.isFinite) && Math.hypot(...rotation.axis) > .99, 'Scaled rigid-body transforms never yield a zero rotation axis');
  const actualSine = Math.sin(rotation.angle) * rotation.axis[1];
  assert.ok(Math.abs(actualSine - Math.sin(angle)) < 1e-6 && Math.abs(Math.cos(rotation.angle) - Math.cos(angle)) < 1e-6, 'Identity and half-turn toy rotations retain the real orientation');
}
const base = { width: 390, height: 420, petSize: 120, sizeScale: 1, decorations: [], toys: [] };
const sofa = { decorationId: 'sofaA', instanceId: 'sofa', offset: { x: .3, y: -.15 }, scale: 1.2 };
const layouts = { ...base, bedId: 'brown', bedOffset: { x: -.45, y: .35 }, decorations: [sofa, { decorationId: 'japaneseDoorAni', instanceId: 'door', offset: { x: -.5, y: -.3 }, wallFlipped: true }], toys: [{ instanceId: 'ball', toyId: 'blueBall', offset: { x: .45, y: .4 }, scale: 1.1 }] };
const before = JSON.stringify(layouts), world = w.buildNativeRoomWorld(layouts);
assert.equal(JSON.stringify(layouts), before, 'Migration does not rewrite saved placements');
const previewWorld = w.buildNativeRoomWorld({ ...layouts, decorations: [...layouts.decorations, { ...sofa, decorationId: 'livingSmallTable', instanceId: 'preview-decoration' }] });
const savedObjects = JSON.stringify(previewWorld.objects.filter(o => o.instanceId !== 'preview-decoration'));
w.placeNativePreview(previewWorld, 'preview-decoration');
assert.equal(JSON.stringify(previewWorld.objects.filter(o => o.instanceId !== 'preview-decoration')), savedObjects, 'Preview placement never moves the saved furnishings');
assert.ok(w.isFree(previewWorld.home, previewWorld), 'The preview cat remains outside solid furniture');
for (const o of world.objects) {
  const meta = catalog[o.modelId];const cos = Math.cos(o.heading), sin = Math.sin(o.heading);
  const center = [o.position[0] + (cos * meta.center[0] + sin * meta.center[2]) * o.scale, o.position[1] + meta.center[1] * o.scale, o.position[2] + (-sin * meta.center[0] + cos * meta.center[2]) * o.scale];
  const actual = w.projectWorld(center, world.width);
  const original = o.instanceId === 'bed' ? layouts.bedOffset : [...layouts.decorations, ...layouts.toys].find(i => i.instanceId === o.instanceId).offset;
  const entry = inventory.find(i => i.id === o.modelId);
  const multiplier = o.instanceId === 'sofa' ? 1.2 : o.instanceId === 'ball' ? 1.1 : 1;
  const size = entry.displaySize * multiplier;
  assert.ok(Math.abs(actual.x - original.x * (base.width - size) / 2) < .001, `${o.instanceId} retains horizontal placement`);
  assert.ok(Math.abs(actual.y - original.y * (base.height - size) / 2) < .001, `${o.instanceId} retains vertical placement`);
}
for (const point of [[0, w.FLOOR_Y, 0], [-1, .6, 1], [1, .2, -1]]) {
  const roundtrip = w.unprojectFloor(w.projectWorld(point, 390), point[1], 390);
  point.forEach((v, i) => assert.ok(Math.abs(roundtrip[i] - v) < 1e-8));
}
const empty = w.buildNativeRoomWorld(base);
const obstacle = { instanceId: 'barrier', solid: true, min: [-.25, 0, -.8], max: [.25, 1, .8] };
const routed = { ...empty, radius: .2, objects: [obstacle] };
const route = w.findRoomPath([-1.5, w.FLOOR_Y, 0], [1.5, w.FLOOR_Y, 0], routed);
assert.ok(route.length > 2 && w.pathLength(route) > 3, 'The cat detours around furniture');
for (let i = 1; i < route.length; i++) for (let t = 0; t <= 1; t += .01) {
  const p = route[i].map((v, axis) => route[i - 1][axis] + (v - route[i - 1][axis]) * t);
  assert.ok(w.isFree(p, routed), 'Every part of the route clears the cat collider');
}
const divided = { ...routed, objects: [{ ...obstacle, min: [-.25, 0, -2.5], max: [.25, 2, 2.5] }] };
assert.equal(w.findRoomPath([-1.5, w.FLOOR_Y, 0], [1.5, w.FLOOR_Y, 0], divided).length, 1, 'Unreachable commands cannot walk through furniture');
const edgePassage = { ...empty, radius: .25, catScale: .5, objects: [{ ...obstacle, min: [-2.5, 0, -.4], max: [1.78, 1, .4] }] };
const edgeStart = [1.6, w.FLOOR_Y, -1], edgeEnd = [2.055, w.FLOOR_Y, .8];
const edgeRoute = w.findRoomPath(edgeStart, edgeEnd, edgePassage);
assert.ok(edgeRoute.length > 2, 'A passage narrower than a grid cell remains navigable beside the floor edge');
assert.ok(w.pathLength([edgeRoute[0], edgeStart]) < 1e-8 && w.pathLength([edgeRoute.at(-1), edgeEnd]) < 1e-8, 'Off-grid endpoints retain their exact positions');
for (let i = 1; i < edgeRoute.length; i++) for (let t = 0; t <= 1; t += .01)
  assert.ok(w.isFree(edgeRoute[i - 1].map((v, axis) => v + (edgeRoute[i][axis] - v) * t), edgePassage), 'The narrow passage route never clips furniture');
const movedBarrierWorld = { ...routed, objects: [{ ...obstacle, position: [0, 0, 1.5], min: [-.25, 0, 1.2], max: [.25, 1, 1.8] }] };
assert.equal(w.findRoomPath([-1.5, w.FLOOR_Y, 0], [1.5, w.FLOOR_Y, 0], movedBarrierWorld).length, 2);
const liveBarrierWorld = w.updateNativeObjectPosition(movedBarrierWorld, 'barrier', [0, .5, 0]);
const updatedDetour = w.findRoomPath([-1.5, w.FLOOR_Y, 0], [1.5, w.FLOOR_Y, 0], liveBarrierWorld);
assert.ok(updatedDetour.length > 2, 'A relocated obstacle changes the live route');
assert.equal(movedBarrierWorld.objects[0].min[2], 1.2, 'Live tracking leaves the rendered layout intact');
for (let i = 1; i < updatedDetour.length; i++) for (let t = 0; t <= 1; t += .02)
  assert.ok(w.isFree(updatedDetour[i].map((v, axis) => updatedDetour[i - 1][axis] + (v - updatedDetour[i - 1][axis]) * t), liveBarrierWorld), 'The updated route clears the obstacle at its new location');
const actualStop = [-1, w.FLOOR_Y, 1];
const dwell = w.prepareNativeStep({ kind: 'toyPlay', steps: [] }, { animation: 'batToy', position: { x: 0, y: 0 }, durationMs: 1000 }, w.catScreenPoint(actualStop, empty), empty, w.FLOOR_Y);
assert.ok(w.pathLength([actualStop, dwell.native.path[0]]) < 1e-8, 'A play/rest clip cannot snap back through furniture after a detour');
const { buildRoomActivity, buildRoomReturn } = load('@/utils/room-activities');
const plan = buildRoomActivity({ ...layouts, nativeWorld: world, homeOffset: { x: 0, y: .12 }, ownedToyIds: [], hungry: false, asleep: false }, 0, 'sofaSit', 'sofa');
const seatStep = w.prepareNativeStep(plan, plan.steps[1], w.catScreenPoint(world.home, world), world, w.FLOOR_Y);
assert.deepEqual(Array.from(seatStep.native.path.at(-1)), Array.from(world.objects.find(o => o.instanceId === 'sofa').seat));
assert.ok(seatStep.native.path.at(-1)[1] > w.FLOOR_Y, 'Landing is supported by the real cushion');
const jumpStart = [-1, w.FLOOR_Y, 1];
const blockedJump = w.prepareNativeStep(plan, plan.steps[1], w.catScreenPoint(jumpStart, world), { ...world, objects: [...world.objects, { ...obstacle, instanceId: 'jump-barrier', min: [-2, 0, -2], max: [2, 3, 2] }] }, w.FLOOR_Y);
assert.ok(blockedJump.native.blocked && !blockedJump.native.jump, 'A blocked flight cannot pass through another furnishing');

// Bowl commands use the placed bowl and face it without a duplicate prop.
for (const decorationId of ['bowlTan', 'bowlBlue', 'bowlPurple', 'bowlPink']) for (const bowlScale of [.7, 1, 2.2]) {
  const bowl = { decorationId, instanceId: 'meal-bowl', offset: { x: .5, y: .15 }, scale: bowlScale };
  const mealWorld = w.buildNativeRoomWorld({ ...base, decorations: [bowl] });
  const mealPlan = buildRoomActivity({ ...base, decorations: [bowl], homeOffset: { x: 0, y: .12 }, ownedToyIds: [], hungry: true }, 0, 'bowlEat');
  const approach = w.prepareNativeStep(mealPlan, mealPlan.steps[0], w.catScreenPoint(mealWorld.home, mealWorld), mealWorld, w.FLOOR_Y);
  assert.equal(approach.native.blocked, false, `${decorationId}/${bowlScale}: the bowl is reachable`);
  const arrival = approach.native.path.at(-1);
  const meal = w.prepareNativeStep(mealPlan, mealPlan.steps[1], w.catScreenPoint(arrival, mealWorld), mealWorld, w.FLOOR_Y);
  assert.equal(meal.native.hideEatingProps, true);
  assert.ok(Number.isFinite(meal.native.heading), 'The cat faces the food bowl');
  const actualBowl = mealWorld.objects[0];
  assert.ok(Math.abs(Math.hypot(actualBowl.position[0] - arrival[0], actualBowl.position[2] - arrival[2]) - w.CAT_EATING_REACH * mealWorld.catScale) < .001);
  const homeStep = w.prepareNativeStep(mealPlan, mealPlan.steps.at(-1), meal.position, mealWorld, w.FLOOR_Y);
  assert.ok(w.pathLength([homeStep.native.path.at(-1), mealWorld.home]) < .001, 'The cat walks back from the bowl');
}

for (const [width, height] of [[320, 320], [390, 520], [430, 700]]) {
  const starter = { width, height, petSize: roomScale.ROOM_CAT_SIZE, sizeScale: roomScale.ROOM_OBJECT_SCALE, bedId: 'brown',
    decorations: [{ decorationId: 'bowlBlue', instanceId: 'starter-bowl', offset: { x: .25, y: .15 } }],
    toys: [{ toyId: 'orangeBall', instanceId: 'starter-ball', offset: { x: .5, y: .4 } }] };
  const starterWorld = w.buildNativeRoomWorld(starter);
  const starterMeal = buildRoomActivity({ ...starter, homeOffset: { x: 0, y: .12 }, ownedToyIds: ['orangeBall'], hungry: false }, 0, 'bowlEat');
  const approach = w.prepareNativeStep(starterMeal, starterMeal.steps[0], w.catScreenPoint(starterWorld.home, starterWorld), starterWorld, w.FLOOR_Y);
  assert.equal(approach.native.blocked, false, `${width}/${height}: the starter bed leaves the food bowl reachable`);
}

// A meal can follow a return from another activity without rerouting that return to food.
const bowlAfterPlay = { decorationId: 'bowlBlue', instanceId: 'after-play-bowl', offset: { x: .25, y: .15 } };
const afterPlayWorld = w.buildNativeRoomWorld({ ...base, decorations: [bowlAfterPlay] });
const afterPlayMeal = buildRoomActivity({ ...base, decorations: [bowlAfterPlay], homeOffset: { x: 0, y: .12 }, ownedToyIds: [], hungry: false }, 0, 'bowlEat');
const homeScreen = w.catScreenPoint(afterPlayWorld.home, afterPlayWorld);
const combinedMeal = { ...afterPlayMeal, steps: [{ position: homeScreen, mood: 'idle', animation: 'walk', durationMs: 1000 }, ...afterPlayMeal.steps] };
const homeBeforeMeal = w.prepareNativeStep(combinedMeal, combinedMeal.steps[0], homeScreen, afterPlayWorld, w.FLOOR_Y);
assert.ok(w.pathLength([homeBeforeMeal.native.path.at(-1), afterPlayWorld.home]) < .001);
const toBowlAfterReturn = w.prepareNativeStep(combinedMeal, combinedMeal.steps[1], homeScreen, afterPlayWorld, w.FLOOR_Y);
assert.equal(toBowlAfterReturn.native.blocked, false);
assert.ok(w.pathLength([toBowlAfterReturn.native.path.at(-1), afterPlayWorld.home]) > .1);

// Eat must finish leaving the source sofa before navigating to its new target.
for (const decorationId of ['sofaA', 'sofaB']) for (const wallFlipped of [false, true]) {
  const furnishings = [{ ...sofa, decorationId, wallFlipped, offset: { x: 0, y: -.25 }, scale: 1 },
    { ...bowlAfterPlay, offset: { x: .25, y: .15 } }];
  const options = { ...base, petSize: roomScale.ROOM_CAT_SIZE, sizeScale: roomScale.ROOM_OBJECT_SCALE,
    decorations: furnishings, homeOffset: { x: -.3, y: .25 }, ownedToyIds: [], hungry: true, asleep: false };
  const transitionWorld = w.buildNativeRoomWorld(options);
  const sourceSofa = transitionWorld.objects.find(o => o.instanceId === 'sofa');
  const nap = buildRoomActivity(options, 0, 'sofaSleep', 'sofa');
  const meal = buildRoomActivity(options, 0, 'bowlEat');
  const wake = buildRoomReturn(options, nap, 3, w.catScreenPoint(sourceSofa.seat, transitionWorld));
  const commandedMeal = { ...meal, steps: [...wake.steps, ...meal.steps] };
  let position = sourceSofa.seat;
  for (const step of commandedMeal.steps) {
    const prepared = w.prepareNativeStep(commandedMeal, step, w.catScreenPoint(position, transitionWorld), transitionWorld, position[1]);
    assert.equal(prepared.native.blocked, false, `${decorationId}/${wallFlipped}/${step.animation}: the source sofa must not block getting down to eat`);
    assert.ok(w.pathLength([prepared.native.path[0], position]) < 1e-6, `Every transition starts at the previous visible position ${JSON.stringify({ decorationId, wallFlipped, animation: step.animation, position, start: prepared.native.path[0] })}`);
    if (step.reverse) assert.equal(prepared.native.heading, sourceSofa.seatHeading, 'Getting up retains the seated facing');
    if (step.animation === 'jumpOff') {
      assert.equal(prepared.native.jump, true);
      assert.ok(w.pathLength([prepared.native.path.at(-1), sourceSofa.approach]) < 1e-6, 'Jump-down lands at the source sofa');
    }
    position = prepared.native.path.at(-1);
  }
}
console.log('Verified lying-to-eating native transitions on both sofa variants and mirrored orientations.');

// Regression: a large plant in the center and a bowl at the front floor corner.
// Keep the saved placements, including a bowl whose rim extends over the edge.
const cornerOptions = { width: 345.33331298828125, height: 465.6666259765625, petSize: 81, sizeScale: 1.1691666666666667,
  homeOffset: { x: -.2238806, y: .1212716 }, ownedToyIds: [], hungry: true, asleep: false,
  decorations: [
    { decorationId: 'plantB', instanceId: 'corner-plant', offset: { x: -.1018651, y: .1399326 }, scale: 2.2 },
    { decorationId: 'sofaA', instanceId: 'corner-sofa', offset: { x: .2240545, y: -.2197700 }, scale: 1.5 },
    { decorationId: 'bowlBlue', instanceId: 'corner-bowl', offset: { x: -.0050873, y: .5235030 }, scale: 1.6 },
  ], toys: [{ toyId: 'scratchPostRed', instanceId: 'corner-post', offset: { x: 1, y: .0408916 }, scale: 1.9 }] };
const cornerWorld = w.buildNativeRoomWorld(cornerOptions);
const cornerSnapshot = JSON.stringify(cornerWorld.objects);
const cornerBowl = cornerWorld.objects.find(o => o.instanceId === 'corner-bowl');
const cornerMeal = buildRoomActivity(cornerOptions, 0, 'bowlEat', 'corner-bowl');
let cornerArrival;
for (const source of ['floor', 'sofaSit', 'sofaSleep']) {
  let start = cornerWorld.home, steps = cornerMeal.steps;
  if (source !== 'floor') {
    const rest = buildRoomActivity(cornerOptions, 0, source, 'corner-sofa');
    start = cornerWorld.objects.find(o => o.instanceId === 'corner-sofa').seat;
    const returning = buildRoomReturn(cornerOptions, rest, source === 'sofaSleep' ? 3 : 2, w.catScreenPoint(start, cornerWorld));
    steps = [...returning.steps, ...steps];
  }
  const command = { ...cornerMeal, steps };
  for (const step of steps) {
    const prepared = w.prepareNativeStep(command, step, w.catScreenPoint(start, cornerWorld), cornerWorld, start[1]);
    assert.equal(prepared.native.blocked, false, `${source}/${step.animation}: the corner bowl remains reachable`);
    assert.ok(w.pathLength([start, prepared.native.path[0]]) < 1e-6, 'The corner route never relocates its start');
    if (step.animation?.startsWith('walk'))
      for (let i = 1; i < prepared.native.path.length; i++) for (let t = 0; t <= 1; t += .01) {
        const a = prepared.native.path[i - 1], b = prepared.native.path[i];
        assert.ok(w.isFree(a.map((v, axis) => v + (b[axis] - v) * t), cornerWorld), 'The corner route clears furniture and floor edges');
      }
    start = prepared.native.path.at(-1);
    if (step.animation === 'eating') {
      cornerArrival = start;
      assert.ok(Math.abs(w.pathLength([start, [cornerBowl.position[0], w.FLOOR_Y, cornerBowl.position[2]]]) - w.CAT_EATING_REACH * cornerWorld.catScale) < 1e-6, 'The cat reaches the food instead of stopping at a nearby free cell');
    }
  }
}
assert.equal(JSON.stringify(cornerWorld.objects), cornerSnapshot, 'Routing leaves the saved room objects in place');

// Sample the shipped skeleton, not a hand-drawn approximation of its tail.
const contact = load('@/utils/native-cat-contact');
const catBytes = fs.readFileSync('assets/3d/native/cat-orange.glb');
const catJSONLength = catBytes.readUInt32LE(12);
const skeleton = JSON.parse(catBytes.subarray(20,20+catJSONLength));
const catBinary = catBytes.subarray(28+catJSONLength);
const channels = new Map();
function values(index) {
  if(channels.has(index))return channels.get(index);
  const a=skeleton.accessors[index],v=skeleton.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type];
  assert.equal(a.componentType,5126);
  const rows=Array.from({length:a.count},(_,i)=>Array.from({length:size},(_,j)=>catBinary.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*4)+j*4)));
  channels.set(index,rows);return rows;
}
function multiply(a,b) { return Array.from({length:16},(_,i)=>[0,1,2,3].reduce((s,k)=>s+a[k*4+i%4]*b[Math.floor(i/4)*4+k],0)); }
function matrix(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]) {
  const [x,y,z,r]=q;
  return [(1-2*y*y-2*z*z)*s[0],(2*x*y+2*z*r)*s[0],(2*x*z-2*y*r)*s[0],0,
    (2*x*y-2*z*r)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*x*r)*s[1],0,
    (2*x*z+2*y*r)*s[2],(2*y*z-2*x*r)*s[2],(1-2*x*x-2*y*y)*s[2],0,...t,1];
}
const parents=new Map();skeleton.nodes.forEach((n,i)=>n.children?.forEach(child=>parents.set(child,i)));
function posedTail(clip,time,position,heading,scale,names=['tailjoint0','tailjoint1','tailjoint2','tailjoint3','tailTip']) {
  const nodes=skeleton.nodes.map(n=>({ ...n }));
  const animation=skeleton.animations.find(a=>a.name===clip);
  for(const channel of animation.channels) {
    const sampler=animation.samplers[channel.sampler],times=values(sampler.input).flat(),output=values(sampler.output);
    let i=times.findIndex(t=>t>=time);if(i<0)i=times.length-1;
    const from=Math.max(0,i-1),fraction=i===from?0:Math.max(0,Math.min(1,(time-times[from])/(times[i]-times[from])));
    let next=output[i];
    if(channel.target.path==='rotation'&&output[from].reduce((sum,v,k)=>sum+v*next[k],0)<0)next=next.map(v=>-v);
    let value=output[from].map((v,k)=>v+(next[k]-v)*fraction);
    if(channel.target.path==='rotation'){const length=Math.hypot(...value);value=value.map(v=>v/length);}
    nodes[channel.target.node][channel.target.path]=value;
  }
  const cache=new Map(),root=matrix(position,[0,Math.sin(heading/2),0,Math.cos(heading/2)],[scale,scale,scale]);
  function worldMatrix(i) { if(cache.has(i))return cache.get(i);const n=nodes[i],parent=parents.get(i);
    const m=multiply(parent===undefined?root:worldMatrix(parent),n.matrix??matrix(n.translation,n.rotation,n.scale));cache.set(i,m);return m; }
  return names.map(name=>worldMatrix(nodes.findIndex(n=>n.name===name)).slice(12,15));
}
// Check the shipped eating clip: the muzzle reaches the bowl, the paws stay
// planted, and the cat returns to its standing pose at both ends.
const eatingDuration = authored.eating[0] / authored.eating[1];
const eatingJoints = ['nose', 'L.front.paw', 'R.front.paw', 'L.rear.paw', 'R.rear.paw'];
const standingJoints = posedTail('idle', 0, [0, 0, 0], 0, 1, eatingJoints);
const cornerHeading = Math.atan2(cornerBowl.position[0] - cornerArrival[0], cornerBowl.position[2] - cornerArrival[2]);
const cornerPaws = posedTail('eating', eatingDuration * .5, cornerArrival, cornerHeading, cornerWorld.catScale, eatingJoints.slice(1));
for (const paw of cornerPaws)
  assert.ok(Math.abs(paw[0]) < 2.32 && Math.abs(paw[2]) < 2.32, 'The shipped eating pose keeps every paw on the floor at the corner bowl');
for (const fraction of [0, .35, .5, .65, 1]) {
  const joints = posedTail('eating', eatingDuration * fraction, [0, 0, 0], 0, 1, eatingJoints);
  for (let i = 1; i < joints.length; i++)
    assert.ok(Math.hypot(...joints[i].map((value, axis) => value - standingJoints[i][axis])) < .003, 'Eating keeps each paw planted');
  const nose = joints[0];
  if (fraction === 0 || fraction === 1)
    assert.ok(Math.hypot(...nose.map((value, axis) => value - standingJoints[0][axis])) < .003, 'Eating starts and ends standing');
  else {
    assert.ok(nose[1] > .2 && nose[1] < .4 && standingJoints[0][1] - nose[1] > .75, 'Eating lowers the muzzle to bowl height');
    assert.ok(Math.abs(nose[2] - w.CAT_EATING_REACH) < .04, 'The meal approach matches the lowered muzzle');
  }
}
// Sample the exported paw pivots during stance. Their backward motion must
// cancel the distance-driven runtime stride instead of sliding on the floor.
const walkDuration=authored.walk[0]/authored.walk[1];
for(const [paw,offset] of [['L.rear.paw',0],['L.front.paw',.18],['R.rear.paw',.50],['R.front.paw',.68]]) {
  const first=posedTail('walk',(offset+.08)*walkDuration,[0,0,0],0,1,[paw])[0];
  const last=posedTail('walk',(offset+.28)*walkDuration,[0,0,0],0,1,[paw])[0];
  assert.ok(Math.abs(last[2]-first[2]+.8*.20)<.004,`${paw}: planted paw matches travel distance`);
  assert.ok(Math.abs(last[1]-first[1])<.003,`${paw}: planted paw stays on its support plane`);
}
// Almost straight legs must retain their anatomical bend side through the
// full walk and sit. A pole inferred from the current foot direction can flip.
for(const clip of ['walk','sit'])for(let sample=0;sample<24;sample++) {
  const duration=authored[clip][0]/authored[clip][1];
  for(const side of ['L','R'])for(const label of ['foreleg','hindleg']) {
    const paw=side+(label==='foreleg'?'.front.paw':'.rear.paw');
    const [a,b,c]=posedTail(clip,duration*sample/24,[0,0,0],0,1,[side+'.'+label+'joint0',side+'.'+label+'joint1',paw]);
    const delta=c.map((v,k)=>v-a[k]), elbow=b.map((v,k)=>v-a[k]);
    const along=elbow.reduce((sum,v,k)=>sum+v*delta[k],0)/delta.reduce((sum,v)=>sum+v*v,0);
    const bend=elbow[2]-along*delta[2];
    assert.ok(label==='foreleg'?bend<=.0001:bend>=-.0001,`${clip}/${side}/${label}: stable anatomical knee or elbow pole`);
  }
}
let corrected=0;
for(const decorationId of ['sofaA','sofaB'])for(const wallFlipped of [false,true])for(const itemScale of [1.8,2,2.2]) {
  const room=w.buildNativeRoomWorld({...base,petSize:96,decorations:[{...sofa,decorationId,wallFlipped,scale:itemScale,offset:{x:0,y:0}}]});
  const object=room.objects[0];assert.equal(object.collisionBoxes.length,13,'Seats, back, arms and pillow use separate authored collision shapes');
  const heading=object.seatHeading;
  assert.ok((Math.sin(heading) + Math.cos(heading)) / Math.SQRT2 > .5,
    `${decorationId}/${wallFlipped}: sitting and sleeping face the player`);
  for (const kind of ['sofaSit', 'sofaSleep']) {
    const plan = buildRoomActivity({ ...base, decorations: [{ ...sofa, decorationId, wallFlipped, scale: itemScale }],
      homeOffset: { x: 0, y: .12 }, ownedToyIds: [], hungry: false, asleep: false }, 0, kind, 'sofa');
    for (const step of plan.steps.filter(step => ['sit', 'curlUp', 'curlSleep'].includes(step.animation))) {
      const prepared = w.prepareNativeStep(plan, step, w.catScreenPoint(object.seat, room), room, object.seat[1]);
      assert.equal(prepared.native.heading, heading, `${kind}/${step.animation}: preserve the viewer-facing direction throughout rest`);
    }
  }
  for(const clip of ['sit','curlUp','curlSleep'])for(let sample=0;sample<12;sample++) {
    const duration=Math.max(...skeleton.animations.find(a=>a.name===clip).samplers.map(s=>skeleton.accessors[s.input].max[0]));
    const points=posedTail(clip,duration*sample/12,object.seat,heading,room.catScale);
    const result=contact.resolveTailContact(points,room,{angle:0,axis:[0,1,0],blocked:false},1/60);
    assert.equal(result.blocked,false,`${decorationId}/${wallFlipped}/${itemScale}/${clip}/${sample}: tail can clear the sofa`);
    if(result.angle>0)corrected++;
    const fixed=points.map(p=>contact.rotateTailPoint(p,points[0],result.angle,result.axis));
    for(let i=1;i<fixed.length;i++)assert.ok(Math.abs(Math.hypot(...fixed[i].map((v,k)=>v-fixed[i-1][k]))-Math.hypot(...points[i].map((v,k)=>v-points[i-1][k])))<1e-8,'Contact keeps tail bone lengths');
    const again=contact.resolveTailContact(fixed,room,{angle:0,axis:[0,1,0],blocked:false},1/60);
    assert.equal(again.angle,0,'Every corrected capsule clears furniture, floor and room walls');
  }
}
// Correctly placed seating may need no correction. The mounted-fixture case
// below deliberately intersects the tail to exercise the contact solver.
console.log(`Verified ${corrected} tail contact corrections across sofa variants, mirroring, scales and actual sit/sleep samples.`);

// A seated tail follows consecutive rendered poses, not isolated snapshots.
let contactFrames = 0, blockedFrames = 0, maxTailStep = 0;
const contactStart = performance.now();
for (const itemScale of [.7, 1, 1.4, 1.8, 2.2]) {
  const room = w.buildNativeRoomWorld({ ...base, decorations: [{ ...sofa, scale: itemScale, offset: {x:0,y:0} }] });
  const seat = room.objects[0].seat;
  let previous = {angle:0,axis:[0,1,0],blocked:false}, lastTip;
  for (let frame=0; frame<240; frame++) {
    const points=posedTail('sit', frame/60, seat, room.objects[0].seatHeading, room.catScale);
    const result=contact.resolveTailContact(points,room,previous,1/60);
    const tip=contact.rotateTailPoint(points.at(-1),points[0],result.angle,result.axis);
    if(lastTip)maxTailStep=Math.max(maxTailStep,Math.hypot(...tip.map((v,k)=>v-lastTip[k])));
    if(result.blocked)blockedFrames++;
    previous=result;lastTip=tip;contactFrames++;
  }
}
assert.equal(blockedFrames,0,'Narrow-sofa seating must leave room for the tail attachment');
assert.ok(maxTailStep < .02, 'A seated tail must not snap between 10-degree contact solutions');
console.log('Consecutive tail frames:', contactFrames, 'blocked:', blockedFrames, 'max tip step:', maxTailStep.toFixed(4), 'ms/frame:', ((performance.now()-contactStart)/contactFrames).toFixed(3));

// Execute NativeCatActor's actual render worklet, with only engine handles mocked.
let slots = [], cursor = 0, effects = [], renderFrame, applies = [], scale, position, rigMatrices;
let exposeFoodProps = false;
const propTransforms = [];
const contactCalls = [];
function memo(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) slots[i] = { deps, value: fn() };return slots[i].value; }
const React = { useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps), useRef: v => memo(() => ({ current: v }), []), useEffect: (fn, deps) => { const i = cursor++, old = slots[i];if (!old || deps.some((v,n) => !Object.is(v, old.deps[n]))) { slots[i] = { deps };effects.push(fn); } } };
mocks.react = React;mocks['react/jsx-runtime'] = {};
mocks['react-native-worklets-core'] = { Worklets: { createRunOnJS: fn => fn }, useSharedValue: v => memo(() => ({ value: v }), []) };
const catModel = glb('cat-orange');
const animations = catModel.animations.map(a => ({ name: a.name, duration: Math.max(...a.samplers.map(s => catModel.accessors[s.input].max[0])) }));
const animator = { getAnimationCount: () => animations.length, getAnimationName: i => animations[i].name, getAnimationDuration: i => animations[i].duration, applyAnimation: (i, t) => applies.push({ name: animations[i].name, time: t }), applyCrossFade() {}, updateBoneMatrices() { contactCalls.push("skin"); } };
const transformManager = { createIdentityMatrix: () => ({ scaling: v => { scale = v;return { rotate: () => ({ translate: v => { position = v;return {}; } }) }; } }), setTransform(entity, transform) { if(entity.name==='tailjoint0')contactCalls.push('tail'); if(entity.name==='Bowl base Game prop')propTransforms.push(transform.original ? 'visible' : 'hidden'); },
  getWorldTransform(entity) { const data=rigMatrices.get(entity.name);return {data,translation:data.slice(12,15)}; },
  getTransform() { return { original: true, translation:[0,0,0], translate() {return this;}, rotate(angle,axis) {assert.ok(angle>0&&Math.abs(Math.hypot(...axis)-1)<1e-6);contactCalls.push('rotate');return this;} }; }
};
const asset = { getFirstEntityByName: name => rigMatrices?.has(name) || exposeFoodProps && name==='Bowl base Game prop' ? {name} : undefined }, entity = {}, context = { transformManager };
mocks['react-native-filament'] = { useModel: () => ({ state: 'loaded', asset, rootEntity: entity }), useAnimator: () => animator, useFilamentContext: () => context, RenderCallbackContext: { useRenderCallback: fn => { renderFrame = fn; } } };
const { NativeCatActor } = load('@/components/pet/native/NativeCatActor');
const registry = load('@/pet-display/registry/cat-model-registry').catModelRegistry;
assert.equal(registry.mediaKind, 'model');
function render(props) { cursor = 0;effects = [];NativeCatActor(props);effects.forEach(fn => fn()); }
for (const fps of [30, 60, 120]) {
  slots = [];applies = [];let complete = 0, steps = [];
  const props = { playback: { kind: 'scenario', steps: [registry.getSegment('excited'), registry.getSegment('eating')] }, active: true, onAnimationComplete: () => complete++, onStepComplete: i => steps.push(i) };
  render(props);
  for (let i = 0; i < fps * 8; i++) renderFrame({ timeSinceLastFrame: 1 / fps });
  assert.equal(complete, 1, 'Scenario completion fires once');assert.deepEqual(steps, [0, 1]);
  slots = [];applies = [];
  const travel = { path: [[-1, w.FLOOR_Y, 0], [1, w.FLOOR_Y, 0]], distance: 2, duration: 2, jump: false };
  render({ playback: { kind: 'segment', segment: registry.getSegment('idle') }, active: true, world: empty, travel });
  for (let i = 0; i < fps; i++) renderFrame({ timeSinceLastFrame: 1 / fps });
  assert.ok(Math.abs(position[0]) < 1e-5);
  assert.deepEqual(Array.from(scale), [empty.catScale, empty.catScale, empty.catScale]);
  const last = applies.at(-1);assert.equal(last.name, 'walk');assert.ok(Math.abs(last.time - (1 / (.8 * empty.catScale) % 1)) < .001, 'Paw phase follows actual traveled distance');
}

// Room arrivals use the rendered clock even when wall time/frame delivery differs.
for (const reduced of [false, true]) {
  slots = []; applies = []; const completions = [];
  const roomTravel = { path: reduced ? [[1, w.FLOOR_Y, 0]] : [[-1, w.FLOOR_Y, 0], [1, w.FLOOR_Y, 0]], distance: reduced ? 0 : 2, duration: 2,
    jump: false, awaitCompletion: true };
  const roomProps = { playback: { kind: 'segment', segment: registry.getSegment('idle') }, active: true,
    world: empty, travel: roomTravel, activityKey: 'meal:walk:1', reduceMotion: reduced,
    onRoomStepComplete: (key, arrival) => completions.push({ key, arrival }) };
  render(roomProps);
  for (let frame = 0; frame < (reduced ? 8 : 20); frame++) renderFrame({ timeSinceLastFrame: .15 });
  assert.equal(completions.length, 0, 'A slow renderer never claims arrival from wall time alone');
  render({ ...roomProps, active: false });
  for (let frame = 0; frame < 100; frame++) renderFrame({ timeSinceLastFrame: .15 });
  assert.equal(completions.length, 0, 'Paused scenes cannot complete a meal step');
  render(roomProps);
  for (let frame = 0; frame < 100; frame++) renderFrame({ timeSinceLastFrame: .15 });
  assert.equal(completions.length, 1);
  assert.equal(completions[0].key, 'meal:walk:1');
  assert.deepEqual(Array.from(completions[0].arrival), [1, w.FLOOR_Y, 0], 'Arrival includes the exact rendered endpoint');
  const duration = authored.eating[0] / authored.eating[1];
  render({ ...roomProps, playback: { kind: 'segment', segment: registry.getSegment('eating') },
    activityKey: 'meal:eating:2', travel: { ...roomTravel, path: [[1, w.FLOOR_Y, 0]], distance: 0, duration } });
  for (let frame = 0; frame < 120; frame++) renderFrame({ timeSinceLastFrame: .15 });
  assert.equal(completions.length, 2);
  assert.equal(completions[1].key, 'meal:eating:2', 'Eating completes after its rendered clip');
}
console.log('Verified actual renderer arrival and eating completion, slow frames, pause, exact endpoints and Reduce Motion.');

// A longer placed-bowl meal must extend native playback and its shared spill clock.
{
  const { createRoomActivitySegment } = load('@/pet-display/registry/cat-model-registry');
  const plan = buildRoomActivity({ ...base, homeOffset: { x: 0, y: .12 }, ownedToyIds: [],
    decorations: [{ decorationId: 'bowlBlue', instanceId: 'long-meal', offset: { x: .2, y: .3 } }] }, 0, 'bowlEat');
  const step = plan.steps[1];
  const segment = createRoomActivitySegment(step.animation, step.reverse, step.animationFps);
  slots = []; applies = [];
  let completions = 0;
  const sharedMealClock = { value: { name: 'idle', time: 0 } };
  render({ playback: { kind: 'segment', segment }, active: true, world: empty,
    animationTimeValue: sharedMealClock, activityKey: 'long-meal:eating',
    travel: { path: [empty.home], distance: 0, duration: step.durationMs / 1000, jump: false, awaitCompletion: true },
    onRoomStepComplete: () => completions++ });
  for (let frame = 0; frame < 240; frame++) renderFrame({ timeSinceLastFrame: 1 / 60 });
  assert.equal(completions, 0, 'The cat continues eating after the old four-second deadline');
  assert.ok(Math.abs(sharedMealClock.value.time - 2) < 1e-5, 'Crumbs are halfway through their animation after four seconds');
  assert.equal(sharedMealClock.value.time, applies.at(-1).time, 'The slower spill clock matches the actual muzzle pose');
  for (let frame = 0; frame < 241; frame++) renderFrame({ timeSinceLastFrame: 1 / 60 });
  assert.equal(completions, 1, 'The extended rendered meal completes once after eight seconds');
}
console.log('Verified eight-second native eating, extended synchronized crumb playback and no early completion.');


slots = [];let complete = 0;
const oneShot = { playback: { kind: 'segment', segment: registry.getSegment('eating') }, active: false, onAnimationComplete: () => complete++ };
render(oneShot);for (let i = 0; i < 300; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });assert.equal(complete, 0, 'Background playback pauses');
render({ ...oneShot, active: true, reduceMotion: true });for (let i = 0; i < 60; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });assert.equal(complete, 1, 'Reduce Motion still releases care');
slots = [];complete = 0;let reducedSteps = [];
render({ playback: { kind: 'scenario', steps: [registry.getSegment('excited'), registry.getSegment('eating')] }, active: true, reduceMotion: true, onAnimationComplete: () => complete++, onStepComplete: i => reducedSteps.push(i) });
for (let i = 0; i < 80; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.equal(complete, 1, 'Reduced multi-step care completes in its semantic duration');assert.deepEqual(reducedSteps, [0, 1]);
// The real renderer must apply contact after animation and before uploading skin matrices.
const contactRoom=w.buildNativeRoomWorld({...base,decorations:[{...sofa,scale:2.2,offset:{x:0,y:0}}]});
const contactSofa=contactRoom.objects[0];
const contactPoints=posedTail('sit',0,contactSofa.seat,0,contactRoom.catScale);
rigMatrices=new Map(contactPoints.map((p,i)=>[i===4?'tailTip':'tailjoint'+i,matrix(p)]));rigMatrices.set('spine',matrix());
slots=[];contactCalls.length=0;
render({ playback:{kind:'segment',segment:registry.getSegment('idle')},world:contactRoom,
  travel:{path:[contactSofa.seat],distance:0,duration:1,jump:false,heading:0},active:true,reduceMotion:true });
renderFrame({timeSinceLastFrame:1/60});
assert.deepEqual(contactCalls,['rotate','tail','skin'],'Reduce Motion still resolves tail contact before skinning');
const heldProps = { playback:{kind:'segment',segment:registry.getSegment('idle')},world:contactRoom,
  travel:{path:[contactSofa.seat],distance:0,duration:1,jump:false,heading:0},active:true };
render(heldProps);
const heldFrame=renderFrame;
for(let i=0;i<20;i++) {
  renderFrame({timeSinceLastFrame:1/60}); render(heldProps);
  assert.equal(renderFrame,heldFrame,'UI rerenders must retain the native rig worklet');
}
assert.ok(applies.at(-1).time>.3,'UI rerenders must not restart the seated idle clock');
rigMatrices=undefined;
const wallFixture={...empty,objects:[{instanceId:'fixture',solid:false,collidable:true,movable:false,min:[-.4,.1,-.4],max:[.4,.8,-.2]}]};
const tailPoints=[[0,.4,0],[0,.5,-.3],[0,.7,-.4],[0,.9,-.4]];
const mounted=contact.resolveTailContact(tailPoints,wallFixture,{angle:0,axis:[0,1,0],blocked:false},1/60);
assert.ok(mounted.angle>0&&!mounted.blocked,'Wall-mounted decorations also constrain the tail');

// Render updates and reroutes preserve the actual pose rather than an old UI sample.
slots = []; applies = [];
const livePosition = { value: empty.home }, renderedTime = { value: { name: 'idle', time: 0 } };
const movingPlayback = { kind: 'segment', segment: registry.getSegment('idle') };
const initialPath = [empty.home, [1, w.FLOOR_Y, 0]];
const movingProps = { playback: movingPlayback, world: empty, active: true, positionValue: livePosition,
  travel: { path: initialPath, distance: w.pathLength(initialPath), duration: 2, jump: false } };
render(movingProps);
for (let i = 0; i < 45; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
const beforeWorldUpdate = Array.from(livePosition.value);
const changedWorld = { ...empty, objects: [obstacle] };
render({ ...movingProps, world: changedWorld }); renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(w.pathLength([beforeWorldUpdate, livePosition.value]) < .03, 'An object update cannot restart the rendered cat journey');
const beforeReroute = Array.from(livePosition.value), destination = [.4, w.FLOOR_Y, 1];
const staleReportedStart = [beforeReroute[0] - 1, w.FLOOR_Y, beforeReroute[2]];
const reroutedProps = { ...movingProps, world: changedWorld, travel: { path: [staleReportedStart, destination], distance: w.pathLength([staleReportedStart, destination]), duration: 2, jump: false, replanned: true } };
render(reroutedProps); renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(w.pathLength([beforeReroute, livePosition.value]) < .03, 'Replanning starts at the exact rendered cat position, even with delayed RN reports');
for (let i = 0; i < 130; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(w.pathLength([destination, livePosition.value]) < 1e-6, 'A reroute reaches the new destination');
render({ ...reroutedProps, travel: undefined }); renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(w.pathLength([destination, livePosition.value]) < 1e-6, 'Ending a blocked/cancelled route never snaps the cat home');
render({ ...reroutedProps, travel: undefined, world: { ...changedWorld, home: [.7, w.FLOOR_Y, .7] } });
renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(w.pathLength([[.7, w.FLOOR_Y, .7], livePosition.value]) < 1e-6, 'Explicit cat repositioning still updates the saved home');
const clockProps = { playback: { kind: 'segment', segment: registry.getSegment('eating') }, world: empty, active: true,
  animationTimeValue: renderedTime, travel: { path: [empty.home], distance: 0, duration: 4, jump: false } };
render(clockProps);
for (let i = 0; i < 60; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
const beforeClockUpdate = renderedTime.value.time;
render({ ...clockProps, world: changedWorld }); renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.ok(Math.abs(renderedTime.value.time - beforeClockUpdate - 1 / 60) < 1e-6, 'World snapshots preserve the eating clock');
console.log('Verified render-position continuity during world updates, rerouting, cancelled travel and explicit cat repositioning.');
console.log(`Verified ${inventory.length} native assets, all ${Object.keys(authored).length} actions in three coats, saved placement projection, collision detours, sofa support, native gait at 30/60/120 FPS, scenario callbacks, pause and Reduce Motion.`);

exposeFoodProps = true; slots = []; propTransforms.length = 0;
const mealProps = { playback: { kind: 'segment', segment: registry.getSegment('eating') }, active: true,
  world: empty, travel: { path: [empty.home], distance: 0, duration: 4, jump: false, hideEatingProps: true } };
render(mealProps); renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.equal(propTransforms.at(-1), 'hidden', 'Placed-bowl meals hide the embedded bowl mesh');
render({ ...mealProps, travel: undefined }); renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.equal(propTransforms.at(-1), 'visible', 'Normal care restores embedded props after a bowl meal');
console.log('Verified placed-bowl animation hides and restores its embedded bowl independently of the room object.');

// The spill follows the rendered cat clock, including pauses and the first muzzle contact.
const mealTime = { value: { name: 'idle', time: 0 } };
slots = []; applies = [];
render({ ...mealProps, animationTimeValue: mealTime });
for (let i = 0; i < 70; i++) renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.equal(mealTime.value.name, 'eating');
assert.equal(mealTime.value.time, applies.at(-1).time);
const pausedMealTime = mealTime.value.time;
render({ ...mealProps, animationTimeValue: mealTime, active: false });
renderFrame({ timeSinceLastFrame: 1 });
assert.equal(mealTime.value.time, pausedMealTime, 'Spills pause with the muzzle');

const spillBytes = fs.readFileSync('assets/3d/native/bowl-food-spill.glb');
const spillModel = glb('bowl-food-spill');
const spillBinary = spillBytes.subarray(28 + spillBytes.readUInt32LE(12));
function spillValues(index) {
  const accessor = spillModel.accessors[index], view = spillModel.bufferViews[accessor.bufferView];
  const width = accessor.type === 'VEC3' ? 3 : accessor.type === 'VEC4' ? 4 : 1;
  return Array.from({ length: accessor.count }, (_, i) => Array.from({ length: width }, (_, axis) =>
    spillBinary.readFloatLE((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + i * (view.byteStride ?? width * 4) + axis * 4)));
}
assert.equal(spillModel.meshes.length, 8, 'A placed-bowl spill adds only crumbs, without another bowl');
assert.equal(spillModel.animations.length, 1);
const spillClip = spillModel.animations[0];
const spillDuration = Math.max(...spillClip.samplers.map(s => spillModel.accessors[s.input].max[0]));
assert.equal(spillDuration, authored.eating[0] / authored.eating[1]);
for (const node of spillModel.nodes.filter(n => n.mesh !== undefined)) {
  const nodeIndex = spillModel.nodes.indexOf(node);
  const channels = spillClip.channels.filter(c => c.target.node === nodeIndex);
  const translations = spillValues(spillClip.samplers[channels.find(c => c.target.path === 'translation').sampler].output);
  const sizesSampler = spillClip.samplers[channels.find(c => c.target.path === 'scale').sampler];
  const sizes = spillValues(sizesSampler.output), times = spillValues(sizesSampler.input);
  assert.ok(sizes[0].every(v => v === 0) && sizes.at(-1).every(v => v === 0), 'Crumbs are hidden before and after the meal');
  assert.ok(Math.max(...translations.map(v => v[1])) > .35, 'Crumbs arc above the rim');
  const settled = translations.at(-1);
  assert.ok(Math.hypot(settled[0], settled[2]) > .365 && Math.abs(settled[1] - .035) < 1e-6, 'Crumbs land outside the bowl on the floor');
  if (Number(node.name.match(/\d+/)[0]) <= 3) {
    const firstVisible = times[sizes.findIndex(v => v[0] > 0)][0];
    assert.ok(firstVisible >= 1 && firstVisible < 1.1, 'The first crumbs move as the muzzle reaches the food');
  }
}

let spillTransform, spillTimes = [];
mocks['react-native-filament'] = {
  useModel: () => ({ state: 'loaded', asset: {}, rootEntity: {} }),
  useAnimator: () => ({ getAnimationDuration: () => spillDuration, applyAnimation: (i, t) => { assert.equal(i, 0); spillTimes.push(t); }, updateBoneMatrices() {} }),
  useFilamentContext: () => ({ transformManager: {
    createIdentityMatrix: () => ({ scaling(v) { this.scale = v; return this; }, rotate(v) { this.heading = v; return this; }, translate(v) { this.position = v; return this; } }),
    setTransform: (_, matrix) => { spillTransform = matrix; },
  } }),
  RenderCallbackContext: { useRenderCallback: fn => { renderFrame = fn; } },
};
const { NativeFoodSpill } = load('@/components/pet/native/NativeFoodSpill');
for (const bowlId of ['bowlTan', 'bowlBlue', 'bowlPurple', 'bowlPink']) {
  for (const itemScale of [.7, 1, 2.2]) {
    const object = w.buildNativeRoomWorld({ ...base, decorations: [{ decorationId: bowlId, instanceId: 'meal', offset: { x: .3, y: -.2 }, scale: itemScale }] }).objects[0];
    assert.ok(object, bowlId);
    slots = []; cursor = 0; mealTime.value = { name: 'eating', time: 1.2 };
    NativeFoodSpill({ object, active: true, animationTime: mealTime }); renderFrame();
    assert.deepEqual(Array.from(spillTransform.scale), [object.scale, object.scale, object.scale]);
    assert.equal(spillTransform.heading, object.heading); assert.equal(spillTransform.position, object.position);
    assert.equal(spillTimes.at(-1), 1.2, 'A late-loaded effect uses the current eating phase');
    cursor = 0; NativeFoodSpill({ object, active: false, animationTime: mealTime });
    const count = spillTimes.length; renderFrame(); assert.equal(spillTimes.length, count);
    cursor = 0; NativeFoodSpill({ object, active: true, animationTime: mealTime });
    mealTime.value = { name: 'eating', time: 5 }; renderFrame(); assert.equal(spillTimes.at(-1), 4);
    mealTime.value = { name: 'walk', time: 1 }; renderFrame(); assert.equal(spillTimes.at(-1), 0);
    mealTime.value = { name: 'eating', time: 0 }; renderFrame(); assert.equal(spillTimes.at(-1), 0, 'A new meal starts without leftover crumbs');
  }
}
console.log('Verified muzzle-contact spills, floor landing, cleanup, selected-bowl transforms, synchronized playback and pauses.');

// Exercise the scene's actual mounting and cleanup conditions.
React.memo = fn => fn;
React.useState = value => [memo(() => value, []), () => {}];
mocks['react/jsx-runtime'] = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
mocks['react-native'] = { View: 'View', ActivityIndicator: 'ActivityIndicator', StyleSheet: { absoluteFill: {}, flatten: v => v, create: v => v } };
mocks['./NativeFoodSpill'] = { NativeFoodSpill: 'FoodSpill' };
mocks['./NativeAirflow'] = { NativeAirflow: 'Airflow' };
mocks['./NativeCatActor'] = { NativeCatActor: 'Cat' };
const startupVisualReadiness = [];
mocks['@/contexts/StartupVisualContext'] = { useStartupVisualReady(ready) { startupVisualReadiness.push(ready); } };
let sceneReduced = false;
mocks['@/hooks/use-animation-activity'] = { useAnimationActivity: () => ({ active: true, reduceMotion: sceneReduced }) };
Object.assign(mocks['react-native-filament'], { FilamentScene: 'FilamentScene', FilamentView: 'FilamentView', DefaultLight: 'Light', useWorld: () => ({}), useStaticPlaneShape() {}, useBoxShape() {}, useRigidBody() {} });
const { NativeRoomScene } = load('@/components/pet/native/NativeRoomScene');
const bowlRoom = w.buildNativeRoomWorld({ ...base, decorations: [{ decorationId: 'bowlBlue', instanceId: 'meal', offset: { x: .2, y: .3 } }] });
slots = []; cursor = 0;
NativeRoomScene({ world: { ...bowlRoom, width: 0 } });
assert.equal(startupVisualReadiness.at(-1), false, 'An unmeasured room must reserve its startup hold before mounting Filament');
function sceneChildren(props) {
  slots = []; cursor = 0;
  const scene = NativeRoomScene(props).props.children.props.children;
  return scene.type(scene.props).props.children.flat(Infinity).filter(Boolean);
}
const sceneMeal = { ...mealProps, world: bowlRoom, playingId: 'meal', activityKey: 'meal-one' };
let children = sceneChildren(sceneMeal), spill = children.find(c => c.type === 'FoodSpill'), cat = children.find(c => c.type === 'Cat');
assert.equal(spill.props.object, bowlRoom.objects[0]); assert.equal(spill.key, 'meal-one');
assert.equal(spill.props.animationTime, cat.props.animationTimeValue, 'Scene shares the actual cat clock with the spill');
assert.equal(sceneChildren({ ...sceneMeal, paused: true }).find(c => c.type === 'FoodSpill').props.active, false);
for (const patch of [{ playingId: 'missing' }, { travel: undefined }, { playback: { kind: 'segment', segment: registry.getSegment('idle') } }])
  assert.ok(!sceneChildren({ ...sceneMeal, ...patch }).some(c => c.type === 'FoodSpill'), 'Spill is removed when the selected-bowl meal ends');
sceneReduced = true;
assert.ok(!sceneChildren(sceneMeal).some(c => c.type === 'FoodSpill'), 'Reduce Motion omits the flying crumbs');
console.log('Verified spill lifecycle in the rendered room scene, including cancellation and Reduce Motion.');

// A cached native surface draws before a slide and stops its GPU clock while hidden.
React.useState = initial => {
  const i = cursor++, value = memoState(i, initial);
  return [value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }];
};
function memoState(i, initial) { if (!slots[i]) slots[i] = { value: initial }; return slots[i].value; }
React.useEffect = (fn, deps) => {
  const i = cursor++, old = slots[i];
  if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) effects.push(() => {
    old?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
  });
};
// Native shared objects are snapshots; persist updates through the value setter.
const sharedSnapshot = value => Array.isArray(value) ? [...value] : value && typeof value === 'object' ? { ...value } : value;
mocks['react-native-worklets-core'].useSharedValue = initial => memo(() => {
  let value = sharedSnapshot(initial);
  return { get value() { return sharedSnapshot(value); }, set value(next) { value = sharedSnapshot(next); } };
}, []);
const sceneClock = [];
context.choreographer = { start: () => sceneClock.push('start'), stop: () => sceneClock.push('stop') };
mocks['react-native-filament'].useFilamentContext = () => context;
let sceneReady = 0, sceneRender;
context.camera = { setOrthographicProjection() {}, lookAt() {} };
context.view = { getAspectRatio: () => 1 };
const onSceneReady = () => sceneReady++;
slots = []; frameRequests.clear();
function renderCachedScene(props) {
  cursor = 0; effects = [];
  const root = NativeRoomScene(props).props.children.props.children;
  const surface = root.type(root.props);
  sceneRender = surface.props.renderCallback;
  const children = surface.props.children.flat(Infinity).filter(Boolean);
  effects.forEach(fn => fn()); return children;
}
function paintFrame() { sceneRender({ timeSinceLastFrame: 1 / 60 }); }
const cachedProps = { ...sceneMeal, paused: true, catPresent: false, onSceneReady };
let cached = renderCachedScene(cachedProps);
cached.find(child => child.type.name === 'RoomModel').props.onReady();
renderCachedScene(cachedProps);
paintFrame(); paintFrame(); renderCachedScene(cachedProps);
assert.equal(sceneReady, 0, 'Room geometry alone does not preload its furniture');
for (const child of cached.filter(child => child.type.name === 'RoomObject'))
  child.props.onReady(`${child.props.object.instanceId}:${child.props.object.modelId}`);
renderCachedScene(cachedProps);
assert.equal(sceneReady, 0, 'Loading the room asset is not a drawn frame');
paintFrame(); renderCachedScene(cachedProps);
assert.equal(sceneReady, 0, 'One drawing turn still retains the outgoing scene');
paintFrame(); renderCachedScene(cachedProps);
assert.equal(sceneReady, 0, 'Startup remains covered until the native scene has drawn twice');
paintFrame(); renderCachedScene(cachedProps);
assert.equal(sceneReady, 1);
assert.equal(sceneClock.at(-1), 'stop', 'A drawn hidden room stops its native renderer');
renderCachedScene({ ...cachedProps, paused: false });
assert.equal(sceneClock.at(-1), 'start');
const arrivalProps = { ...cachedProps, catPresent: true, initialCatPosition: w.nativeRoomEdge(bowlRoom, -1) };
cached = renderCachedScene(arrivalProps);
assert.equal(sceneReady, 1, 'A previously empty room waits for the incoming cat');
assert.equal(sceneClock.at(-1), 'start', 'The cached renderer wakes to draw a newly arriving cat');
const incomingCat = cached.find(child => child.type === 'Cat');
assert.equal(incomingCat.props.initialPosition, arrivalProps.initialCatPosition);
incomingCat.props.onReady(); renderCachedScene(arrivalProps);
paintFrame(); renderCachedScene(arrivalProps); paintFrame(); renderCachedScene(arrivalProps);
paintFrame(); renderCachedScene(arrivalProps);
assert.equal(sceneReady, 2);
assert.equal(sceneClock.at(-1), 'stop');
console.log('Verified native first-frame handoff, retained hidden surfaces, paused GPU clocks and new-cat readiness in cached rooms.');

const departurePlan = buildRoomActivity({ ...base, homeOffset: { x: 0, y: .12 }, ownedToyIds: [], decorations: [] }, 0, 'roomTravel', 'bedroom');
const departure = w.prepareNativeStep(departurePlan, departurePlan.steps[0], w.catScreenPoint(routed.home, routed), routed, w.FLOOR_Y);
assert.equal(departure.native.blocked, false);
assert.ok(departure.native.path.at(-1)[2] > 1.5, 'Travel to the bedroom reaches the left front edge');
for (let i = 1; i < departure.native.path.length; i++) for (let t = 0; t <= 1; t += .02)
  assert.ok(w.isFree(departure.native.path[i - 1].map((v, axis) => v + (departure.native.path[i][axis] - v) * t), routed), 'Departure routes clear the current furniture');
const rightDeparturePlan = buildRoomActivity({ ...base, homeOffset: { x: 0, y: .12 }, ownedToyIds: [], decorations: [] }, 0, 'roomTravel', 'kitchen');
const blockedDeparture = w.prepareNativeStep(rightDeparturePlan, rightDeparturePlan.steps[0], w.catScreenPoint([-1.5, w.FLOOR_Y, 0], divided), divided, w.FLOOR_Y);
assert.equal(blockedDeparture.native.blocked, true, 'An unreachable departure cannot change the cat room');
const { buildRoomEntry } = load('@/utils/room-activities');
for (const [destination, direction] of [['bedroom', -1], ['kitchen', 1], ['bathroom', 1]]) {
  const options = { ...base, homeRoomId: 'livingRoom', entry: { id: 1, direction }, homeOffset: { x: 0, y: .12 }, ownedToyIds: [], decorations: [] };
  const exitPlan = buildRoomActivity(options, 0, 'roomTravel', destination);
  const exit = w.prepareNativeStep(exitPlan, exitPlan.steps[0], w.catScreenPoint(routed.home, routed), routed, w.FLOOR_Y);
  assert.equal(exitPlan.steps[0].travelDirection, direction);
  assert.equal(Math.sign(w.catScreenPoint(exit.native.path.at(-1), routed).x), direction, 'The exit is on the side of the destination');
  const entryPlan = buildRoomEntry(options);
  const entry = w.prepareNativeStep(entryPlan, entryPlan.steps[0], { x: 0, y: 0 }, routed, w.FLOOR_Y);
  assert.equal(Math.sign(w.catScreenPoint(entry.native.path[0], routed).x), -direction, 'The next room starts on the opposite edge');
  assert.ok(w.pathLength([entry.native.path.at(-1), w.nearestFree(routed.home, routed)]) < 1e-6, 'Entry walks to the saved home position with furniture clearance');
  assert.equal(entry.native.blocked, false);
  for (let i = 1; i < entry.native.path.length; i++) for (let t = 0; t <= 1; t += .02)
    assert.ok(w.isFree(entry.native.path[i - 1].map((v, axis) => v + (entry.native.path[i][axis] - v) * t), routed), 'Entry routes avoid furniture');
}
console.log('Verified left/right departures, opposite-side entries, furniture detours and the living room between bedroom and kitchen.');
