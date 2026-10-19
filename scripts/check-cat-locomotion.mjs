/** Exercise the shipped planner and motion sampler, including multi-surface routes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache = new Map();
function load(id) {
  if (/\.(png|webp|glb|mp4)$/.test(id)) return id;
  const file = path.resolve(id.startsWith('@/') ? id.slice(2) : id);
  const resolved = fs.existsSync(file) ? file : ['.ts','.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved,id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved,module);
  if (resolved.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(resolved,'utf8'));
  else vm.runInNewContext(ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,
    { module,exports:module.exports,require:load,Math,Date,Set,Map });
  return module.exports;
}
const w=load('@/utils/native-room-world'), motion=load('@/utils/native-cat-locomotion'), traversal=load('@/utils/native-cat-traversal');
const floor=w.FLOOR_Y;
const world={width:390,height:420,catScale:.45,radius:.30,home:[-1.4,floor,0],objects:[]};
const barrier={instanceId:'books',modelId:'booksPile',scale:1,heading:0,position:[0,floor,0],solid:true,movable:false,
  min:[-.12,floor,-2.5],max:[.12,floor+.20,2.5]};
const blocked={...world,objects:[barrier]}, target=[1.4,floor,0];
assert.equal(w.findRoomPath(world.home,target,blocked).length,1,'The floor-only route is blocked');
const route=w.findCatRoomRoute(world.home,target,blocked);
assert.ok(route.legs?.some(leg=>leg.kind==='hop'),'A low obstacle is crossed as a route connection');
assert.deepEqual(Array.from(route.path.at(-1)),target);
for(const leg of route.legs.filter(leg=>leg.kind==='hop'))assert.ok(traversal.catFlightClear(leg.path[0],leg.path.at(-1),leg.arcHeight,blocked));
const tall={...blocked,objects:[{...barrier,max:[.12,2,2.5]}]};
assert.equal(w.findCatRoomRoute(world.home,target,tall).path.length,1,'An unsafe high obstacle has no invented jump');
const clear=w.findCatRoomRoute(world.home,target,world);
assert.equal(clear.legs,undefined,'A clear floor route does not add unnecessary jumps');

// Real mesh-derived seat/backrest colliders, with side walls preventing a floor detour.
for(const decorationId of ['kitchenChairWindsor','chairRockingOak'])for(const rotationDegrees of [0,90,180,270]) {
  const room=w.buildNativeRoomWorld({width:390,height:420,petSize:80,sizeScale:1.15,decorations:[{decorationId,instanceId:'chair',scale:1.5,offset:{x:0,y:0},rotationDegrees}],toys:[]});
  const chair=room.objects[0], s=Math.sin(chair.heading), c=Math.cos(chair.heading);
  const axis=Math.abs(s)>.5?2:0;
  const walls=[-1,1].map(sign=>({instanceId:'wall'+sign,modelId:'barrier',scale:1,heading:0,position:[0,0,0],solid:true,movable:false,
    min:axis===0?[sign<0?-2.5:chair.max[0]+.02,floor,chair.min[2]]:[chair.min[0],floor,sign<0?-2.5:chair.max[2]+.02],
    max:axis===0?[sign<0?chair.min[0]-.02:2.5,3,chair.max[2]]:[chair.max[0],3,sign<0?chair.min[2]-.02:2.5]}));
  const testWorld={...room,objects:[chair,...walls]};
  const start=[chair.seat[0]+s*1.5,floor,chair.seat[2]+c*1.5], end=[chair.seat[0]-s*1.5,floor,chair.seat[2]-c*1.5];
  assert.ok(w.isFree(start,testWorld)&&w.isFree(end,testWorld));
  assert.equal(w.findRoomPath(start,end,testWorld).length,1);
  const links=traversal.buildCatTraversalLinks(testWorld,p=>w.isFree(p,testWorld));
  const result=w.findCatRoomRoute(start,end,testWorld);
  assert.ok(result.legs?.filter(leg=>leg.kind==='hop').length>=2,`${rotationDegrees}: floor → seat → over backrest → floor (${links.length} links, cat ${room.catScale}, chair ${chair.scale})`);
  assert.ok(result.legs.some(leg=>leg.kind==='walk'&&leg.path[0][1]>floor+.1),'The cat repositions on the seat');
  for(const leg of result.legs.filter(leg=>leg.kind==='hop'))assert.ok(traversal.catFlightClear(leg.path[0],leg.path.at(-1),leg.arcHeight,testWorld));
  // Block the landing, keeping the same instance positions. Regenerate all links.
  const landing=result.legs.filter(leg=>leg.kind==='hop').at(-1).path.at(-1);
  const closed={...testWorld,objects:[...testWorld.objects,{...barrier,instanceId:'landing-blocker',min:[landing[0]-.3,floor,landing[2]-.3],max:[landing[0]+.3,3,landing[2]+.3]}]};
  assert.ok(!traversal.buildCatTraversalLinks(closed,p=>w.isFree(p,closed)).some(link=>w.pathLength([link.to,landing])<.05),'A new obstruction invalidates its previously valid landing');
}

const duration=route.legs.reduce((sum,leg)=>sum+leg.duration,0);
for(const fps of [30,60,120]) {
  let previous=world.home, greatest=0;
  for(let frame=0;frame<=Math.ceil(duration*fps);frame++) {
    const sample=motion.catMotionSample(route.legs,frame/fps);
    const distance=w.pathLength([previous,sample.position]);greatest=Math.max(greatest,distance);
    assert.ok(sample.position.every(Number.isFinite));
    assert.ok(distance<.15,'Traversal cannot teleport between legs');previous=sample.position;
  }
  assert.ok(w.hasNativeArrived(previous,target));
}
const progress=motion.catTravelProgress;
assert.equal(progress(0,2),0);assert.equal(progress(2,2),1);
assert.ok(progress(.05,2)<.05/2,'Movement accelerates gradually');
assert.ok(1-progress(1.95,2)<.05/2,'Movement brakes before arrival');
const corner=[[-1,floor,0],[0,floor,0],[0,floor,1]];
const rounded=motion.roundCatPath(corner,.2,()=>true);
assert.ok(rounded.length>corner.length);
const rejected=motion.roundCatPath(corner,.2,()=>false);
assert.deepEqual(JSON.parse(JSON.stringify(rejected)),corner,'Smoothing never cuts an obstructed corner');
assert.ok(motion.catWalkTiming(corner,.45).duration>motion.catWalkTiming([[-1,floor,0],[1,floor,0]],.45).duration,'Turns receive more time than a straight route of the same length');

// Repeatable room variations catch cases that a single carefully arranged room misses.
let seed=731;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let run=0;run<24;run++) {
  const objects=Array.from({length:4},(_,index)=>{
    const x=random()*2.8-1.4,z=random()*2.8-1.4,width=.1+random()*.3,depth=.1+random()*.3;
    return {...barrier,instanceId:'obstacle-'+index,min:[x-width,floor,z-depth],max:[x+width,floor+.1+random()*.3,z+depth]};
  });
  const room={...world,objects},start=w.nearestFree([-1.7,floor,-1.5],room),end=w.nearestFree([1.7,floor,1.5],room);
  const result=w.findCatRoomRoute(start,end,room);
  if(result.legs)for(const leg of result.legs) {
    if(leg.kind==='hop')assert.ok(traversal.catFlightClear(leg.path[0],leg.path.at(-1),leg.arcHeight,room));
    else for(let i=1;i<leg.path.length;i++)for(let t=0;t<=1;t+=.05)
      assert.ok(w.isFree(leg.path[i-1].map((v,k)=>v+(leg.path[i][k]-v)*t),room),'Randomized walking legs remain outside furniture');
  }
  else for(let i=1;i<result.path.length;i++)for(let t=0;t<=1;t+=.05)
    assert.ok(w.isFree(result.path[i-1].map((v,k)=>v+(result.path[i][k]-v)*t),room),'Randomized routes never cut through an obstacle');
  assert.deepEqual(JSON.parse(JSON.stringify(w.findCatRoomRoute(start,end,JSON.parse(JSON.stringify(room))))),JSON.parse(JSON.stringify(result)),'Saving/reloading a layout preserves its route');
}
console.log('Verified floor/seat/backrest traversal, low hops, unsafe jumps, all four rotations, acceleration, braking, collision-safe corners and continuous 30/60/120 FPS trajectories.');
console.log('Verified 24 seeded obstacle layouts, collision-free walking/flight and deterministic routes after save/reload.');

// An overhead panel and separate legs expose real empty space below a table.
const panel={min:[-.13,floor+.78,-2.5],max:[.13,floor+.87,2.5]};
const supports=[-1,1].map(sign=>({min:[-.13,floor,sign<0?-2.5:2.3],max:[.13,floor+.78,sign<0?-2.3:2.5]}));
const table={...barrier,instanceId:'underpass',modelId:'tableCoffeeGlass',max:panel.max,collisionBoxes:[panel,...supports]};
const crawlWorld={...world,objects:[table]};
const under=w.findCatRoomRoute(world.home,target,crawlWorld);
assert.ok(under.legs?.some(leg=>leg.animation==='crawl'),'A real opening under a table is usable');
assert.deepEqual(Array.from(under.path.at(-1)),target);
for(const leg of under.legs.filter(leg=>leg.animation==='crawl')) {
  assert.ok(traversal.catCrawlClear(leg.path[0],leg.path.at(-1),crawlWorld),'Every low passage clears the torso, head and supports');
  for(const fps of [30,60,120])for(let frame=0;frame<=Math.ceil(leg.duration*fps);frame++) {
    const sample=motion.catMotionSample([leg],frame/fps);
    assert.equal(sample.animation,'crawl');assert.ok(sample.position.every(Number.isFinite));
  }
}
const lowered={...crawlWorld,objects:[{...table,collisionBoxes:[{...panel,min:[-.13,floor+.4,-2.5]},...supports]}]};
assert.ok(!traversal.buildCatTraversalLinks(lowered,p=>w.isFree(p,lowered)).some(link=>link.leg.animation==='crawl'),'A panel that is too low cannot produce a crawl');
const door={...barrier,instanceId:'door',modelId:'door',solid:false,collidable:true,min:[-.2,floor,-.2],max:[.2,floor+1,.2],interactionBoxes:[{min:[-.2,floor,-2.5],max:[.2,floor+1,2.5]}]};
assert.ok(!traversal.catCrawlClear([-1,floor,0],[1,floor,0],{...crawlWorld,objects:[table,door]}),'Open-door geometry blocks a passage too');
const plainLow={...barrier,modelId:'lowBench',instanceId:'low-unknown'};
assert.ok(traversal.buildCatTraversalLinks({...world,objects:[plainLow]},p=>w.isFree(p,{...world,objects:[plainLow]})).some(link=>link.leg.kind==='hop'),'Low safe obstacles do not need a model-name exception');
console.log('Verified low passages, full-body clearance, lowered ceilings, open doors, ordinary low obstacles and crawl sampling at 30/60/120 FPS.');
