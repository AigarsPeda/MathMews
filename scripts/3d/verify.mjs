/** Check complete catalog coverage, valid atlas bounds, and pet-state transitions. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import sharp from 'sharp';
const root=process.cwd(),cache=new Map();
function load(relative){
 const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 if(file.endsWith('.json')){module.exports=JSON.parse(fs.readFileSync(file,'utf8'));return module.exports;}
 const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 function require(ref){
  if(ref==='react')return {};
  const resolved=ref.startsWith('@/')?path.join(root,ref.slice(2)):path.resolve(path.dirname(file),ref);
  if(/\.(png|gif|webp|mp4)$/.test(resolved)){assert.ok(fs.existsSync(resolved),'Missing asset '+ref);return path.relative(root,resolved);}
  assert.ok(ref.startsWith('@/')||ref.startsWith('.'),'Unexpected import '+ref);
  return load(fs.existsSync(resolved)?resolved:resolved+'.ts');
 }
 vm.runInNewContext(compiled,{exports:module.exports,module,require,Date,Math,Map,Set,console,queueMicrotask},{filename:file});return module.exports;
}
const inventory=JSON.parse(fs.readFileSync('scripts/3d/inventory.json','utf8')).entries;
assert.equal(new Set(inventory.map(entry => entry.id)).size, inventory.length, 'Inventory IDs must be unique');
const decor=load('constants/cat-decorations.ts'),beds=load('constants/cat-beds.ts'),toys=load('constants/cat-toys.ts'),rooms=load('constants/cat-rooms.ts');
for(const entry of inventory){
 const source=entry.kind==='decoration'?decor.CAT_DECORATION_CATALOG[entry.id]?.source:entry.kind==='room'?rooms.CAT_ROOM_SOURCES[entry.id]:entry.kind==='bed'?beds.CAT_BED_SOURCES[entry.id.slice(4)]:toys.getCatToySource(entry.id.slice(4));
 assert.ok(source?.startsWith('assets/3d/'),`Unmigrated ${entry.id}`);
 if(entry.kind==='decoration')assert.equal(decor.getDecorationDisplaySize(entry.id),entry.displaySize);
 const metadata=await sharp(source).metadata();assert.equal(metadata.format,'png');assert.ok(metadata.hasAlpha);
}
assert.equal(load('constants/decoration-variants.ts').canFlipWallDecoration('bathroomWcAni'),true);
const variants=load('constants/decoration-variants.ts');
for(const id of variants.WALL_FACING_DECORATION_IDS){
 assert.ok(id in decor.CAT_DECORATION_CATALOG,`Invalid wall-facing catalog ID ${id}`);
 assert.equal(variants.canFlipWallDecoration(id),true,`Missing other-wall control ${id}`);
 const placed={instanceId:'orientation-check',decorationId:id,rotationIndex:0,wallFlipped:true};
 assert.equal(variants.getPlacedDecorationWallFlipped(placed),true,`Lost saved wall facing ${id}`);
 assert.equal(variants.getPlacedDecorationWallFlipped({...placed,wallFlipped:false}),false,`Cannot face original wall ${id}`);
 assert.equal(variants.getPlacedDecorationSpriteId(placed),id,`Wall facing changed item/style ${id}`);
}
for(const entry of inventory.filter(e=>e.kind==='decoration'&&/poster|window|canvas|diploma|pictureframe|portrait|photos|shelving|longshelf|smallshelf|mirror|corkboard|aircon|^officeAc$|ClockAni|ProjectorScreen/i.test(e.id))){
 assert.equal(variants.canFlipWallDecoration(entry.id),true,`Wall-mounted item cannot face both walls: ${entry.id}`);
}
// A portrait's non-square alpha bounds must not introduce black letterboxing.
const icon=await sharp('assets/images/icon.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(icon.info.width,1024);assert.equal(icon.info.height,1024);
for(let i=3;i<icon.data.length;i+=4)assert.equal(icon.data[i],255,'iOS icon must be fully opaque');
for(const x of [120,900])for(let y=140;y<885;y++){
 const i=(y*1024+x)*4;
 assert.ok(icon.data[i]+icon.data[i+1]+icon.data[i+2]>80,'Black letterbox stripe in app icon');
}
const splash=await sharp('assets/images/splash-brand.png').metadata();
assert.ok(splash.width>=640&&splash.height>=640,'Native splash is missing its branded image');
const splashPortrait = await sharp('assets/3d/cat-splash.png').metadata();
assert.equal(splashPortrait.width, 192);assert.equal(splashPortrait.height, 192);assert.ok(splashPortrait.hasAlpha);
console.log(`Verified both-wall controls for ${variants.WALL_FACING_DECORATION_IDS.length} additional items and launch branding.`);
const {catModelRegistry: registry, createBoxPlayScenario} = load('pet-display/registry/cat-model-registry.ts');
const {buildBoxPlaySequence} = load('constants/cat-box-play.ts');
assert.deepEqual(Array.from(buildBoxPlaySequence()), ['box1','box2','box3']);
const boxStory = createBoxPlayScenario(buildBoxPlaySequence());
assert.equal(boxStory.steps.length, 3);
for (const step of boxStory.steps) assert.equal(step.loop, false);
for (const reaction of ['correct','incorrect','eating','excited','playBall','playYarn','playFeather']) assert.equal(registry.getSegment(reaction).loop, false);
assert.equal(registry.mediaKind, 'model');
assert.notEqual(registry.getSegment('correct').assetKey, registry.getSegment('incorrect').assetKey);
for (const [id, maxDuration] of [['wakeUp',850],['standUp',700]]) {
 const step=registry.getScenario(id).steps[0];
 assert.equal(step.reverse, true);assert.equal(step.loop, false);
 assert.ok(step.model.duration / step.model.rate * 1000 <= maxDuration, `${id} responds too slowly`);
}
assert.equal(registry.getScenario('fallAsleep').steps[0].model.rate, 1);
for(const entry of inventory.filter(e=>e.animated||['toy-orangeBall','toy-blueBall','toy-pinkBall','toy-mouse'].includes(e.id))){
 const hashes=new Set();const atlas=`assets/3d/atlases/${entry.id}.png`;
 for(let i=0;i<8;i++)hashes.add((await sharp(atlas).extract({left:i*192,top:0,width:192,height:192}).raw().toBuffer()).toString('base64'));
 assert.ok(hashes.size>1,`${entry.id} has no motion`);
}
const mood=load('pet-display/engine/derive-mood.ts');const now=1_000_000_000;
const pet={type:'cat',lastInteractionAt:now,lastCareAt:now,stats:{hunger:80,happiness:80,cleanliness:80,level:1}};
assert.equal(mood.derivePetVideoMood(pet,false,now,false),'idle');
const resting={...pet,lastInteractionAt:now-4*60*1000};
assert.equal(mood.derivePetVideoMood(resting,false,now,false),'lyingDown');
assert.equal(mood.derivePetVideoMood(resting,false,now,true),'resting');
const sleepy={...pet,lastInteractionAt:now-31*60*1000};
assert.equal(mood.derivePetVideoMood(sleepy,false,now,false),'lyingDown');
assert.equal(mood.derivePetVideoMood(sleepy,false,now,true),'fallingAsleep');
assert.equal(mood.derivePetVideoMood(sleepy,true,now,true),'sleeping');
assert.equal(mood.derivePetMood({...pet,stats:{...pet.stats,hunger:10}},now),'sad');
assert.equal(mood.derivePetVideoMood(pet,false,now,false),'idle');
console.log(`Verified ${inventory.length} catalog thumbnails, ${inventory.filter(e=>e.animated).length} animated thumbnails and rest/sleep/wake states.`);

const {advanceSpritePlayback:advance}=load('utils/sprite-playback.ts');
for (const refreshRate of [30,60,120]) {
 let state={frame:0,elapsed:0};
 for(let i=0;i<refreshRate*2;i++)state=advance(state.frame,state.elapsed,1000/refreshRate,8,12);
 assert.equal(state.frame,0,'Thumbnail cadence must match at different refresh rates');
 assert.ok(state.elapsed<1e-5);
}
assert.equal(advance(0,0,0,8,12).frame,0,'Paused clock preserves progress');
assert.equal(advance(7,0,1000/12,8,12).frame,0,'Thumbnail loop wraps to its first frame');
assert.equal(advance(0,0,1000,8,12).frame,1,'Slow frames cannot skip through a full loop');
console.log('Verified thumbnail cadence, loop wrapping and pause behavior.');
await import('../check-asset-budget.mjs');
