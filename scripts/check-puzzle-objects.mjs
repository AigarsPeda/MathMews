import { readPuzzles } from './puzzles/catalog.mjs';
/** The pictures must represent the authored quantities without overlap or answer hints. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const en=['easy','medium','hard'].flatMap(t=>readPuzzles('en', t));
const lv=['easy','medium','hard'].flatMap(t=>readPuzzles('lv', t));
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
  if(id==='react')return{useState:initial=>[initial,()=>{}]};
  if(id==='react-native')return{View:'View',StyleSheet:{create:s=>s,absoluteFill:{}}};
  if(id==='./kit/DiagramIcon')return{DiagramIcon:'DiagramIcon'};
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
// Every authored object has a flat vector glyph; models never fall back to bitmaps.
const objectType=fs.readFileSync('types/puzzle-object.ts','utf8');
const objects=[...objectType.matchAll(/"([a-z_]+)"/g)].map(m=>m[1]);
const library=fs.readFileSync('components/puzzle/glyphs/library.ts','utf8');
const glyphNames=new Set([...library.slice(library.indexOf('export const glyphs')).matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map(m=>m[1]));
for(const name of objects)assert.ok(glyphNames.has(name),`${name}: vector glyph exists`);
assert.ok(!/require\(|Image/.test(fs.readFileSync('components/puzzle/kit/DiagramIcon.tsx','utf8')),'DiagramIcon draws vectors, not bitmaps');
console.log(`Verified ${illustrated} illustrated puzzles in both languages, exact object counts, stable animated identities, non-overlapping layouts, equal object sizes, no extra frames, and ${objects.length} vector object glyphs.`);
