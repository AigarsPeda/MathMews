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
  }).outputText, { module, exports: module.exports, require: load, performance, setTimeout });
  return module.exports;
}

const {storedRoomItems,createRoomPlacementDraft,withRoomPlacementDraft,applyRoomObjectEdits,roomFurnitureVersion}=load('@/utils/room-edit');
const {buildNativeRoomWorld,projectWorld,NATIVE_MODEL_CATALOG}=load('@/utils/native-room-world');
const {createRoomPlacementResolver,roomItemAnchor}=load('@/utils/room-item-placement');
const {roomSupport,roomSupportGroup,moveRoomSupportGroup,restoreRoomSupports,transformRoomObject}=load('@/utils/room-support');
const {normalizePlacedDecorations}=load('@/utils/room-placement');
const progress={bedsUnlocked:['brown','green'],toysUnlocked:['blueBall'],toyQuantities:{blueBall:3},decorationsUnlocked:['plantSmall'],decorationQuantities:{plantSmall:2}};
const plant={decorationId:'plantSmall',instanceId:'plant',offset:{x:0,y:0}};
const pet={homeRoomId:'livingRoom',bedId:'brown',roomBedOffset:{x:-.2,y:.3},placedToys:[{toyId:'blueBall',instanceId:'ball',offset:{x:0,y:0}}],placedDecorations:[plant],homeRooms:{livingRoom:{placedDecorations:[plant]},kitchen:{placedToys:[{toyId:'blueBall',instanceId:'kitchen-ball',offset:{x:0,y:0}}]}}};
assert.equal(storedRoomItems(pet,progress).find(i=>i.target.id==='blueBall').count,1,'Copies in other rooms consume inventory, current snapshot is counted once');
const version=roomFurnitureVersion(pet), draft=createRoomPlacementDraft({kind:'decoration',id:'plantSmall'});
const preview=withRoomPlacementDraft(pet,draft);
assert.equal(preview.placedDecorations.length,2);assert.equal(pet.placedDecorations.length,1);
assert.equal(roomFurnitureVersion(pet),version,'Staging cannot change persisted layout');
const committed=applyRoomObjectEdits(pet,[{instanceId:draft.item.instanceId,offset:{x:.3,y:.2},rotationDegrees:35}],['plant'],draft);
assert.equal(committed.placedDecorations.length,1);assert.equal(committed.placedDecorations[0].rotationDegrees,35);
assert.equal(storedRoomItems(committed,progress).find(i=>i.target.id==='plantSmall').count,1,'Replaced furniture returns to storage');
assert.equal(pet.placedDecorations[0].instanceId,'plant','The original snapshot remains an atomic Undo point');
const bedDraft=createRoomPlacementDraft({kind:'bed',id:'green'});
assert.equal(withRoomPlacementDraft(pet,bedDraft).bedId,'green');assert.equal(pet.bedId,'brown','Cancel keeps the existing bed');
assert.equal(applyRoomObjectEdits(pet,[{instanceId:'bed',offset:{x:.1,y:.2}}],[],bedDraft).bedId,'green');

const input={width:390,height:420,petSize:80,sizeScale:1.15,toys:[],decorations:[
 {decorationId:'kitchenIslandOpenCart',instanceId:'island',offset:{x:0,y:0}},
 {decorationId:'lampShade',instanceId:'lamp',offset:{x:.4,y:.4},scale:.6}]};
// Pick available catalog models explicitly, avoiding fixture-only geometry.
input.decorations[0].decorationId='kitchenModernIslandNavy';
input.decorations[1].decorationId='lampTableMushroom';
const world=buildNativeRoomWorld(input);
assert.equal(world.objects.length,2);
const parent=world.objects.find(o=>o.instanceId==='island'), child=world.objects.find(o=>o.instanceId==='lamp');
const attached={...transformRoomObject(child,[parent.position[0]+.1,parent.max[1],parent.position[2]-.1]),supportId:parent.instanceId};
const before={...world,objects:[parent,attached]}, support=roomSupport(attached,parent);
const candidate=transformRoomObject(parent,[parent.position[0]+.25,parent.position[1],parent.position[2]+.2],parent.heading+Math.PI/2);
const group=moveRoomSupportGroup(before.objects,parent,candidate);
assert.equal(group.length,2);assert.equal(group[1].scale,attached.scale,'Moving a support never resizes its contents');
const restored=restoreRoomSupports([candidate,child],new Map([['lamp',support]]));
for(let axis=0;axis<3;axis++)assert.ok(Math.abs(restored[1].position[axis]-group[1].position[axis])<1e-8);
assert.ok(Math.abs(restored[1].heading-group[1].heading)<1e-8);
assert.equal(roomSupportGroup(before.objects,['island']).length,2);
assert.equal(roomSupportGroup(before.objects,['lamp']).length,1,'Picking up a child does not move its parent');
const normalized=normalizePlacedDecorations([{...input.decorations[1],support}]);
assert.equal(normalized[0].support.parentId,'island');
assert.equal(normalizePlacedDecorations([{...input.decorations[1],support:{parentId:'island',position:[NaN,0,0],heading:0}}])[0].support,undefined);
const detached=applyRoomObjectEdits({...pet,placedDecorations:[{...plant,support:{...support,parentId:'other'}}]},[],['other']);
assert.equal(detached.placedDecorations[0].support,undefined,'Removing a missing parent cannot leave a dangling saved link');
const cycles=restoreRoomSupports(before.objects,new Map([['island',{parentId:'lamp',position:[0,0,0],heading:0}],['lamp',support]]));
assert.equal(cycles.length,2,'Malformed cyclic saves cannot recurse forever');
const resolver=createRoomPlacementResolver(world,['lamp']);
const blocked=resolver.preview('lamp',roomItemAnchor(parent,390));
assert.ok(blocked);
assert.equal(JSON.stringify(world),JSON.stringify(buildNativeRoomWorld(input)),'Live validation never mutates saved world objects');
console.log('Verified stored inventory across rooms, draft cancellation, atomic replacement, bed staging, supported translation/rotation, persistence, detaching and malformed support recovery.');

// Execute the actual asynchronous draft effect without native assets or a device.
const stageSource=fs.readFileSync('components/pet/PetStage.tsx','utf8');
const ast=ts.createSourceFile('PetStage.tsx',stageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect;
function findEffect(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes('suggestionStarted.current'))effect=node.arguments[0].getText(ast);ts.forEachChild(node,findEffect);}
findEffect(ast);assert.ok(effect);
const code=ts.transpileModule(`(${effect})();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let frame,resolveSearch;
const effectContext={placementDraft:undefined,movingItem:undefined,roomVisible:true,viewport:{width:390},suggestionStarted:{current:undefined},suggestionAbort:{current:undefined},nativeWorld:world,editingObject:{value:undefined},
 AbortController,requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame(){},markDecorationTiming(){},setPendingMove(){},setPlacementFeedback(){},setRoomPreview:(ref,value)=>{ref.value=value;},
 isCurtainDecorationId:()=>false,isWindowLightSource:()=>false,curtainAtWindow:()=>undefined,
 placement:{canPlace:()=>false,feedback:()=>({blockers:[],boundaries:[]}),nearestFreeAsync:()=>new Promise(resolve=>{resolveSearch=resolve;})}};
vm.runInNewContext(code,effectContext);assert.equal(frame,undefined,'Saved furniture never starts automatic fitting');
effectContext.placementDraft={item:{kind:'decoration',instanceId:'lamp'},target:{kind:'decoration',id:'lampTableMushroom'}};effectContext.movingItem=effectContext.placementDraft.item;
const cleanup=vm.runInNewContext(code,effectContext);frame();
const initialPreview=effectContext.editingObject.value;assert.equal(initialPreview.instanceId,'lamp','An initial preview exists while the suggestion searches');
cleanup();resolveSearch({...child,position:[9,9,9]});await Promise.resolve();await Promise.resolve();
assert.equal(effectContext.editingObject.value,initialPreview,'An interrupted search cannot overwrite the current preview');
console.log('Verified initial draft feedback before search completion and cancellation of late suggestions.');

const {restoreOwnedRoomLayout}=load('@/utils/room-edit');
const restoredBudget=restoreOwnedRoomLayout(pet,{...pet,placedToys:[pet.placedToys[0],{toyId:'blueBall',instanceId:'copy2',offset:{x:0,y:0}},{toyId:'blueBall',instanceId:'copy3',offset:{x:0,y:0}}]},progress);
assert.equal(restoredBudget.placedToys.length,2,'Restoring a layout respects the copy already used in the kitchen');
const providerSource=fs.readFileSync('contexts/GameProvider.tsx','utf8'),providerAst=ts.createSourceFile('Provider.tsx',providerSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let commitSource;
function findCommit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(providerAst)==='commitRoomEdit')commitSource=node.initializer.arguments[0].getText(providerAst);ts.forEachChild(node,findCommit);}
findCommit(providerAst);assert.ok(commitSource);
const context={saveRef:{current:{pet,progress,pendingWalletPurchases:[{id:'pending',kind:'decoration',itemId:'plantSmall',status:'pending',undo:{addedInstances:[]}}]}},placementDraft:{roomId:'livingRoom',draft},roomFurnitureVersion,storedRoomItems,applyRoomObjectEdits,setPlacementDraft(){},setSave:save=>{context.saveRef.current=save;}};
const commit=vm.runInNewContext(ts.transpileModule(`(${commitSource})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
assert.equal(commit('kitchen',[],[],version),false,'A stale room cannot accept the edit');
assert.equal(commit('livingRoom',[{instanceId:draft.item.instanceId,offset:{x:.4,y:.2}}],[],version),true);
assert.equal(context.saveRef.current.pendingWalletPurchases[0].undo.addedInstances[0],draft.item.instanceId,'A placement made during confirmation remains identifiable on rejection');
assert.equal(commit('livingRoom',[],[],version),false,'A duplicate or stale callback cannot allocate a second draft');
context.saveRef.current={pet,progress:{...progress,decorationsUnlocked:[],decorationQuantities:{plantSmall:0}}};
assert.equal(commit('livingRoom',[],[],version),false,'A revoked purchase cannot be placed');
assert.equal(context.saveRef.current.pet,pet);
console.log('Verified save-layout inventory budgets, stale/duplicate commits, confirmation-time instance tracking and revoked drafts.');

const top=NATIVE_MODEL_CATALOG[parent.modelId].supportSurfaces[0];
const boardPoint=projectWorld([parent.position[0],parent.position[1]+top.max[1]*parent.scale,parent.position[2]],world.width);
const tooLarge=transformRoomObject(child,child.position,child.heading,parent.scale*10);
const surfaceAttempt=createRoomPlacementResolver({...world,objects:[parent,tooLarge]},['lamp']).preview('lamp',boardPoint);
assert.equal(surfaceAttempt.feedback.unsupportedSurfaceId,'island');
assert.equal(surfaceAttempt.accepted,false,'A too-large tabletop item cannot silently become a floor placement');
console.log('Verified explicit rejection of an object whose base does not fit the pointed-at surface.');

const {roomPlacementAccess}=load('@/utils/room-placement-access');
const {FLOOR_Y}=load('@/utils/native-room-world');
const empty=buildNativeRoomWorld({...input,decorations:[]});
const start=[0,FLOOR_Y,0];
assert.equal(roomPlacementAccess(empty,empty,start).blockedExit,false,'Clear room access is never rejected');
const sealed=buildNativeRoomWorld({...input,decorations:[{decorationId:'kitchenModernFridgeNavy',instanceId:'barrier',scale:2.2,offset:{x:0,y:0}}]});
const barrier=transformRoomObject(sealed.objects[0],[0,FLOOR_Y,0],0,20);
assert.equal(roomPlacementAccess(empty,{...empty,objects:[barrier]},start).blockedExit,true,'A layout with no reachable exit is rejected');
console.log('Verified clear-room acceptance and complete-exit-blockage rejection with the cat route solver.');

const {ambiguousRoomItems}=load('@/utils/room-selection');
const tiny=buildNativeRoomWorld({...input,decorations:[],toys:[{toyId:'blueBall',instanceId:'a',offset:{x:0,y:0}},{toyId:'blueBall',instanceId:'b',offset:{x:.03,y:0}}]});
assert.equal(ambiguousRoomItems(tiny,'a',roomItemAnchor(tiny.objects[0],390),1).length,2,'Closely clustered small targets get a picture choice');
assert.equal(ambiguousRoomItems({...tiny,objects:[tiny.objects[0]]},'a',roomItemAnchor(tiny.objects[0],390),1).length,0,'A clear single target stays a direct tap');
console.log('Verified small-target ambiguity detection and direct selection for unambiguous taps.');

// A selected purchase must win over the sofa rendered in front of its outline.
const {selectedRoomItemAtPoint}=load('@/utils/room-selection');
let pickerSource;
function findEditingPicker(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='pickEditingItem')pickerSource=node.initializer.getText(ast);ts.forEachChild(node,findEditingPicker);}
findEditingPicker(ast);assert.ok(pickerSource);
const shelfWorld=buildNativeRoomWorld({width:390,height:420,petSize:80,sizeScale:1.15,toys:[],decorations:[
 {decorationId:'livingShelvingA',instanceId:'shelf',offset:{x:0,y:0}},
 {decorationId:'sofaA',instanceId:'sofa',offset:{x:.2,y:0}}]});
const shelf=shelfWorld.objects.find(o=>o.instanceId==='shelf');
const pickContext={tapToMove:false,movingItem:{kind:'decoration',instanceId:'shelf'},editingObject:{value:shelf},
 nativeWorld:shelfWorld,selectedRoomItemAtPoint,viewport:{width:390,height:420},zoom:1,pickNativeItem:async()=> 'sofa'};
const pickEditing=vm.runInNewContext(ts.transpileModule(`(${pickerSource})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,pickContext);
const shelfCenter=projectWorld(shelf.min.map((v,i)=>(v+shelf.max[i])/2),390);
assert.equal(await pickEditing({x:shelfCenter.x+195,y:shelfCenter.y+210}),'shelf','The selected shelf remains draggable through the foreground sofa');
assert.equal(await pickEditing({x:-500,y:-500}),'sofa','Touches outside selection still use native geometry');
pickContext.tapToMove=true;
assert.equal(await pickEditing({x:shelfCenter.x+195,y:shelfCenter.y+210}),undefined,'Tap destination mode does not capture furniture');
// Use a physically clear but visually occluded fixture. The low shelf is on
// the rear wall, with the sofa in front. Suggestion ranking must move it up.
const hiddenShelf=transformRoomObject(shelf,[0,.55,shelf.position[2]]);
const sofa=shelfWorld.objects.find(o=>o.instanceId==='sofa');
const frontSofa=transformRoomObject(sofa,[hiddenShelf.position[0]+.7,sofa.position[1],hiddenShelf.position[2]+.7]);
const hiddenWorld={...shelfWorld,objects:[hiddenShelf,frontSofa]};
const suggestionResolver=createRoomPlacementResolver(hiddenWorld,['shelf']);
assert.ok(suggestionResolver.canPlace(hiddenShelf),'Occluded starting shelf is physically legal');
const visibleSuggestion=await suggestionResolver.nearestFreeAsync(hiddenShelf,new AbortController().signal,true);
assert.ok(visibleSuggestion && suggestionResolver.canPlace(visibleSuggestion));
assert.notDeepEqual(visibleSuggestion.position,hiddenShelf.position,'A hidden initial shelf is not retained as the suggested pose');
assert.deepEqual(hiddenWorld.objects[1],frontSofa,'Finding the shelf never moves its sofa neighbor');
console.log('Verified selected shelf capture through the sofa, native picking outside selection, and visible legal suggestions without moving neighbors.');
