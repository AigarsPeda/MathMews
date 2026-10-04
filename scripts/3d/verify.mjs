/** Check complete catalog coverage, valid atlas bounds, and pet-state transitions. */
import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const root=process.cwd(),cache=new Map();
const blenderRoot=path.resolve(process.env.BRAINPET_BLENDER_ASSET_DIR||path.join(root,'..','BrainPet-blender-assest'));
function load(relative){
 const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
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
assert.equal(inventory.length,288,'Inventory ID count changed');
const decor=load('constants/cat-decorations.ts'),beds=load('constants/cat-beds.ts'),toys=load('constants/cat-toys.ts'),rooms=load('constants/cat-rooms.ts');
for(const entry of inventory){
 assert.ok(fs.existsSync(path.join(blenderRoot,entry.kind==='room'?'rooms':'items',`${entry.id}.blend`)),`Missing editable model ${entry.id} in ${blenderRoot}. Restore the Blender library or run npm run assets:3d -- --refresh.`);
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
const splashPortrait=await sharp('assets/3d/cat-splash.png').ensureAlpha().raw().toBuffer();
const splashFrame=await sharp('assets/3d/atlases/cat-orange-idle.png').extract({left:0,top:0,width:192,height:192}).ensureAlpha().raw().toBuffer();
assert.deepEqual(splashPortrait,splashFrame,'Splash portrait must match the first idle animation cell');
console.log(`Verified both-wall controls for ${variants.WALL_FACING_DECORATION_IDS.length} additional items and launch branding.`);
const {getCatSpriteAnimations}=load('pet-display/registry/cat-sprite-atlas.ts');
const {createCatSpriteRegistry}=load('pet-display/registry/cat-sprite-registry.ts');
const {buildBoxPlaySequence}=load('constants/cat-box-play.ts');
const {createBoxPlayScenario}=load('pet-display/registry/cat-sprite-registry.ts');
assert.deepEqual(Array.from(buildBoxPlaySequence()),['box1','box2','box3'],'Box story must jump, peek, then settle');
for(const skin of ['orange','grey','white']){
 const clips=getCatSpriteAnimations(skin);const registry=createCatSpriteRegistry(skin);
 const boxStory=createBoxPlayScenario(skin,buildBoxPlaySequence());
 assert.equal(boxStory.steps.length,3);
 for(const step of boxStory.steps)assert.equal(step.loop,false,'Box story must advance through one-shot clips');
 for(const [id,clip] of Object.entries(clips)){
  const sources=clip.pages??[clip.source];
  assert.equal(sources.length,Math.ceil(clip.frames.length/(clip.framesPerPage??clip.frames.length)),`${skin}/${id} page count`);
  for(const source of sources){const metadata=await sharp(source).metadata();assert.equal(metadata.width,clip.sheetWidth,id);assert.equal(metadata.height,clip.sheetHeight,id);}
  assert.ok(clip.sheetWidth*clip.sheetHeight*4<=9*1024*1024,`${skin}/${id} exceeds texture page budget`);
  const hashes=new Set();
  let decodedSource=null,decodedPixels=null;
  for(const [index,frame] of clip.frames.entries()){
   const source=sources[Math.floor(index/(clip.framesPerPage??clip.frames.length))];
   const w=clip.frameWidth,h=clip.frameHeight;
   if(source!==decodedSource){decodedPixels=await sharp(source).ensureAlpha().raw().toBuffer();decodedSource=source;}
   const pixels=Buffer.allocUnsafe(w*h*4);
   for(let y=0;y<h;y++){
    const start=((frame.row*h+y)*clip.sheetWidth+frame.col*w)*4;
    decodedPixels.copy(pixels,y*w*4,start,start+w*4);
   }
   let occupied=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)occupied++;
   assert.ok(occupied>w*h*.04,`${skin}/${id} contains an empty frame`);
   for(let x=0;x<w;x++)assert.ok(pixels[x*4+3]<30&&pixels[((h-1)*w+x)*4+3]<30,`${skin}/${id} clipped vertically`);
   const t=index/(clip.frames.length-1);
   const slidesAtLeft=id==='eating'&&(t<.125||t>.875)||id==='box1'&&t<.25||id==='box3'&&t>.75||['ballToss','yarnRoll','featherChase'].includes(id)&&(t<.15||t>.85);
   for(let y=0;y<h;y++){
    if(!slidesAtLeft)assert.ok(pixels[y*w*4+3]<30,`${skin}/${id} clipped on left outside prop slide`);
    assert.ok(pixels[(y*w+w-1)*4+3]<30,`${skin}/${id} clipped on right`);
   }
   hashes.add(createHash('sha256').update(pixels).digest('hex'));
  }
  assert.ok(hashes.size>1,`${skin}/${id} has no motion`);
 }
 for(const reaction of ['correct','incorrect','eating','excited','playBall','playYarn','playFeather'])assert.equal(registry.getSegment(reaction).loop,false);
 assert.notEqual(registry.getSegment('correct').sprite.source,registry.getSegment('incorrect').sprite.source);
 assert.equal(registry.getScenario('wakeUp').steps[0].sprite.reverse,true);
 assert.equal(registry.getScenario('standUp').steps[0].sprite.reverse,true);
 for(const [id,maxDuration] of [['wakeUp',850],['standUp',700]]){
  const step=registry.getScenario(id).steps[0];
  assert.equal(step.loop,false,`${skin}/${id} must finish before the care action`);
  assert.ok(step.sprite.frames.length/step.sprite.fps*1000<=maxDuration,`${skin}/${id} responds too slowly`);
 }
 assert.equal(registry.getScenario('fallAsleep').steps[0].sprite.fps,24,'Going to sleep keeps its gentle timing');
}
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
console.log(`Verified ${inventory.length} retained item IDs, ${Object.keys(getCatSpriteAnimations('orange')).length*3} moving cat clips, 28 moving objects, atlas bounds and rest/sleep/wake states.`);

const {advanceSpritePlayback:advance}=load('pet-display/media/sprite/sprite-playback.ts');
for(const reverse of [false,true]){
 let state={frame:reverse?47:0,elapsed:0,finished:false};
 for(let i=0;i<120;i++)state=advance(state.frame,state.elapsed,1000/60,48,24,reverse,false,4,Array.from({length:12},(_,i)=>i));
 assert.equal(state.finished,true,'One-shot finishes at its authored duration');
 assert.equal(state.frame,reverse?0:47,'Forward/reverse hold their final frame');
}
assert.equal(advance(3,0,1000/24,8,24,false,true,4,[0]).frame,3,'Missing next page holds last decoded frame');
assert.equal(advance(3,0,1000/24,8,24,false,true,4,[0,1]).frame,4,'Preloaded next page advances normally');
assert.equal(advance(7,0,1000/24,8,24,false,true,4,[0,1]).frame,0,'Loop returns to first page');
assert.equal(advance(4,0,1000/24,8,24,true,true,4,[0,1]).frame,3,'Reverse crosses pages backwards');
assert.equal(advance(0,0,0,8,24,false,true,4,[0,1]).frame,0,'Paused clock preserves progress');
console.log('Verified paged playback, reverse completion, texture budgets and loading stalls.');
