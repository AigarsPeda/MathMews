/** Learner-facing contracts: pictured givens, honest labels, and unsolved hints. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { readPuzzles } from './puzzles/catalog.mjs';
const all = ['easy','medium','hard'].flatMap(tier => readPuzzles('en',tier));
const byId = new Map(all.map(p => [p.id,p]));
let diagrams = 0, stories = 0;
for (const p of all) {
  for (const model of [p.everyday?.model, p.everyday?.example.model].filter(Boolean)) {
    diagrams++;
    if (model.kind === 'money') {
      if (model.unit === 'cents') assert.ok(model.coins, `${p.id}: visible coins`);
      else assert.equal(model.items?.length,model.prices.length,`${p.id}: each price has an item`);
      if (model.task === 'unit') assert.match(model.label,/whole pack/,`${p.id}: distinguish pack price from unit price`);
    }
    if (model.kind === 'capacity' && ['servings','containers'].includes(model.task)) {
      assert.ok(['cup','bottle','bowl'].includes(model.portionContainer),`${p.id}: show the receiving container`);
      assert.ok(model.portion > 0);
    }
  }
  if (p.contextObjects) {
    stories++;
    for (const item of p.contextObjects) {
      for (const locale of ['en','lv','ru']) assert.ok(JSON.parse(fs.readFileSync(`locales/${locale}.json`)).taskObjects[item.object]);
      if (item.count !== undefined) assert.ok(Number.isInteger(item.count) && item.count >= 0);
    }
  }
  if (p.type === 'budget_plan') {
    assert.ok(p.payload.items.every(item=>item.object));
    assert.doesNotMatch(p.hint,/\d/, 'Budget hint teaches a method without giving the target spend');
  }
  if (p.type === 'route_grid') assert.doesNotMatch(p.hint,/\d/, 'Route hint must not supply intermediate answers');
}
assert.deepEqual(byId.get('v2-medium-addition-explore-4-1').contextObjects,
  [{object:'shell',count:23,role:'start',primary:true},{object:'shell',count:15,role:'add'}]);
assert.equal(byId.get('v2-hard-fractions-amounts-1').taskVisual.object,'plant');
assert.equal(byId.get('v2-hard-measurement-rates-1').taskVisual.object,'planting_tile');
assert.ok(!byId.get('v2-easy-numbers-small-1').contextObjects, 'Number tiles are not planting tiles');
assert.match(byId.get('v2-medium-division-parcels-2').hint,/equal groups/);
assert.doesNotMatch(byId.get('v2-medium-division-parcels-2').hint,/cookies|7/);
// Evaluate real JSX to verify the visible quantities instead of just checking metadata.
const jsx=(type,props)=>({type,props});
const strings=JSON.parse(fs.readFileSync('locales/en.json'));
function render(file,name,props) {
  const mod={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    module:mod,exports:mod.exports,require:id=>{
      if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};
      if(id==='react-native')return{View:'View',StyleSheet:{create:x=>x,absoluteFill:{}},useWindowDimensions:()=>({width:393,height:852,fontScale:1})};
      if(id==='react-i18next')return{useTranslation:()=>({t:key=>key.split('.').reduce((v,k)=>v[k],strings)})};
      if(id==='@/contexts/LocaleProvider')return{useLocale:()=>({locale:'en'})};
      if(id==='@/constants/puzzle-theme')return{PuzzleColors:{},DiagramColors:{}};
      if(id==='@shopify/react-native-skia')return{};
      if(id==='@/utils/border-radius')return{insetRadius:(outer,inset)=>Math.max(0,outer-inset)};
      return new Proxy({},{get:(_,key)=>key});
    }
  });return mod.exports[name](props);
}
function nodes(v){return Array.isArray(v)?v.flatMap(nodes):v?.props?[v,...nodes(v.props.children)]:[];}
const pack = byId.get('v2-medium-money-lesson-7-1');
const packNodes=nodes(render('components/puzzle/EverydayDiagram.tsx','EverydayDiagram',{model:pack.everyday.model}));
assert.equal(packNodes.filter(n=>n.type==='AppIcon'&&n.props.name==='apple').length,4);
assert.ok(packNodes.some(n=>n.props.children==='Whole pack price'));
assert.ok(packNodes.some(n=>n.props.children==='€12'));
assert.ok(!packNodes.some(n=>n.props.children==='€3'),'Do not print the unit-price answer');
const contextNodes=nodes(render('components/puzzle/PuzzleContextObjects.tsx','PuzzleContextObjects',{objects:[{object:'ribbon',count:8,role:'start'},{object:'ribbon',count:5,role:'add'}]}));
assert.equal(contextNodes.filter(n=>n.type==='PuzzleObjectImage').length,13,'Show every object in small given groups');
assert.ok(contextNodes.some(n=>n.props.accessibilityLabel==='At the start 8 ribbons'));
assert.ok(contextNodes.some(n=>n.props.accessibilityLabel==='Added 5 ribbons'));
assert.ok(!contextNodes.some(n=>n.props.accessibilityLabel?.includes('13')),'Do not label the solved sum');
console.log(`Verified ${diagrams} task/example diagrams, ${stories} pictured stories, pack quantities, localized object names and principle-based hints.`);
