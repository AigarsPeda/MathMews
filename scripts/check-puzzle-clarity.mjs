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
  const model = p.everyday?.model;
  if (model) {
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
// The real design tokens, so diagrams render with the production palette and metrics.
const money={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/puzzle-money.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:money,exports:money.exports,Intl,require:()=>({})});
const tape={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/money-tape.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:tape,exports:tape.exports,require:()=>money.exports});
const theme={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('constants/puzzle-theme.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:theme,exports:theme.exports,require:()=>({GameColors:{}})});
function render(file,name,props) {
  const mod={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    module:mod,exports:mod.exports,require:id=>{
      if(id.endsWith('/useModelPaint'))return{useModelPaint:()=>({current:null})};
      if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};
      if(id==='react-native')return{View:'View',StyleSheet:{create:x=>x,absoluteFill:{}},useWindowDimensions:()=>({width:393,height:852,fontScale:1})};
      if(id==='react-i18next')return{useTranslation:()=>({t:key=>key.split('.').reduce((v,k)=>v[k],strings)})};
      if(id==='@/contexts/LocaleProvider')return{useLocale:()=>({locale:'en'})};
      if(id==='@/constants/puzzle-theme')return theme.exports;
      if(id==='@/utils/puzzle-money')return money.exports;
      if(id==='@/utils/money-tape')return tape.exports;
      if(id==='@shopify/react-native-skia')return{};
      if(id==='@/utils/border-radius')return{insetRadius:(outer,inset)=>Math.max(0,outer-inset)};
      return new Proxy({},{get:(_,key)=>key});
    }
  });return mod.exports[name](props);
}
function nodes(v){return Array.isArray(v)?v.flatMap(nodes):v?.props?[v,...nodes(v.props.children)]:[];}
const pack = byId.get('v2-medium-money-lesson-7-1');
const packNodes=nodes(render('components/puzzle/everyday/MoneyStage.tsx','MoneyShelf',{model:pack.everyday.model}));
assert.equal(packNodes.filter(n=>n.type==='MoneyDiagramIcon'&&n.props.name==='apple').length,4,'Show every apple in the pack');
assert.equal(packNodes[0].props.accessibilityLabel, 'Apple: 4 in the pack; whole pack €12.');
assert.match(fs.readFileSync('components/puzzle/everyday/MoneyPurse.tsx','utf8'),/model\.task === 'unit' \? formatPriceTicket\(model\.prices\[0\]/,'Show the whole pack price once, in the lane above the purse');
assert.ok(!packNodes.some(n=>['€3','€3.00'].includes(n.props.children)),'Do not print the unit-price answer');
const contextNodes=nodes(render('components/puzzle/PuzzleContextObjects.tsx','PuzzleContextObjects',{objects:[{object:'ribbon',count:8,role:'start'},{object:'ribbon',count:5,role:'add'}]}));
assert.equal(contextNodes.filter(n=>n.type==='PuzzleObjectImage').length,13,'Show every object in small given groups');
assert.ok(contextNodes.some(n=>n.props.accessibilityLabel==='At the start 8 ribbons'));
assert.ok(contextNodes.some(n=>n.props.accessibilityLabel==='Added 5 ribbons'));
assert.ok(!contextNodes.some(n=>n.props.accessibilityLabel?.includes('13')),'Do not label the solved sum');
console.log(`Verified ${diagrams} task diagrams, ${stories} pictured stories, pack quantities, localized object names and principle-based hints.`);
