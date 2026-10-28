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
const { buildNativeRoomWorld, placeObjectOnRugs, projectWorld, nativeWallPlacementBounds, NATIVE_MODEL_CATALOG, ROOM_SPAN, FLOOR_Y } = load('@/utils/native-room-world');
const { roomItemAnchor, roomItemAtPoint, roomItemFootprint, ROOM_PLACEMENT_MIN, ROOM_PLACEMENT_MAX, createRoomPlacementResolver } = load('@/utils/room-item-placement');
const { transformRoomObject } = load('@/utils/room-support');
const { updatePlacedDecorationOffsetByInstance, updatePlacedDecorationWallFlipByInstance, normalizePlacedDecorations } = load('@/utils/room-placement');
function at(object, x, z, width) {
  const centerY = (object.min[1] + object.max[1]) / 2;
  return roomItemAtPoint(object, projectWorld([x, centerY, z], width), width);
}
// Probe real empty spaces and solids at several scales/headings. These include
// concave parts, slanted legs, asymmetric outlines and formerly boxed animations.
{
  const probeMeta={kind:'decoration',renderScale:1,center:[0,0,0],min:[-.018,-.018,-.018],max:[.018,.018,.018],animated:false};
  NATIVE_MODEL_CATALOG.placementProbe=probeMeta;
  const cases=[
    ['livingTable',[0,.4,0],[0,1.02,0]],
    ['kitchenChairBistro',[0,.9,-.31],[0,1.39,-.3]],
    ['kitchenChairBistro',[.315,.49,.315],[.27,.29,.27]],
    ['chairRockingOak',[.34,.18,0],[0,.55,0]],
    ['sofaCornerSage',[0,.1,0],[0,.38,0]],
    ['sofaCornerSage',[-.5,.5,1], [.7,.4,1]],
    ['bedroomDoubleBed',[0,.07,0],[0,.48,0]],
    ['tvBigAniA',[0,.09,0],[0,.7,0]],
  ];
  NATIVE_MODEL_CATALOG.placementWedge={...probeMeta,min:[-.4,0,-.4],max:[.4,1,.4],
    placementBoxes:[{min:[-.4,0,-.4],max:[.4,1,.4],footprint:[[-.4,-.4],[.4,-.4],[-.4,.4]]}]};
  cases.push(['placementWedge',[.28,.5,.28],[-.2,.5,-.2]]);
  for(const [modelId,clear,blocked]of cases)for(const degrees of [0,37,90,173])for(const scale of [.6,1]) {
    const meta=NATIVE_MODEL_CATALOG[modelId],heading=degrees*Math.PI/180;
    const transform=([x,y,z])=>[scale*(x*Math.cos(heading)+z*Math.sin(heading)),FLOOR_Y+y*scale,scale*(-x*Math.sin(heading)+z*Math.cos(heading))];
    const corners=[meta.min[0],meta.max[0]].flatMap(x=>[meta.min[1],meta.max[1]].flatMap(y=>[meta.min[2],meta.max[2]].map(z=>transform([x,y,z]))));
    const item={instanceId:'fixture',modelId,position:[0,FLOOR_Y,0],heading,scale,collidable:true,
      min:[0,1,2].map(k=>Math.min(...corners.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...corners.map(p=>p[k])))};
    const world=buildNativeRoomWorld({width:390,height:420,petSize:80,sizeScale:1,decorations:[],toys:[]});
    world.objects=[item];
    const resolver=createRoomPlacementResolver(world);
    const probe=point=>{const position=transform(point);return {instanceId:'probe',modelId:'placementProbe',position,heading:0,scale,collidable:true,
      min:position.map(v=>v-.018*scale),max:position.map(v=>v+.018*scale)};};
    assert.ok(resolver.canPlace(probe(clear)),`${modelId}: usable gap stays clear at ${degrees} degrees / ${scale} scale`);
    assert.equal(resolver.canPlace(probe(blocked)),false,`${modelId}: actual solid still blocks at ${degrees} degrees / ${scale} scale`);
  }
  delete NATIVE_MODEL_CATALOG.placementProbe;delete NATIVE_MODEL_CATALOG.placementWedge;
  console.log('Verified gaps beneath tables/beds/sofas, curved chair frames and runners, slanted legs, animated TV feet and asymmetric footprints at four angles and two scales.');
}
// Furniture must clear the rug mesh without changing its persisted screen anchor.
for (const rugId of ['carpetRound', 'carpetClassic', 'rugBraidedRound', 'rugStripedRunner']) for (const angle of [0,37,90]) {
  const layout = { width:390, height:420, petSize:120, sizeScale:1, toys:[], decorations:[
    {decorationId:'chairRockingOak',instanceId:'chair',offset:{x:0,y:0},rotationDegrees:angle},
    {decorationId: rugId,instanceId:'rug',offset:{x:0,y:0},scale:2.2,rotationDegrees:37},
  ] };
  const initial = buildNativeRoomWorld({...layout,decorations:layout.decorations.slice(0,1)}).objects[0];
  const world = buildNativeRoomWorld(layout), chair = world.objects[0], rug = world.objects[1];
  assert.ok(chair.rugLift > 0 && chair.min[1] >= rug.max[1] + .0019, 'Runners rest above the rug, including rotated/resized rugs');
  for (const field of ['position','min','max','seat']) assert.ok(Math.abs(chair[field][1] - initial[field][1] - chair.rugLift) < 1e-8);
  for (let i=0;i<initial.collisionBoxes.length;i++) assert.ok(Math.abs(chair.collisionBoxes[i].min[1] - initial.collisionBoxes[i].min[1] - chair.rugLift)<1e-8);
  const anchor = roomItemAnchor(chair,390), originalAnchor = roomItemAnchor(initial,390);
  assert.ok(Math.hypot(anchor.x-originalAnchor.x,anchor.y-originalAnchor.y)<1e-8,'Carpet clearance preserves the saved anchor');
  assert.equal(placeObjectOnRugs(chair,world.objects),chair,'Repeated support does not accumulate height');
  if (rugId === 'carpetRound' && angle === 0) {
    const edge = at(initial,(rug.min[0]+rug.max[0])/2,rug.max[2]+(initial.max[2]-initial.min[2])*.2,390);
    assert.ok(placeObjectOnRugs(edge,[edge,rug]).rugLift>0,'Runner contact lifts the chair even when its center is outside the carpet');
  }
  const reloaded = buildNativeRoomWorld({...layout,livePositions:{chair:anchor}}).objects[0];
  assert.ok(reloaded.position.every((v,i)=>Math.abs(v-chair.position[i])<1e-8),'Saving the visible anchor reloads without drift');
  const resolver = createRoomPlacementResolver(world);
  const preview = resolver.move('chair',anchor).object;
  assert.ok(preview.min[1] >= rug.max[1]+.0019,'A drag preview retains rug clearance');
  const dropped = resolver.drop('chair',anchor,{snapInsideWalls:false});
  assert.ok(dropped.accepted && dropped.object.min[1] >= rug.max[1]+.0019,'Releasing the chair preserves clearance');
  const enlarged = buildNativeRoomWorld({...layout,decorations:[{...layout.decorations[0],scale:1.6},layout.decorations[1]]}).objects[0];
  const resized = resolver.resize(chair,enlarged);
  assert.ok(resized && resized.min[1]>=rug.max[1]+.0019,'Resizing preserves runner clearance');
  const away = roomItemAnchor(at(initial,2,2,390),390);
  const moved = resolver.move('chair',away).object;
  assert.equal(moved.rugLift,undefined,'Moving off the rug returns the chair to the floor');
  assert.ok(Math.abs(moved.position[1]-FLOOR_Y)<1e-8);
  const removed = buildNativeRoomWorld({...layout,decorations:layout.decorations.slice(0,1),livePositions:{chair:anchor}}).objects[0];
  assert.ok(removed.position.every((v,i)=>Math.abs(v-initial.position[i])<1e-8),'Removing the rug restores the original floor pose');
}
{
  const layout={width:390,height:420,petSize:120,sizeScale:1,toys:[],decorations:[
    {decorationId:'chairRockingOak',instanceId:'chair',offset:{x:0,y:0}},
    {decorationId:'carpetRound',instanceId:'rug',offset:{x:0,y:0},scale:.2},
  ]};
  const world=buildNativeRoomWorld(layout), originalRug=world.objects[1];
  const rug={...originalRug,scale:originalRug.scale*.1,
    min:originalRug.min.map((v,i)=>originalRug.position[i]+(v-originalRug.position[i])*.1),
    max:originalRug.max.map((v,i)=>originalRug.position[i]+(v-originalRug.position[i])*.1)};
  const plain=buildNativeRoomWorld({...layout,decorations:layout.decorations.slice(0,1)}).objects[0];
  const chair=at(plain,(rug.min[0]+rug.max[0])/2,(rug.min[2]+rug.max[2])/2,390);
  assert.equal(placeObjectOnRugs(chair,[chair,rug]).rugLift,undefined,'A small rug between the two runners cannot lift the chair');
  const corner={...plain,scale:.01,position:[originalRug.max[0]-.005,FLOOR_Y,originalRug.max[2]-.005]};
  assert.equal(placeObjectOnRugs(corner,[corner,originalRug]).rugLift,undefined,'Empty corners inside a round rug bounding box cannot lift furniture');
}
console.log('Verified furniture rug clearance, seat/collider alignment, stable anchors, previews, save/reload, floor return and gaps between runners.');
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
  const descriptor=Object.getOwnPropertyDescriptor(chairMeta,'placementBoxes');
  let collisionReads=0;
  Object.defineProperty(chairMeta,'placementBoxes',{configurable:true,get:()=>{collisionReads++;return descriptor?.value;}});
  try {
    const releaseOnly=createRoomPlacementResolver(world);
    collisionReads=0;
    for(let frame=0;frame<120;frame++)releaseOnly.move('chair',inside);
    assert.equal(collisionReads,0,'Drag frames do not read or build collision boxes');
    releaseOnly.drop('chair',inside);
    assert.ok(collisionReads>0,'The release performs the contact check');
  } finally {
    if(descriptor)Object.defineProperty(chairMeta,'placementBoxes',descriptor);
    else delete chairMeta.placementBoxes;
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

// Every window changes walls without being pushed to the inside corner.
const { WINDOW_DECORATION_IDS } = load('@/constants/window-decorations');
for (const width of [320,414,768]) for (const decorationId of WINDOW_DECORATION_IDS) {
  const original={decorationId,instanceId:'window',offset:{x:.6,y:-.35},scale:1.2,rotationDegrees:0};
  const input={width,height:width*1.1,petSize:width/3,sizeScale:width/390,toys:[],decorations:normalizePlacedDecorations([original])};
  const before=buildNativeRoomWorld(input).objects[0];
  const legacy=buildNativeRoomWorld({...input,decorations:input.decorations.map(item=>({...item,rotationDegrees:137.5}))}).objects[0];
  assert.equal(legacy.heading,before.heading,'Old window angles cannot tilt the frame away from its wall');
  const flipped=updatePlacedDecorationWallFlipByInstance(input.decorations,'window',true);
  assert.equal(flipped[0].offset.x,-original.offset.x);
  assert.equal(flipped[0].offset.y,original.offset.y);
  assert.equal(flipped[0].scale,original.scale);
  const after=buildNativeRoomWorld({...input,decorations:flipped}).objects[0];
  assert.equal(before.wallAxis,2);
  assert.equal(after.wallAxis,0);
  const onLeft=buildNativeRoomWorld({...input,decorations:flipped.map(item=>({...item,rotationDegrees:90}))}).objects[0];
  assert.equal(onLeft.heading,after.heading,'Left-wall windows also ignore old free angles');
  assert.ok(Math.abs(roomItemAnchor(before,width).x+roomItemAnchor(after,width).x)<1e-6,`${decorationId}: reflected screen position`);
  assert.ok(Math.abs(roomItemAnchor(before,width).y-roomItemAnchor(after,width).y)<1e-6,`${decorationId}: retained height`);
  assert.equal(createRoomPlacementResolver({...buildNativeRoomWorld(input),objects:[after]}).canPlace(after),true);
  const saved=normalizePlacedDecorations(JSON.parse(JSON.stringify(flipped)));
  const reloaded=buildNativeRoomWorld({...input,decorations:saved}).objects[0];
  assert.ok(reloaded.position.every((v,i)=>Math.abs(v-after.position[i])<1e-8),`${decorationId}: window wall placement survives reload`);
  const same=updatePlacedDecorationWallFlipByInstance(flipped,'window',true);
  assert.equal(same[0].offset.x,flipped[0].offset.x,'Setting the existing wall does not move the window');
  const restored=updatePlacedDecorationWallFlipByInstance(flipped,'window',false);
  assert.equal(restored[0].offset.x,original.offset.x);
  assert.equal(restored[0].wallFlipped,undefined);
}
console.log('Verified every window switches walls with a reflected anchor, retained height/scale, valid mounting bounds and save/reload.');
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
const angled={...frame,heading:Math.PI/4,scale:.5};
const hull=roomItemFootprint(angled),maxX=Math.max(...hull.map(p=>p[0]));
const edgePose={...angled,position:[ROOM_PLACEMENT_MAX-maxX-.001,.068,0]};
assert.ok(createRoomPlacementResolver({width:390,objects:[edgePose]}).canPlace(edgePose),'Mesh footprint reaches the real open floor edge');
const overEdge={...edgePose,position:[edgePose.position[0]+.6,.068,0]};
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

// Reported living-room lamp: the base fits beside the planter/fireplace, but
// square base corners and a broad box under the arch used to reject it.
for(const width of [354,390,768]) {
  const input={width,height:width*420/390,petSize:80*width/390,sizeScale:1.15*width/390,toys:[],decorations:[
    {decorationId:'lampFloorArc',instanceId:'lamp',offset:{x:-.14408440017989146,y:-.5216254006403184},rotationDegrees:53,scale:1.8},
    {decorationId:'plantB',instanceId:'plant',offset:{x:-.09405185324228767,y:-.322725393257792},scale:1.7},
    {decorationId:'livingFireplaceCream',instanceId:'fireplace',offset:{x:-.6878426887379766,y:-.056746550942773304},rotationDegrees:90},
    {decorationId:'windowOakWide',instanceId:'window',offset:{x:.6863000072190298,y:-.4706359865071423},scale:1.6},
  ]};
  const world=buildNativeRoomWorld(input),lamp=world.objects[0],plant=world.objects[1],resolver=createRoomPlacementResolver(world);
  const anchor=(x,z)=>roomItemAnchor({...lamp,position:[x,FLOOR_Y,z]},width);
  for(const [x,z] of [[-1.7,-1.1],[-1.4,-1.1],[-1.3,.4]]) {
    const preview=resolver.move('lamp',anchor(x,z));
    assert.equal(resolver.canPlace(preview.object),true,'A clear round base and empty space below the arch allow placement');
    const drop=resolver.drop('lamp',preview.point);
    assert.equal(drop.accepted,true,'Clear lamp placements survive release beside the existing furniture');
    const offset={x:drop.point.x/((width-drop.object.scale*width*NATIVE_MODEL_CATALOG.lampFloorArc.renderScale/ROOM_SPAN)/2),
      y:drop.point.y/((input.height-drop.object.scale*width*NATIVE_MODEL_CATALOG.lampFloorArc.renderScale/ROOM_SPAN)/2)};
    const saved=buildNativeRoomWorld({...input,decorations:input.decorations.map(item=>item.instanceId==='lamp'?{...item,offset}:item)});
    assert.ok(createRoomPlacementResolver(saved).canPlace(saved.objects[0]),'The valid lamp placement stays valid after save/reload');
  }
  const c=Math.cos(lamp.heading),s=Math.sin(lamp.heading);
  const overlap=resolver.drop('lamp',anchor(plant.position[0]+.3*lamp.scale*c,plant.position[2]-.3*lamp.scale*s),{zoom:100});
  assert.equal(overlap.accepted,false,'The lamp cannot share the planter’s actual solid base');
  assert.ok(overlap.feedback.blockers.some(hit=>hit.instanceId==='plant'));
  const clearLamp=resolver.move('lamp',anchor(-1.4,-1.1)).object;
  assert.equal(createRoomPlacementResolver({...world,objects:[clearLamp]}).canPlace(clearLamp),true);
  const shadePoint=[clearLamp.position[0]+.72*lamp.scale*c,clearLamp.position[1]+1.42*lamp.scale,clearLamp.position[2]-.72*lamp.scale*s];
  const raisedPlant={...plant,position:[shadePoint[0],shadePoint[1]-.2,shadePoint[2]]};
  assert.equal(createRoomPlacementResolver({...world,objects:[clearLamp,raisedPlant]}).canPlace(clearLamp),false,'The bulb/shade still reject a real obstruction above the floor');
}
console.log('Verified clear arc-lamp bases beside the reported planter/fireplace, preview/drop/save agreement, and rejection of actual base and shade collisions.');

// The bed can clear the grate's physical mesh but still cover the fireplace opening.
for (const degrees of [0, 90]) {
  const width = 390;
  const world = buildNativeRoomWorld({ width, height: 420, petSize: 80, sizeScale: 1.15,
    bedId: 'green', bedOffset: { x: .5, y: .5 }, toys: [], decorations: [
      { decorationId: 'livingFireplaceCream', instanceId: 'fireplace', offset: { x: 0, y: 0 }, rotationDegrees: degrees },
    ] });
  const bed = world.objects.find(item => item.instanceId === 'bed');
  const fireplace = world.objects.find(item => item.instanceId === 'fireplace');
  const front = .45 * fireplace.scale + (degrees ? .972 : .81) * bed.scale + .02;
  const candidate = transformRoomObject(bed, [fireplace.position[0] + Math.sin(fireplace.heading) * front,
    bed.position[1], fireplace.position[2] + Math.cos(fireplace.heading) * front]);
  const resolver = createRoomPlacementResolver(world, ['bed']);
  assert.equal(resolver.canPlace(candidate), false, 'A cat bed cannot sit in the fireplace hearth clearance');
  assert.ok(resolver.feedback(candidate).blockers.some(hit => hit.instanceId === 'fireplace'));
  assert.equal(resolver.drop('bed', roomItemAnchor(candidate, width), { zoom: 100 }).accepted, false);
  const side = .895 * fireplace.scale + (degrees ? .81 : .972) * bed.scale + .05;
  const beside = transformRoomObject(bed, [fireplace.position[0] + Math.cos(fireplace.heading) * side,
    bed.position[1], fireplace.position[2] - Math.sin(fireplace.heading) * side]);
  assert.equal(resolver.canPlace(beside), true, 'The cat bed can still sit beside the fireplace');
}
console.log('Verified the fireplace keeps cat beds out of its hearth on both orientations.');

// The visible floor reaches the open edge past the start of its bevel.
{
  const width = 390;
  const world = buildNativeRoomWorld({ width, height: 420, petSize: 80, sizeScale: 1.15,
    bedId: 'green', bedOffset: { x: 0, y: 0 }, toys: [], decorations: [] });
  const bed = world.objects.find(item => item.instanceId === 'bed');
  const extent = .44548 * bed.scale;
  const atEdge = transformRoomObject(bed, [0, bed.position[1], 2.48 - extent]);
  const beyondEdge = transformRoomObject(bed, [0, bed.position[1], 2.52 - extent]);
  const resolver = createRoomPlacementResolver(world, ['bed']);
  assert.equal(resolver.canPlace(atEdge), true, 'A bed on the visible floor is not rejected before the open edge');
  assert.deepEqual(Array.from(resolver.feedback(atEdge).boundaries), []);
  assert.equal(resolver.drop('bed', roomItemAnchor(atEdge, width), { zoom: 100 }).accepted, true);
  assert.equal(resolver.canPlace(beyondEdge), false, 'The bed still cannot hang beyond the visible floor');
  assert.deepEqual(Array.from(resolver.feedback(beyondEdge).boundaries), ['frontEdge']);
}
console.log('Verified bed placement at the visible front floor edge and rejection beyond it.');

{
  const layout = JSON.parse(fs.readFileSync('scripts/fixtures/crowded-living-room.json', 'utf8'));
  const world = buildNativeRoomWorld(layout);
  const bed = world.objects.find(item => item.instanceId === 'bed');
  const resolver = createRoomPlacementResolver(world, ['bed']);
  const feedback = resolver.feedback(bed);
  assert.deepEqual(Array.from(feedback.boundaries), [], 'The saved bed rests on the visible front floor');
  assert.deepEqual(Array.from(feedback.blockers), [], 'Nearby furniture does not block the saved bed');
  assert.equal(resolver.canPlace(bed), true, 'The saved bed is placeable at its exact pose');
  const anchor = roomItemAnchor(bed, world.width);
  assert.equal(resolver.preview('bed', anchor, 100, undefined, false).accepted, true,
    'The exact saved pose has a valid drag preview');
  assert.equal(resolver.drop('bed', anchor, { zoom: 100 }).accepted, true,
    'The exact saved pose can be placed again');
  const beyond = transformRoomObject(bed, [bed.position[0], bed.position[1], bed.position[2] + .04]);
  assert.deepEqual(Array.from(resolver.feedback(beyond).boundaries), ['frontEdge'],
    'Moving the bed support past the open edge is still rejected');
  const { roomPlacementAccess } = load('@/utils/room-placement-access');
  assert.equal(roomPlacementAccess(world, world, world.home, false).blockedExit, false,
    'The bed at the edge does not block the cat from leaving the room');
}

// Lamps rest on a rotated/scaled tabletop, and the screen anchor survives saves.
const { placeObjectOnSurface } = load('@/utils/native-room-world');
const { lampLightConfig } = load('@/utils/native-lamp-light');
for (const width of [320, 414, 768]) for (const rotationDegrees of [0, 20, 90]) {
  const input = { width, height: width * 1.1, petSize: width / 3, sizeScale: width / 390,
    decorations: [{ decorationId: 'tablePurple', instanceId: 'table', offset: { x: 0, y: 0 }, rotationDegrees, scale: 1.3 }], toys: [] };
  const tableWorld = buildNativeRoomWorld(input), table = tableWorld.objects[0];
  for (const modelId of ['lavaLampAni', 'lampTableMushroom', 'lampTableCeramic', 'lampTableBanker', 'halloweenGhostLantern']) {
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
  for (const lampModel of ['lavaLampAni','halloweenGhostLantern']) for (const supportModel of lampModel==='halloweenGhostLantern'
    ? ['tablePurple','bathroomLongShelf','shelfWood','livingFireplaceCream','kitchenModernShelfNavy','kitchenModernIslandNavy']
    : ['tablePurple','bathroomLongShelf','bathroomSmallShelf','livingShelvingA','livingShelvingB','japaneseShelf','shelfWood','livingFireplaceCream']) {
    const input={width,height:width*1.1,petSize:width/3,sizeScale:width/390,toys:[],
      decorations:[{decorationId:supportModel,instanceId:'support',scale:/^bathroom.*Shelf/.test(supportModel)?1.5:lampModel==='halloweenGhostLantern'&&supportModel==='shelfWood'?1.6:1,
        offset: /tablePurple|shelfWood|Fireplace|Island/.test(supportModel) ? {x:0,y:0} : {x:wallFlipped ? -.45 : .45,y:-.25},wallFlipped}]};
    const support=buildNativeRoomWorld(input).objects[0];
    const surface=NATIVE_MODEL_CATALOG[supportModel].supportSurfaces.at(-1);
    const local=[(surface.min[0]+surface.max[0])/2,surface.max[1],(surface.min[2]+surface.max[2])/2];
    const cos=Math.cos(support.heading),sin=Math.sin(support.heading);
    const board=[support.position[0]+(cos*local[0]+sin*local[2])*support.scale,
      support.position[1]+local[1]*support.scale+.002,
      support.position[2]+(-sin*local[0]+cos*local[2])*support.scale];
    const lampInput={decorationId:lampModel,instanceId:'lamp',offset:{x:0,y:.6},rotationDegrees:lampModel==='halloweenGhostLantern'?0:20,poweredOn:true,
      ...(lampModel==='halloweenGhostLantern'?{scale:.7}:{})};
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

// Kitchen mixers use the actual worktop and retain their elevated pose on reload.
for (const width of [320,414,768]) for (const rotationDegrees of [0,25,90]) {
  const input={width,height:width*1.1,petSize:width/3,sizeScale:width/390,toys:[],
    decorations:[{decorationId:'kitchenIsland',instanceId:'counter',offset:{x:0,y:0},rotationDegrees,scale:1.2}]};
  const world=buildNativeRoomWorld(input),counter=world.objects[0];
  const surface=NATIVE_MODEL_CATALOG.kitchenIsland.supportSurfaces[0];
  const height=counter.position[1]+surface.max[1]*counter.scale+.002;
  const surfacePoint=(x,z,y=height)=>projectWorld([
    counter.position[0]+(Math.cos(counter.heading)*x+Math.sin(counter.heading)*z)*counter.scale,
    y,counter.position[2]+(-Math.sin(counter.heading)*x+Math.cos(counter.heading)*z)*counter.scale],width);
  for (const modelId of ['kitchenMixerStand','kitchenMixerHand']) {
    const mixerInput={decorationId:modelId,instanceId:'mixer',offset:{x:.65,y:.6},rotationDegrees:20};
    const mixer=buildNativeRoomWorld({...input,decorations:[mixerInput]}).objects[0];
    const meta=NATIVE_MODEL_CATALOG[modelId];
    const resolver=createRoomPlacementResolver({...world,objects:[counter,mixer]});
    const preview=resolver.move('mixer',surfacePoint(0,0));
    assert.equal(preview.object.supportId,'counter',`${modelId}: targeting the countertop lifts the mixer`);
    assert.ok(Math.abs(preview.object.min[1]-height)<1e-6,'The base rests on the worktop, below its decorations');
    const drop=resolver.drop('mixer',preview.point);
    assert.equal(drop.accepted,true,`${modelId}/${width}/${rotationDegrees}: the clear worktop accepts the mixer`);
    assert.ok(drop.object.position.every((v,i)=>Math.abs(v-preview.object.position[i])<1e-8));
    assert.equal(drop.object.heading,mixer.heading);
    const size=mixer.scale*width*meta.renderScale/ROOM_SPAN;
    const offset={x:drop.point.x/((width-size)/2),y:drop.point.y/((input.height-size)/2)};
    const saved=normalizePlacedDecorations(JSON.parse(JSON.stringify([...input.decorations,{...mixerInput,offset}])));
    const reloaded=buildNativeRoomWorld({...input,decorations:saved}).objects[1];
    assert.equal(reloaded.supportId,'counter');
    assert.ok(reloaded.position.every((v,i)=>Math.abs(v-drop.object.position[i])<1e-8),'Save/reload retains the countertop pose');
    const occupied=createRoomPlacementResolver({...world,objects:[counter,mixer,{...drop.object,instanceId:'other-mixer'}]});
    const rejected=occupied.drop('mixer',preview.point);
    assert.equal(rejected.accepted,false);
    assert.ok(rejected.feedback.blockers.some(hit=>hit.instanceId==='other-mixer'));
    const onBoard=resolver.drop('mixer',surfacePoint(.60,-.22,height+(meta.center[1]-meta.min[1])*mixer.scale));
    assert.equal(onBoard.accepted,false,'The built-in chopping board remains an obstacle');
    assert.ok(onBoard.feedback.blockers.some(hit=>hit.instanceId==='counter'));
    const edgePoint=surfacePoint(surface.max[0]-.001,0,height+(meta.center[1]-meta.min[1])*mixer.scale);
    const edge=placeObjectOnSurface(roomItemAtPoint(mixer,edgePoint,width),[counter],width);
    assert.equal(edge.supportId,undefined,`${modelId}/${rotationDegrees}: an overhanging base cannot occupy the worktop`);
    const raised=createRoomPlacementResolver({...world,objects:[counter,drop.object]});
    const floor=raised.drop('mixer',roomItemAnchor(at(mixer,1.8,1.8,width),width));
    assert.equal(floor.accepted,true);
    assert.equal(floor.object.supportId,undefined);
    assert.ok(Math.abs(floor.object.min[1]-(FLOOR_Y+meta.min[1]*mixer.scale))<1e-8,'Moving off the counter restores floor height');
  }
}
console.log('Verified both mixers on rotated/scaled countertops, preview/drop agreement, save/reload, occupied worktops, chopping-board collisions, overhangs and floor return.');

// Matching kitchens retain level stone tops and expose both shelf boards.
for (const finish of ['White','Sage','Navy','Charcoal']) for (const width of [320,414,768]) {
  const input={width,height:width*1.1,petSize:width/3,sizeScale:width/390,toys:[],decorations:[]};
  const counterInput={decorationId:`kitchenModernCounter${finish}`,instanceId:'counter',offset:{x:0,y:0}};
  const inductionInput={...counterInput,decorationId:`kitchenModernInduction${finish}`,instanceId:'induction'};
  const islandInput={...counterInput,decorationId:`kitchenModernIsland${finish}`,instanceId:'island',rotationDegrees:30};
  const floorShelfInput={...counterInput,decorationId:`kitchenModernFloorShelf${finish}`,instanceId:'floorShelf'};
  const counter=buildNativeRoomWorld({...input,decorations:[counterInput]}).objects[0];
  const induction=buildNativeRoomWorld({...input,decorations:[inductionInput]}).objects[0];
  const island=buildNativeRoomWorld({...input,decorations:[islandInput]}).objects[0];
  const floorShelf=buildNativeRoomWorld({...input,decorations:[floorShelfInput]}).objects[0];
  const floorShelfMeta=NATIVE_MODEL_CATALOG[floorShelf.modelId];
  assert.equal(floorShelf.solid,true,'Floor shelves occupy the floor rather than mounting on a wall');
  assert.ok(Math.abs(floorShelfMeta.max[0]-floorShelfMeta.min[0]-floorShelfMeta.max[2]+floorShelfMeta.min[2])<1e-6,'Compact shelves have square footprints');
  assert.ok(floorShelfMeta.max[0]-floorShelfMeta.min[0]<NATIVE_MODEL_CATALOG[counter.modelId].max[0]-NATIVE_MODEL_CATALOG[counter.modelId].min[0],'Floor shelves are narrower than the drawer counters');
  assert.ok(Math.abs(floorShelf.scale-counter.scale)<1e-6,'Compact units retain the same physical cabinetry scale');
  assert.equal(floorShelfMeta.supportSurfaces.length,3,'Both open shelf levels and the stone top accept objects');
  const floorShelfTop=floorShelfMeta.supportSurfaces.reduce((highest,board)=>board.max[1]>highest.max[1]?board:highest);
  assert.ok(Math.abs(counter.position[1]+NATIVE_MODEL_CATALOG[counter.modelId].supportSurfaces[0].max[1]*counter.scale
    -floorShelf.position[1]-floorShelfTop.max[1]*floorShelf.scale)<1e-6,'Compact stone tops align with the counters');
  const counterTop=NATIVE_MODEL_CATALOG[counter.modelId].supportSurfaces[0];
  const inductionTop=NATIVE_MODEL_CATALOG[induction.modelId].supportSurfaces[0];
  assert.ok(Math.abs(counter.position[1]+counterTop.max[1]*counter.scale
    -induction.position[1]-inductionTop.max[1]*induction.scale)<1e-6,'Matching modules have level stone worktops');
  const islandTop=NATIVE_MODEL_CATALOG[island.modelId].supportSurfaces[0];
  assert.ok(Math.abs(counter.position[1]+counterTop.max[1]*counter.scale
    -island.position[1]-islandTop.max[1]*island.scale)<1e-6,'Modern island worktops match the counter height');
  assert.ok(createRoomPlacementResolver({...input,objects:[island]}).canPlace(island),'Rotated island fits in the room');
  for(const wallFlipped of [false,true]) {
    const fridgeInput={decorationId:`kitchenModernFridge${finish}`,instanceId:'fridge',offset:{x:0,y:0},wallFlipped};
    const fridge=buildNativeRoomWorld({...input,decorations:[fridgeInput]}).objects[0];
    assert.equal(fridge.solid,true,'Built-in fridges block floor navigation');
    assert.equal(fridge.heading,wallFlipped?Math.PI/2:0,'Integrated doors face either wall');
    assert.ok(Math.abs(fridge.scale-counter.scale)<1e-6,'Built-in cabinets use the same physical scale as base units');
    assert.ok(createRoomPlacementResolver({...input,objects:[fridge]}).canPlace(fridge),'Built-in fridge fits without crossing the floor edge');
    const shelfInput={decorationId:`kitchenModernShelf${finish}`,instanceId:'shelf',offset:{x:wallFlipped?-.35:.35,y:-.55},scale:1.3,wallFlipped};
    const shelf=buildNativeRoomWorld({...input,decorations:[shelfInput]}).objects[0];
    assert.equal(shelf.wallAxis,wallFlipped?0:2);
    assert.equal(shelf.solid,false,'Mounted shelves do not occupy the cat floor route');
    assert.equal(NATIVE_MODEL_CATALOG[shelf.modelId].supportSurfaces.length,2,'Both stone shelves support objects');
    const flipped=updatePlacedDecorationWallFlipByInstance([shelfInput],'shelf',!wallFlipped)[0];
    assert.equal(flipped.offset.x,-shelfInput.offset.x,'Switching shelves mirrors the wall anchor');
    const switched=buildNativeRoomWorld({...input,decorations:[flipped]}).objects[0];
    assert.equal(switched.wallAxis,wallFlipped?2:0);
    assert.ok(createRoomPlacementResolver({...input,objects:[switched]}).canPlace(switched),'Shelf remains inside the chosen wall');
    const facingFloorShelfInput={...floorShelfInput,wallFlipped};
    const facingFloorShelf=buildNativeRoomWorld({...input,decorations:[facingFloorShelfInput]}).objects[0];
    assert.equal(facingFloorShelf.heading,wallFlipped?Math.PI/2:0,'Floor shelf openings can face either direction');
    for(const owner of [counter,shelf,island,facingFloorShelf]) for(const board of NATIVE_MODEL_CATALOG[owner.modelId].supportSurfaces) {
      const mixerInput={decorationId:'kitchenMixerStand',instanceId:'mixer',offset:{x:.5,y:.6},scale:owner===facingFloorShelf?.7:.8,wallFlipped};
      const mixer=buildNativeRoomWorld({...input,decorations:[mixerInput]}).objects[0];
      const localZ=(board.min[2]+board.max[2])/2+.03;
      const height=owner.position[1]+board.max[1]*owner.scale+.002;
      const anchorHeight=height+(owner===facingFloorShelf
        ?(NATIVE_MODEL_CATALOG[mixer.modelId].center[1]-NATIVE_MODEL_CATALOG[mixer.modelId].min[1])*mixer.scale:0);
      const target=projectWorld([owner.position[0]+Math.sin(owner.heading)*localZ*owner.scale,
        anchorHeight,owner.position[2]+Math.cos(owner.heading)*localZ*owner.scale],width);
      const world={...input,objects:[owner,mixer]};
      const resolver=createRoomPlacementResolver(world),preview=resolver.move('mixer',target);
      assert.equal(preview.object.supportId,owner.instanceId,`${owner.modelId}: mixer targets the stone board`);
      const dropped=resolver.drop('mixer',preview.point);
      assert.equal(dropped.accepted,true,`${owner.modelId}/${board.max[1]}/${wallFlipped}: ${JSON.stringify({position:dropped.feedback?.candidate.position,boundaries:dropped.feedback?.boundaries,blockers:dropped.feedback?.blockers.map(hit=>hit.instanceId)})}`);
      assert.ok(Math.abs(dropped.object.min[1]-height)<1e-6,'Mixer rests on the selected board');
      const size=mixer.scale*width*NATIVE_MODEL_CATALOG[mixer.modelId].renderScale/ROOM_SPAN;
      const offset={x:dropped.point.x/((width-size)/2),y:dropped.point.y/((input.height-size)/2)};
      const ownerInput=owner===counter?counterInput:owner===island?islandInput:owner===facingFloorShelf?facingFloorShelfInput:shelfInput;
      const saved=normalizePlacedDecorations(JSON.parse(JSON.stringify([ownerInput,{...mixerInput,offset}])));
      const restored=buildNativeRoomWorld({...input,decorations:saved}).objects[1];
      assert.equal(restored.supportId,owner.instanceId,'Stone support survives saving and reopening');
      assert.ok(restored.position.every((v,i)=>Math.abs(v-dropped.object.position[i])<1e-8));
    }
  }
}
console.log('Verified all four modern kitchens, square floor shelves, level countertops, built-in fridges on both orientations, shelf levels, mixer placement and support after reload.');

// Different render anchors must not leave adjoining cabinets staggered in depth.
function kitchenPose(object, x, z, width) {
  const center=NATIVE_MODEL_CATALOG[object.modelId].center, c=Math.cos(object.heading), s=Math.sin(object.heading);
  return roomItemAtPoint(object,projectWorld([
    c*x+s*z+(c*center[0]+s*center[2])*object.scale,
    object.position[1]+center[1]*object.scale,
    -s*x+c*z+(-s*center[0]+c*center[2])*object.scale,
  ],width),width);
}
function kitchenLocal(object) {
  const c=Math.cos(object.heading),s=Math.sin(object.heading),meta=NATIVE_MODEL_CATALOG[object.modelId];
  const x=c*object.position[0]-s*object.position[2],z=s*object.position[0]+c*object.position[2];
  return {left:x+meta.min[0]*object.scale,right:x+meta.max[0]*object.scale,back:z+meta.min[2]*object.scale};
}
// A complete purchased kitchen leaves an aisle around a central island.
const { appendPlacedDecoration } = load('@/utils/room-placement');
const { ROOM_CAT_SIZE, ROOM_OBJECT_SCALE } = load('@/constants/room-scale');
const { isFree, findRoomPath } = load('@/utils/native-room-world');
for (const finish of ['White','Sage','Navy','Charcoal']) for (const width of [320,414,768]) for (const wallFlipped of [false,true]) {
  const factor = width / 390;
  const decorations = ['Counter','Sink','Induction','Fridge','FloorShelf','Island']
    .map(piece => ({ ...appendPlacedDecoration([], `kitchenModern${piece}${finish}`)[0], wallFlipped, offset:{x:0,y:0} }));
  const world = buildNativeRoomWorld({width,height:width*1.1,petSize:ROOM_CAT_SIZE*factor,
    sizeScale:ROOM_OBJECT_SCALE*factor,decorations,toys:[]});
  let left = ROOM_PLACEMENT_MIN;
  world.objects = world.objects.map((object,index) => {
    const meta = NATIVE_MODEL_CATALOG[object.modelId];
    if (index === 5) return kitchenPose(object,0,.1,width);
    const placed = kitchenPose(object,left-meta.min[0]*object.scale,
      ROOM_PLACEMENT_MIN-meta.min[2]*object.scale,width);
    left += (meta.max[0]-meta.min[0])*object.scale;
    return placed;
  });
  assert.ok(left <= ROOM_PLACEMENT_MAX,'The full row, including the square shelf, fits on either wall');
  const resolver = createRoomPlacementResolver(world);
  for (const object of world.objects) assert.ok(resolver.canPlace(object),`${object.modelId}: purchased kitchen has no overlap`);
  const local = point => wallFlipped ? [-point[2],point[1],point[0]] : point;
  const front = Math.max(...world.objects.slice(0,5).map(object =>
    Math.max(...[object.min,object.max].map(point => local(point)[2]))));
  const islandBack = Math.min(...[world.objects[5].min,world.objects[5].max].map(point => local(point)[2]));
  assert.ok(islandBack-front >= world.radius*2+world.catScale*.3,`The cat aisle includes body clearance plus room on both sides: ${finish}/${width}/${wallFlipped}, gap ${islandBack-front}, diameter ${world.radius*2}`);
  const aisleZ = (front+islandBack)/2;
  const floorPoint = x => wallFlipped ? [aisleZ,FLOOR_Y,-x] : [x,FLOOR_Y,aisleZ];
  for (let x=-1.4;x<=1.4;x+=.1) assert.ok(isFree(floorPoint(x),world),'The cat can stand along the full aisle');
  const target = floorPoint(1.4), route = findRoomPath(floorPoint(-1.4),target,world);
  assert.ok(route.length>1 && Math.hypot(route.at(-1)[0]-target[0],route.at(-1)[2]-target[2])<1e-6,'The cat can walk between both ends of the kitchen');
}
console.log('Verified purchased kitchens leave a clear cat aisle with an island, every finish, both walls and phone/tablet widths.');

for(const width of [320,414,768]) for(const heading of [0,Math.PI/2,20*Math.PI/180]) for(const side of [-1,1])
  for(const modelId of ['kitchenModernInductionNavy','kitchenModernFridgeWhite',
    ...['White','Sage','Navy','Charcoal'].map(finish=>`kitchenModernFloorShelf${finish}`),
    ...['White','Sage','Navy','Charcoal'].map(finish=>`kitchenModernSink${finish}`)]) {
    const input={width,height:width*1.1,petSize:width/3,sizeScale:width/390,toys:[]};
    const entries=[{decorationId:'kitchenModernCounterCharcoal',instanceId:'fixed',offset:{x:0,y:0}},
      {decorationId:modelId,instanceId:'moving',offset:{x:0,y:0},rotationDegrees:heading*180/Math.PI}];
    const built=buildNativeRoomWorld({...input,decorations:entries});
    const fixed=kitchenPose({...built.objects[0],heading},0,-.8,width),moving=built.objects[1];
    const fixedMeta=NATIVE_MODEL_CATALOG[fixed.modelId],meta=NATIVE_MODEL_CATALOG[moving.modelId];
    const x=side*(fixedMeta.max[0]*fixed.scale+meta.max[0]*moving.scale);
    const z=kitchenLocal(fixed).back-meta.min[2]*moving.scale;
    const attempt=kitchenPose(moving,x+side*.07,z+.09,width);
    const world={...built,objects:[fixed,moving]},resolver=createRoomPlacementResolver(world);
    const preview=resolver.move('moving',roomItemAnchor(attempt,width));
    assert.ok(Math.abs(kitchenLocal(preview.object).back-kitchenLocal(fixed).back-.09)<1e-8,'Drag previews remain free');
    const result=resolver.drop('moving',roomItemAnchor(attempt,width));
    assert.equal(result.accepted,true);
    const aligned=kitchenLocal(result.object),neighbor=kitchenLocal(fixed);
    assert.ok(Math.abs(aligned.back-neighbor.back)<1e-8,`Joined units have matching backs: ${width}/${heading}/${side}/${modelId}, ${aligned.back} vs ${neighbor.back}`);
    assert.ok(Math.abs(side<0?aligned.right-neighbor.left:aligned.left-neighbor.right)<1e-8,'Stone edges touch without a gap or overlap');
    const size=moving.scale*width*meta.renderScale/ROOM_SPAN;
    const saved={...entries[1],offset:{x:result.point.x/((width-size)/2),y:result.point.y/((input.height-size)/2)}};
    const restored=buildNativeRoomWorld({...input,decorations:[saved]}).objects[0];
    assert.ok(restored.position.every((value,i)=>Math.abs(value-result.object.position[i])<1e-8),'Joined cabinet placement survives saving');
    const distant=kitchenPose(moving,x+side*.2,z+.2,width);
    const free=resolver.drop('moving',roomItemAnchor(distant,width));
    assert.equal(free.accepted,true);
    const spaced=kitchenLocal(free.object);
    assert.ok(Math.abs(spaced.back-neighbor.back)>.005,`General edge contact does not force back alignment outside the cabinet alignment range: ${width}/${heading}/${side}/${modelId}, ${spaced.back-neighbor.back}`);
    if(heading===0||heading===Math.PI/2) {
      const wallZ=-2.3075-meta.min[2]*moving.scale;
      const nearWall=kitchenPose(moving,0,wallZ+.08,width);
      const wallDrop=createRoomPlacementResolver({...built,objects:[moving]}).drop('moving',roomItemAnchor(nearWall,width));
      assert.equal(wallDrop.accepted,true);
      assert.ok(Math.abs(kitchenLocal(wallDrop.object).back+2.3075)<1e-6,`Standalone cabinet settles against either wall: ${width}/${heading}/${modelId}, ${kitchenLocal(wallDrop.object).back}`);
    }
    if(heading===0&&side===1) {
      const tiny={...built.objects[0],instanceId:'blocker',scale:.06};
      const center=NATIVE_MODEL_CATALOG[tiny.modelId].center;
      const blocker=kitchenPose(tiny,x+meta.max[0]*moving.scale-.045-center[0]*tiny.scale,
        neighbor.back+.04-center[2]*tiny.scale,width);
      const blocked=createRoomPlacementResolver({...built,objects:[fixed,moving,blocker]});
      assert.equal(blocked.canPlace(kitchenPose(moving,x,z,width)),false,'The aligned pose has a real obstacle');
      assert.equal(blocked.canPlace(attempt),true,'The freely chosen pose clears that obstacle');
      const fallback=blocked.drop('moving',roomItemAnchor(attempt,width));
      assert.equal(fallback.accepted,true,'A blocked snap falls back to a valid unsnapped placement');
      assert.ok(blocked.canPlace(fallback.object),'Any alternative contact clears the blocker and the neighboring cabinet');
    }
  }
console.log('Verified adjoining cabinet edges/back alignment, both walls, free angles, save/reload, free spacing and blocked-snap fallback.');

// A side contact near the wall must not preserve a stepped run of cabinets.
for (const width of [320,414,768]) for (const zoom of [1,2.5]) for (const wallFlipped of [false,true]) {
  const entries = ['FloorShelf','Induction','Sink'].map((piece,index) => ({
    ...appendPlacedDecoration([], `kitchenModern${piece}Navy`)[0], instanceId: `row-${index}`,
    wallFlipped, offset:{x:0,y:0}, scale:1.1,
  }));
  const input = {width,height:width*1.1,petSize:ROOM_CAT_SIZE*width/390,
    sizeScale:ROOM_OBJECT_SCALE*width/390,toys:[],decorations:entries};
  const world = buildNativeRoomWorld(input);
  let left = -1.6;
  world.objects = world.objects.map((object,index) => {
    const meta = NATIVE_MODEL_CATALOG[object.modelId];
    const placed = kitchenPose(object,left-meta.min[0]*object.scale,
      ROOM_PLACEMENT_MIN-meta.min[2]*object.scale+[.03,.095,.22][index],width);
    left += (meta.max[0]-meta.min[0])*object.scale+.02;
    return placed;
  });
  // Fix the middle unit first: both neighbors still have their old wall gaps.
  for (const index of [1,2,0]) {
    const original = world.objects[index], resolver = createRoomPlacementResolver(world);
    assert.equal(original.movable,false,'Cat physics cannot push a kitchen unit');
    const drop = resolver.drop(original.instanceId,roomItemAnchor(original,width),{zoom});
    assert.equal(drop.accepted,true,'The adjoining wall row accepts the drop');
    assert.ok(Math.abs(kitchenLocal(drop.object).back-ROOM_PLACEMENT_MIN)<1e-6,
      `Side snapping aligns to the wall, not the staggered neighbor: ${width}/${zoom}/${wallFlipped}/${index}`);
    world.objects[index] = drop.object;
    const meta = NATIVE_MODEL_CATALOG[original.modelId],size=original.scale*width*meta.renderScale/ROOM_SPAN;
    const restored=buildNativeRoomWorld({...input,decorations:[{...entries[index],offset:{
      x:drop.point.x/((width-size)/2),y:drop.point.y/((input.height-size)/2),
    }}]}).objects[0];
    assert.ok(restored.position.every((v,i)=>Math.abs(v-drop.object.position[i])<1e-6),'Straight row placement survives reload');
  }
  const fronts = world.objects.map(object => object.position[wallFlipped?0:2]
    + Math.max(...NATIVE_MODEL_CATALOG[object.modelId].supportSurfaces.map(board=>board.max[2]))*object.scale);
  assert.ok(Math.max(...fronts)-Math.min(...fronts)<1e-6,'Stone fronts form one straight line');
}
console.log('Verified stepped kitchen rows snap straight against both walls at phone/tablet sizes and zoom levels.');

// An already straight run may stand forward of the wall to clear a window.
// Moving its units or adding a purchase must follow that line, not create a step.
for (const width of [320,414,768]) for (const zoom of [1,2.5])
  for (const wallFlipped of [false,true]) for (const finish of ['White','Sage','Navy','Charcoal']) {
    const entries = ['FloorShelf','Induction','Sink','FloorShelf'].map((piece,index) => ({
      ...appendPlacedDecoration([], `kitchenModern${piece}${finish}`)[0],
      instanceId:`straight-${index}`,wallFlipped,offset:{x:0,y:0},
    }));
    const input={width,height:width*1.1,petSize:width/3,sizeScale:ROOM_OBJECT_SCALE*width/390,toys:[],decorations:entries};
    const world=buildNativeRoomWorld(input),back=ROOM_PLACEMENT_MIN+.21;
    let left=-2.1;
    world.objects=world.objects.map(object=>{
      const meta=NATIVE_MODEL_CATALOG[object.modelId];
      const placed=kitchenPose(object,left-meta.min[0]*object.scale,back-meta.min[2]*object.scale,width);
      left+=(meta.max[0]-meta.min[0])*object.scale;
      return placed;
    });
    const positions=world.objects.map(object=>[...object.position]);
    for (const index of [0,1,2,3]) {
      const original=world.objects[index],local=kitchenLocal(original),meta=NATIVE_MODEL_CATALOG[original.modelId];
      const attempt=kitchenPose(original,local.left-meta.min[0]*original.scale+.04,
        back-meta.min[2]*original.scale+.06,width);
      const resolver=createRoomPlacementResolver(world);
      const drop=resolver.drop(original.instanceId,roomItemAnchor(attempt,width),{zoom});
      assert.equal(drop.accepted,true,'Moving any unit rejoins the established row');
      assert.ok(Math.abs(kitchenLocal(drop.object).back-back)<1e-6,
        `Existing row keeps its clearance: ${width}/${zoom}/${wallFlipped}/${finish}/${index}`);
      assert.ok(drop.object.position.every((v,i)=>Math.abs(v-original.position[i])<1e-6),'Units meet tightly at their existing edges');
      const size=original.scale*width*meta.renderScale/ROOM_SPAN;
      const restored=buildNativeRoomWorld({...input,decorations:[{...entries[index],offset:{
        x:drop.point.x/((width-size)/2),y:drop.point.y/((input.height-size)/2),
      }}]}).objects[0];
      assert.ok(restored.position.every((v,i)=>Math.abs(v-drop.object.position[i])<1e-6),'Existing row clearance survives save/reload');
      assert.ok(world.objects.every((object,i)=>object.position.every((v,axis)=>v===positions[i][axis])),'Snapping does not reposition neighboring units');
    }
    const purchase=world.objects[3],local=kitchenLocal(purchase),meta=NATIVE_MODEL_CATALOG[purchase.modelId];
    const attempt=kitchenPose(purchase,local.left-meta.min[0]*purchase.scale+.07,
      back-meta.min[2]*purchase.scale+.09,width);
    const purchasedWorld={...world,objects:[...world.objects.slice(0,3),attempt]};
    const free=createRoomPlacementResolver(purchasedWorld).nearestFree(attempt);
    assert.ok(free,'There is space for the newly bought unit');
    assert.ok(free.position.every((v,i)=>Math.abs(v-purchase.position[i])<1e-6),'A new purchase snaps into the existing run');
    const overlapping=kitchenPose(purchase,local.left-meta.min[0]*purchase.scale-.04,
      back-meta.min[2]*purchase.scale+.06,width);
    const recovered=createRoomPlacementResolver({...world,objects:[...world.objects.slice(0,3),overlapping]}).nearestFree(overlapping);
    assert.ok(recovered.position.every((v,i)=>Math.abs(v-purchase.position[i])<1e-6),'A nearby purchase overlap resolves to exact row contact');
  }
console.log('Verified existing straight rows retain window clearance when moved or extended by purchases, across finishes, both walls, zoom and device widths.');

// Sink holes are not support surfaces; the stone landing still holds appliances.
for(const finish of ['White','Sage','Navy','Charcoal']) for(const width of [320,414,768]) for(const wallFlipped of [false,true]) {
  const input={width,height:width*1.1,petSize:width/3,sizeScale:width/390,toys:[]};
  const sinkInput={decorationId:`kitchenModernSink${finish}`,instanceId:'sink',offset:{x:0,y:0},wallFlipped};
  const mixerInput={decorationId:'kitchenMixerStand',instanceId:'mixer',offset:{x:.5,y:.5},scale:.7,wallFlipped};
  const built=buildNativeRoomWorld({...input,decorations:[sinkInput,mixerInput]}),[sink,mixer]=built.objects;
  const meta=NATIVE_MODEL_CATALOG[sink.modelId],surfaces=meta.supportSurfaces;
  assert.equal(surfaces.length,4,'Only the four solid slabs around the sink accept countertop objects');
  assert.ok(surfaces.every(top=>top.max[0]<=-.73+.00001||top.min[0]>=.23-.00001
    ||top.max[2]<=-.33+.00001||top.min[2]>=.33-.00001),'No support covers the basin opening');
  const counter=buildNativeRoomWorld({...input,decorations:[{...sinkInput,decorationId:`kitchenModernCounter${finish}`}]}).objects[0];
  assert.ok(Math.abs(sink.scale-counter.scale)<1e-6,'The tap does not change cabinet size relative to neighboring units');
  assert.ok(Math.abs(sink.position[1]+surfaces[0].max[1]*sink.scale-counter.position[1]
    -NATIVE_MODEL_CATALOG[counter.modelId].supportSurfaces[0].max[1]*counter.scale)<1e-6,'Stone countertops remain level');
  const top=surfaces.find(board=>board.min[0]>.2),height=sink.position[1]+top.max[1]*sink.scale+.002;
  const c=Math.cos(sink.heading),s=Math.sin(sink.heading);
  const point=(x,z)=>projectWorld([sink.position[0]+(c*x+s*z)*sink.scale,height,
    sink.position[2]+(-s*x+c*z)*sink.scale],width);
  const resolver=createRoomPlacementResolver(built);
  const preview=resolver.move('mixer',point(.575,0)),drop=resolver.drop('mixer',preview.point);
  assert.equal(preview.object.supportId,'sink');
  assert.equal(drop.accepted,true,'The usable stone landing accepts a mixer');
  assert.ok(Math.abs(drop.object.min[1]-height)<1e-6);
  const size=mixer.scale*width*NATIVE_MODEL_CATALOG[mixer.modelId].renderScale/ROOM_SPAN;
  const saved={...mixerInput,offset:{x:drop.point.x/((width-size)/2),y:drop.point.y/((input.height-size)/2)}};
  const restored=buildNativeRoomWorld({...input,decorations:[sinkInput,saved]}).objects[1];
  assert.equal(restored.supportId,'sink','Countertop support persists after reopening');
  assert.ok(restored.position.every((v,i)=>Math.abs(v-drop.object.position[i])<1e-8));
  assert.equal(resolver.move('mixer',point(-.25,0)).object.supportId,undefined,'The mixer cannot float across the recessed basin');
}
console.log('Verified modern sink units have level matching countertops, four solid supports, open basins, usable appliance landings, both wall orientations and saved support.');

// Corner drops settle both cabinet edges inside the skirting in one release.
for(const width of [320,414,768]) for(const heading of [0,Math.PI/2])
  for(const modelId of ['kitchenModernCounterNavy','kitchenModernFloorShelfSage','kitchenModernSinkWhite','kitchenModernInductionCharcoal','kitchenModernFridgeNavy']) {
    const input={width,height:width*1.1,petSize:width/3,sizeScale:width/390,toys:[]};
    const entry={decorationId:modelId,instanceId:'corner',offset:{x:0,y:0},rotationDegrees:heading*180/Math.PI};
    const built=buildNativeRoomWorld({...input,decorations:[entry]}),unit=built.objects[0],meta=NATIVE_MODEL_CATALOG[modelId];
    const leftWall=-2.3075,cornerX=heading===0?leftWall-meta.min[0]*unit.scale:-leftWall-meta.max[0]*unit.scale;
    const cornerZ=leftWall-meta.min[2]*unit.scale;
    const outward=heading===0?-1:1;
    const attempt=kitchenPose(unit,cornerX+outward*.06,cornerZ-.07,width);
    const resolver=createRoomPlacementResolver(built);
    assert.equal(resolver.canPlace(attempt),false,'The raw corner attempt crosses the skirting');
    const preview=resolver.move('corner',roomItemAnchor(attempt,width));
    assert.ok(preview.object.position.every((v,i)=>Math.abs(v-attempt.position[i])<1e-8),'Corner drag previews still follow the pointer freely');
    const drop=resolver.drop('corner',preview.point);
    assert.equal(drop.accepted,true,`${modelId}/${width}/${heading}: a nearby corner drop settles both edges`);
    assert.ok(resolver.canPlace(drop.object),'A snapped corner cabinet stays inside both walls');
    const local=kitchenLocal(drop.object);
    assert.ok(Math.abs(local.back-leftWall)<1e-6);
    assert.ok(Math.abs((heading===0?local.left:local.right)-(heading===0?leftWall:-leftWall))<1e-6);
    const size=unit.scale*width*meta.renderScale/ROOM_SPAN;
    const saved={...entry,offset:{x:drop.point.x/((width-size)/2),y:drop.point.y/((input.height-size)/2)}};
    const restored=buildNativeRoomWorld({...input,decorations:[saved]}).objects[0];
    assert.ok(restored.position.every((v,i)=>Math.abs(v-drop.object.position[i])<1e-8),'Corner alignment persists after reopening');
    const far=kitchenPose(unit,cornerX+outward*.6,cornerZ-.07,width);
    assert.equal(resolver.drop('corner',roomItemAnchor(far,width)).accepted,false,'A cabinet well outside the room is still rejected');
    const sideOnly=kitchenPose(unit,cornerX+outward*.06,cornerZ+.5,width);
    const sideDrop=resolver.drop('corner',roomItemAnchor(sideOnly,width));
    assert.equal(sideDrop.accepted,true,'A side-wall overrun also settles when the back is intentionally spaced away');
    assert.ok(Math.abs(kitchenLocal(sideDrop.object).back-leftWall-.5)<1e-8,'Side alignment preserves an intentional gap at the back');
    const blocker=kitchenPose({...unit,instanceId:'blocker'},cornerX,cornerZ,width);
    const occupied=createRoomPlacementResolver({...built,objects:[unit,blocker]});
    assert.equal(occupied.drop('corner',roomItemAnchor(attempt,width)).accepted,false,'Corner snapping cannot overlap another cabinet');
  }
console.log('Verified simultaneous corner edge/back alignment, both wall orientations, narrow and full kitchen units, free previews, saved placements, distant edge rejection and occupied corners.');

function shiftPose(object, delta, width) {
  const anchor=roomItemAnchor(object,width),zero=projectWorld([0,0,0],width),shift=projectWorld(delta,width);
  return roomItemAtPoint(object,{x:anchor.x+shift.x-zero.x,y:anchor.y+shift.y-zero.y},width);
}
// A vanity at the end of a wall can cross the adjacent open floor edge by a
// few points. Correct that overrun together with the wall gap at release.
for(const width of [320,414,768]) for(const zoom of [1,2.5]) for(const wallFlipped of [false,true]) {
  const entry={decorationId:'bathroomDoubleVanity',instanceId:'sink',offset:{x:0,y:0},wallFlipped};
  const input={width,height:width*1.1,petSize:width/3,sizeScale:width/390,toys:[],decorations:[entry]};
  const world=buildNativeRoomWorld(input),sink=world.objects[0],footprint=roomItemFootprint(sink);
  const wallAxis=wallFlipped?0:2,edgeAxis=wallFlipped?2:0;
  const delta=[0,0,0];
  delta[wallAxis]=ROOM_PLACEMENT_MIN-Math.min(...footprint.map(p=>p[wallAxis]));
  delta[edgeAxis]=ROOM_PLACEMENT_MAX-Math.max(...footprint.map(p=>p[edgeAxis]));
  const flush=shiftPose(sink,delta,width),resolver=createRoomPlacementResolver(world);
  const zero=projectWorld([0,0,0],width),unit=projectWorld([1,0,0],width);
  const screenUnit=Math.hypot(unit.x-zero.x,unit.y-zero.y)*zoom;
  const overrun=[0,0,0];
  overrun[edgeAxis]=8/screenUnit;
  overrun[wallAxis]=6/screenUnit;
  const attempt=shiftPose(flush,overrun,width),point=roomItemAnchor(attempt,width);
  assert.equal(resolver.canPlace(attempt),false,'The uncorrected vanity really crosses the floor edge');
  assert.ok(resolver.move('sink',point).object.position.every((v,i)=>Math.abs(v-attempt.position[i])<1e-8),'Preview follows the pointer at the edge');
  const drop=resolver.drop('sink',point,{zoom});
  assert.equal(drop.accepted,true,`Vanity settles at the wall end: ${width}/${zoom}/${wallFlipped}`);
  assert.ok(drop.object.position.every((v,i)=>Math.abs(v-flush.position[i])<1e-8),'Wall and floor-edge corrections apply together');
  assert.equal(drop.object.heading,sink.heading);
  const size=sink.scale*width*NATIVE_MODEL_CATALOG[sink.modelId].renderScale/ROOM_SPAN;
  const saved={...entry,offset:{x:drop.point.x/((width-size)/2),y:drop.point.y/((input.height-size)/2)}};
  const restored=buildNativeRoomWorld({...input,decorations:[saved]}).objects[0];
  assert.ok(restored.position.every((v,i)=>Math.abs(v-drop.object.position[i])<1e-8),'Corrected vanity survives save/reload');
  const inside=[0,0,0];inside[edgeAxis]=-8/screenUnit;
  const spaced=shiftPose(flush,inside,width),free=resolver.drop('sink',roomItemAnchor(spaced,width),{zoom});
  assert.ok(free.object.position.every((v,i)=>Math.abs(v-spaced.position[i])<1e-8),'An intentional gap inside the open edge stays unchanged');
  const far=[0,0,0];far[edgeAxis]=11/screenUnit;
  const rejected=resolver.drop('sink',roomItemAnchor(shiftPose(flush,far,width),width),{zoom});
  assert.equal(rejected.accepted,false,'Distant overruns still reject placement');
  assert.ok(rejected.feedback.boundaries.includes(edgeAxis===0?'rightEdge':'frontEdge'));
  const occupied=createRoomPlacementResolver({...world,objects:[sink,{...flush,instanceId:'blocker'}]});
  assert.equal(occupied.drop('sink',point,{zoom}).accepted,false,'Edge correction cannot overlap another fixture');
}
console.log('Verified vanity placement at both wall ends, edge overrun correction, free previews, intentional gaps, save/reload, zoom reach and occupied-edge rejection.');
// The magnet has the same reach in screen points on phones, tablets and zoomed views.
for(const width of [320,414,768]) for(const zoom of [1,2.5]) for(const heading of [0,Math.PI/2,.35])
  for(const modelId of ['shelfWood','chairRockingOak','kitchenModernFloorShelfNavy']) {
    const input={width,height:width*1.1,petSize:width/3,sizeScale:1,toys:[],
      decorations:[{decorationId:modelId,instanceId:'unit',offset:{x:0,y:0},rotationDegrees:heading*180/Math.PI}]};
    const built=buildNativeRoomWorld(input),unit=built.objects[0],footprint=roomItemFootprint(unit);
    const flush=shiftPose(unit,[-2.3075-Math.min(...footprint.map(p=>p[0])),0,-2.3075-Math.min(...footprint.map(p=>p[2]))],width);
    const zero=projectWorld([0,0,0],width),one=projectWorld([1,0,0],width);
    const screenUnit=Math.hypot(one.x-zero.x,one.y-zero.y)*zoom;
    const resolver=createRoomPlacementResolver(built);
    for(const side of [-1,1]) {
      const attempt=shiftPose(flush,[side*9/screenUnit,0,side*9/screenUnit],width);
      const drop=resolver.drop('unit',roomItemAnchor(attempt,width),{zoom});
      assert.equal(drop.accepted,true,`${modelId}/${width}/${zoom}/${heading}: nearby wall gaps and overruns snap`);
      assert.ok(drop.object.position.every((v,i)=>Math.abs(v-flush.position[i])<1e-6),'Both real mesh edges touch the corner');
      assert.equal(drop.object.heading,unit.heading,'Snapping preserves the chosen orientation');
    }
    const far=shiftPose(flush,[-11/screenUnit,0,-11/screenUnit],width);
    assert.equal(resolver.drop('unit',roomItemAnchor(far,width),{zoom}).accepted,false,'Outside the magnet range, boundary errors remain visible');
    const spaced=shiftPose(flush,[11/screenUnit,0,11/screenUnit],width);
    const free=resolver.drop('unit',roomItemAnchor(spaced,width),{zoom});
    assert.equal(free.accepted,true);
    assert.ok(free.object.position.every((v,i)=>Math.abs(v-spaced.position[i])<1e-6),'Gaps beyond the screen range remain intentional');
    const nudge=shiftPose(flush,[8/screenUnit,0,8/screenUnit],width);
    const away=resolver.drop('unit',roomItemAnchor(nudge,width),{zoom,snapInsideWalls:false});
    assert.equal(away.accepted,true);
    assert.ok(away.object.position.every((v,i)=>Math.abs(v-nudge.position[i])<1e-6),'Fine nudges can move away from a snapped wall');
  }
// A neighboring unit with a small back gap must not win over an empty corner.
{
  const width=414,input={width,height:460,petSize:138,sizeScale:1,toys:[],decorations:[
    {decorationId:'kitchenModernCounterNavy',instanceId:'unit',offset:{x:0,y:0}},
    {decorationId:'kitchenModernFridgeNavy',instanceId:'neighbor',offset:{x:0,y:0}}]};
  const built=buildNativeRoomWorld(input),[unit,neighbor]=built.objects,meta=NATIVE_MODEL_CATALOG[unit.modelId];
  const x=-2.3075-meta.min[0]*unit.scale,z=-2.3075-meta.min[2]*unit.scale;
  const fixed=kitchenPose(neighbor,x+meta.max[0]*unit.scale-NATIVE_MODEL_CATALOG[neighbor.modelId].min[0]*neighbor.scale+.1,
    -2.3075-NATIVE_MODEL_CATALOG[neighbor.modelId].min[2]*neighbor.scale+.1,width);
  const resolver=createRoomPlacementResolver({...built,objects:[unit,fixed]});
  const exact=kitchenPose(unit,x,z,width);
  assert.ok(resolver.canPlace(exact),'The exact corner is empty');
  const drop=resolver.drop('unit',roomItemAnchor(kitchenPose(unit,x+.06,z+.07,width),width));
  assert.equal(drop.accepted,true);
  assert.ok(Math.abs(kitchenLocal(drop.object).left+2.3075)<1e-6);
  assert.ok(Math.abs(kitchenLocal(drop.object).back+2.3075)<1e-6,'Corner contact wins over the neighbor back gap');
}
// Wall shelves settle at the inner corner and the open end on either wall.
for(const width of [320,414,768]) for(const zoom of [1,2.5]) for(const wallFlipped of [false,true]) {
  const built=buildNativeRoomWorld({width,height:width*1.1,petSize:width/3,sizeScale:1,toys:[],decorations:[
    {decorationId:'kitchenModernShelfNavy',instanceId:'shelf',offset:{x:0,y:-.5},wallFlipped}]});
  const unit=built.objects[0],axis=unit.wallAxis===0?2:0,zero=projectWorld([0,0,0],width),one=projectWorld(axis===0?[1,0,0]:[0,0,1],width);
  const screenUnit=Math.hypot(one.x-zero.x,one.y-zero.y)*zoom,resolver=createRoomPlacementResolver(built);
  for(const edge of ['start','end']) {
    const distance=edge==='start'?-2.35-unit.min[axis]:2.465-nativeWallPlacementBounds(unit).max[axis];
    const delta=[0,0,0];delta[axis]=distance;
    const flush=shiftPose(unit,delta,width);
    delta[axis]=(edge==='start'?-1:1)*9/screenUnit;
    const attempt=shiftPose(flush,delta,width),drop=resolver.drop('shelf',roomItemAnchor(attempt,width),{zoom});
    assert.equal(drop.accepted,true,`Shelf edge ${edge}/${width}/${zoom}/${wallFlipped}`);
    assert.ok(drop.object.position.every((v,i)=>Math.abs(v-flush.position[i])<1e-6),'Wall shelf keeps mounting depth and height when snapping');
  }
}
console.log('Verified screen-sized wall/corner magnets, zoom, existing furniture, free angles, intentional spacing, fine nudges, corner priority and shelves on both walls.');

// A sink on the left wall meets a corner counter facing the back wall.
for(const width of [320,414,768]) for(const zoom of [1,2.5]) for(const finish of ['White','Sage','Navy','Charcoal']) {
  const entries=[{decorationId:`kitchenModernCounter${finish}`,instanceId:'fixed',offset:{x:0,y:0}},
    {decorationId:`kitchenModernSink${finish}`,instanceId:'sink',offset:{x:0,y:0},wallFlipped:true}];
  const input={width,height:width*1.1,petSize:width/3,sizeScale:1,toys:[],decorations:entries};
  const built=buildNativeRoomWorld(input),[counter,sink]=built.objects;
  const min=(object,axis)=>Math.min(...roomItemFootprint(object).map(p=>p[axis]));
  const fixed=shiftPose(counter,[-2.3075-min(counter,0),0,-2.3075-min(counter,2)],width);
  const stoneFront=fixed.position[2]+NATIVE_MODEL_CATALOG[fixed.modelId].supportSurfaces[0].max[2]*fixed.scale;
  const flush=shiftPose(sink,[-2.3075-min(sink,0),0,stoneFront-min(sink,2)],width);
  const zero=projectWorld([0,0,0],width),one=projectWorld([0,0,1],width),screenUnit=Math.hypot(one.x-zero.x,one.y-zero.y)*zoom;
  const resolver=createRoomPlacementResolver({...built,objects:[fixed,sink]});
  for(const gap of [7,-2]) {
    const attempt=shiftPose(flush,[3/screenUnit,0,gap/screenUnit],width);
    const drop=resolver.drop('sink',roomItemAnchor(attempt,width),{zoom});
    assert.equal(drop.accepted,true,`Corner sink contact ${width}/${zoom}/${finish}/${gap}`);
    assert.ok(Math.abs(min(drop.object,0)+2.3075)<1e-6,'The sink stays against its wall');
    assert.ok(Math.abs(min(drop.object,2)-stoneFront)<1e-6,`The perpendicular stone edges meet without a gap: ${width}/${zoom}/${finish}/${gap}`);
    assert.ok(resolver.canPlace(drop.object),'Tight contact never overlaps either cabinet');
    const size=sink.scale*width*NATIVE_MODEL_CATALOG[sink.modelId].renderScale/ROOM_SPAN;
    const saved={...entries[1],offset:{x:drop.point.x/((width-size)/2),y:drop.point.y/((input.height-size)/2)}};
    const restored=buildNativeRoomWorld({...input,decorations:[saved]}).objects[0];
    assert.ok(restored.position.every((v,i)=>Math.abs(v-drop.object.position[i])<1e-6),'Wall plus neighbor contact survives reload');
  }
  const overlap=shiftPose(flush,[0,0,-2/screenUnit],width);
  const stopped=resolver.drop('sink',roomItemAnchor(overlap,width),{zoom,snapInsideWalls:false});
  assert.equal(stopped.accepted,true,'A fine nudge that crosses a neighbor stops at its edge');
  assert.ok(Math.abs(min(stopped.object,2)-stoneFront)<1e-6);
  const away=shiftPose(flush,[0,0,2/screenUnit],width);
  const nudged=resolver.drop('sink',roomItemAnchor(away,width),{zoom,snapInsideWalls:false});
  assert.ok(nudged.object.position.every((v,i)=>Math.abs(v-away.position[i])<1e-6),'Nudging away does not stick to the neighbor');
}

// Contact is based on solid model parts, for unrelated and rotated furniture.
for(const width of [320,414,768]) for(const zoom of [1,2.5])
  for(const [fixedId,movingId,angle] of [['sofaA','chairRockingOak',0],['sofaA','sofaBlueClassic',25],
    ['kitchenModernFloorShelfNavy','kitchenModernCounterSage',35]]) {
    const entries=[{decorationId:fixedId,instanceId:'fixed',offset:{x:0,y:0}},
      {decorationId:movingId,instanceId:'moving',offset:{x:0,y:0},rotationDegrees:angle}];
    const built=buildNativeRoomWorld({width,height:width*1.1,petSize:width/3,sizeScale:1,toys:[],decorations:entries});
    const [original,moving]=built.objects,fixed=shiftPose(original,[-.5-original.position[0],0,-original.position[2]],width);
    const zero=projectWorld([0,0,0],width),one=projectWorld([1,0,0],width),screenUnit=Math.hypot(one.x-zero.x,one.y-zero.y)*zoom;
    const attempt=shiftPose(moving,[fixed.max[0]+4/screenUnit-moving.min[0],0,fixed.position[2]-moving.position[2]],width);
    const resolver=createRoomPlacementResolver({...built,objects:[fixed,moving]});
    const drop=resolver.drop('moving',roomItemAnchor(attempt,width),{zoom});
    assert.equal(drop.accepted,true,`${fixedId}/${movingId}/${width}/${zoom}`);
    assert.ok(resolver.canPlace(drop.object));
    const delta=drop.object.position.map((v,i)=>v-attempt.position[i]),length=Math.hypot(...delta);
    assert.ok(length>.00001,`Nearby unrelated furniture snaps: ${fixedId}/${movingId}/${width}/${zoom}`);
    const pushed=shiftPose(drop.object,delta.map(v=>v/length*.02),width);
    assert.equal(resolver.canPlace(pushed),false,'Pushing farther crosses a real contact surface, not an enclosing air box');
    assert.equal(drop.object.heading,moving.heading,'Contact does not change the selected angle');
  }
console.log('Verified perpendicular sink/counter joints, simultaneous wall contact, save/reload, fine nudge stops/escape and actual part contact across unrelated rotated furniture.');

for(const width of [320,414,768]) for(const zoom of [1,2.5]) {
  const built=buildNativeRoomWorld({width,height:width*1.1,petSize:width/3,sizeScale:1,toys:[],decorations:[
    {decorationId:'kitchenModernFloorShelfWhite',instanceId:'fixed',offset:{x:0,y:0}},
    {decorationId:'kitchenModernFloorShelfNavy',instanceId:'moving',offset:{x:0,y:0}}]});
  const [original,moving]=built.objects,fixed=shiftPose(original,[-.5-original.position[0],0,-.5-original.position[2]],width);
  const zero=projectWorld([0,0,0],width),one=projectWorld([1,0,0],width),screenUnit=Math.hypot(one.x-zero.x,one.y-zero.y)*zoom;
  const attempt=shiftPose(moving,[fixed.max[0]+3/screenUnit-moving.min[0],0,fixed.max[2]+3/screenUnit-moving.min[2]],width);
  const resolver=createRoomPlacementResolver({...built,objects:[fixed,moving]});
  const drop=resolver.drop('moving',roomItemAnchor(attempt,width),{zoom});
  assert.equal(drop.accepted,true);
  // Rounded stone corners touch slightly inside their enclosing rectangles.
  const gaps=[drop.object.min[0]-fixed.max[0],drop.object.min[2]-fixed.max[2]];
  assert.ok(gaps.every(gap=>gap<=1e-6&&gap>-.02)&&resolver.canPlace(drop.object),'Diagonal gaps settle into valid rounded corner contact');
  assert.equal(resolver.canPlace(shiftPose(drop.object,[-.02,0,-.02],width)),false,'Moving past rounded corner contact intersects the actual stone');
  const far=shiftPose(moving,[fixed.max[0]+16/screenUnit-moving.min[0],0,fixed.max[2]+16/screenUnit-moving.min[2]],width);
  const free=resolver.drop('moving',roomItemAnchor(far,width),{zoom});
  assert.equal(free.accepted,true);
  assert.ok(free.object.position.every((v,i)=>Math.abs(v-far.position[i])<1e-6),'Spacing beyond the screen magnet stays intentional');
}
for(const wallFlipped of [false,true]) for(const side of ['beside','above']) {
  const width=414,built=buildNativeRoomWorld({width,height:460,petSize:138,sizeScale:1,toys:[],decorations:[
    {decorationId:'kitchenModernWallCabinetNavy',instanceId:'fixed',offset:{x:0,y:-.3},wallFlipped},
    {decorationId:'kitchenModernWallCabinetWhite',instanceId:'moving',offset:{x:0,y:-.3},wallFlipped}]});
  const along=wallFlipped?2:0,centering=[0,0,0];
  centering[along]=-(built.objects[0].min[along]+built.objects[0].max[along])/2;
  const [fixed,moving]=built.objects.map(object=>shiftPose(object,centering,width));
  const axis=side==='above'?1:along,delta=[0,0,0];
  const zero=projectWorld([0,0,0],width),basis=[0,0,0];basis[axis]=1;
  const one=projectWorld(basis,width),screenUnit=Math.hypot(one.x-zero.x,one.y-zero.y);
  delta[axis]=fixed.max[axis]+3/screenUnit-moving.min[axis];
  const attempt=shiftPose(moving,delta,width),resolver=createRoomPlacementResolver({...built,objects:[fixed,moving]});
  const drop=resolver.drop('moving',roomItemAnchor(attempt,width));
  assert.equal(drop.accepted,true,`Wall items ${wallFlipped}/${side}`);
  assert.ok(Math.abs(drop.object.min[axis]-fixed.max[axis])<1e-6,'Wall items meet beside or above one another');
  assert.equal(drop.object.position[drop.object.wallAxis],moving.position[moving.wallAxis],'Wall contact retains the mounting plane');
}
console.log('Verified diagonal corner contact, intentional distant spacing and horizontal/vertical joins between wall items on either wall.');

// A contact magnet cannot pull an appliance into the gap between worktops.
{
  const width=414,built=buildNativeRoomWorld({width,height:460,petSize:138,sizeScale:1,toys:[],decorations:[
    {decorationId:'kitchenModernCounterNavy',instanceId:'left',offset:{x:0,y:0}},
    {decorationId:'kitchenModernCounterWhite',instanceId:'right',offset:{x:0,y:0}},
    {decorationId:'lavaLampAni',instanceId:'lamp',offset:{x:.4,y:.4},scale:.7}]});
  const [first,second,lamp]=built.objects,left=shiftPose(first,[-.8-first.position[0],0,-first.position[2]],width);
  const right=shiftPose(second,[left.max[0]+.05-second.min[0],0,left.position[2]-second.position[2]],width);
  const meta=NATIVE_MODEL_CATALOG[lamp.modelId],half=Math.max(...meta.baseHull.map(([x])=>Math.abs(x)))*lamp.scale;
  const on=(owner,x,id)=>{
    const top=NATIVE_MODEL_CATALOG[owner.modelId].supportSurfaces[0],height=owner.position[1]+top.max[1]*owner.scale+.002;
    const point=projectWorld([x,height+(meta.center[1]-meta.min[1])*lamp.scale,owner.position[2]],width);
    return createRoomPlacementResolver({...built,objects:[owner,{...lamp,instanceId:id}]}).move(id,point).object;
  };
  const supported=on(left,left.max[0]-half-.001,'lamp'),neighbor=on(right,right.min[0]+half+.001,'neighbor');
  assert.equal(supported.supportId,'left');assert.equal(neighbor.supportId,'right');
  const resolver=createRoomPlacementResolver({...built,objects:[left,right,supported,neighbor]});
  const drop=resolver.drop('lamp',roomItemAnchor(supported,width));
  assert.equal(drop.accepted,true);
  assert.equal(drop.object.supportId,'left');
  assert.ok(drop.object.position.every((v,i)=>Math.abs(v-supported.position[i])<1e-6),'The lamp stays fully supported instead of snapping across the worktop gap');
}
console.log('Verified object snapping preserves full tabletop support at separated counter edges.');

// A flush window and a countertop tap may overlap in the picture while
// occupying separate depths. Keep real fixture collisions active.
for(const width of [320,414,768]) for(const wallFlipped of [false,true])
  for(const finish of ['White','Sage','Navy','Charcoal']) for(const windowScale of [.7,1.5]) {
  const input={width,height:width*1.1,petSize:width/3,sizeScale:width/390,toys:[],decorations:[
    {decorationId:`kitchenModernSink${finish}`,instanceId:'sink',offset:{x:0,y:0},scale:1.1,wallFlipped},
    {decorationId:'windowPlain',instanceId:'window',offset:{x:0,y:0},scale:windowScale,wallFlipped},
  ]};
  const built=buildNativeRoomWorld(input),normal=wallFlipped?0:2,along=wallFlipped?2:0;
  const sinkDelta=[0,0,0];sinkDelta[normal]=ROOM_PLACEMENT_MIN-built.objects[0].min[normal];
  const sink=shiftPose(built.objects[0],sinkDelta,width),tap=sink.collisionBoxes[0];
  const windowDelta=[0,.4-built.objects[1].min[1],0];
  windowDelta[along]=(tap.min[along]+tap.max[along]-built.objects[1].min[along]-built.objects[1].max[along])/2;
  const window=shiftPose(built.objects[1],windowDelta,width);
  assert.ok(window.min[1]<tap.max[1]&&window.max[1]>tap.min[1],'The window spans the tap height');
  assert.ok(window.max[normal]<tap.min[normal],'Shallow window trim remains behind the actual tap');
  const resolver=createRoomPlacementResolver({...built,objects:[sink,window]});
  assert.equal(resolver.drop('window',roomItemAnchor(window,width)).accepted,true,'A wall window clears the countertop tap on either wall');
  assert.equal(resolver.drop('sink',roomItemAnchor(sink,width)).accepted,true,'Moving the sink uses the same physical clearance');
  const blocker={...window,instanceId:'second-window'};
  assert.equal(createRoomPlacementResolver({...built,objects:[sink,window,blocker]})
    .drop('window',roomItemAnchor(window,width)).accepted,false,'Real overlapping window frames still block placement');
}
console.log('Verified shallow window/tap clearance on both walls, all sink finishes, window sizes, viewports and real frame collisions.');

// The reported chair sits near the wall. Rotating only that instance may
// nudge it inward, while leaving every other saved item exactly where it was.
const diningEntries = [
  {decorationId:'kitchenDiningTable',instanceId:'table',offset:{x:.7579651283871901,y:.12811517440151143},scale:1.1},
  {decorationId:'kitchenChairUpholstered',instanceId:'left',offset:{x:.41806084794320797,y:.08966184177597702},rotationDegrees:118.1},
  {decorationId:'kitchenChairUpholstered',instanceId:'right',offset:{x:.8946879957449176,y:.11800410678215711}},
  {decorationId:'kitchenChairUpholstered',instanceId:'back',offset:{x:.5912700993670853,y:.02850325226910195},rotationDegrees:58},
  {decorationId:'kitchenChairUpholstered',instanceId:'front',offset:{x:.6242201619868812,y:.21841781750862438},rotationDegrees:202.3},
];
const {setRoomItemRotation} = load('@/utils/room-rotation');
for (const width of [390,414]) {
  const options={width,height:width*1.1,petSize:80,sizeScale:1,toys:[],decorations:diningEntries};
  const world=buildNativeRoomWorld(options),check=createRoomPlacementResolver(world),before=world.objects.find(o=>o.instanceId==='right');
  const unchanged=JSON.stringify(world);
  for (const degrees of [30,60,90,118,180,270]) {
    const after=buildNativeRoomWorld({...options,decorations:diningEntries.map(item=>item.instanceId==='right'?{...item,rotationDegrees:degrees}:item)}).objects.find(o=>o.instanceId==='right');
    const turned=check.rotate(before,after);
    assert.ok(turned && check.canPlace(turned),`Reported right chair rotates safely to ${degrees} degrees`);
    const point=roomItemAnchor(turned,width),size=turned.scale*width*NATIVE_MODEL_CATALOG[turned.modelId].renderScale/ROOM_SPAN;
    const offset={x:point.x/((width-size)/2),y:point.y/((options.height-size)/2)};
    const pet={placedDecorations:diningEntries};
    const saved=setRoomItemRotation(pet,{kind:'decoration',decorationId:'kitchenChairUpholstered',instanceId:'right'},degrees,offset);
    const restored=buildNativeRoomWorld({...options,decorations:normalizePlacedDecorations(JSON.parse(JSON.stringify(saved.placedDecorations)))});
    const chair=restored.objects.find(o=>o.instanceId==='right');
    assert.ok(chair.position.every((v,i)=>Math.abs(v-turned.position[i])<1e-8),'The adjusted position and angle survive refresh together');
    assert.ok(createRoomPlacementResolver(restored).canPlace(chair));
    for (const item of diningEntries.filter(item=>item.instanceId!=='right'))
      assert.equal(saved.placedDecorations.find(entry=>entry.instanceId===item.instanceId),item,'Other instances retain their saved positions and angles');
  }
  assert.equal(JSON.stringify(world),unchanged,'Rotation previews never mutate saved furniture');
}
function diningPose(modelId,position,heading=0) {
  const meta=NATIVE_MODEL_CATALOG[modelId],corners=[];
  for(const x of [meta.min[0],meta.max[0]])for(const y of [meta.min[1],meta.max[1]])for(const z of [meta.min[2],meta.max[2]])
    corners.push([position[0]+x*Math.cos(heading)+z*Math.sin(heading),position[1]+y,position[2]-x*Math.sin(heading)+z*Math.cos(heading)]);
  return {modelId,instanceId:modelId,scale:1,heading,position,solid:true,collidable:true,movable:false,
    min:[0,1,2].map(k=>Math.min(...corners.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...corners.map(p=>p[k])))};
}
for (const heading of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5]) {
  const distance=heading===Math.PI/4?1.08:.82;
  const table=diningPose('kitchenDiningTable',[0,FLOOR_Y,0]);
  const chair=diningPose('kitchenChairUpholstered',[-Math.sin(heading)*distance,FLOOR_Y,-Math.cos(heading)*distance],heading);
  const check=createRoomPlacementResolver({width:390,objects:[table,chair]});
  assert.ok(check.canPlace(chair),'The seat fits beneath the round tabletop while the back clears its curved edge');
  const drop=check.drop(chair.instanceId,roomItemAnchor(chair,390));
  assert.ok(drop.accepted && check.canPlace(drop.object),'A tucked drop snaps to real structural contact');
  // Pushing further must still stop at the backrest or table legs.
  const inside=diningPose('kitchenChairUpholstered',[-Math.sin(heading)*.6,FLOOR_Y,-Math.cos(heading)*.6],heading);
  assert.equal(check.canPlace(inside),false,'Chairs cannot pass through the tabletop or its legs');
}
console.log('Verified the reported wall-side chair turns safely, saves angle and position atomically, leaves other instances unchanged and tucks beneath the round tabletop without crossing its legs/backrest.');

// Resizing must not drag the reported floor lamp into the wall.
const lampEntries = JSON.parse(fs.readFileSync('scripts/fixtures/arc-lamp-kitchen.json', 'utf8'));
const lampId = 'pi-mv3k95w8-lz12vw';
const { updatePlacedDecorationScaleByInstance } = load('@/utils/room-placement');
for (const width of [390,414]) {
  const input = {width,height:width*1.1,petSize:80,sizeScale:1.15,toys:[],decorations:lampEntries};
  const world = buildNativeRoomWorld(input), before = world.objects.find(o=>o.instanceId===lampId);
  const candidate = buildNativeRoomWorld({...input,decorations:lampEntries.map(item=>item.instanceId===lampId?{...item,scale:1.7}:item)})
    .objects.find(o=>o.instanceId===lampId);
  const resolver = createRoomPlacementResolver(world);
  assert.equal(resolver.canChange(before,candidate),false,'Keeping the old sprite offset incorrectly pushes the smaller lamp into the wall');
  const smaller = resolver.resize(before,candidate);
  assert.ok(smaller,'The lamp can shrink in the reported kitchen');
  assert.ok(smaller.position.every((v,i)=>Math.abs(v-before.position[i])<1e-8),'The floor base stays exactly in place');
  const point = roomItemAnchor(smaller,width),size = smaller.scale*width*NATIVE_MODEL_CATALOG[smaller.modelId].renderScale/ROOM_SPAN;
  const offset = {x:point.x/((width-size)/2),y:point.y/((input.height-size)/2)};
  const saved = updatePlacedDecorationScaleByInstance(lampEntries,lampId,1.7,offset);
  const restored = buildNativeRoomWorld({...input,decorations:normalizePlacedDecorations(JSON.parse(JSON.stringify(saved)))})
    .objects.find(o=>o.instanceId===lampId);
  assert.ok(restored.position.every((v,i)=>Math.abs(v-smaller.position[i])<1e-8),'Scale and compensated anchor survive save normalization together');
  assert.equal(restored.heading,before.heading);
  for (const item of lampEntries.filter(item=>item.instanceId!==lampId)) assert.equal(saved.find(entry=>entry.instanceId===item.instanceId),item);
}
// Even an empty room must retain the surface beneath a tabletop lamp.
{
  const width=390,input={width,height:420,petSize:80,sizeScale:1.15,toys:[],decorations:[
    {decorationId:'kitchenModernIslandNavy',instanceId:'island',offset:{x:0,y:0}},
    {decorationId:'lampTableMushroom',instanceId:'lamp',offset:{x:0,y:0},scale:1},
  ]};
  let world=buildNativeRoomWorld(input);
  const lamp=world.objects.find(o=>o.instanceId==='lamp'),owner=world.objects[0];
  const meta=NATIVE_MODEL_CATALOG[owner.modelId],lampMeta=NATIVE_MODEL_CATALOG[lamp.modelId];
  const height=owner.position[1]+meta.supportSurfaces[0].max[1]*owner.scale+.002;
  const point=projectWorld([owner.position[0],height+lampMeta.center[1]*lamp.scale,owner.position[2]],width);
  const supported=createRoomPlacementResolver(world).move('lamp',point).object;
  assert.equal(supported.supportId,'island');
  world={...world,objects:[owner,supported]};
  const next=buildNativeRoomWorld({...input,decorations:[input.decorations[0],{...input.decorations[1],scale:.9}]}).objects[1];
  const small=createRoomPlacementResolver(world).resize(supported,next);
  assert.ok(small);assert.equal(small.supportId,'island');
  assert.ok(Math.abs(small.min[1]-supported.min[1])<1e-8,'The lamp still rests on the same countertop');
  assert.ok([0,2].every(i=>Math.abs(small.position[i]-supported.position[i])<1e-8));
}
console.log('Verified the reported arc lamp shrinks without moving into the wall, saves its base and size together, leaves other items untouched and preserves countertop support.');

for (const wallFlipped of [false,true]) {
  const width=390,input={width,height:420,petSize:80,sizeScale:1.15,toys:[],decorations:[
    {decorationId:'windowPlain',instanceId:'window',offset:{x:wallFlipped?-.4:.4,y:-.4},scale:1.5,wallFlipped},
  ]};
  const world=buildNativeRoomWorld(input),before=world.objects[0];
  const after=buildNativeRoomWorld({...input,decorations:[{...input.decorations[0],scale:1.4}]}).objects[0];
  const smaller=createRoomPlacementResolver(world).resize(before,after);
  assert.ok(smaller);
  const along=wallFlipped?2:0;
  for(const axis of [along,1]) assert.ok(Math.abs((before.min[axis]+before.max[axis]-smaller.min[axis]-smaller.max[axis])/2)<1e-8,'Wall mounting center stays fixed');
  assert.equal(smaller.position[smaller.wallAxis],after.position[after.wallAxis],'The frame retains its newly scaled mounting plane');
  const point=roomItemAnchor(smaller,width),size=smaller.scale*width*NATIVE_MODEL_CATALOG[smaller.modelId].renderScale/ROOM_SPAN;
  const saved=updatePlacedDecorationScaleByInstance(input.decorations,'window',1.4,{x:point.x/((width-size)/2),y:point.y/((input.height-size)/2)});
  const restored=buildNativeRoomWorld({...input,decorations:saved}).objects[0];
  assert.ok(restored.position.every((v,i)=>Math.abs(v-smaller.position[i])<1e-8));
}
{
  const width=390,input={width,height:420,petSize:80,sizeScale:1.15,toys:[],decorations:[
    {decorationId:'sofaA',instanceId:'sofa',offset:{x:0,y:0}},
    {decorationId:'kitchenChairUpholstered',instanceId:'chair',offset:{x:0,y:0},scale:.7},
  ]};
  const built=buildNativeRoomWorld(input),sofa=at(built.objects[0],0,-.8,width);
  const large=buildNativeRoomWorld({...input,decorations:[{...input.decorations[1],scale:2.2}]}).objects[0];
  let blocked=false;
  for(let z=-1.5;z<2;z+=.05) {
    const before=at(built.objects[1],0,z,width),world={...built,objects:[sofa,before]},resolver=createRoomPlacementResolver(world);
    if(resolver.canPlace(before)&&!resolver.resize(before,large)){blocked=true;break;}
  }
  assert.ok(blocked,'Resizing still refuses to enlarge a clear item through furniture');
}
console.log('Verified stable mounting centers on both walls, saved wall planes and blocked enlargement into other furniture.');

for (const decorationId of ['kitchenChairUpholstered','sofaA','lampFloorArc','halloweenGhostLantern']) {
  const width=390,input={width,height:420,petSize:80,sizeScale:1.15,toys:[],decorations:[
    {decorationId,instanceId:'item',offset:{x:0,y:0},scale:1.1,rotationDegrees:37},
  ]};
  const world=buildNativeRoomWorld(input),before=world.objects[0];
  const after=buildNativeRoomWorld({...input,decorations:[{...input.decorations[0],scale:1}]}).objects[0];
  const smaller=createRoomPlacementResolver(world).resize(before,after);
  assert.ok(smaller,decorationId);
  assert.ok(smaller.position.every((v,i)=>Math.abs(v-before.position[i])<1e-8),'Floor model origin stays grounded even if its mesh has small foot clearance');
  const point=roomItemAnchor(smaller,width),size=smaller.scale*width*NATIVE_MODEL_CATALOG[smaller.modelId].renderScale/ROOM_SPAN;
  const saved=updatePlacedDecorationScaleByInstance(input.decorations,'item',1,{x:point.x/((width-size)/2),y:point.y/((input.height-size)/2)});
  const restored=buildNativeRoomWorld({...input,decorations:normalizePlacedDecorations(JSON.parse(JSON.stringify(saved)))}).objects[0];
  assert.ok(restored.position.every((v,i)=>Math.abs(v-smaller.position[i])<1e-8),decorationId+' retains its resized floor position through refresh');
}
console.log('Verified stable grounded model origins and saved offsets for chairs, sofas, floor lamps and small lanterns.');

// The reported bedroom rug can grow beyond 2.2x without leaving the floor.
for (const width of [320,390,768]) for (const rotationDegrees of [0,90]) {
  const input = {width,height:width*1.1,petSize:80,sizeScale:width/390*1.15,toys:[],
    decorations:[{decorationId:'bedroomRug',instanceId:'large-bedroom-rug',offset:{x:0,y:.3},scale:2.2,rotationDegrees}]};
  let saved = input.decorations;
  let priorWidth;
  for (let tenths=23;tenths<=44;tenths++) {
    const scale=tenths/10, world=buildNativeRoomWorld({...input,decorations:saved});
    const before=world.objects[0];
    const after=buildNativeRoomWorld({...input,decorations:[{...saved[0],scale}]}).objects[0];
    const resized=createRoomPlacementResolver(world).resize(before,after);
    if (!resized) {
      const footprint=roomItemFootprint(after).map(point=>point.map((v,i)=>v+before.position[i]-after.position[i]));
      assert.ok(footprint.some(point=>[0,2].some(axis=>point[axis]<ROOM_PLACEMENT_MIN-.00001||point[axis]>ROOM_PLACEMENT_MAX+.00001)),
        'Further enlargement stops when the rug would cross a floor edge at its current position');
      assert.ok(saved[0].scale>=4,'The rug grows well beyond its old maximum before filling the floor');
      break;
    }
    const point=roomItemAnchor(resized,width),size=resized.scale*width*NATIVE_MODEL_CATALOG[resized.modelId].renderScale/ROOM_SPAN;
    saved=normalizePlacedDecorations(JSON.parse(JSON.stringify(updatePlacedDecorationScaleByInstance(saved,'large-bedroom-rug',scale,
      {x:point.x/Math.max(1,(width-size)/2),y:point.y/Math.max(1,(input.height-size)/2)}))));
    const restored=buildNativeRoomWorld({...input,decorations:saved}).objects[0];
    assert.ok(restored.position.every((v,i)=>Math.abs(v-resized.position[i])<1e-7),'Large rugs retain their fitted anchors after reload');
    assert.equal(saved[0].scale,scale);
    const measuredWidth=restored.max[0]-restored.min[0];
    if(priorWidth)assert.ok(measuredWidth>priorWidth,'Every Bigger step visibly enlarges the model');
    priorWidth=measuredWidth;
  }
}
console.log('Verified the bedroom rug grows from 2.2× past 4× on phones/tablets, preserves its saved anchor and stops at the floor boundary.');
