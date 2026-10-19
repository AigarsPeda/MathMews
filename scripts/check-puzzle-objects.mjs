/** The pictures must represent the authored quantities without overlap or answer hints. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const en=['easy','medium','hard'].flatMap(t=>JSON.parse(fs.readFileSync(`assets/puzzles/${t}.json`)));
const lv=['easy','medium','hard'].flatMap(t=>JSON.parse(fs.readFileSync(`assets/puzzles/lv/${t}.json`)));
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/quantity-task-scene.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports});
const {getQuantityTaskTokens,getQuantityTaskHeight}=module.exports;
let illustrated=0;
for(const puzzle of en){
 const counterpart=lv.find(p=>p.id===puzzle.id);
 assert.deepEqual(puzzle.taskVisual,counterpart.taskVisual);
 assert.equal(puzzle.payload?.object,counterpart.payload?.object);
 const model=puzzle.taskVisual??(puzzle.type==='fair_share'?{kind:'share',items:puzzle.payload.items,groups:puzzle.payload.people,object:puzzle.payload.object}:undefined);
 if(model?.object){
  illustrated++;
  const total=model.kind==='share'?model.items:model.kind==='array'?model.rows*model.columns:model.kind==='join'?model.left+model.right:model.left;
  let identities;
  for(let step=0;step<=(model.kind==='share'?Math.floor(model.items/model.groups):1);step++){
   const tokens=getQuantityTaskTokens(model,step).filter(t=>t.id.startsWith('counter-'));
   assert.equal(tokens.length,total,`${puzzle.id}: no counted objects are lost`);
   if(identities)assert.deepEqual(tokens.map(t=>t.id),identities);else identities=tokens.map(t=>t.id);
   assert.ok(tokens.every(t=>t.object===model.object&&t.label===''),'The objects do not write the answer');
   const visible=tokens.filter(t=>t.visible!==false);
   for(const token of visible){
    assert.ok(token.x-token.width/2>=0&&token.x+token.width/2<=300,`${puzzle.id}: object fits horizontally`);
    assert.ok(token.y-token.height/2>=0&&token.y+token.height/2<=getQuantityTaskHeight(model),`${puzzle.id}: object fits vertically`);
   }
   for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
    const a=visible[i],b=visible[j];
    assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2,`${puzzle.id}: countable objects cannot overlap`);
   }
  }
 }
 if(puzzle.type==='compare'&&puzzle.payload.object){
  illustrated++;
  for(const value of [puzzle.payload.optionA,puzzle.payload.optionB])assert.ok(Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=24);
 }
}
// Render the actual tray component. Empty cells stay present on both choices.
const jsx=(type,props)=>({type,props});
const component={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/puzzle/PuzzleObjectImage.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 module:component,exports:component.exports,require:id=>{
  if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};
  if(id==='react-native')return{View:'View',StyleSheet:{create:s=>s,absoluteFill:{}}};
  if(id==='expo-image')return{Image:'Image'};
  if(id==='@/constants/puzzle-object-assets')return{getPuzzleObjectAsset:()=>1};
  throw new Error(id);
 }
});
function nodes(node){return Array.isArray(node)?node.flatMap(nodes):node?.props?[node,...nodes(node.props.children)]:[];}
const {PuzzleObjectCollection,PuzzleObjectImage}=component.exports;
for(const [a,b] of [[3,8],[7,19],[12,18]]){
 const trays=[a,b].map(count=>PuzzleObjectCollection({object:'mouse',count,capacity:Math.max(a,b)}));
 assert.deepEqual(trays[0].props.style,trays[1].props.style,'Different quantities use identical object sizes');
 assert.ok(trays.every(tray=>!nodes(tray).some(n=>n.type==='Image')),'No extra frame image around the counted objects');
 for(const [i,count]of [a,b].entries())assert.equal(nodes(trays[i]).filter(n=>n.type===PuzzleObjectImage).length,count);
}
const catalog=JSON.parse(fs.readFileSync('assets/3d/puzzle-objects/catalog.json'));
assert.ok(fs.statSync(catalog.source).size>1000,'Editable Blender scenes are saved');
for(const name of catalog.objects){
 const file=`assets/3d/puzzle-objects/${name}.png`,meta=await sharp(file).metadata();
 assert.ok(meta.hasAlpha&&meta.width>=256&&meta.height>=256,`${name}: bundled transparent render`);
 const {data,info}=await sharp(file).extractChannel('alpha').raw().toBuffer({resolveWithObject:true});
 let minX=info.width,minY=info.height,maxX=-1,maxY=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[y*info.width+x]>128){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 assert.ok(maxX-minX>info.width*.5||maxY-minY>info.height*.5,`${name}: object must be readable at counting size`);
 assert.ok(minX>0&&minY>0&&maxX<info.width-1&&maxY<info.height-1,`${name}: no clipped edges`);
}
console.log(`Verified ${illustrated} illustrated puzzles in both languages, exact object counts, stable animated identities, non-overlapping layouts, equal object sizes, no extra frames, and ${catalog.objects.length} Blender renders.`);
