import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root=process.cwd(), cache=new Map();
function load(relative){
 const file=path.resolve(root,relative);
 if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const require=(ref)=>{
  const resolved=ref.startsWith('@/')?path.join(root,ref.slice(2)):path.resolve(path.dirname(file),ref);
  if(/\.(png|gif|webp)$/.test(resolved))return path.relative(root,resolved);
  if(!ref.startsWith('@/')&&!ref.startsWith('.'))throw Error('Unexpected inventory import '+ref);
  return load(fs.existsSync(resolved)?resolved:resolved+'.ts');
 };
 vm.runInNewContext(source,{exports:mod.exports,module:mod,require,console,Date,Map,Set},{filename:file});return mod.exports;
}
const decor=load('constants/cat-decorations.ts'),beds=load('constants/cat-beds.ts'),toys=load('constants/cat-toys.ts'),rooms=load('constants/cat-rooms.ts');
const entries=[];
for(const[id,entry]of Object.entries(decor.CAT_DECORATION_CATALOG))entries.push({id,kind:'decoration',...entry});
for(const[id,source]of Object.entries(beds.CAT_BED_SOURCES))entries.push({id:'bed-'+id,kind:'bed',source,displaySize:beds.getBedDisplaySize(id)});
for(const id of toys.CAT_TOY_IDS)entries.push({id:'toy-'+id,kind:'toy',source:toys.CAT_TOY_SOURCES[id],displaySize:toys.getToyDisplaySize(id)});
for(const[id,source]of Object.entries(rooms.CAT_ROOM_SOURCES))entries.push({id,kind:'room',source});
const thumbnailIds={japaneseDoorAni:'japaneseDoorClosed',japaneseSlidingDoorAni:'japaneseSlidingDoorClosed'};
const plan={version:2,entries:entries.map(e=>({id:e.id,kind:e.kind,...(thumbnailIds[e.id]?{thumbnailId:thumbnailIds[e.id]}:{}),...(e.displaySize?{displaySize:e.displaySize}:{}),animated:'frameWidth' in e||['toy-orangeBall','toy-blueBall','toy-pinkBall','toy-mouse'].includes(e.id)}))};
fs.writeFileSync('scripts/3d/inventory.json',JSON.stringify(plan,null,2)+'\n');
console.log('Inventory:',entries.length,'assets');
console.log(entries.map(e=>e.id).join(' '));
