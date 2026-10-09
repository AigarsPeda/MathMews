/** Exercise the actual report, weather sheet, clock controls and saved choices. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache=new Map(), states=[];
let cursor=0, now=1_790_000_000_000, writes=0, game, locale='en';
const locales=Object.fromEntries(['en','lv'].map(id=>[id,JSON.parse(fs.readFileSync(`locales/${id}.json`,'utf8'))]));
function t(key,values={}) {
  const text=key.split('.').reduce((value,part)=>value?.[part],locales[locale]);
  assert.equal(typeof text,'string',`${locale}/${key} is translated`);
  return text.replace(/\{\{(\w+)\}\}/g,(_match,key)=>String(values[key]));
}
const mocks={
  react:{createElement:(type,props,...children)=>({type,props:{...props,children}}),useState:initial=>{
    const index=cursor++;
    if(!(index in states))states[index]=initial;
    return [states[index],next=>{states[index]=next;}];
  }},
  'react-native':{Pressable:'Pressable',View:'View',Text:'Text',ScrollView:'ScrollView',StyleSheet:{create:value=>value}},
  'react-i18next':{useTranslation:()=>({t})},
  '@/components/ui/AppBottomSheet':{AppBottomSheet:'AppBottomSheet'},
  '@/components/ui/AppIcon':{AppIcon:'AppIcon'},
  '@/contexts/GameProvider':{useGame:()=>game},
  '@/hooks/use-world-clock-now':{useWorldClockNow:()=>now},
  '@/utils/scale':{moderateScale:value=>value},
};
function load(id,parent=process.cwd()) {
  if(id in mocks)return mocks[id];
  const file=id.startsWith('@/')?path.resolve(id.slice(2)):path.resolve(parent,id);
  if(file.endsWith('.png')){assert.ok(fs.existsSync(file));return file;}
  const resolved=fs.existsSync(file)?file:['.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);
  assert.ok(resolved,id);
  if(cache.has(resolved))return cache.get(resolved).exports;
  const module={exports:{}};cache.set(resolved,module);
  if(resolved.endsWith('.json'))module.exports=JSON.parse(fs.readFileSync(resolved,'utf8'));
  else vm.runInNewContext(ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,
  }}).outputText,{module,exports:module.exports,require:next=>load(next,path.dirname(resolved)),Math,React:mocks.react,
    Date:class extends Date{static now(){return now;}}});
  return module.exports;
}
const clock=load('@/utils/world-clock'),weather=load('@/utils/world-weather');
const start=clock.createWorldClock(now);
for(const kind of ['clear','rain','snow','leaves'])for(let day=0;day<12;day++)for(let hour=0;hour<24;hour++) {
  const current={...start,worldMs:(day*24+hour)*3_600_000,weather:kind};
  const report=weather.worldWeatherReport(current,now);
  assert.equal(report.kind,kind);
  assert.ok(Number.isInteger(report.temperature) && report.temperature>=-7 && report.temperature<=25);
  if(kind==='snow')assert.ok(report.temperature<0,'Snow has a freezing outdoor temperature');
  assert.ok(fs.existsSync(`assets/icons/${report.icon}.png`),'Every report has bundled artwork');
  const restored=clock.normalizeWorldClock(JSON.parse(JSON.stringify(current)),now);
  assert.deepEqual({...weather.worldWeatherReport(restored,now)},{...report},'The same saved world restores its report');
}
const afternoon={...start,worldMs:15*3_600_000,weather:'clear'};
const night={...start,worldMs:3*3_600_000,weather:'clear'};
assert.equal(weather.worldWeatherReport(afternoon,now).icon,'weather-sun');
assert.equal(weather.worldWeatherReport(night,now).icon,'weather-moon');
assert.ok(weather.worldWeatherReport(afternoon,now).temperature>weather.worldWeatherReport(night,now).temperature);
for(const speed of [1,60,300]) {
  const before={...afternoon,speed};
  assert.equal(weather.worldWeatherReport(before,now).temperature,weather.worldWeatherReport(afternoon,now).temperature);
  assert.deepEqual({...weather.worldWeatherReport(before,now+60_000)},
    {...weather.worldWeatherReport(clock.changeWorldClock(before,300,undefined,now+60_000),now+60_000)},'Changing speed cannot jump the weather report');
}
function nodes(node) {
  if(Array.isArray(node))return node.flatMap(nodes);
  return node?.props?[node,...nodes(node.props.children)]:[];
}
const {WorldWeatherControl}=load('@/components/pet/WorldWeatherControl');
const {WorldClockControl}=load('@/components/pet/WorldClockControl');
game={worldClock:{...start},setWorldWeather:kind=>{writes++;game.worldClock={...game.worldClock,weather:kind};},
  setWorldClock:(speed,minute)=>{game.worldClock=clock.changeWorldClock(game.worldClock,speed,minute,now);}};
function render(){cursor=0;return nodes(WorldWeatherControl());}
const sheet=tree=>tree.find(node=>node.type==='AppBottomSheet');
let tree=render();
assert.equal(sheet(tree).props.visible,false);
assert.equal(writes,0,'Reading the weather never writes a save');
tree.find(node=>node.props.accessibilityRole==='button').props.onPress();
assert.equal(sheet(render()).props.visible,true,'The report opens its own weather sheet');
for(const [index,kind] of ['auto','clear','rain','snow','leaves'].entries()) {
  const before={...game.worldClock};
  tree=render();
  tree.filter(node=>node.props.accessibilityRole==='radio')[index].props.onPress();
  assert.equal(game.worldClock.weather,kind);
  for(const field of ['worldMs','realMs','speed'])assert.equal(game.worldClock[field],before[field],'Selecting weather preserves the clock');
  tree=render();
  const selected=tree.filter(node=>node.props.accessibilityState?.selected);
  assert.equal(selected.length,1,'Exactly one weather choice is selected');
  assert.equal(selected[0].props.children[1].props.children[0].props.children[0],t(`worldClock.weather_${kind}`));
  assert.equal(sheet(tree).props.visible,true,'The chooser stays open to preview different weather');
}
const saved=JSON.parse(JSON.stringify(game.worldClock));
game.worldClock=clock.normalizeWorldClock(saved,now);
assert.equal(render().find(node=>node.props.accessibilityRole==='button').props.accessibilityLabel,
  t('worldWeather.open',{weather:t('worldClock.weather_leaves'),temperature:weather.worldWeatherReport(game.worldClock,now).temperature}));
sheet(render()).props.onClose();
assert.equal(sheet(render()).props.visible,false,'Native sheet dismissal updates visibility');
const writeCount=writes;
for(let minute=0;minute<120;minute++){now+=1000;render();}
assert.equal(writes,writeCount,'Clock and weather polling do not persist repeated saves');
for(const language of ['en','lv']){locale=language;render();}
locale='en';states.length=0;cursor=0;
tree=nodes(WorldClockControl());
assert.ok(tree.some(node=>node.type===WorldWeatherControl),'The weather control lives beside the actual clock');
tree.find(node=>node.props.accessibilityRole==='button').props.onPress();
cursor=0;tree=nodes(WorldClockControl());
assert.equal(sheet(tree).props.visible,true,'The clock still opens independently');
const presets=tree.filter(node=>node.props.accessibilityRole==='button' && node.props.children[0]?.props?.children[0]==='Night');
presets[0].props.onPress();
assert.equal(clock.worldClockReading(game.worldClock,now).time,'23:00');
assert.equal(game.worldClock.weather,'leaves','Clock presets preserve the chosen weather');
const row=tree.find(node=>node.props.pointerEvents==='box-none').props.style;
for(const width of [300,320,351,390,430]) {
  const badgeWidth=(width-row.left-row.right-row.gap)/2;
  assert.ok(badgeWidth>=70,'Clock and weather badges remain usable on compact rooms');
  assert.ok(row.left>=122,'The report row clears the decoration control');
}
console.log('Verified the real weather report and chooser, all saved weather modes, Celsius temperatures, day/night icons, clock independence, speed continuity, translations, compact layout and no polling saves.');
