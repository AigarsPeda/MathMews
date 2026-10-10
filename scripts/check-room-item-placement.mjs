/** Exercise free drag previews, drop validation, saved angles and legacy recovery. */
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
  const chairMeta=NATIVE_MODEL_CATALOG.chairRockingOak;
  const descriptor=Object.getOwnPropertyDescriptor(chairMeta,'collisionBoxes');
  let collisionReads=0;
  Object.defineProperty(chairMeta,'collisionBoxes',{configurable:true,get:()=>{collisionReads++;return descriptor?.value;}});
  try {
    const releaseOnly=createRoomPlacementResolver(world);
    collisionReads=0;
    for(let frame=0;frame<120;frame++)releaseOnly.move('chair',inside);
    assert.equal(collisionReads,0,'Drag frames do not read or build collision boxes');
    releaseOnly.drop('chair',inside);
    assert.ok(collisionReads>0,'The release performs the contact check');
  } finally {
    if(descriptor)Object.defineProperty(chairMeta,'collisionBoxes',descriptor);
    else delete chairMeta.collisionBoxes;
  }
  const original = JSON.stringify(world);
  const previewInside = resolver.move('chair', inside);
  assert.ok(!resolver.canPlace(previewInside.object), 'The temporary preview may overlap the sofa');
  assert.ok(Math.abs(previewInside.point.x-inside.x)<1e-8 && Math.abs(previewInside.point.y-inside.y)<1e-8,'Preview follows the pointer without collision work');
  const rejected = resolver.drop('chair', inside);
  assert.equal(rejected.accepted,false);
  assert.deepEqual(Array.from(rejected.feedback.blockers,hit=>hit.instanceId),['sofa']);
  assert.equal(rejected.feedback.boundaries.length,0,'Furniture blockers are separate from room edges');
  assert.ok(rejected.feedback.blockers[0].boxes.every(corners=>corners.length===8),'Feedback identifies the actual blocking parts');
  assert.equal(rejected.object,chair,'Dropping on the sofa restores the saved chair');
  const clearPoint=roomItemAnchor(at(chair,1.65,-1.5,width),width);
  const through=resolver.move('chair',clearPoint);
  const placed=resolver.drop('chair',clearPoint);
  assert.equal(placed.feedback,undefined,'Accepted placement clears rejection feedback');
  assert.ok(placed.accepted && resolver.canPlace(placed.object),'The chair can be placed beyond an obstacle when the final spot is clear');
  assert.ok(Math.abs(through.point.x-clearPoint.x)<1e-8 && Math.abs(through.point.y-clearPoint.y)<1e-8);
  for (const pose of [previewInside.object, through.object]) assert.equal(pose.heading, 20 * Math.PI / 180);
  let preview = chair;
  for (let frame = 0; frame < 120; frame++) {
    preview = resolver.move('chair', inside).object;
    assert.equal(preview.heading, chair.heading, 'Live movement retains the exact saved angle');
    assert.ok(!resolver.canPlace(preview),'Contact is allowed until the drag is released');
  }
  assert.equal(JSON.stringify(world), original, 'Preview never mutates the saved room');
  const point = roomItemAnchor(placed.object, width);
  const size = placed.object.scale * width * NATIVE_MODEL_CATALOG[chair.modelId].renderScale / ROOM_SPAN;
  const offset = { x: point.x / ((width - size) / 2), y: point.y / ((input.height - size) / 2) };
  const saved = normalizePlacedDecorations(JSON.parse(JSON.stringify(updatePlacedDecorationOffsetByInstance(input.decorations, 'chair', offset))));
  const reloaded = buildNativeRoomWorld({ ...input, decorations: saved }).objects[1];
  assert.equal(reloaded.heading, chair.heading, 'Save/reload after moving retains 20 degrees');
  assert.ok(reloaded.position.every((v, i) => Math.abs(v - placed.object.position[i]) < 1e-8));
  const legacy = at(chair, 0, -.8, width);
  const legacyWorld = { ...world, objects: [sofa, legacy] };
  const repaired = createRoomPlacementResolver(legacyWorld).drop('chair', roomItemAnchor(chair, width));
  assert.ok(repaired.accepted);
  assert.ok(createRoomPlacementResolver(legacyWorld).canPlace(repaired.object), 'Existing overlaps can be pulled apart');
  const relocated = createRoomPlacementResolver(legacyWorld).nearestFree(legacy);
  assert.ok(relocated && createRoomPlacementResolver(legacyWorld).canPlace(relocated), 'New furniture can be relocated to empty space');
  assert.equal(relocated.heading,chair.heading);
  const outside = at(chair, 0, 3.2, width);
  const outsideResolver=createRoomPlacementResolver({...world,objects:[outside]});
  const edgeDrop=resolver.drop('chair',roomItemAnchor(outside,width));
  assert.equal(edgeDrop.accepted,false,'Dropping outside the floor returns to the saved pose');
  assert.deepEqual(Array.from(edgeDrop.feedback.boundaries),['frontEdge']);
  assert.equal(edgeDrop.feedback.blockers.length,0,'An out-of-room drop does not falsely blame every piece of furniture');
  const recovered = outsideResolver.drop('chair', roomItemAnchor(chair, width));
  assert.ok(recovered.accepted);
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
console.log('Verified free previews through obstacles, overlap/out-of-room drop rejection, clear drop acceptance, retained 20-degree yaw, saves and legacy recovery.');
const door={decorationId:'japaneseDoorAni',instanceId:'door',offset:{x:-.4,y:-.3},rotationDegrees:20};
const movedDoor=updatePlacedDecorationOffsetByInstance([door],'door',{x:.4,y:-.3})[0];
assert.equal(movedDoor.wallFlipped,true,'Moving a legacy door across the screen does not turn it onto the other wall');
assert.equal(movedDoor.rotationDegrees,20);

// Empty space between the chair parts is available; solid wood still blocks it.
const tiny = {...synthetic('small-prop',0,0), modelId:'toy-blueBall',heading:0,scale:.02};
const frame = {...synthetic('chair',0,0),heading:0,scale:1};
const openGap = {...tiny,position:[0,.28,.1]};
assert.ok(createRoomPlacementResolver({width:390,objects:[frame,openGap]}).canPlace(openGap),'The chair envelope no longer fills the empty space under its seat');
const solidSeat = {...tiny,position:[0,.58,0]};
assert.equal(createRoomPlacementResolver({width:390,objects:[frame,solidSeat]}).canPlace(solidSeat),false,'Chair seat still prevents actual intersection');
// A rotated mesh may fit at the edge even when corners of its enclosing box do not.
const {roomItemFootprint,ROOM_PLACEMENT_MAX} = load('@/utils/room-item-placement');
const angled={...frame,heading:Math.PI/4,scale:.5};
const hull=roomItemFootprint(angled),maxX=Math.max(...hull.map(p=>p[0]));
const edgePose={...angled,position:[ROOM_PLACEMENT_MAX-maxX-.001,.068,0]};
assert.ok(createRoomPlacementResolver({width:390,objects:[edgePose]}).canPlace(edgePose),'Mesh footprint reaches the real open floor edge');
const overEdge={...edgePose,position:[edgePose.position[0]+.02,.068,0]};
const actualEdge=createRoomPlacementResolver({width:390,objects:[edgePose]}).drop('chair',roomItemAnchor(overEdge,390));
assert.equal(actualEdge.accepted,false);
assert.deepEqual(Array.from(actualEdge.feedback.boundaries),['rightEdge']);

// The chair visible in the reported screenshot is the restored, valid pose.
// Rejection belongs to the separate destination farther left, beside the lamp.
const {roomItemPlacementOutline} = load('@/utils/room-item-placement');
for(const width of [354,390]) {
  const reported=buildNativeRoomWorld({width,height:420,petSize:80,sizeScale:1.15,decorations:[
    {decorationId:'chairRockingOak',instanceId:'chair',offset:{x:-.6453306371759913,y:.02214805025076669},wallFlipped:true,rotationDegrees:20},
    {decorationId:'lampFloorArc',instanceId:'lamp',offset:{x:-.9644401312492304,y:-.13636163791554348},rotationDegrees:53,scale:1.8},
  ],toys:[]});
  const chair=reported.objects.find(o=>o.instanceId==='chair'),anchor=roomItemAnchor(chair,width);
  const check=createRoomPlacementResolver(reported);
  assert.equal(check.drop('chair',anchor).accepted,true,'The visually clear saved chair position is allowed');
  const rejected=check.drop('chair',{x:anchor.x-30,y:anchor.y+10});
  assert.equal(rejected.accepted,false);
  assert.ok(rejected.feedback.boundaries.includes('leftWall'));
  assert.ok(rejected.feedback.blockers.some(hit=>hit.instanceId==='lamp'));
  assert.ok(roomItemPlacementOutline(rejected.feedback.candidate).length>5,'The attempted chair outline shows its parts above the floor');
  assert.ok(Math.abs(roomItemAnchor(rejected.feedback.candidate,width).x-rejected.point.x)>29,'Attempted outline and restored chair have distinct positions');
}
console.log('Verified the screenshot chair position is allowed, while the separate attempted destination intersects the lamp/wall and has its own furniture outline.');

// Lamps rest on a rotated/scaled tabletop, and the screen anchor survives saves.
const { FLOOR_Y } = load('@/utils/native-room-world');
const { lampLightConfig } = load('@/utils/native-lamp-light');
for (const width of [320, 414, 768]) for (const rotationDegrees of [0, 20, 90]) {
  const input = { width, height: width * 1.1, petSize: width / 3, sizeScale: width / 390,
    decorations: [{ decorationId: 'tablePurple', instanceId: 'table', offset: { x: 0, y: 0 }, rotationDegrees, scale: 1.3 }], toys: [] };
  const tableWorld = buildNativeRoomWorld(input), table = tableWorld.objects[0];
  for (const modelId of ['lavaLampAni', 'lampTableMushroom', 'lampTableCeramic', 'lampTableBanker']) {
    const lampInput = { decorationId: modelId, instanceId: 'lamp', offset: { x: .65, y: .6 }, poweredOn: true, rotationDegrees: 20 };
    const floorLamp = buildNativeRoomWorld({ ...input, decorations: [lampInput] }).objects[0];
    const meta = NATIVE_MODEL_CATALOG[modelId];
    const height = table.max[1] + .002;
    const point = projectWorld([table.position[0], height + (meta.center[1] - meta.min[1]) * floorLamp.scale, table.position[2]], width);
    const world = { ...tableWorld, objects: [table, floorLamp] }, resolver = createRoomPlacementResolver(world);
    const preview = resolver.move('lamp', point), drop = resolver.drop('lamp', point);
    assert.equal(drop.accepted, true, `${modelId} fits on the tabletop at ${rotationDegrees} degrees`);
    assert.ok(Math.abs(preview.object.min[1] - height) < 1e-6);
    assert.ok(Math.abs(drop.object.min[1] - height) < 1e-6, 'The base rests above the tabletop');
    assert.equal(drop.object.heading, floorLamp.heading);
    assert.ok(lampLightConfig(drop.object).position[1] > lampLightConfig(floorLamp).position[1], 'Light rises with the lamp');
    const size = floorLamp.scale * width * meta.renderScale / ROOM_SPAN;
    const offset = { x: drop.point.x / ((width - size) / 2), y: drop.point.y / ((input.height - size) / 2) };
    const saved = normalizePlacedDecorations(JSON.parse(JSON.stringify([...input.decorations, { ...lampInput, offset }])));
    const reloaded = buildNativeRoomWorld({ ...input, decorations: saved }).objects[1];
    assert.ok(reloaded.position.every((v, i) => Math.abs(v - drop.object.position[i]) < 1e-8), 'Saved lamp retains its elevated pose');
    const occupied = createRoomPlacementResolver({ ...world, objects: [...world.objects, { ...drop.object, instanceId: 'other-lamp' }] });
    assert.equal(occupied.drop('lamp', point).accepted, false, 'Tabletop placement still rejects overlapping lamps');
    const supported = createRoomPlacementResolver({ ...world, objects: [table, drop.object] });
    const floorPoint = roomItemAnchor(at(floorLamp, 1.8, 1.8, width), width);
    const movedOff = supported.drop('lamp', floorPoint);
    assert.equal(movedOff.accepted, true);
    assert.ok(Math.abs(movedOff.object.min[1] - (FLOOR_Y + meta.min[1] * floorLamp.scale)) < 1e-8, 'Dragging off the table returns to floor height');
    const edgePoint = projectWorld([table.position[0] + Math.cos(table.heading) * .84 * table.scale,
      height + (meta.center[1] - meta.min[1]) * floorLamp.scale,
      table.position[2] - Math.sin(table.heading) * .84 * table.scale], width);
    assert.ok(resolver.move('lamp', edgePoint).object.min[1] < height - .1, 'An overhanging base cannot snap onto the tabletop');
  }
}
console.log('Verified tabletop lamp previews, rotated/scaled tables, release validation, blockers, light elevation, save/reload and return to the floor.');

// Aim at the board itself as well as at the elevated lamp anchor. The returned
// preview anchor is the one the drag controller submits at release.
for (const width of [320,414,768]) for (const wallFlipped of [false,true]) {
  for (const supportModel of ['tablePurple','bathroomLongShelf','bathroomSmallShelf','livingShelvingA','livingShelvingB','japaneseShelf','shelfWood','livingFireplaceCream']) {
    const input={width,height:width*1.1,petSize:width/3,sizeScale:width/390,toys:[],
      decorations:[{decorationId:supportModel,instanceId:'support',scale:/^bathroom.*Shelf/.test(supportModel)?1.5:1,
        offset: /tablePurple|shelfWood|Fireplace/.test(supportModel) ? {x:0,y:0} : {x:wallFlipped ? -.45 : .45,y:-.25},wallFlipped}]};
    const support=buildNativeRoomWorld(input).objects[0];
    const surface=NATIVE_MODEL_CATALOG[supportModel].supportSurfaces.at(-1);
    const local=[(surface.min[0]+surface.max[0])/2,surface.max[1],(surface.min[2]+surface.max[2])/2];
    const cos=Math.cos(support.heading),sin=Math.sin(support.heading);
    const board=[support.position[0]+(cos*local[0]+sin*local[2])*support.scale,
      support.position[1]+local[1]*support.scale+.002,
      support.position[2]+(-sin*local[0]+cos*local[2])*support.scale];
    const lampInput={decorationId:'lavaLampAni',instanceId:'lamp',offset:{x:0,y:.6},rotationDegrees:20,poweredOn:true};
    const lamp=buildNativeRoomWorld({...input,decorations:[lampInput]}).objects[0];
    const resolver=createRoomPlacementResolver({...buildNativeRoomWorld(input),objects:[support,lamp]});
    const aimed=projectWorld(board,width);
    const preview=resolver.move('lamp',aimed);
    assert.equal(preview.object.supportId,'support',`${supportModel}: aiming at the board snaps onto it`);
    assert.ok(Math.abs(preview.object.min[1]-board[1])<1e-6);
    const drop=resolver.drop('lamp',preview.point);
    assert.equal(drop.accepted,true,`${supportModel}/${width}/${wallFlipped}: ${JSON.stringify({position:drop.feedback?.candidate.position,boundaries:drop.feedback?.boundaries,blockers:drop.feedback?.blockers.map(hit=>hit.instanceId)})}`);
    assert.equal(drop.object.supportId,'support');
    assert.equal(drop.object.heading,lamp.heading);
    assert.ok(drop.object.position.every((v,i)=>Math.abs(v-preview.object.position[i])<1e-8));
    assert.ok(lampLightConfig(drop.object).position[1]>lampLightConfig(lamp).position[1]);
    const size=lamp.scale*width*NATIVE_MODEL_CATALOG[lamp.modelId].renderScale/ROOM_SPAN;
    const offset={x:drop.point.x/((width-size)/2),y:drop.point.y/((input.height-size)/2)};
    const reloaded=buildNativeRoomWorld({...input,decorations:[...input.decorations,{...lampInput,offset}]}).objects[1];
    assert.equal(reloaded.supportId,'support');
    assert.ok(reloaded.position.every((v,i)=>Math.abs(v-drop.object.position[i])<1e-8),`${supportModel}: save/reload preserves the exact elevated pose`);
    const occupied=createRoomPlacementResolver({...buildNativeRoomWorld(input),objects:[support,lamp,{...drop.object,instanceId:'other'}]});
    const rejected=occupied.drop('lamp',preview.point);
    assert.equal(rejected.accepted,false);
    assert.ok(rejected.feedback.blockers.some(hit=>hit.instanceId==='other'));
  }
}
console.log('Verified board-target snapping, both wall orientations, shelf/mantel support, release agreement, blockers and elevated lamp/light persistence.');

// A surface is a placement target, not an exemption from structural collisions.
{
  const input={width:414,height:455,petSize:138,sizeScale:414/390,toys:[],decorations:[
    {decorationId:'shelfWood',instanceId:'shelf',offset:{x:0,y:0},scale:2.2},
    {decorationId:'lampTableCeramic',instanceId:'lamp',offset:{x:.65,y:.6},scale:.7}]};
  const world=buildNativeRoomWorld(input),[shelf,lamp]=world.objects;
  const surfaces=NATIVE_MODEL_CATALOG.shelfWood.supportSurfaces;
  const meta=NATIVE_MODEL_CATALOG[lamp.modelId];
  const resolver=createRoomPlacementResolver(world);
  // Move into an interior shelf. The board above still limits available height.
  const height=shelf.position[1]+surfaces[0].max[1]*shelf.scale+.002;
  const point=projectWorld([shelf.position[0],height+(meta.center[1]-meta.min[1])*lamp.scale,shelf.position[2]+.02],world.width);
  const preview=resolver.move('lamp',point);
  assert.equal(preview.object.supportId,'shelf');
  const interiorDrop=resolver.drop('lamp',preview.point);
  assert.equal(interiorDrop.accepted,true,'A small lamp fits between shelf boards');
  assert.ok(interiorDrop.object.collisionBoxes.every(box=>box.min[0]>=interiorDrop.object.min[0]-1e-5 && box.max[0]<=interiorDrop.object.max[0]+1e-5),
    'The preview collision boxes move with the elevated lamp');
  const largeInput={...input,decorations:[input.decorations[0],{...input.decorations[1],scale:2.2}]};
  const largeWorld=buildNativeRoomWorld(largeInput),largeLamp=largeWorld.objects[1];
  const largePoint=projectWorld([shelf.position[0],height+(meta.center[1]-meta.min[1])*largeLamp.scale,shelf.position[2]+.02],world.width);
  assert.equal(createRoomPlacementResolver(largeWorld).drop('lamp',largePoint).accepted,false,'A lamp that does not fit cannot occupy the shelving');
  const floorPoint=roomItemAnchor(at(lamp,1.5,1.5,world.width),world.width);
  const floor=resolver.drop('lamp',floorPoint);
  assert.equal(floor.accepted,true);
  assert.equal(floor.object.supportId,undefined);
}
console.log('Verified interior shelf clearance, oversized lamp rejection and return to the floor.');
