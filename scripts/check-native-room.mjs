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
const { CAT_DECORATION_IDS } = load('@/constants/cat-decorations');
const { isWindowDecorationId } = load('@/constants/window-decorations');
const { CAT_TOY_IDS } = load('@/constants/cat-toys');
const { CAT_BED_IDS } = load('@/constants/cat-beds');
const rotatingLayouts = [
  ...CAT_DECORATION_IDS.map(decorationId => degrees => ({ ...base, decorations: [{ decorationId, instanceId: decorationId, offset: { x: 0, y: -.2 }, rotationDegrees: degrees }] })),
  ...CAT_TOY_IDS.map(toyId => degrees => ({ ...base, toys: [{ toyId, instanceId: toyId, offset: { x: 0, y: 0 }, rotationIndex: 2, rotationDegrees: degrees }] })),
  ...CAT_BED_IDS.map(bedId => degrees => ({ ...base, bedId, bedFlipped: true, bedRotationDegrees: degrees })),
];
for (const layout of rotatingLayouts) {
  const original = w.buildNativeRoomWorld(layout(0)).objects[0];
  assert.ok(original, 'Every placeable item has a native model');
  for (const degrees of [37.5, 137.2, 315, 360]) {
    const object = w.buildNativeRoomWorld(layout(degrees)).objects[0];
    const turn = isWindowDecorationId(object.modelId) ? 0 : (degrees % 360) * Math.PI / 180;
    assert.ok(Math.abs(object.heading - original.heading - turn) < 1e-8, `${object.modelId}: windows stay flush to the wall; other items use the saved yaw`);
    const meta = catalog[object.modelId], cos = Math.cos(object.heading), sin = Math.sin(object.heading);
    // Approach points may be shifted to clear the rotated collision bounds;
    // the contact/landing points themselves must stay attached to the model.
    for (const [before, after] of [[original.seat, object.seat], [original.bathroom?.contact, object.bathroom?.contact], ...(original.leaves ?? []).map((point, index) => [point, object.leaves[index]])]) {
      if (!before) continue;
      const x = before[0] - original.position[0], z = before[2] - original.position[2];
      assert.ok(Math.abs(after[0] - object.position[0] - (Math.cos(turn) * x + Math.sin(turn) * z)) < 1e-7
        && Math.abs(after[2] - object.position[2] - (-Math.sin(turn) * x + Math.cos(turn) * z)) < 1e-7, `${object.modelId}: cat interaction anchors follow the rotated model`);
    }
    for (const x of [meta.min[0], meta.max[0]]) for (const y of [meta.min[1], meta.max[1]]) for (const z of [meta.min[2], meta.max[2]]) {
      const corner = [object.position[0] + (cos * x + sin * z) * object.scale, object.position[1] + y * object.scale, object.position[2] + (-sin * x + cos * z) * object.scale];
      corner.forEach((value, axis) => assert.ok(value >= object.min[axis] - 1e-7 && value <= object.max[axis] + 1e-7, `${object.modelId}: collider encloses the rotated model`));
    }
  }
}
console.log(`Verified arbitrary native rotation and collider bounds for all ${rotatingLayouts.length} placeable items.`);
const { WINDOW_DECORATION_IDS } = load('@/constants/window-decorations');
for (const decorationId of WINDOW_DECORATION_IDS) for (const wallFlipped of [false,true]) for (const rotationDegrees of [0, 45, 137.5, 315]) {
  const layout = {...base, decorations:[{decorationId, instanceId:'window', wallFlipped, rotationDegrees, offset:{x:-.15,y:.18}}]};
  const window = w.buildNativeRoomWorld(layout).objects[0];
  assert.ok(window.min[1] >= .18 - 1e-6 && window.max[1] <= 2.65 + 1e-6,
    'Windows placed with a floor offset remain visible above the floor and below the wall top');
  assert.ok(window.min[wallFlipped ? 0 : 2] >= -2.35 - 1e-6,
    'The glass and frame sit in front of the opaque room wall');
  assert.ok(window.placementOffset, 'Invisible saved placements receive a matching editor anchor');
  const repaired = w.buildNativeRoomWorld({...layout, decorations:[{...layout.decorations[0], offset:window.placementOffset}]}).objects[0];
  assert.equal(repaired.placementOffset, undefined, 'Correcting the saved anchor converges after one update');
  assert.ok(w.pathLength([window.position,repaired.position]) < 1e-6, 'Saving the repaired anchor preserves the visible window');
}
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
  const multiplier = o.instanceId === 'sofa' ? 1.2 : o.instanceId === 'ball' ? 1.1 : o.instanceId === 'bed' ? 1.3 : 1;
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
const { buildRoomActivity, buildRoomReturn, buildRoomExit, routeToSofa } = load('@/utils/room-activities');
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

// Reproduce the furnished saved room instead of testing only isolated bowls.
const savedLiving = JSON.parse(fs.readFileSync('scripts/fixtures/living-room-navigation.json'));
for (const [width, height] of [[320,320],[351,520],[390,650]]) {
  const options = { width, height, petSize:80, sizeScale:1.15, homeOffset:savedLiving.roomPetOffset,
    decorations:savedLiving.placedDecorations, toys:savedLiving.placedToys, ownedToyIds:[], hungry:true };
  const world = w.buildNativeRoomWorld(options);
  const plan = buildRoomActivity({...options,nativeWorld:world},0,'bowlEat');
  assert.ok(plan, `${width}/${height}: the saved living room has a reachable bowl`);
  const approach = w.prepareNativeStep(plan,plan.steps[0],w.catScreenPoint(world.home,world),world,w.FLOOR_Y);
  assert.equal(approach.native.blocked,false);
  const arrival = approach.native.path.at(-1);
  assert.ok(w.isFree(arrival,world));
  const meal = w.prepareNativeStep(plan,plan.steps[1],w.catScreenPoint(arrival,world),world,w.FLOOR_Y);
  assert.equal(meal.native.blocked,false,'Eating starts only after the cat arrives within muzzle reach');
  const tooFar = w.prepareNativeStep(plan,plan.steps[1],w.catScreenPoint([1.8,w.FLOOR_Y,1.8],world),world,w.FLOOR_Y);
  assert.equal(tooFar.native.blocked,true,'The eating clip cannot award food from across the room');
  const chairPlan=buildRoomActivity({...options,nativeWorld:world},0,'sofaSit',savedLiving.placedDecorations.find(item=>item.decorationId==='chairRockingOak').instanceId);
  const chair=world.objects.find(object=>object.modelId==='chairRockingOak');
  const exit=buildRoomExit({...options,nativeWorld:world},chairPlan,2,w.catScreenPoint(chair.seat,world));
  const off=w.prepareNativeStep(exit,exit.steps[0],w.catScreenPoint(chair.seat,world),world,chair.seat[1]);
  assert.equal(off.native.blocked,false,'The reported rocking chair has a safe jump down before editing');
  assert.equal(off.native.path.at(-1)[1],w.FLOOR_Y);
}
const twoBowls = { ...base, petSize:80, decorations:[
  {decorationId:'bowlBlue',instanceId:'enclosed-bowl',offset:{x:-.5,y:.05}},
  {decorationId:'bowlPink',instanceId:'reachable-bowl',offset:{x:.5,y:.05}},
], homeOffset:{x:0,y:.4}, ownedToyIds:[], hungry:true };
const twoBowlWorld = w.buildNativeRoomWorld(twoBowls);
const enclosed = twoBowlWorld.objects[0];
twoBowlWorld.objects.push({instanceId:'blocker',modelId:'test-blocker',position:enclosed.position,heading:0,scale:1,solid:true,
  min:[enclosed.position[0]-.9,0,enclosed.position[2]-.9],max:[enclosed.position[0]+.9,1,enclosed.position[2]+.9]});
const mealChoice = buildRoomActivity({...twoBowls,nativeWorld:twoBowlWorld},0,'bowlEat');
assert.equal(mealChoice?.targetInstanceId,'reachable-bowl','Eat chooses another bowl when the first is enclosed');
assert.equal(buildRoomActivity({...twoBowls,nativeWorld:twoBowlWorld},0,'bowlEat','enclosed-bowl'),null,
  'Selecting an enclosed bowl cannot silently eat from another bowl');
console.log('Verified saved living-room food routes, muzzle arrival checks and alternate reachable bowl selection.');

// The reported sofa is behind a chair and beneath a rotated arc lamp.
const savedSofa = JSON.parse(fs.readFileSync('scripts/fixtures/sofa-navigation.json'));
for (const [width, height] of [[320,460],[351,520],[390,650]]) {
  const options = { width, height, petSize:80, sizeScale:1.15, homeOffset:savedSofa.roomPetOffset,
    decorations:savedSofa.placedDecorations, toys:savedSofa.placedToys, ownedToyIds:[], asleep:false };
  const world = w.buildNativeRoomWorld(options);
  const sofa = world.objects.find(o=>o.modelId==='sofaB');
  const chair = world.objects.find(o=>o.modelId==='chairRockingOak');
  const lamp = world.objects.find(o=>o.modelId==='lampFloorArc');
  assert.ok(lamp.collisionBoxes.length>5, 'Arc lamp collision follows its stem instead of filling the air beneath the shade');
  const sleep = buildRoomActivity({...options,nativeWorld:world},0,'sofaSleep',sofa.instanceId);
  const tooFar = w.prepareNativeStep(sleep,sleep.steps[3],w.catScreenPoint(world.home,world),world,w.FLOOR_Y);
  assert.equal(tooFar.native.blocked,true,'A held sleep clip cannot start on the floor before reaching its cushion');
  const belowSeat = [sofa.seat[0],w.FLOOR_Y,sofa.seat[2]];
  assert.equal(w.prepareNativeStep(sleep,sleep.steps[3],w.catScreenPoint(belowSeat,world),world,w.FLOOR_Y).native.blocked,true,
    'Being underneath the sofa is not arrival on the cushion');
  let point = world.home;
  let preparedPlan = sleep;
  for (let index=0;index<4;index++) {
    const step=w.prepareNativeStep(preparedPlan,preparedPlan.steps[index],w.catScreenPoint(point,world),world,point[1]);
    assert.equal(step.native.blocked,false,`${width}/${index}: the reported sofa has a clear approach and supported sleep pose`);
    preparedPlan={...preparedPlan,steps:preparedPlan.steps.map((s,i)=>i===index?step:s)};
    point=step.native.path.at(-1);
  }
  assert.ok(w.hasNativeArrived(point,sofa.seat));
  const source = buildRoomActivity({...options,nativeWorld:world},0,'sofaSit',chair.instanceId);
  const switching = routeToSofa({...options,nativeWorld:world},sleep,w.catScreenPoint(chair.seat,world),{plan:source,stepIndex:2});
  point=chair.seat; preparedPlan=switching;
  for(let index=0;index<switching.steps.length;index++) {
    const step=w.prepareNativeStep(preparedPlan,preparedPlan.steps[index],w.catScreenPoint(point,world),world,point[1]);
    assert.equal(step.native.blocked,false,`${width}/${index}: chair-to-sofa exits keep their source while the approach targets the sofa`);
    preparedPlan={...preparedPlan,steps:preparedPlan.steps.map((s,i)=>i===index?step:s)};
    point=step.native.path.at(-1);
    if(step.hold)break;
  }
  assert.ok(w.hasNativeArrived(point,sofa.seat));
  const enclosed={...world,objects:[...world.objects,{...obstacle,instanceId:'enclosure',min:[-2.5,0,-2.5],max:[2.5,3,2.5]}]};
  assert.equal(w.findSeatApproach(world.home,sofa,enclosed),undefined,'A fully blocked sofa has no invented interaction point');
}
console.log('Verified reported sofa routes, rotated lamp clearance, chair-to-sofa commands, supported sleep and unreachable seating.');

const alternateSeatOptions={...base,petSize:80,decorations:[{decorationId:'sofaA',instanceId:'alternate-seat',offset:{x:0,y:-.2},scale:1.5}],ownedToyIds:[]};
const alternateSeatWorld=w.buildNativeRoomWorld(alternateSeatOptions),alternateSeat=alternateSeatWorld.objects[0];
const originalApproach=alternateSeat.approach;
alternateSeatWorld.objects.push({...obstacle,instanceId:'takeoff-blocker',min:[originalApproach[0]-.08,0,originalApproach[2]-.08],max:[originalApproach[0]+.08,.3,originalApproach[2]+.08]});
const alternateApproach=w.findSeatApproach(alternateSeatWorld.home,alternateSeat,alternateSeatWorld);
assert.ok(alternateApproach&&w.pathLength([alternateApproach,originalApproach])>.1,'A blocked default takeoff chooses another reachable front-side point');

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
// The landing point must follow the exported sofa orientation, including mirrors.
for (const decorationId of ['sofaA','sofaB']) for (const wallFlipped of [false,true]) for (const scale of [1,1.5,2.2]) {
  const room=w.buildNativeRoomWorld({...base,decorations:[{...sofa,decorationId:'sofaA',rotationIndex:decorationId==='sofaB'?1:0,wallFlipped,scale}]});
  const object=room.objects[0], model=glb(decorationId);
  assert.equal(object.modelId,decorationId);
  const orientation=model.nodes.find(node=>node.name===`${decorationId} orientation`);
  const exported=matrix(orientation.translation,orientation.rotation,orientation.scale);
  const root=matrix(object.position,[0,Math.sin(object.heading/2),0,Math.cos(object.heading/2)],[object.scale,object.scale,object.scale]);
  const transform=multiply(root,exported);
  for (const [name,local] of [['seat',[0,.70,.27]],['approach',[0,0,.85+room.radius/object.scale]]]) {
    const expected=[0,1,2].map(axis=>transform[axis]*local[0]+transform[4+axis]*local[1]+transform[8+axis]*local[2]+transform[12+axis]);
    if(name==='approach') expected[1]=w.FLOOR_Y;
    if(name==='approach') expected.splice(0,3,...w.nearestFree(expected,room));
    assert.ok(w.pathLength([object[name],expected])<1e-6, `${decorationId}/${wallFlipped}/${scale}: ${name} follows the real sofa GLB orientation`);
  }
}
function posedTail(clip,time,position,heading,scale,names=['tailjoint0','tailjoint1','tailjoint2','tailjoint3','tailTip'], localsOnly=false) {
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
  if (localsOnly) return new Map(nodes.map(n => [n.name, n.matrix ?? matrix(n.translation,n.rotation,n.scale)]));
  return names.map(name=>worldMatrix(nodes.findIndex(n=>n.name===name)).slice(12,15));
}
// Hanging toys use the shipped paw joints and perch geometry.
const hanging = load('@/utils/native-hanging-toy');
const treeLayout = { ...base, petSize: 80, sizeScale: 1.15,
  decorations: [{ decorationId: 'catTreePink', instanceId: 'tree', offset: { x: 0, y: .1 } }] };
const treeWorld = w.buildNativeRoomWorld(treeLayout);
const tree = treeWorld.objects[0];
const treeRoom = { ...treeLayout, nativeWorld: treeWorld, homeOffset: { x: 0, y: .12 }, ownedToyIds: [], hungry: false, asleep: false };
const treePlan = load('@/utils/room-activities').buildRoomActivity(treeRoom, 0, 'toyPlay', 'tree');
assert.ok(treePlan && treePlan.steps.some(s => s.animation === 'jumpOn'));
let treePosition = treeWorld.home;
for (const step of treePlan.steps) {
  const prepared = w.prepareNativeStep(treePlan, step, w.catScreenPoint(treePosition, treeWorld), treeWorld, treePosition[1]);
  assert.ok(!prepared.native.blocked, 'The tree play route stays reachable');
  treePosition = prepared.native.path.at(-1);
  if (step.animation === 'jumpOn') assert.ok(w.pathLength([treePosition, tree.seat]) < 1e-6);
}
// Returning from a sofa or another toy prepends steps before the new toy walk.
const prefixedTreePlan = {...treePlan,steps:[{...treePlan.steps.at(-1),returnHome:true},...treePlan.steps]};
const prefixedTreeWalk = w.prepareNativeStep(prefixedTreePlan,prefixedTreePlan.steps[1],w.catScreenPoint(treeWorld.home,treeWorld),treeWorld,w.FLOOR_Y);
const expectedTreeApproach = w.findHangingToyApproach(treeWorld.home,tree,treeWorld);
assert.ok(w.pathLength([prefixedTreeWalk.native.path.at(-1),expectedTreeApproach])<.01,
  'Toy walks after a preceding return still reach the hanging ball instead of the old sprite anchor');
const prefixedReturn = w.prepareNativeStep(prefixedTreePlan,prefixedTreePlan.steps[0],w.catScreenPoint([1.5,w.FLOOR_Y,1.5],treeWorld),treeWorld,w.FLOOR_Y);
assert.ok(w.pathLength([prefixedReturn.native.path.at(-1),w.nearestFree(treeWorld.home,treeWorld)])<.01,
  'The prepended return remains a journey home instead of walking to the new toy');

const treeContactRooms = [treeWorld];
for (const x of [-1, 1]) for (const z of [-1, 1]) {
  const shift = [x * (2.25 - .65 * tree.scale) - tree.position[0], 0,
    z * (2.25 - .46 * tree.scale) - tree.position[2]];
  const move = p => p.map((v,i)=>v+shift[i]);
  const cornerTree = { ...tree, position: move(tree.position), min: move(tree.min), max: move(tree.max),
    seat: move(tree.seat), approach: move(tree.approach),
    collisionBoxes: tree.collisionBoxes.map(b=>({min:move(b.min),max:move(b.max)})) };
  const cornerRoom = { ...treeWorld, home:[0,w.FLOOR_Y,0], objects:[cornerTree] };
  treeContactRooms.push(cornerRoom);
  const approach = w.findHangingToyApproach(cornerRoom.home,cornerTree,cornerRoom);
  assert.ok(approach, `The hanging ball remains playable in corner ${x}/${z}`);
  const prepared = w.prepareNativeStep(treePlan,treePlan.steps[0],w.catScreenPoint(cornerRoom.home,cornerRoom),cornerRoom,w.FLOOR_Y);
  assert.ok(!prepared.native.blocked && w.pathLength([prepared.native.path.at(-1),approach])<.01);
  const cornerPlan = {...treePlan,steps:[prepared,...treePlan.steps.slice(1)]};
  const off = w.prepareNativeStep(cornerPlan,cornerPlan.steps[6],w.catScreenPoint(cornerTree.seat,cornerRoom),cornerRoom,cornerTree.seat[1]);
  assert.ok(w.pathLength([off.native.path.at(-1),approach])<.01, 'Jump-down uses the selected accessible side');
  const sealed = {...cornerRoom,objects:[cornerTree,{...cornerTree,instanceId:'barrier',modelId:'sofaA',min:[-2.3,0,-2.3],max:[2.3,3,2.3]}]};
  assert.equal(w.findHangingToyApproach(sealed.home,cornerTree,sealed),undefined,'A sealed-off toy never starts a pretend play sequence');
}
const approachBarrier = { ...tree, instanceId:'approach-barrier', modelId:'sofaA',
  min:[tree.max[0]+.01,w.FLOOR_Y,tree.min[2]-.3], max:[2.2,2,tree.max[2]+.3] };
const crowdedTreeRoom = {...treeWorld,objects:[tree,approachBarrier]};
assert.ok(!w.isFree(tree.approach,crowdedTreeRoom));
assert.ok(w.findHangingToyApproach(crowdedTreeRoom.home,tree,crowdedTreeRoom),
  'Furniture blocking the default side still permits an accessible side swat');
treeContactRooms.push(crowdedTreeRoom);
const tinyTreeWorld = w.buildNativeRoomWorld({ ...treeLayout, decorations: [{ ...treeLayout.decorations[0], scale: .5 }] });
const tinyPlan = load('@/utils/room-activities').buildRoomActivity({ ...treeRoom, nativeWorld: tinyTreeWorld,
  decorations: [{ ...treeLayout.decorations[0], scale: .5 }] }, 0, 'toyPlay', 'tree');
assert.ok(!tinyPlan.steps.some(s => s.animation === 'jumpOn'), 'A platform too small for the cat keeps play on the floor');
const perchedPaws = posedTail('sit', .34, tree.seat, tree.seatHeading, treeWorld.catScale,
  ['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw']);
for (const paw of perchedPaws) {
  const x=(paw[0]-tree.position[0])/tree.scale, z=(paw[2]-tree.position[2])/tree.scale;
  const radius=.12*treeWorld.catScale/tree.scale;
  assert.ok(x-radius>=-.65 && x+radius<=.35 && z-radius>=-.46 && z+radius<=.34,
    'The seated catching pose keeps supporting paws on the perch');
}
const interrupt = load('@/utils/room-activities').buildRoomReturn(treeRoom, treePlan, 4, w.catScreenPoint(tree.seat, treeWorld));
assert.equal(interrupt.steps[0].animation, 'jumpOff', 'Cancelling a platform catch jumps down before returning home');
for (const id of ['catTreePink','catTreeBlue','catTreeTan', ...inventory.filter(e => e.id.startsWith('toy-scratchPost')).map(e => e.id)]) {
  const model = glb(id), pivot = model.nodes.find(n => n.name === 'Hanging toy pivot');
  assert.ok(pivot && pivot.children.some(i => model.nodes[i].name === 'Hanging toy string'));
  const ball = model.nodes[pivot.children.find(i => model.nodes[i].name === 'Dangling toy')];
  assert.ok(Math.abs(Math.hypot(...ball.translation) - hanging.HANGING_TOY_LENGTH) < 1e-6);
  assert.ok(!catalog[id].animated, 'The hanging toy moves on contact, without an autoplay clip');
}
const restSwing = { x: 0, z: 0, vx: 0, vz: 0, touching: false };
for (const fps of [30, 60, 120]) {
  let swing = hanging.advanceHangingToy(restSwing, 1 / fps, tree.scale);
  assert.equal(swing.x, 0); assert.equal(swing.z, 0);
  swing = hanging.advanceHangingToy(swing, 1 / fps, tree.scale, [-.7, 0, .9]);
  let peak = 0;
  for (let i = 0; i < fps * 8; i++) {
    swing = hanging.advanceHangingToy(swing, 1 / fps, tree.scale);
    assert.ok(Math.abs(Math.hypot(...hanging.hangingToyOffset(swing.x, swing.z)) - hanging.HANGING_TOY_LENGTH) < 1e-8);
    peak = Math.max(peak, Math.hypot(swing.x, swing.z));
  }
  assert.ok(peak > .2 && Math.hypot(swing.x, swing.z) < .02, 'Paw impulses swing in two axes and settle');
}
const ballPoint = [tree.position[0] + .30 * tree.scale, tree.position[1] + (1.43 - hanging.HANGING_TOY_LENGTH) * tree.scale, tree.position[2] + .12 * tree.scale];
const joints = posedTail('batToy', authored.batToy[0] / authored.batToy[1] * .34, tree.approach,
  Math.atan2(ballPoint[0]-tree.approach[0],ballPoint[2]-tree.approach[2]),treeWorld.catScale,['L.forelegjoint0','L.forelegjoint1','L.front.paw']);

assert.ok(Math.hypot(...ballPoint.map((v,i)=>v-joints[0][i])) <
  Math.hypot(...joints[1].map((v,i)=>v-joints[0][i])) + Math.hypot(...joints[2].map((v,i)=>v-joints[1][i])) + .1*tree.scale + treeWorld.radius*.12,
  'A floor swat can reach the suspended ball with the actual leg lengths');
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
const seatingSofas = load('@/constants/sofa-decorations');
for(const decorationId of seatingSofas.SOFA_DECORATION_IDS.filter(seatingSofas.isSeatingSofaDecorationId))for(const wallFlipped of [false,true])for(const itemScale of [1.8,2,2.2]) {
  const room=w.buildNativeRoomWorld({...base,petSize:96,decorations:[{...sofa,decorationId,wallFlipped,scale:itemScale,offset:{x:0,y:0}}]});
  const object=room.objects[0];
  if (['sofaA','sofaB'].includes(decorationId)) assert.equal(object.collisionBoxes.length,13,'Seats, back, arms and pillow use separate authored collision shapes');
  else assert.ok(object.collisionBoxes.length > 5, 'New sofas retain separate seat, back and arm collision shapes');
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

// Shadow bindings are exercised separately by check-native-shadows.
mocks['./use-model-shadows'] = { useModelShadows() {} };
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
let actorAsset = asset;
mocks['react-native-filament'] = { useModel: () => ({ state: 'loaded', asset: actorAsset, rootEntity: entity }), useAnimator: () => animator, useFilamentContext: () => context, RenderCallbackContext: { useRenderCallback: fn => { renderFrame = fn; } } };
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

// A paused portrait still applies its first pose when its model is replaced.
slots = []; applies = []; let pausedReady = 0;
const pausedPortrait = { playback: { kind: 'segment', segment: registry.getSegment('idle') }, active: false, onReady: () => pausedReady++ };
render(pausedPortrait); renderFrame({ timeSinceLastFrame: 1 / 60 });
assert.equal(applies.at(-1).time, 0); assert.equal(pausedReady, 1);
const posedFrames = applies.length;
renderFrame({ timeSinceLastFrame: 1 }); assert.equal(applies.length, posedFrames);
actorAsset = { ...asset }; render(pausedPortrait); renderFrame({ timeSinceLastFrame: 1 });
assert.equal(applies.length, posedFrames + 1); assert.equal(applies.at(-1).time, 0); assert.equal(pausedReady, 2);
renderFrame({ timeSinceLastFrame: 1 }); assert.equal(applies.length, posedFrames + 1);
actorAsset = asset;

// A retained native renderer must not reuse command IDs after a React refresh.
slots = []; applies = [];
const refreshedJourney = { path:[[-1,w.FLOOR_Y,0],[1,w.FLOOR_Y,0]], distance:2, duration:2, jump:false, awaitCompletion:true };
const refreshedArrivals = [];
const refreshedProps = { playback:{kind:'segment',segment:registry.getSegment('idle')},active:true,world:empty,travel:refreshedJourney,
  onRoomStepComplete: (key, point) => refreshedArrivals.push(point) };
render(refreshedProps);
const retainedCommand = slots.find(slot=>slot?.value?.value?.segments)?.value;
assert.ok(retainedCommand);
retainedCommand.value = {...retainedCommand.value,id:40};
render({...refreshedProps,activityKey:'after-refresh'});
assert.ok(retainedCommand.value.id>40,'New commands advance the retained native ID, so a new walk cannot complete from an old clock');
for(let frame=0;frame<121;frame++)renderFrame({timeSinceLastFrame:1/60});
assert.ok(Math.abs(position[0]-1)<1e-6,'The refreshed command reaches its intended endpoint');
assert.equal(refreshedArrivals.length,1);
refreshedJourney.path[1][0]=9;
assert.equal(refreshedArrivals[0][0],1,'Deferred completion retains the rendered arrival when a shared navigation path is replaced');
refreshedJourney.path[1][0]=1;

// Drawing-thread reads can lag behind consecutive React effects. A complete
// command publication must not read/merge an older shared command snapshot.
slots=[]; applies=[];
const atomicArrivals=[];
const idleProps={playback:{kind:'segment',segment:registry.getSegment('idle')},active:true,world:empty};
render(idleProps);
for(let frame=0;frame<180;frame++)renderFrame({timeSinceLastFrame:1/60});
const atomicCommand=slots.find(slot=>slot?.value?.value?.segments)?.value;
const staleCommand=atomicCommand.value;
let pendingCommand=staleCommand, writes=0;
Object.defineProperty(atomicCommand,'value',{configurable:true,get:()=>staleCommand,set:value=>{pendingCommand=value;writes++;}});
render({...idleProps,world:{...empty},active:false,activityKey:'atomic-meal',travel:refreshedJourney,
  onRoomStepComplete:(key,point)=>atomicArrivals.push(point)});
assert.equal(writes,1,'A native command publishes one complete snapshot rather than competing partial writes');
assert.equal(pendingCommand.activityKey,'atomic-meal');assert.equal(pendingCommand.travel,refreshedJourney);
assert.equal(pendingCommand.active,false);assert.ok(pendingCommand.id>staleCommand.id);
Object.defineProperty(atomicCommand,'value',{configurable:true,writable:true,value:pendingCommand});
render({...idleProps,activityKey:'atomic-meal',travel:refreshedJourney,onRoomStepComplete:(key,point)=>atomicArrivals.push(point)});
for(let frame=0;frame<60;frame++)renderFrame({timeSinceLastFrame:1/60});
assert.equal(atomicArrivals.length,0,'The new walk cannot finish using the old idle clock');
for(let frame=0;frame<61;frame++)renderFrame({timeSinceLastFrame:1/60});
assert.equal(atomicArrivals.length,1);assert.ok(Math.abs(atomicArrivals[0][0]-1)<1e-6);
console.log('Verified atomic native commands with delayed shared reads and a fresh movement clock.');

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
// Worklets Core's JsiArrayWrapper exposes indices and iteration, but no slice method.
const sharedReroutePath = new Proxy([staleReportedStart, destination], {
  get: (target, key, receiver) => key === 'slice' ? undefined : Reflect.get(target, key, receiver),
});
const reroutedProps = { ...movingProps, world: changedWorld, travel: { path: sharedReroutePath, distance: w.pathLength([staleReportedStart, destination]), duration: 2, jump: false, replanned: true } };
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
mocks['./NativeLampLight'] = { NativeLampLight: 'LampLight' };
mocks['./NativeSpotlightHead'] = { NativeSpotlightHead: 'SpotlightHead' };
mocks['./NativeLampGlow'] = { NativeLampGlow: 'LampGlow' };
mocks['./NativeContactShadows'] = { NativeContactShadows: 'ContactShadows' };
mocks['./NativeCurtain'] = { NativeCurtain: 'Curtain' };
mocks['./NativeLightning'] = { NativeLightning: 'Lightning' };
mocks['./NativeWorldLighting'] = { NativeWorldLighting: 'WorldLighting' };
mocks['./NativeWindowPane'] = { NativeWindowPane: 'WindowPane' };
mocks['./NativeWindowWeather'] = { NativeWindowWeather: 'WindowWeather' };
mocks['./NativeCatActor'] = { NativeCatActor: 'Cat' };
const startupVisualReadiness = [];
mocks['@/contexts/StartupVisualContext'] = { useStartupVisualReady(ready) { startupVisualReadiness.push(ready); } };
let sceneReduced = false;
mocks['@/hooks/use-animation-activity'] = { useAnimationActivity: () => ({ active: true, reduceMotion: sceneReduced }) };
Object.assign(mocks['react-native-filament'], { FilamentScene: 'FilamentScene', FilamentView: 'FilamentView', DefaultLight: 'Light', useWorld: () => ({}), useStaticPlaneShape() {}, useBoxShape() {}, useRigidBody() {} });
mocks['@/components/recovery/RecoveryBoundary'] = { RecoveryBoundary: 'RecoveryBoundary' };
mocks['@/components/recovery/SceneLoadGuard'] = { SceneLoadGuard: 'SceneLoadGuard' };
mocks['@/lib/graphics-mode'] = { enableSimpleGraphicsForSession() {} };
const { NativeRoomSurface: NativeRoomScene } = load('@/components/pet/native/NativeRoomScene');
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
context.camera = { setProjection(...args) { assert.equal(args.length,5); assert.equal(args[4],'vertical'); }, lookAt() {} };
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
const cachedProps = { ...sceneMeal, paused: true, catPresent: false, onSceneReady,
  worldClock: { worldMs: 23 * 3_600_000, realMs: Date.now(), speed: 60 } };
let cached = renderCachedScene(cachedProps);
assert.equal(cached.find(child => child.type === 'WorldLighting').props.active, true, 'Night lighting runs during hidden scene warmup');
assert.ok(cached.filter(child => child.type.name === 'RoomObject').every(child => child.props.lightingActive), 'Window materials initialize before scene readiness');
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
cached = renderCachedScene({ ...cachedProps, transitioning: true });
assert.equal(sceneClock.at(-1), 'start', 'A cached destination draws during the slide');
assert.equal(cached.find(child => child.type === 'WorldLighting').props.active, true, 'Night lighting stays active throughout room travel');
assert.equal(cached.find(child => child.type === 'Cat'), undefined);
assert.ok(cached.filter(child => child.type.name === 'RoomObject').every(child => !child.props.active), 'Furniture motion remains paused during room travel');
cached = renderCachedScene(cachedProps);
assert.equal(cached.find(child => child.type === 'WorldLighting').props.active, false, 'Settled hidden rooms pause their lighting');
assert.equal(sceneClock.at(-1), 'stop');
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

sceneReduced = false;
let editorPhysicsSteps = 0;
mocks['react-native-filament'].useWorld = () => ({ stepSimulation() { editorPhysicsSteps++; } });
cached = renderCachedScene({ ...cachedProps, paused: false, editing: true });
paintFrame();
assert.equal(editorPhysicsSteps, 0, 'Physics cannot push a manually dragged ball away while decorating');
assert.equal(cached.find(child => child.type.name === 'RoomObject').props.active, false, 'Physics reports cannot overwrite editor placement');
renderCachedScene({ ...cachedProps, paused: false, editing: false }); paintFrame();
assert.equal(editorPhysicsSteps, 1, 'Normal ball physics resumes after decorating');

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

// Execute the cat render worklet against real exported animation matrices.
function nativeMatrix(data=matrix()) {
  return { data, translation: data.slice(12,15),
    scaling: s => nativeMatrix(multiply(matrix([0,0,0],[0,0,0,1],s),data)),
    translate: t => nativeMatrix(multiply(matrix(t),data)),
    rotate(angle,axis) { const sine=Math.sin(angle/2);return nativeMatrix(multiply(matrix([0,0,0],[...axis.map(v=>v*sine),Math.cos(angle/2)]),data)); } };
}
let liveLocals, catRoot;
const parentNames = new Map([...parents].map(([child,parent]) => [skeleton.nodes[child].name,skeleton.nodes[parent].name]));
function jointWorld(name) {
  const parent=parentNames.get(name);
  return multiply(parent ? jointWorld(parent) : catRoot,liveLocals.get(name));
}
Object.assign(transformManager, {
  createIdentityMatrix: () => nativeMatrix(),
  getTransform: e => nativeMatrix(liveLocals.get(e.name)),
  getWorldTransform: e => nativeMatrix(jointWorld(e.name)),
  setTransform(e,m) { if(e.name)liveLocals.set(e.name,m.data);else catRoot=m.data; },
});
asset.getFirstEntityByName = name => liveLocals.has(name) ? {name} : undefined;
animator.applyAnimation = (index,time) => { liveLocals=posedTail(animations[index].name,time,[0,0,0],0,1,[],true); };
animator.applyCrossFade = () => {};
// A rug adds a support plane, not a navigation wall. Exercise the real actor
// and the exported skin vertices while crossing its edge and standing on it.
const groundSupport = load('@/utils/native-ground-support');
function skinAccessor(index) {
  const a = skeleton.accessors[index], view = skeleton.bufferViews[a.bufferView];
  const width = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const [bytes, read] = { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5126: [4, 'readFloatLE'] }[a.componentType];
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, k) =>
    catBinary[read]((view.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (view.byteStride ?? width * bytes) + k * bytes)));
}
const skinNode = skeleton.nodes.find(n => n.name === 'Game cat skin');
const skinPrimitive = skeleton.meshes[skinNode.mesh].primitives[0], catSkin = skeleton.skins[skinNode.skin];
const skinPositions = skinAccessor(skinPrimitive.attributes.POSITION);
const skinJoints = skinAccessor(skinPrimitive.attributes.JOINTS_0);
const skinWeights = skinAccessor(skinPrimitive.attributes.WEIGHTS_0);
const inverseBinds = skinAccessor(catSkin.inverseBindMatrices);
const pawJointIds = catSkin.joints.flatMap((node, index) => /\.(front|rear)\.paw$/.test(skeleton.nodes[node].name) ? [index] : []);
const pawVertices = skinPositions.flatMap((point, i) => skinWeights[i].some((weight, k) => weight > .5 && pawJointIds.includes(skinJoints[i][k])) ? [i] : []);
assert.ok(pawVertices.length > 40, 'Support checks cover the actual toe-pad mesh');
function transformedPawVertices() {
  const matrices = catSkin.joints.map((node, i) => multiply(jointWorld(skeleton.nodes[node].name), inverseBinds[i]));
  return pawVertices.map(i => [0, 1, 2].map(axis => skinWeights[i].reduce((sum, weight, k) => {
    const m = matrices[skinJoints[i][k]], p = skinPositions[i];
    return sum + weight * (m[axis] * p[0] + m[4 + axis] * p[1] + m[8 + axis] * p[2] + m[12 + axis]);
  }, 0)));
}
function onRug(point, surface) {
  const dx = point[0] - surface.position[0], dz = point[2] - surface.position[2];
  const x = dx * surface.cos - dz * surface.sin - surface.centerX;
  const z = dx * surface.sin + dz * surface.cos - surface.centerZ;
  return surface.round ? Math.hypot(x / surface.halfX, z / surface.halfZ) <= .99
    : Math.abs(x) < surface.halfX - .002 && Math.abs(z) < surface.halfZ - .002;
}
for (const [modelId, itemScale, angle, fps] of [
  ['carpetRound', 1, 0, 30], ['carpetRound', 1, 0, 60], ['carpetRound', 1, 0, 120],
  ['rugGeometricTeal', 1.3, 37, 60], ['rugStripedRunner', .7, 90, 60],
]) {
  const room = w.buildNativeRoomWorld({ ...base, petSize: 80, decorations: [{ decorationId: modelId, instanceId: 'rug', offset: { x: 0, y: 0 }, scale: itemScale, rotationDegrees: angle }] });
  const rug = room.objects[0], surface = groundSupport.buildRugSurfaces(room)[0];
  assert.equal(rug.solid, false); assert.equal(rug.collidable, false);
  const reach = Math.hypot(surface.halfX, surface.halfZ) + 1.5 * room.catScale;
  const start = [rug.position[0] - reach, w.FLOOR_Y, rug.position[2]], end = [rug.position[0] + reach, w.FLOOR_Y, rug.position[2]];
  const route = w.findRoomPath(start, end, room);
  assert.equal(route.length, 2, 'A rug can be crossed directly');
  slots = []; catRoot = matrix(); liveLocals = posedTail('idle', 0, [0, 0, 0], 0, 1, [], true);
  const completions = [], reportedHeights = [], renderedPosition = { value: start };
  render({ playback: { kind: 'segment', segment: registry.getSegment('idle') }, active: true, world: room, activityKey: 'rug:walk',
    positionValue: renderedPosition, onRoomStepComplete: (key, point) => completions.push(point),
    onContactPosition: point => reportedHeights.push(point[1]),
    travel: { path: route, distance: w.pathLength(route), duration: 4, jump: false, awaitCompletion: true } });
  let contacts = 0, highest = w.FLOOR_Y, lastHeight = w.FLOOR_Y;
  for (let frame = 0; frame < fps * 4 + 1; frame++) {
    renderFrame({ timeSinceLastFrame: 1 / fps });
    highest = Math.max(highest, catRoot[13]);
    if (frame > 0) assert.ok(Math.abs(catRoot[13] - lastHeight) < .04, `${modelId}/${fps}/${frame}: stepping over the edge cannot snap the whole cat vertically (${lastHeight} -> ${catRoot[13]})`);
    lastHeight = catRoot[13];
    if (frame % Math.max(1, fps / 30) !== 0) continue;
    for (const point of transformedPawVertices()) if (onRug(point, surface)) {
      contacts++;
      assert.ok(point[1] >= surface.height - .003, `${modelId}/${fps}: a toe pad cannot sink into the rug (${point[1]} < ${surface.height})`);
    }
  }
  assert.ok(contacts > 100 && highest >= surface.height, 'The walk really crosses the raised rug surface');
  assert.equal(completions.length, 1, 'Rug support cannot prevent arrival completion');
  assert.ok(w.pathLength([completions[0], route.at(-1)]) < 1e-6);
  assert.ok(reportedHeights.every(y => y === w.FLOOR_Y), 'Rendering support never feeds back into route planning');
  assert.ok(Math.abs(catRoot[13] - w.FLOOR_Y) < 1e-6, 'The paws return to floor height after leaving the rug');
  for (const reduced of [false, true]) for (const clip of ['idle', 'sit', 'layDown', 'sleep']) {
    slots = []; liveLocals = posedTail('idle', 0, [0, 0, 0], 0, 1, [], true);
    const center = [rug.position[0], w.FLOOR_Y, rug.position[2]];
    render({ playback: { kind: 'segment', segment: load('@/pet-display/registry/cat-model-registry').createRoomActivitySegment(clip) }, active: true, reduceMotion: reduced,
      world: { ...room, home: center } });
    const frames = Math.ceil(authored[clip][0] / authored[clip][1] * 60);
    for (let frame = 0; frame < frames; frame++) {
      renderFrame({ timeSinceLastFrame: 1 / 60 });
      if (frame % 15 !== 0) continue;
      const minimum = Math.min(...transformedPawVertices().filter(point => onRug(point, surface)).map(point => point[1]));
      assert.ok(minimum >= surface.height - .003, `${modelId}/${clip}/${frame}: resting and Reduce Motion retain toe-pad clearance ${JSON.stringify({minimum,height:surface.height,root:catRoot[13],paws:pawJointIds.map(i=>jointWorld(skeleton.nodes[catSkin.joints[i]].name))})}`);
    }
  }
  const airborne = [rug.position[0], surface.height + .3, rug.position[2]];
  assert.equal(groundSupport.rugSupportLift(airborne, [airborne], [surface], room.catScale), 0, 'Airborne and perched cats keep their authored height');
}
const roundSurface = groundSupport.buildRugSurfaces(w.buildNativeRoomWorld({ ...base, decorations: [{ decorationId: 'carpetRound', instanceId: 'round', offset: { x: 0, y: 0 } }] }))[0];
const cornerPoint = [roundSurface.position[0] + roundSurface.halfX, w.FLOOR_Y, roundSurface.position[2] + roundSurface.halfZ];
assert.equal(groundSupport.rugSupportLift(cornerPoint, [cornerPoint], [roundSurface], .1), 0, 'Empty corners of a round rug bounding box cannot lift the cat');
console.log('Verified real animated toe pads on round, rotated and resized rugs, edge transitions, floor return, arrival, standing and Reduce Motion.');
// Run the actual object and cat callbacks in their scene order with shipped GLBs.
sceneReduced = false;
let toyRoot, toyLocals, toyNodes, toyParents;
const toyEntity = { toy: true, name: '__root' };
const toyAsset = { getRenderableEntities: () => [{ id: 5000 }], getFirstEntityByName: name => toyNodes.has(name) ? { toy: true, name } : undefined };
function toyWorldMatrix(name) {
  const parent = toyParents.get(name);
  return multiply(parent ? toyWorldMatrix(parent) : toyRoot, toyLocals.get(name));
}
const catGetLocal = transformManager.getTransform, catGetWorld = transformManager.getWorldTransform, catSet = transformManager.setTransform;
Object.assign(transformManager, {
  getTransform: e => e.toy ? nativeMatrix(e.name === '__root' ? toyRoot : toyLocals.get(e.name)) : catGetLocal(e),
  getWorldTransform: e => e.toy ? nativeMatrix(e.name === '__root' ? toyRoot : toyWorldMatrix(e.name)) : catGetWorld(e),
  setTransform(e, m) { if (!e.toy) catSet(e, m); else if (e.name === '__root') toyRoot = m.data; else toyLocals.set(e.name, m.data); },
});
Object.assign(mocks['react-native-filament'], {
  useModel: () => ({ state: 'loaded', asset: toyAsset, rootEntity: toyEntity }),
  useAnimator: () => ({ getAnimationCount: () => 0 }),
  useFilamentContext: () => context,
  useSphereShape() {}, useWorkletEffect: fn => fn(),
});
// The shipped clock's hands rotate around the dial, rather than the mesh origin.
{
  const clockWorld = w.buildNativeRoomWorld({ ...base, decorations: [{ decorationId: 'officeClockAni', instanceId: 'clock', offset: { x: 0, y: 0 } }] });
  const model = glb('officeClockAni');
  toyRoot = matrix(); toyNodes = new Map(model.nodes.map(n => [n.name, n]));
  toyLocals = new Map(model.nodes.map(n => [n.name, n.matrix ?? matrix(n.translation, n.rotation, n.scale)]));
  toyParents = new Map(model.nodes.flatMap(n => (n.children ?? []).map(i => [model.nodes[i].name, n.name])));
  const worldClock = { worldMs: 3 * 3_600_000, realMs: Date.now() + 1_000_000, speed: 60 };
  const clockScene = sceneChildren({ world: clockWorld, catPresent: false, worldClock });
  assert.equal(clockScene.find(c => c.type === 'WorldLighting').props.clock, worldClock);
  assert.equal(clockScene.find(c => c.type === 'WorldLighting').props.objects, clockWorld.objects, 'Room lighting receives the actual placed windows');
  const child = clockScene.find(c => c.type.name === 'RoomObject');
  assert.equal(child.props.worldClock, worldClock);
  const lightning = clockScene.find(c => c.type === 'Lightning');
  assert.equal(lightning.props.flash, clockScene.find(c => c.type === 'WorldLighting').props.lightning);
  assert.equal(child.props.lightning, lightning.props.flash, 'Lighting and all room-object materials share one storm pulse');
  assert.equal(lightning.props.active, false, 'Rooms without windows do not advance a storm clock');
  slots = []; cursor = 0; effects = [];
  child.type(child.props); effects.forEach(fn => fn());
  renderFrame({ timeSinceLastFrame: 1 / 60 });
  for (const [name, tip, axis] of [['Hour hand', [.12, .83, .08], 0], ['Minute hand', [-.32, .65, .085], 1]]) {
    assert.ok(toyNodes.has(name));
    const m = toyLocals.get(name);
    const transform = p => [0, 1, 2].map(i => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
    const center = transform([0, .6, tip[2]]), endpoint = transform(tip);
    assert.ok(Math.hypot(center[0], center[1] - .6, center[2] - tip[2]) < 1e-6, 'Each hand stays attached to the dial center');
    const delta = endpoint.map((v, i) => v - center[i]);
    assert.ok(delta[axis] > .2 && Math.abs(delta[1 - axis]) < 1e-6, 'At 03:00 the hour hand points right and the minute hand points up');
  }
  console.log('Verified native scene clock wiring and actual shipped wall-clock hand transforms at 03:00.');
}
assert.equal(hanging.hangingToyContact([0,0,0], [[.2,0,0]], .1, {ball:[0,0,0], paws:[[-.2,0,0]]}), 0, 'A fast paw crossing the ball between frames makes contact');
assert.equal(hanging.hangingToyContact([0,0,0], [[2,0,0]], .1, {ball:[0,0,0], paws:[[-2,0,0]]}), -1, 'Repositioning does not create a distant hit');
const largeTreeWorld = w.buildNativeRoomWorld({...treeLayout, decorations:[{...treeLayout.decorations[0], scale:1.6}]});
const scratchPostContactRooms = [];
for (const rotationIndex of [1,2,3]) {
  const rotatedRoom = w.buildNativeRoomWorld({...treeLayout, decorations:[], toys:[{
    toyId:'scratchPostGreen', instanceId:'post', offset:{x:0,y:.1}, rotationIndex,
  }]});
  const post = rotatedRoom.objects[0];
  assert.equal(post.heading, rotationIndex * Math.PI / 2, 'Saved quarter turns rotate the native model');
  const [cx,cy,cz] = catalog[post.modelId].center;
  const c = Math.cos(post.heading), s = Math.sin(post.heading);
  const center = [cx*c+cz*s,cy,cz*c-cx*s].map((v,i) => post.position[i] + v*post.scale);
  const anchor = w.projectWorld(center, rotatedRoom.width);
  const size = 96 * treeLayout.sizeScale;
  assert.ok(Math.abs(anchor.x) < 1e-6 && Math.abs(anchor.y - .1*(rotatedRoom.height-size)/2) < 1e-6,
    'Rotation preserves the saved screen placement');
  scratchPostContactRooms.push(rotatedRoom);
}
for (const toyId of ['scratchPostGreen','scratchPostBlue','scratchPostPurple','scratchPostRed']) {
  const room = w.buildNativeRoomWorld({...treeLayout,decorations:[],toys:[{toyId,instanceId:'post',offset:{x:0,y:.1}}]});
  for(const home of [[-1.5,w.FLOOR_Y,-1.5],[-1.5,w.FLOOR_Y,1.5],[1.5,w.FLOOR_Y,-1.5],[1.5,w.FLOOR_Y,1.5]])
    scratchPostContactRooms.push({...room,home});
}
for (const contactRoom of [...treeContactRooms, largeTreeWorld,...scratchPostContactRooms]) for (const fps of [30,60,120]) {
  slots=[];catRoot=matrix();liveLocals=posedTail('idle',0,[0,0,0],0,1,[],true);
  const currentTree=contactRoom.objects[0], model=glb(currentTree.modelId);
  toyRoot=matrix();toyNodes=new Map(model.nodes.map(n=>[n.name,n]));
  toyLocals=new Map(model.nodes.map(n=>[n.name,n.matrix??matrix(n.translation,n.rotation,n.scale)]));
  toyParents=new Map(model.nodes.flatMap(n=>(n.children??[]).map(i=>[model.nodes[i].name,n.name])));
  const approach=w.findHangingToyApproach(contactRoom.home,currentTree,contactRoom);
  assert.ok(approach, 'A reachable floor play point exists');
  const ball={value:hanging.hangingToyPosition(currentTree)}, paws={value:[]};
  const currentPlan={...prefixedTreePlan,targetInstanceId:currentTree.instanceId};
  const walk=w.prepareNativeStep(currentPlan,currentPlan.steps[1],w.catScreenPoint(contactRoom.home,contactRoom),contactRoom,w.FLOOR_Y);
  assert.ok(!walk.native.blocked && w.pathLength([walk.native.path.at(-1),approach])<.01,
    'A toy command after another activity walks to the reachable ball side from every starting corner');
  const treeBat=w.prepareNativeStep(currentPlan,currentPlan.steps[2],w.catScreenPoint(walk.native.path.at(-1),contactRoom),contactRoom,w.FLOOR_Y);
  render({ playback:{kind:'segment',segment:{assetKey:'batToy',loop:true}}, loop:true, active:true,
    world:contactRoom,travel:treeBat.native,hangingBall:ball,pawPositions:paws,initialPosition:approach });
  const catFrame=renderFrame;
  const child = sceneChildren({ world:contactRoom, catPresent:true, playingId:currentTree.instanceId }).find(c=>c.type.name==='RoomObject');
  slots=[];cursor=0;effects=[];
  // Physical touch must work even without the activity's playContact flag.
  child.type({...child.props, hangingBall:ball, pawPositions:paws, playContact:false});effects.forEach(fn=>fn());
  const objectFrame=renderFrame;
  let minDistance=Infinity, peak=0;
  for(let frame=0;frame<fps*4;frame++) {
    objectFrame({timeSinceLastFrame:1/fps});catFrame({timeSinceLastFrame:1/fps});
    const actual=toyWorldMatrix('Dangling toy').slice(12,15);
    assert.ok(Math.hypot(...actual.map((v,k)=>v-ball.value[k]))<.08, 'The rendered ball follows its published contact position');
    for(const paw of paws.value) minDistance=Math.min(minDistance,Math.hypot(...paw.map((v,k)=>v-actual[k])));
    const rest=hanging.hangingToyPosition(currentTree);
    peak=Math.max(peak,Math.hypot(...actual.map((v,k)=>v-rest[k]))/currentTree.scale);
    assert.ok(Math.abs(actual[0])+.1*currentTree.scale<=2.35+1e-6 && Math.abs(actual[2])+.1*currentTree.scale<=2.35+1e-6,'Corner swings rebound inside the room walls');
    const anchor=toyWorldMatrix('Hanging toy pivot').slice(12,15);
    assert.ok(Math.abs(Math.hypot(...actual.map((v,k)=>v-anchor[k]))-hanging.HANGING_TOY_LENGTH*currentTree.scale)<1e-6, 'The rendered string stays attached at its fixed length');
  }
  assert.ok(peak>.1, `The actual object callback must react to paw touch at ${fps} FPS; nearest paw ${minDistance}, scale ${currentTree.scale}`);
}
console.log('Verified actual cat and toy render callbacks, fast swats, longer cords and contact without an activity flag in open space, larger toys and all corners at 30/60/120 FPS.');

// Plant contact uses the same exported rig and the actual per-instance leaf callbacks.
const nativeEmptyPaws = new Proxy([], { get(array, key) {
  if (/^\d+$/.test(String(key)) && Number(key) >= array.length) throw new Error('Native shared array read beyond length');
  return Reflect.get(array, key);
} });
assert.equal(hanging.hangingToyContact([0,0,0], [[0,0,0]], .2, {ball:[0,0,0], paws:nativeEmptyPaws}), 0,
  'First paw contact safely handles an empty previous native shared array');
const plantPhysics = load('@/utils/native-plant-play');
for (const fps of [30,60,120]) {
  let leaf=plantPhysics.detachPlantLeaf([2.27,1,0],[2,1,0],0);
  const original=JSON.stringify(leaf);
  leaf=plantPhysics.advancePlantLeaf(leaf,1/fps,w.FLOOR_Y+.05);
  assert.notEqual(JSON.stringify(leaf),original);
  let halfway;
  for(let frame=1;frame<fps*27;frame++) {
    leaf=plantPhysics.advancePlantLeaf(leaf,1/fps,w.FLOOR_Y+.05);
    if (leaf.age >= 0) assert.ok(leaf.position[1]>=w.FLOOR_Y+.05 && Math.abs(leaf.position[0])<=2.28, 'Falling leaves stay above the floor and inside room walls');
    if(frame===fps*16)halfway=leaf;
  }
  assert.ok(halfway.scale>.4 && halfway.scale<.6,'Leaves grow slowly over twenty seconds');
  assert.equal(leaf.age,-1,'Leaves return to a complete attached state');
}
const plantLayout={...treeLayout,decorations:[{decorationId:'plantPotted',instanceId:'plant',offset:{x:-.2,y:.1},scale:1.4}]};
const plantWorld=w.buildNativeRoomWorld(plantLayout), plantObject=plantWorld.objects[0];
for(const start of [[0,w.FLOOR_Y,0],[-1.5,w.FLOOR_Y,-1.5],[1.5,w.FLOOR_Y,1.5]]) {
  const plantApproach=w.findPlantApproach(start,plantObject,plantWorld);
  assert.ok(plantApproach);
  assert.ok(Math.min(...plantObject.leaves.map(point=>Math.hypot(point[0]-plantApproach[0],point[2]-plantApproach[2]))) <= .9*plantWorld.catScale+.20*plantObject.scale+1e-6,
    'Different starting positions select a close plant approach instead of the distant edge of paw reach');
  const toyApproach=w.findHangingToyApproach(start,tree,treeWorld), point=hanging.hangingToyPosition(tree);
  assert.ok(toyApproach && Math.hypot(point[0]-toyApproach[0],point[2]-toyApproach[2]) <= .9*treeWorld.catScale+.1*tree.scale+1e-6,
    'Different starting positions select a close hanging-toy approach');
}

const plantRooms=[plantWorld];
for(const x of [-1,1]) for(const z of [-1,1]) {
  const shift=[x*(2.25-.64*plantObject.scale)-plantObject.position[0],0,z*(2.25-.64*plantObject.scale)-plantObject.position[2]];
  const move=p=>p.map((v,i)=>v+shift[i]);
  const object={...plantObject,position:move(plantObject.position),min:move(plantObject.min),max:move(plantObject.max),
    leaves:plantObject.leaves.map(move),collisionBoxes:plantObject.collisionBoxes.map(b=>({min:move(b.min),max:move(b.max)}))};
  plantRooms.push({...plantWorld,home:[0,w.FLOOR_Y,0],objects:[object]});
}
for(const contactRoom of plantRooms) for(const fps of [30,60,120]) {
  const plant=contactRoom.objects[0], model=glb(plant.modelId), meta=catalog[plant.modelId];
  assert.ok(meta.leaves.length>=5 && model.nodes.some(n=>n.name==='Leaf blade 1'));
  for(const material of model.materials.filter(m=>m.name.startsWith('Deep leaf green'))) {
    const rgb=material.pbrMetallicRoughness.baseColorFactor;
    assert.ok(rgb[1]>rgb[0] && rgb[1]<.2,'The shipped leaf material is a dark green');
  }
  const approach=w.findPlantApproach(contactRoom.home,plant,contactRoom);
  assert.ok(approach,`A leaf is reachable even when the plant is in a corner; plant ${plant.position}, scale ${plant.scale}, cat ${contactRoom.catScale}, leaves ${JSON.stringify(plant.leaves)}`);
  const options={...plantLayout,nativeWorld:contactRoom,homeOffset:{x:0,y:.12},ownedToyIds:[],hungry:true,asleep:false};
  const plan=buildRoomActivity(options,0,'plantPlay','plant');
  assert.ok(plan && plan.steps.filter(s=>s.animation==='batToy').length===3,'A direct plant menu command creates pawing steps, including low hunger');
  const walk=w.prepareNativeStep(plan,plan.steps[0],w.catScreenPoint(contactRoom.home,contactRoom),contactRoom,w.FLOOR_Y);
  assert.ok(!walk.native.blocked && w.pathLength([walk.native.path.at(-1),approach])<.01);
  const blockedRoom={...contactRoom,objects:[plant,{...obstacle,instanceId:'closed',modelId:'sofaA',min:[-2.3,0,-2.3],max:[2.3,3,2.3]}]};
  assert.equal(w.findPlantApproach(contactRoom.home,plant,blockedRoom),undefined,'A blocked plant cannot be played with through furniture');
  slots=[];catRoot=matrix();liveLocals=posedTail('idle',0,[0,0,0],0,1,[],true);
  toyRoot=matrix();toyNodes=new Map(model.nodes.map(n=>[n.name,n]));
  toyLocals=new Map(model.nodes.map(n=>[n.name,n.matrix??matrix(n.translation,n.rotation,n.scale)]));
  toyParents=new Map(model.nodes.flatMap(n=>(n.children??[]).map(i=>[model.nodes[i].name,n.name])));
  const target={value:undefined},paws={value:[]},catPosition={value:approach};
  const bat=w.prepareNativeStep(plan,plan.steps[1],w.catScreenPoint(approach,contactRoom),contactRoom,w.FLOOR_Y);
  render({playback:{kind:'segment',segment:{assetKey:'batToy',loop:true}},active:true,world:contactRoom,travel:bat.native,
    plantLeaf:target,pawPositions:paws,positionValue:catPosition,initialPosition:approach});
  const catFrame=renderFrame;
  const child=sceneChildren({world:contactRoom,catPresent:true,playingId:'plant'}).find(c=>c.type.name==='RoomObject');
  const props={...child.props,plantLeaf:target,pawPositions:paws,catPosition,playContact:true,airflow:[]};
  slots=[];cursor=0;effects=[];child.type({...props,onReady:undefined});effects.forEach(fn=>fn());
  let objectFrame=renderFrame;
  objectFrame({timeSinceLastFrame:0});
  const originalLeaves=meta.leaves.map(l=>toyWorldMatrix(l.node));
  let fallen=0;
  for(let frame=0;frame<fps*6;frame++) {
    objectFrame({timeSinceLastFrame:1/fps});catFrame({timeSinceLastFrame:1/fps});
    fallen=Math.max(fallen,meta.leaves.filter((l,i)=>toyWorldMatrix(l.node)[13]<originalLeaves[i][13]-.04).length);
  }
  assert.ok(fallen>0,`Actual paw touch must knock a leaf off at ${fps} FPS`);
  const beforePause=meta.leaves.map(l=>toyWorldMatrix(l.node));
  cursor=0;effects=[];child.type({...props,onReady:undefined,active:false});effects.forEach(fn=>fn());
  for(let frame=0;frame<fps;frame++)renderFrame({timeSinceLastFrame:1/fps});
  assert.deepEqual(meta.leaves.map(l=>toyWorldMatrix(l.node)),beforePause,'Paused room clocks freeze falling leaves and regrowth');
  cursor=0;effects=[];child.type({...props,onReady:undefined});effects.forEach(fn=>fn());objectFrame=renderFrame;
  paws.value=[];
  for(let frame=0;frame<fps*28;frame++)objectFrame({timeSinceLastFrame:1/fps});
  for(let i=0;i<meta.leaves.length;i++) assert.ok(toyWorldMatrix(meta.leaves[i].node).every((v,k)=>Math.abs(v-originalLeaves[i][k])<1e-6),'Each detached leaf regrows at its exact original attachment');
}
console.log('Verified real plant menu plans, paw contact, falling leaves, pause/resume, independent slow regrowth, dark materials, and open/corner navigation at 30/60/120 FPS.');

// Airflow follows the actual AC outlet, including the other wall and resizing.
const air = load('@/utils/native-airflow');
for (const decorationId of ['livingAirCon','officeAc']) for (const wallFlipped of [false,true]) for (const scale of [.7,1,1.6]) {
  const room=w.buildNativeRoomWorld({...base,decorations:[{decorationId,instanceId:'ac',wallFlipped,scale,poweredOn:true,offset:{x:.15,y:-.6}}]});
  const ac=room.objects[0], sources=air.roomAirflowSources(room.objects), source=sources[0];
  const point=(across,forward,drop)=>[source.position[0]+across*Math.cos(ac.heading)+forward*Math.sin(ac.heading),
    source.position[1]-drop,source.position[2]-across*Math.sin(ac.heading)+forward*Math.cos(ac.heading)];
  assert.ok(air.airflowStrength(point(0,.35,1),sources)>.5,'A leaf in front and below either AC outlet receives a visible draft');
  for(const p of [point(3,.35,1),point(0,-1,1),point(0,.35,-.1),point(0,.35,4)])
    assert.equal(air.airflowStrength(p,sources),0,'Leaves outside the stream, behind or above the AC remain still');
  assert.equal(air.roomAirflowSources([{...ac,poweredOn:false}]).length,0,'Switching off an AC removes its airflow');
  assert.equal(air.roomAirflowSources([{...ac,poweredOn:undefined}]).length,0,'An AC that has never been switched on produces no airflow');
  assert.equal(air.roomAirflowSources([ac,{...ac,instanceId:'off',poweredOn:false}]).length,1,'Each AC has independent power');
}
// Reproduce the plant and AC placement in the reported room. Check actual leaf
// tip movement through the render worklet, rather than just an animation flag.
const draftRoom=w.buildNativeRoomWorld({...base,width:351,height:456,petSize:80,sizeScale:1.15,decorations:[
  {decorationId:'livingAirCon',instanceId:'ac',offset:{x:.1215852969,y:-.6446808017},poweredOn:true},
  {decorationId:'plantB',instanceId:'plant',offset:{x:.0163736957,y:-.3914404433},scale:2.2},
]});
const draftPlant=draftRoom.objects[1], draftModel=glb(draftPlant.modelId), draftMeta=catalog[draftPlant.modelId];
assert.ok(draftPlant.leaves.every(point=>air.airflowStrength(point,air.roomAirflowSources(draftRoom.objects))>.1),
  'The leaves shown beneath the AC in the reported placement receive airflow');
for(const fps of [30,60,120]) {
  toyRoot=matrix();toyNodes=new Map(draftModel.nodes.map(n=>[n.name,n]));
  toyLocals=new Map(draftModel.nodes.map(n=>[n.name,n.matrix??matrix(n.translation,n.rotation,n.scale)]));
  toyParents=new Map(draftModel.nodes.flatMap(n=>(n.children??[]).map(i=>[draftModel.nodes[i].name,n.name])));
  const child=sceneChildren({world:draftRoom,catPresent:false}).find(c=>c.type.name==='RoomObject'&&c.props.object.instanceId==='plant');
  slots=[];
  const paint=patch=>{cursor=0;effects=[];child.type({...child.props,...patch,onReady:undefined});effects.forEach(fn=>fn());return renderFrame;};
  let frame=paint({airflow:[]});frame({timeSinceLastFrame:0});
  const rest=draftMeta.leaves.map(leaf=>toyWorldMatrix(leaf.node));
  const tips=draftMeta.leaves.map(leaf=>toyWorldMatrix(leaf.contact).slice(12,15));
  const root=toyRoot.slice();
  frame=paint({});
  let peak=0;
  let previousTips=tips;
  const low=tips.map(()=>Infinity), high=tips.map(()=>-Infinity);
  for(let i=0;i<fps*8;i++) {
    frame({timeSinceLastFrame:1/fps});
    const currentTips=[];
    for(let k=0;k<draftMeta.leaves.length;k++) {
      const tip=toyWorldMatrix(draftMeta.leaves[k].contact).slice(12,15);
      currentTips.push(tip);
      if(i>=fps) {low[k]=Math.min(low[k],tip[1]);high[k]=Math.max(high[k],tip[1]);}
      peak=Math.max(peak,Math.hypot(...tip.map((v,j)=>v-tips[k][j])));
      assert.ok(tip[1]<=tips[k][1]+.005,'The downward draft presses leaves down instead of flapping them up and down');
      assert.ok(Math.hypot(...tip.map((v,j)=>v-previousTips[k][j]))<.30/fps,
        `Damped leaf motion stays smooth between frames: ${fps} FPS, frame ${i}, leaf ${k}`);
      assert.ok(toyWorldMatrix(draftMeta.leaves[k].node).slice(12,15).every((v,j)=>Math.abs(v-rest[k][12+j])<1e-6),
        'Fluttering leaves stay attached to their stems');
    }
    previousTips=currentTips;
  }
  assert.ok(peak>.025,`The actual rendered leaf tips visibly bend with the draft at ${fps} FPS`);
  assert.ok(Math.max(...high.map((value,k)=>value-low[k]))>.035,
    `The slow gust produces visible ongoing motion after the initial bend: ${fps} FPS, ${Math.max(...high.map((value,k)=>value-low[k]))}`);
  assert.deepEqual(toyRoot,root,'Airflow leaves the pot and plant root fixed');
  const beforePause=draftMeta.leaves.map(leaf=>toyWorldMatrix(leaf.node));
  frame=paint({active:false});for(let i=0;i<fps;i++)frame({timeSinceLastFrame:1/fps});
  assert.deepEqual(draftMeta.leaves.map(leaf=>toyWorldMatrix(leaf.node)),beforePause,'Hidden or paused rooms freeze the leaf motion');
  const off=air.roomAirflowSources(draftRoom.objects.map(o=>({...o,poweredOn:false})));
  frame=paint({airflow:off});
  frame({timeSinceLastFrame:1/fps});
  assert.ok(draftMeta.leaves.some((leaf,k)=>toyWorldMatrix(leaf.node).some((v,j)=>Math.abs(v-rest[k][j])>1e-4)),
    'Leaves ease back instead of snapping immediately when the AC turns off');
  for(let i=0;i<fps*3;i++)frame({timeSinceLastFrame:1/fps});
  for(let k=0;k<rest.length;k++) assert.ok(toyWorldMatrix(draftMeta.leaves[k].node).every((v,j)=>Math.abs(v-rest[k][j])<1e-6),
    'Switching the AC off returns the leaves to their resting pose');
  frame=paint({airflow:child.props.airflow.map(source=>({...source,position:[source.position[0]+3,...source.position.slice(1)]}))});
  for(let i=0;i<fps;i++)frame({timeSinceLastFrame:1/fps});
  for(let k=0;k<rest.length;k++) assert.ok(toyWorldMatrix(draftMeta.leaves[k].node).every((v,j)=>Math.abs(v-rest[k][j])<1e-6),
    'Moving the AC away stops the plant reacting');
}
sceneReduced=true;
assert.equal(sceneChildren({world:draftRoom,catPresent:false}).find(c=>c.type.name==='RoomObject').props.active,false,
  'Reduce Motion disables airflow response in the actual scene');
sceneReduced=false;
console.log('Verified visible leaf-tip sway, fixed stem attachments, scaled/rotated AC airflow, power-off, distance, pause and Reduce Motion at 30/60/120 FPS.');

// Execute the ball's render callback at the floor edge and after play finishes.
sceneReduced = false;
for (const fps of [30, 60, 120]) {
  const ballLayout = { ...base, toys: [{ toyId: 'blueBall', instanceId: 'loose-ball', offset: { x: 0, y: .3 }, scale: 1.2 }] };
  const ballWorld = w.buildNativeRoomWorld(ballLayout), ballObject = ballWorld.objects[0];
  const radius = Math.max((ballObject.max[0] - ballObject.min[0]) / 2, (ballObject.max[2] - ballObject.min[2]) / 2);
  const positions = [], reports = [];
  const body = { position: [0, w.FLOOR_Y + radius, 0],
    setPosition(...p) { this.position = p; positions.push(p); },
    setKinematic() {}, applyCentralImpulse() {} };
  mocks['react-native-filament'].useRigidBody = () => body;
  toyRoot = matrix(); toyNodes = new Map();
  transformManager.updateTransformByRigidBody = () => { toyRoot = matrix(body.position); };
  const child = sceneChildren({ world: ballWorld, catPresent: false }).find(c => c.type.name === 'RoomObject');
  const props = { ...child.props, onReady: undefined, onPosition: (...args) => reports.push(args) };
  slots = []; cursor = 0; effects = []; child.type(props); effects.forEach(fn => fn());
  renderFrame({ timeSinceLastFrame: 1 / fps });
  const landed = [2.4 - radius - .02, w.FLOOR_Y + radius, .6];
  body.position = landed;
  for (let frame = 0; frame < fps; frame++) renderFrame({ timeSinceLastFrame: 1 / fps });
  assert.deepEqual(body.position, landed, 'A ball reaching the room edge must never return to its initial placement');
  const settled = reports.filter(report => report[3]);
  assert.equal(settled.length, 1, 'A landing is reported once, even if the screen position has stopped changing');
  assert.deepEqual(Array.from(settled[0][2]), landed);
  cursor = 0; effects = []; child.type({ ...props, playingId: undefined, playContact: false }); effects.forEach(fn => fn());
  for (let frame = 0; frame < fps; frame++) renderFrame({ timeSinceLastFrame: 1 / fps });
  assert.deepEqual(body.position, landed, 'Finishing play leaves the physical ball at its landing');
  const offset = w.nativeObjectPlacementOffset(ballWorld, ballObject, landed);
  const reloaded = w.buildNativeRoomWorld({ ...ballLayout, toys: [{ ...ballLayout.toys[0], offset: JSON.parse(JSON.stringify(offset)) }] }).objects[0];
  assert.ok(Math.abs((reloaded.min[0] + reloaded.max[0]) / 2 - landed[0]) < 1e-6);
  assert.ok(Math.abs((reloaded.min[2] + reloaded.max[2]) / 2 - landed[2]) < 1e-6, 'Saved layout restores the landed floor location');
  body.position = [2.8, w.FLOOR_Y - .1, .6];
  renderFrame({ timeSinceLastFrame: 1 / fps });
  assert.ok(Math.abs(body.position[0] - (2.4 - radius)) < 1e-6);
  assert.equal(body.position[2], .6, 'Boundary recovery stays beside the impact, not at the starting point');
  assert.equal(body.position[1], w.FLOOR_Y + radius);
}
console.log('Verified landed balls stay put after play, save/reload at the same floor position, and recover locally at boundaries at 30/60/120 FPS.');

// Move the real chair root entirely through its drawing-thread shared preview.
{
  const room=w.buildNativeRoomWorld({...base,decorations:[{decorationId:'chairRockingOak',instanceId:'drag-chair',offset:{x:0,y:.2},rotationDegrees:20}]});
  const object=room.objects[0], editingObject={value:undefined};
  const child=sceneChildren({world:room,catPresent:false,editing:true,editingObject}).find(c=>c.type.name==='RoomObject');
  toyRoot=matrix();toyNodes=new Map();slots=[];cursor=0;effects=[];
  let bodies=0, models=0;
  const oldBody=mocks['react-native-filament'].useRigidBody,oldModel=mocks['react-native-filament'].useModel;
  mocks['react-native-filament'].useRigidBody=(...args)=>{bodies++;return oldBody(...args);};
  mocks['react-native-filament'].useModel=(...args)=>{models++;return oldModel(...args);};
  child.type(child.props);effects.forEach(fn=>fn());
  for(let frame=0;frame<120;frame++) {
    editingObject.value={...object,position:object.position.map((v,i)=>v+(i===0?frame*.001:0))};
    renderFrame({timeSinceLastFrame:1/60});
    assert.ok(Math.abs(Math.atan2(toyRoot[8],toyRoot[0])-20*Math.PI/180)<1e-8,'Live native rendering keeps the chair at 20 degrees');
    assert.ok(Math.abs(toyRoot[12]-editingObject.value.position[0])<1e-8);
  }
  const savedSetTransform=transformManager.setTransform;
  let repeatedWrites=0;
  transformManager.setTransform=(...args)=>{repeatedWrites++;return savedSetTransform(...args);};
  for(let frame=0;frame<120;frame++)renderFrame({timeSinceLastFrame:1/60});
  assert.equal(repeatedWrites,0,'A stationary or blocked preview performs no repeated native transform writes');
  transformManager.setTransform=savedSetTransform;
  for(const invalid of [{}, {...object,scale:undefined}, {...object,scale:NaN}, {...object,scale:0},
    {...object,heading:undefined}, {...object,position:undefined}, {...object,position:[0,NaN,0]}]) {
    editingObject.value=invalid;
    assert.doesNotThrow(()=>renderFrame({timeSinceLastFrame:1/60}),'Incomplete previews cannot reach native numeric transforms');
    assert.ok(toyRoot.every(Number.isFinite),'The room retains a finite transform during an incomplete preview');
  }
  editingObject.value={...object,position:[.5,object.position[1],object.position[2]]};
  renderFrame({timeSinceLastFrame:1/60});
  assert.equal(toyRoot[12],.5,'A valid preview continues working after an incomplete update');
  assert.equal(bodies,1,'Dragging does not rebuild physics bodies');
  assert.equal(models,1,'Dragging does not reload model assets');
  mocks['react-native-filament'].useRigidBody=oldBody;mocks['react-native-filament'].useModel=oldModel;
}
console.log('Verified native chair drag previews retain 20 degrees across 120 frames with no model reloads or physics body recreation.');

// Pick actual rendered entity IDs, including cleanup and delayed queries after unmount.
{
  const room=w.buildNativeRoomWorld({...base,decorations:[{decorationId:'lampFloorArc',instanceId:'pick-lamp',offset:{x:0,y:.2}}]});
  const pickerRef={current:undefined}, coordinates=[];
  let picked={id:5000}, resolveDelayed;
  const oldView=context.view;
  context.view={pickEntity:(x,y)=>{coordinates.push([x,y]);return picked==='pending'
    ? new Promise(resolve=>{resolveDelayed=resolve;}) : Promise.resolve(picked);}};
  effects=[];
  const children=sceneChildren({world:room,catPresent:true,pickerRef});
  effects.forEach(fn=>fn());
  const sceneCleanups=slots.flatMap(slot=>slot?.cleanup ? [slot.cleanup] : []);
  const picker=pickerRef.current;
  const child=children.find(c=>c.type.name==='RoomObject');
  toyRoot=matrix();toyNodes=new Map();slots=[];cursor=0;effects=[];
  child.type(child.props);effects.forEach(fn=>fn());
  const objectCleanups=slots.flatMap(slot=>slot?.cleanup ? [slot.cleanup] : []);
  assert.equal(await picker.pick(12,34),'pick-lamp','Renderable IDs identify the placed model');
  assert.deepEqual(coordinates.at(-1),[12,34],'The engine receives local DP without a second density/Y conversion');
  picked={id:999999}; assert.equal(await picker.pick(1,2),undefined,'Room surfaces and unregistered entities do not select furniture');
  const unregisterCat=children.find(c=>c.type==='Cat').props.registerPickEntities('cat',[{id:6000}]);
  picked={id:6000}; assert.equal(await picker.pick(1,2),'cat');
  unregisterCat(); assert.equal(await picker.pick(1,2),undefined);
  objectCleanups.forEach(fn=>fn());
  picked={id:5000}; assert.equal(await picker.pick(1,2),undefined,'Removed model entities cannot stay selectable');
  picked='pending'; const pending=picker.pick(1,2);
  sceneCleanups.forEach(fn=>fn());
  assert.equal(pickerRef.current,undefined,'Scene unmount disconnects the picker');
  resolveDelayed({id:5000});assert.equal(await pending,undefined,'A delayed query cannot select an unmounted room');
  context.view=oldView;
}
console.log('Verified actual native entity registration, geometry picker coordinates, removal, cat selection and unmount safety.');

// Match the real chair cushion and runner geometry, then run both native roots
// against the scene's single rocking clock.
const rocking = load('@/utils/native-rocking-chair');
const chairModel = glb('chairRockingOak');
const cushion = chairModel.nodes.find(n => n.name === 'Soft sage seat pad');
const cushionPrimitive = chairModel.meshes[cushion.mesh].primitives[0];
const cushionTop = cushion.translation[1] + chairModel.accessors[cushionPrimitive.attributes.POSITION].max[1];
assert.ok(Math.abs(cushionTop - .69) < .0001);
for (const wallFlipped of [false,true]) for (const size of [undefined,1,1.4,2.2]) for (const kind of ['sofaSit','sofaSleep']) {
  const layout = { ...base, petSize: roomScale.ROOM_CAT_SIZE, sizeScale: roomScale.ROOM_OBJECT_SCALE,
    decorations: [{ decorationId:'chairRockingOak',instanceId:'rocker',offset:{x:0,y:.15},wallFlipped,scale:size}] };
  const world = w.buildNativeRoomWorld(layout), chair = world.objects[0];
  const options = { ...layout, nativeWorld:world, homeOffset:{x:0,y:.12}, ownedToyIds:[], hungry:false, asleep:false };
  const plan = buildRoomActivity(options,0,kind,'rocker');
  assert.ok(plan);
  const root = matrix(chair.position,[0,Math.sin(chair.heading/2),0,Math.cos(chair.heading/2)],[chair.scale,chair.scale,chair.scale]);
  const expected = [0,1,2].map(i => root[4+i]*cushionTop + root[8+i]*cushion.translation[2] + root[12+i]);
  assert.ok(w.pathLength([chair.seat,expected]) < .0001, 'Cat landing matches the shipped cushion top on both orientations');
  const walk = w.prepareNativeStep(plan,plan.steps[0],w.catScreenPoint(world.home,world),world,w.FLOOR_Y);
  assert.equal(walk.native.blocked,false);
  assert.ok(w.pathLength([walk.native.path.at(-1),chair.approach]) < .001);
  const jump = w.prepareNativeStep(plan,plan.steps[1],walk.position,world,w.FLOOR_Y);
  assert.equal(jump.native.blocked,false);
  assert.ok(w.pathLength([jump.native.path.at(-1),chair.seat]) < .001);
  const restStep = plan.steps.find(s => s.hold);
  const rest = w.prepareNativeStep(plan,restStep,jump.position,world,chair.seat[1]);
  assert.equal(rest.native.rockingChair.instanceId,'rocker');
  const leaveStep = plan.steps.find(s => s.animation === 'jumpOff');
  const leave = w.prepareNativeStep(plan,leaveStep,rest.position,world,chair.seat[1]);
  assert.equal(leave.native.rockingChair.leaving,true);
  assert.equal(rocking.rockingChairContact(jump.native,0),0);
  assert.equal(rocking.rockingChairContact(jump.native,jump.native.duration),1);
  assert.equal(rocking.rockingChairContact(leave.native,0),1);
  assert.equal(rocking.rockingChairContact(leave.native,leave.native.duration),0);
  if (size !== undefined && size !== 1.4) continue;
  for (const fps of [30,60,120]) {
    toyRoot = matrix(); toyNodes = new Map(chairModel.nodes.map(n => [n.name,n]));
    toyLocals = new Map(chairModel.nodes.map(n => [n.name,n.matrix ?? matrix(n.translation,n.rotation,n.scale)]));
    toyParents = new Map(chairModel.nodes.flatMap(n => (n.children ?? []).map(i => [chairModel.nodes[i].name,n.name])));
    slots=[]; catRoot=matrix();liveLocals=posedTail('sit',0,[0,0,0],0,1,[],true);
    const motion = {value:rocking.STILL_ROCKING_MOTION};
    const catPosition = {value:chair.seat};
    render({playback:{kind:'segment',segment:{assetKey:restStep.animation,loop:true}},active:true,
      world,travel:rest.native,rockingMotion:motion,positionValue:catPosition,initialPosition:chair.seat});
    const catFrame=renderFrame;
    const child=sceneChildren({world,catPresent:true,travel:rest.native,playback:{kind:'segment',segment:{assetKey:'sit'}}}).find(c=>c.type.name==='RoomObject');
    const props={...child.props,rockingMotion:motion,catPosition,onReady:undefined};
    slots=[];cursor=0;effects=[];child.type(props);effects.forEach(fn=>fn());
    const chairFrame=renderFrame;
    let min=Infinity,max=-Infinity;
    for(let frame=0;frame<fps*8;frame++) {
      motion.value=rocking.advanceRockingChair(motion.value,rest.native.rockingChair,catPosition.value,1/fps);
      chairFrame({timeSinceLastFrame:1/fps});catFrame({timeSinceLastFrame:1/fps});
      const actualSeat=[0,1,2].map(i=>toyRoot[4+i]*cushionTop+toyRoot[8+i]*cushion.translation[2]+toyRoot[12+i]);
      assert.ok(w.pathLength([catRoot.slice(12,15),actualSeat])<.0001, 'Cat and chair remain attached to the same cushion through every rock');
      min=Math.min(min,motion.value.angle);max=Math.max(max,motion.value.angle);
    }
    assert.ok(max-min>.14,'Occupied chair visibly rocks in both directions');
    for(let frame=0;frame<fps*5;frame++) motion.value=rocking.advanceRockingChair(motion.value,undefined,undefined,1/fps);
    assert.equal(motion.value.angle,0,'Empty chair settles after the cat leaves');
  }
}
// The actual scene clock freezes when paused and resets with Reduce Motion.
const rockerWorld=w.buildNativeRoomWorld({...base,decorations:[{decorationId:'chairRockingOak',instanceId:'rocker',offset:{x:0,y:.15}}]});
const rocker=rockerWorld.objects[0];
const chairTravel={path:[rocker.seat],distance:0,duration:12,jump:false,rockingChair:{instanceId:'rocker',seat:rocker.seat,
  pivot:rocker.position,axis:[1,0,0],scale:rocker.scale}};
const chairScene={world:rockerWorld,catPresent:true,initialCatPosition:rocker.seat,travel:chairTravel,playback:{kind:'segment',segment:{assetKey:'sit'}},paused:false};
slots=[];let rockerChildren=renderCachedScene(chairScene);
const sceneMotion=rockerChildren.find(c=>c.type.name==='RoomObject').props.rockingMotion;
assert.equal(sceneMotion,rockerChildren.find(c=>c.type==='Cat').props.rockingMotion);
for(let frame=0;frame<60;frame++)paintFrame();
assert.ok(Math.abs(sceneMotion.value.angle)>.05);
renderCachedScene({...chairScene,paused:true});const frozen=JSON.stringify(sceneMotion.value);
for(let frame=0;frame<60;frame++)paintFrame();assert.equal(JSON.stringify(sceneMotion.value),frozen);
sceneReduced=true;renderCachedScene(chairScene);paintFrame();assert.equal(sceneMotion.value.angle,0);
sceneReduced=false;renderCachedScene({...chairScene,editing:true});paintFrame();assert.equal(sceneMotion.value.angle,0);
console.log('Verified real rocking-chair cushion alignment, approach/jumps, shared chair/cat rocking, settling, pauses and Reduce Motion at 30/60/120 FPS.');

// Execute PetStage's wall-anchor save effect: a cached living room must never
// call the bathroom's editing callback, even through many parent refreshes.
const stageSource=fs.readFileSync('components/pet/PetStage.tsx','utf8');
const stageAst=ts.createSourceFile('PetStage.tsx',stageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let repairEffect;
function findRepairEffect(node) {
  if(ts.isCallExpression(node) && node.expression.getText(stageAst)==='useEffect'
    && node.arguments[0]?.getText(stageAst).includes('object.placementOffset')) repairEffect=node.arguments[0].getText(stageAst);
  ts.forEachChild(node,findRepairEffect);
}
findRepairEffect(stageAst);assert.ok(repairEffect);
const repairCode=ts.transpileModule(`(${repairEffect})();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const repairLayout={...base,decorations:[{decorationId:'windowOakWide',instanceId:'cached-window',scale:1.6,offset:{x:.3,y:.2}}]};
let repairWorld=w.buildNativeRoomWorld(repairLayout),saves=0;
const repairContext={roomVisible:false,rotationPreview:null,viewport:{width:base.width,height:base.height},nativeWorld:repairWorld,livePositions:{},
  isCurtainDecorationId:load('@/constants/decoration-motion').isCurtainDecorationId,
  seenPlacementIds:{current:undefined},placement:load('@/utils/room-item-placement').createRoomPlacementResolver(repairWorld),
  onPlacedDecorationOffsetChange(id,offset){saves++;repairLayout.decorations[0].offset=offset;}};
for(let render=0;render<100;render++) vm.runInNewContext(repairCode,repairContext);
assert.equal(saves,0,'Hidden cached rooms never save into the active room or trigger an update loop');
repairContext.roomVisible=true;vm.runInNewContext(repairCode,repairContext);
assert.equal(saves,0,'Displaying a clamped existing window never changes its saved anchor');
repairContext.nativeWorld=w.buildNativeRoomWorld(repairLayout);
for(let render=0;render<100;render++)vm.runInNewContext(repairCode,repairContext);
assert.equal(saves,0,'Further parent renders retain the original saved window placement');
// Refresh first measures a short scene before the complete layout settles.
// Its bottom clamp used to persist a higher anchor into the full-height room.
const lowWindowLayout={...base,height:480,decorations:[{decorationId:'windowPlain',instanceId:'low-window',scale:1.5,wallFlipped:true,offset:{x:-.4366,y:-.4652}}]};
const lowWindowBefore=w.buildNativeRoomWorld(lowWindowLayout).objects[0];
assert.equal(lowWindowBefore.placementOffset,undefined,'The saved low pose is valid in the settled viewport');
repairContext.seenPlacementIds.current=undefined;
repairContext.onPlacedDecorationOffsetChange=(id,offset)=>{saves++;lowWindowLayout.decorations[0].offset=offset;};
for(const height of [260,480,320,480]) {
  repairContext.viewport={width:base.width,height};
  repairContext.nativeWorld=w.buildNativeRoomWorld({...lowWindowLayout,height});
  repairContext.placement=load('@/utils/room-item-placement').createRoomPlacementResolver(repairContext.nativeWorld);
  if(height===260)assert.ok(repairContext.nativeWorld.objects[0].placementOffset,'The startup viewport needs a temporary bottom correction');
  vm.runInNewContext(repairCode,repairContext);
}
assert.equal(saves,0,'Transient viewport corrections never enter the save file');
assert.ok(w.pathLength([lowWindowBefore.position,w.buildNativeRoomWorld(lowWindowLayout).objects[0].position])<1e-8,'The window returns to its exact low pose after refresh');
repairContext.seenPlacementIds.current=new Set();
repairContext.viewport={width:base.width,height:260};
repairContext.nativeWorld=w.buildNativeRoomWorld({...lowWindowLayout,height:260});
repairContext.placement=load('@/utils/room-item-placement').createRoomPlacementResolver(repairContext.nativeWorld);
vm.runInNewContext(repairCode,repairContext);
assert.equal(saves,1,'A newly placed wall item still saves its fitted visible anchor');
console.log('Verified local wall display corrections, hidden/visible refreshes, transient viewport sizes, exact saved pose restoration and new-item fitting.');

// Bathroom journeys use authored basin/tray/seat anchors, retain their entry
// side through washing, and leave safely when another command interrupts.
const bathroomIds = ['bathroomBathAni', 'bathroomShowerCabin', 'bathroomWcAni',
  'bathroomBathOvalWhite', 'bathroomBathOvalSage', 'bathroomBathOvalRose', 'bathroomBathOvalCharcoal',
  'bathroomBathClawfootCream', 'bathroomBathClawfootNavy', 'bathroomJacuzziWhite', 'bathroomJacuzziSage'];
for (const id of bathroomIds) for (const wallFlipped of [false, true]) for (const size of [id === 'bathroomWcAni' ? 1.3 : id === 'bathroomShowerCabin' ? 1 : 1.8, 2.2]) {
  const fixtureKind = catalog[id].bathroom.kind;
  const kind = fixtureKind === 'toilet' ? 'toiletUse' : fixtureKind === 'shower' ? 'showerWash' : 'bathWash';
  const layout = { ...base, petSize: roomScale.ROOM_CAT_SIZE, sizeScale: roomScale.ROOM_OBJECT_SCALE,
    decorations: [{ decorationId: id, instanceId: 'fixture', scale: size, wallFlipped, offset: { x: 0, y: -.25 } }] };
  const room = w.buildNativeRoomWorld(layout), fixture = room.objects[0];
  const options = { ...layout, nativeWorld: room, homeOffset: { x: .1, y: .2 }, ownedToyIds: [], hungry: false, asleep: false };
  const plan = buildRoomActivity(options, 0, kind, 'fixture');
  assert.ok(plan && plan.targetInstanceId === 'fixture');
  assert.equal(buildRoomActivity(options, 0, kind, 'missing'), null);
  assert.ok(!buildRoomActivity(options, 0), 'Bathroom care starts only from an explicit command');
  let position = room.home, entry;
  for (let i = 0; i < plan.steps.length; i++) {
    const prepared = w.prepareNativeStep(plan, plan.steps[i], w.catScreenPoint(position, room), room, position[1]);
    assert.equal(prepared.native.blocked, false, `${id}/${wallFlipped}/${size}/${prepared.bathroomPhase ?? 'return'} is reachable`);
    plan.steps[i] = prepared;
    position = prepared.native.path.at(-1);
    if (prepared.bathroomPhase === 'enter') {
      entry = prepared.bathroomApproach;
      assert.ok(w.pathLength([position, fixture.bathroom.contact]) < 1e-6, 'Landing matches the actual exported contact point');
    }
    if (['wash', 'use'].includes(prepared.bathroomPhase)) {
      const returning = buildRoomReturn(options, plan, i, prepared.position);
      assert.equal(returning.steps[0].bathroomPhase, 'exit');
      assert.equal(returning.steps[0].targetInstanceId, 'fixture');
      assert.ok(w.pathLength([returning.steps[0].bathroomApproach, entry]) < 1e-6);
      if (kind === 'toiletUse') assert.equal(returning.steps[1].bathroomPhase, 'close');
      const exit = w.prepareNativeStep(returning, returning.steps[0], prepared.position, room, position[1]);
      assert.equal(exit.native.blocked, false);
      assert.ok(w.pathLength([exit.native.path.at(-1), entry]) < 1e-6, 'An interrupted wash leaves through its reachable entry side');
    }
  }
  assert.ok(w.pathLength([position, room.home]) < 1e-6);
  const model = glb(id), anchor = model.nodes.find(n => n.name === 'Bathroom contact');
  assert.ok(anchor);
  assert.ok(w.pathLength([anchor.translation, catalog[id].bathroom.contact]) < 1e-6);
  if (fixtureKind !== 'toilet') assert.equal(model.nodes.filter(n => n.name?.startsWith('Bathroom water drop ')).length, 8);
}
const washPaws = Array.from({ length: 49 }, (_, i) => posedTail('wash', i / 24, [0,0,0], 0, 1, ['R.front.paw', 'L.front.paw', 'head']));
assert.ok(Math.max(...washPaws.map(p => p[0][1])) - Math.min(...washPaws.map(p => p[0][1])) > .3,
  'The actual washing clip visibly lifts the forepaw to wash the face');
assert.ok(Math.max(...washPaws.map(p => p[1][1])) - Math.min(...washPaws.map(p => p[1][1])) < .025,
  'The supporting forepaw stays planted while washing');
for (const id of ['bathroomBathAni', 'bathroomShowerCabin', 'bathroomWcAni', 'bathroomJacuzziWhite']) for (const fps of [30,60,120]) {
  const room = w.buildNativeRoomWorld({ ...base, petSize:80, decorations:[{decorationId:id,instanceId:'fixture',scale:1.8,offset:{x:0,y:0}}] });
  const model=glb(id), fixture=room.objects[0], fixtureKind=fixture.bathroom.kind;
  toyRoot=matrix();toyNodes=new Map(model.nodes.map(n=>[n.name,n]));
  toyLocals=new Map(model.nodes.map(n=>[n.name,n.matrix??matrix(n.translation,n.rotation,n.scale)]));
  toyParents=new Map(model.nodes.flatMap(n=>(n.children??[]).map(i=>[model.nodes[i].name,n.name])));
  const child=sceneChildren({world:room,catPresent:true}).find(c=>c.type.name==='RoomObject');
  slots=[];
  const paint=(phase,extra={})=>{cursor=0;effects=[];child.type({...child.props,onReady:undefined,
    travel:phase?{bathroom:{instanceId:'fixture',kind:fixtureKind,phase}}:undefined,...extra});effects.forEach(fn=>fn());return renderFrame;};
  let frame=paint();frame({timeSinceLastFrame:0});
  const drops=model.nodes.filter(n=>n.name?.startsWith('Bathroom water drop ')).map(n=>n.name);
  for(const name of drops) assert.equal(Math.hypot(...toyLocals.get(name).slice(0,3)),0,'Water is hidden before the cat washes');
  const hinge=fixtureKind==='toilet' ? toyLocals.get('Toilet lid hinge').slice() : undefined;
  frame=paint(fixtureKind==='toilet'?'open':'wash');
  for(let i=0;i<fps;i++)frame({timeSinceLastFrame:1/fps});
  if(hinge) assert.ok(Math.abs(toyLocals.get('Toilet lid hinge')[6])>.98,'The toilet lid lifts clear before the cat jumps');
  else {
    assert.ok(drops.every(name=>Math.hypot(...toyLocals.get(name).slice(0,3))>0),'Washing starts the water');
    const prior=toyLocals.get(drops[0]).slice();frame({timeSinceLastFrame:1/fps});
    assert.notEqual(toyLocals.get(drops[0])[13],prior[13],'The running water falls visibly');
  }
  const beforeLayoutRefresh=JSON.stringify([...toyLocals]);
  frame=paint(fixtureKind==='toilet'?'use':'wash',{object:{...fixture,bathroom:{...fixture.bathroom,contact:[...fixture.bathroom.contact]}}});
  frame({timeSinceLastFrame:0});
  assert.equal(JSON.stringify([...toyLocals]),beforeLayoutRefresh,'Refreshing a layout cannot recapture the animated lid or water as its base pose');
  frame=paint(fixtureKind==='toilet'?'use':'wash',{active:false});
  const paused=JSON.stringify([...toyLocals]);for(let i=0;i<fps;i++)frame({timeSinceLastFrame:1/fps});
  assert.equal(JSON.stringify([...toyLocals]),paused,'Covered bathroom scenes pause their water and lid clock');
  frame=paint(undefined);for(let i=0;i<fps;i++)frame({timeSinceLastFrame:1/fps});
  if(hinge) assert.ok(toyLocals.get('Toilet lid hinge').every((v,i)=>Math.abs(v-hinge[i])<.0001),'The lid closes after use or cancellation');
  else for(const name of drops)assert.equal(Math.hypot(...toyLocals.get(name).slice(0,3)),0,'Finishing or cancelling a wash stops its water');
  frame=paint(fixtureKind==='toilet'?'open':'wash',{active:false,reduceMotion:true});frame({timeSinceLastFrame:1/fps});
  if(hinge) assert.ok(Math.abs(toyLocals.get('Toilet lid hinge')[6])>.98,'Reduce Motion opens the lid immediately');
}
console.log('Verified all bathroom anchors and rotated/resized journeys, safe wash interruptions, real paw washing, running water, toilet lid opening/closing, pause and Reduce Motion at 30/60/120 FPS.');

const referenceBathroom = [
  {decorationId:'bathroomBathAni',instanceId:'bath',offset:{x:-.55,y:.08},scale:1.8},
  {decorationId:'bathroomWcAni',instanceId:'toilet',offset:{x:.6046991500,y:-.0640368225},scale:1.3},
  {decorationId:'bathroomShowerCabin',instanceId:'shower',offset:{x:-.0135219181,y:-.2660848204},scale:1.5,wallFlipped:true},
];
for(const [width,height] of [[320,320],[390,420],[351,456]]) {
  const layout={...base,width,height,petSize:80,sizeScale:1.15,decorations:referenceBathroom};
  const room=w.buildNativeRoomWorld(layout);
  for(const [kind,id] of [['bathWash','bath'],['showerWash','shower'],['toiletUse','toilet']]) {
    const plan=buildRoomActivity({...layout,nativeWorld:room,homeOffset:{x:0,y:.12},ownedToyIds:[],hungry:false,asleep:false},0,kind,id);
    let position=room.home;
    for(let i=0;i<plan.steps.length;i++) {
      const step=w.prepareNativeStep(plan,plan.steps[i],w.catScreenPoint(position,room),room,position[1]);
      assert.equal(step.native.blocked,false,`${kind}/${width}/${step.bathroomPhase??'home'} reaches the bathroom shown in the screenshot`);
      plan.steps[i]=step;position=step.native.path.at(-1);
    }
  }
}
console.log('Verified bath, shower and toilet journeys in the reported bathroom layout at three viewport sizes.');

mocks['react-native-filament'].Light = 'LampLightEntity';
const { NativeLampLight } = load('@/components/pet/native/NativeLampLight');
const lampRoom = w.buildNativeRoomWorld({ ...base, decorations: [
  { decorationId: 'lampFloorArc', instanceId: 'lamp-lit', offset: { x: -.4, y: .1 }, poweredOn: true, rotationDegrees: 53 },
  { decorationId: 'lampTableCeramic', instanceId: 'lamp-off', offset: { x: .4, y: .1 } },
] });
const lampsInScene = sceneChildren({ ...sceneMeal, world: lampRoom }).filter(child => child.type === 'LampLight');
assert.equal(lampsInScene.length, 2);
const lampPreview = { value: undefined };
const lampNode = NativeLampLight({...lampsInScene[0].props, editingObject:lampPreview});
assert.equal(typeof lampNode.props.config.intensity, 'number', 'Light updates avoid native handle listeners');
let lampCreates = 0, lampPositions = [];
mocks['react-native-filament'].useLightEntity = (_manager, config) => { lampCreates++; return {config}; };
mocks['react-native-filament'].useEntityInScene = () => {};
mocks['react-native-filament'].useFilamentContext = () => ({ lightManager:{ setPosition(_light,position) { lampPositions.push([...position]); } }, scene:{} });
slots=[];cursor=0;effects=[];lampNode.type(lampNode.props);
renderFrame({timeSinceLastFrame:1/60});
for(let i=0;i<120;i++) {
  lampPreview.value={...lampRoom.objects[0],position:lampRoom.objects[0].position.map((v,axis)=>v+(axis===0?i*.001:0))};
  renderFrame({timeSinceLastFrame:1/60});
}
assert.equal(lampCreates,1,'Dragging never recreates the native lamp light');
assert.ok(Math.abs(lampPositions.at(-1)[0]-lampNode.props.config.position[0]-.119)<1e-8,'The light pool follows the moving lamp');
const settledLampUpdates=lampPositions.length;
for(let i=0;i<60;i++)renderFrame({timeSinceLastFrame:1/60});
assert.equal(lampPositions.length,settledLampUpdates,'An unmoving lamp does not repeat native writes');
assert.equal(NativeLampLight(lampsInScene[1].props), null, 'An off lamp emits no light');
const hiddenLampNode = NativeLampLight({ ...lampsInScene[0].props, active: false });
assert.equal(hiddenLampNode.type, lampNode.type, 'Pausing a room retains its powered lamp component');
assert.equal(hiddenLampNode.props.config.intensity, lampNode.props.config.intensity, 'Room visibility cannot switch lamp power off');
cursor=0;effects=[];hiddenLampNode.type(hiddenLampNode.props);effects.forEach(fn=>fn());
const hiddenLampUpdates=lampPositions.length;
renderFrame({timeSinceLastFrame:1/60});
assert.equal(lampPositions.length,hiddenLampUpdates,'Hidden lamps retain their light without native pose updates');
assert.equal(NativeLampLight({ ...lampsInScene[0].props, object: { ...lampRoom.objects[0], poweredOn: false } }), null);
console.log('Verified native lamp mounting, independent power, numeric light properties and retained hidden-room lights.');

const glowParts = load('@/constants/lamp-glow-parts.json');
const { LAMP_LIGHT_ORIGINS } = load('@/constants/decoration-motion');
assert.deepEqual(Object.keys(glowParts).sort(), Object.keys(LAMP_LIGHT_ORIGINS).sort(), 'Every switchable lamp has a visible light source');
const { NativeLampGlow } = load('@/components/pet/native/NativeLampGlow');
mocks['react-native-filament'].useFilamentContext = () => ({
  renderableManager: {
    getPrimitiveCount: entity => entity.materials.length,
    getMaterialInstanceAt: (entity, index) => entity.materials[index],
  }, nameComponentManager: { getEntityName: entity => entity.name },
});
function lampGlowAsset(id) {
  const model = glb(id);
  const materials = model.materials.map(meta => ({ meta, emission: undefined,
    setFloat4Parameter(name, value) { assert.equal(name, 'emissiveFactor'); this.emission = [...value]; } }));
  const entities = model.nodes.filter(node => node.mesh !== undefined).map(node => ({ name: node.name,
    materials: model.meshes[node.mesh].primitives.map(primitive => materials[primitive.material]) }));
  return { materials, getRenderableEntities: () => entities };
}
function glow(asset, modelId, poweredOn) {
  slots = []; cursor = 0;
  NativeLampGlow({ asset, modelId, poweredOn });
}
for (const id of Object.keys(glowParts)) {
  const asset = lampGlowAsset(id);
  glow(asset, id, true);
  const glowing = asset.materials.filter(material => material.meta.name.startsWith('Lamp glow '));
  assert.ok(glowing.length && glowing.every(material => material.emission?.slice(0, 3).some(value => value > 0)),
    `${id}: the shade, bulb or lantern glows when powered on`);
  assert.ok(asset.materials.filter(material => !glowing.includes(material)).every(material => material.emission === undefined),
    `${id}: shared authored colors cannot make its base or stand glow`);
  const second = lampGlowAsset(id);
  glow(second, id, false);
  assert.ok(glowing.every(material => material.emission.slice(0, 3).some(value => value > 0)), 'Another lamp has independent power');
  glow(asset, id, false);
  assert.ok(glowing.every(material => material.emission.slice(0, 3).every(value => value === 0)), 'Switching off removes the source glow');
  glow(asset, id, true);
  assert.ok(glowing.every(material => material.emission.slice(0, 3).some(value => value > 0)), 'Switching back on restores the glow');
}
console.log('Verified shade emission, isolated Blender materials, independent lamps and repeated on/off switching for all 10 lamp types.');

for(const id of ['lavaLampOff','lavaLampAni']) {
  const model=glb(id),buffer=fs.readFileSync(`assets/3d/native/${id}.glb`);
  const binary=buffer.subarray(28+buffer.readUInt32LE(12));
  function values(index) {
    const accessor=model.accessors[index],view=model.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType,5126);
    const size=accessor.type==='SCALAR'?1:3;
    return Array.from({length:accessor.count},(_,row)=>Array.from({length:size},(_,axis)=>
      binary.readFloatLE((view.byteOffset??0)+(accessor.byteOffset??0)+row*(view.byteStride??size*4)+axis*4)));
  }
  const glass=model.materials.find(m=>m.name.startsWith('Lamp glow Glass'));
  assert.equal(glass.alphaMode,'BLEND','Wax is visible through the actual exported glass');
  assert.ok(glass.pbrMetallicRoughness.baseColorFactor[3]<.4);
  const blobs=model.nodes.filter(n=>n.name.startsWith('Lava blob'));
  assert.equal(blobs.length,3);
  const animation=model.animations[0];
  assert.ok(animation,'Both saved lava lamp variants move when powered on');
  assert.equal(Math.max(...animation.samplers.map(s=>model.accessors[s.input].max[0])),20,
    'Wax rises slowly instead of cycling every two seconds');
  const trajectories=[];
  for(const blob of blobs) {
    const channels=animation.channels.filter(channel=>model.nodes[channel.target.node]===blob);
    const positions=values(animation.samplers[channels.find(c=>c.target.path==='translation').sampler].output);
    const scales=values(animation.samplers[channels.find(c=>c.target.path==='scale').sampler].output);
    assert.equal(positions.length,scales.length);
    const heights=positions.map(p=>p[1]);
    assert.ok(Math.max(...heights)-Math.min(...heights)>.5,'Each wax volume rises and falls inside the bottle');
    positions.forEach((point,i)=>{
      const scale=scales[i];
      assert.ok(point[1]-scale[1]>.29 && point[1]+scale[1]<1.24,'Wax cannot move through the cap or base');
      const narrowestRadius=.12;
      assert.ok(Math.hypot(point[0],point[2])+Math.max(scale[0],scale[2])<narrowestRadius,
        'Wax remains behind the tapered glass at every sampled frame');
      assert.ok(scale[2]>.04 && scale[0]>.04,'Wax is a rounded volume, not a flat dot on the glass');
    });
    for(const axis of [0,1,2]) {
      assert.ok(Math.abs(positions[0][axis]-positions.at(-1)[axis])<1e-6,'The wax cycle has no position jump');
      assert.ok(Math.abs(scales[0][axis]-scales.at(-1)[axis])<1e-6,'The wax cycle has no size jump');
    }
    trajectories.push(heights);
  }
  assert.notDeepEqual(trajectories[0],trajectories[1],'Wax blobs have independent motion');
}
console.log('Verified transparent lava bottles, round wax volumes, slow seamless motion and containment for both lamp variants.');
