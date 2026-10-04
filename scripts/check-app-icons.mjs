/** Verify bundled icon integrity, native inline text, and puzzle object coverage. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const cache=new Map();
const mocks={
  react:{Children:{map:(children,fn)=>(Array.isArray(children)?children:[children]).flatMap(fn)}},
  'react-native':{Text:'Text',StyleSheet:{flatten:styles=>Array.isArray(styles)?Object.assign({},...styles):styles}},
  'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
  './AppIcon':{AppIcon:'AppIcon'},
};
function load(file){
  const absolute=path.resolve(file);
  if(cache.has(absolute))return cache.get(absolute);
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,require:id=>{
    if(id in mocks)return mocks[id];
    const target=id.startsWith('@/')?path.resolve(id.slice(2)):path.resolve(path.dirname(absolute),id);
    if(target.endsWith('.png')){assert.ok(fs.existsSync(target),target);return target;}
    return load(target+'.ts');
  }});
  cache.set(absolute,module.exports);return module.exports;
}
const {APP_ICON_SOURCES:sources}=load('constants/app-icons.ts');
const {INLINE_ICONS:inline}=load('constants/inline-icons.ts');
let bytes=0;
for(const [name,file] of Object.entries(sources)){
  bytes+=fs.statSync(file).size;
  const meta=await sharp(file).metadata();
  assert.equal(meta.width,256,name);assert.equal(meta.height,256,name);assert.ok(meta.hasAlpha,name);
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let opaque=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    if(data[(y*info.width+x)*4+3]<10)continue;
    opaque++;
    assert.ok(x>=3 && y>=3 && x<253 && y<253,`${name} is clipped`);
  }
  assert.ok(opaque>500,`${name} is empty`);
}
assert.ok(bytes<3*1024**2,'Icon family exceeds the 3 MiB bundle budget');
for(const icon of Object.values(inline))assert.ok(icon in sources,icon);
function walk(value){
  if(Array.isArray(value))return value.forEach(walk);
  if(!value || typeof value!=='object')return;
  if(value.emoji)assert.ok(value.emoji in inline,`Puzzle illustration ${value.emoji} lacks app artwork`);
  Object.values(value).forEach(walk);
}
for(const locale of ['', 'lv/'])for(const difficulty of ['easy','medium','hard'])walk(JSON.parse(fs.readFileSync(`assets/puzzles/${locale}${difficulty}.json`,'utf8')));
const {IconText}=load('components/ui/IconText.tsx');
const tree=IconText({style:[{fontSize:20},{fontWeight:'700'}],accessibilityLabel:'4 coins',children:['Cost 4 🪙; ', '🍎🍎🍎', '2 × 3 = 6 → ?']});
const children=tree.props.children.flat(Infinity);
const icons=children.filter(child=>child?.type==='AppIcon');
assert.equal(icons.length,4,'Counted objects must not merge or disappear');
assert.equal(icons[0].props.name,'coin');assert.equal(icons[0].props.size,24);
assert.equal(icons.filter(icon=>icon.props.name==='apple').length,3);
assert.ok(children.includes('2 × 3 = 6 → ?'),'Mathematical notation stays text');
assert.equal(tree.props.accessibilityLabel,'4 coins');
console.log(`Verified ${Object.keys(sources).length} transparent, unclipped icons (${(bytes/1024**2).toFixed(2)} MiB), translated inline images, math notation and every puzzle object marker.`);
