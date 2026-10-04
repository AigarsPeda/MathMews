/** Verify native dog playback ownership, background pause, and reduced-motion completion. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let slots = [], index = 0, effects = [], now = 0, timerId = 0;
const timers = new Map(), completed = [], stepsCompleted = [];
let activity = { active: true, reduceMotion: false };
const setTimer = (fn, delay, interval = false) => { const id = ++timerId; timers.set(id, { fn, at: now + delay, delay, interval }); return id; };
function advance(ms) {
  const until = now + ms;
  for (;;) { const next = [...timers].sort((a,b)=>a[1].at-b[1].at)[0]; if (!next || next[1].at > until) break; now=next[1].at; timers.delete(next[0]); if(next[1].interval) timers.set(next[0], { ...next[1], at: now+next[1].delay }); next[1].fn(); }
  now = until;
}
const slot = initial => { const i = index++; if (!(i in slots)) slots[i] = initial(); return [i, slots[i]]; };
const memo = (fn, deps) => { const [i, old] = slot(()=>null); if(!old || deps.some((d,n)=>d!==old.deps[n])) slots[i]={ deps, value:fn() }; return slots[i].value; };
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useRef: initial => slot(()=>({current:initial}))[1],
  useState: initial => { const [i,value]=slot(()=>typeof initial==='function'?initial():initial); return [value, next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}]; },
  useCallback: (fn,deps)=>memo(()=>fn,deps), useMemo:memo,
  useEffect: (fn,deps) => { const [i,old]=slot(()=>null); if(!old || deps.some((d,n)=>d!==old.deps[n])) effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};}); },
};
const keys = ['idle','eating','correct'];
const players = Object.fromEntries(keys.map(key=>[key, { currentTime:0,duration:2,status:'readyToPlay',playing:false,replacements:0,listeners:new Map(),
  replace(){this.replacements++;}, play(){this.playing=true;}, pause(){this.playing=false;},
  addListener(event,fn){const list=this.listeners.get(event)??new Set();list.add(fn);this.listeners.set(event,list);return{remove:()=>list.delete(fn)};},
  emit(event,value){this.listeners.get(event)?.forEach(fn=>fn(value));},
}]));
const mocks={react:React,'react-native':{View:'View',Pressable:'Pressable',Platform:{OS:'ios'},StyleSheet:{create:s=>s,absoluteFill:{}}},'expo-video':{VideoView:'VideoView'},'@/utils/scale':{moderateScale:n=>n},'@/constants/game':{GameColors:{}},'@/pet-display/media/sprite/use-sprite-clock':{useSpriteActivity:()=>activity},'@/pet-display/registry/dog-video-registry':{DOG_VIDEO_SOURCES:Object.fromEntries(keys.map(key=>[key,key]))},'@/pet-display/media/video/PetVideoMediaProvider':{PET_VIDEO_ASSET_KEYS:keys,usePetVideoPlayers:()=>players}};
const module={exports:{}};
const code=ts.transpileModule(fs.readFileSync('pet-display/media/video/PetVideoRenderer.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
vm.runInNewContext(code,{module,exports:module.exports,React,require:id=>{assert.ok(id in mocks,id);return mocks[id];},setTimeout:(fn,ms)=>setTimer(fn,ms),clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>setTimer(fn,ms,true),clearInterval:id=>timers.delete(id),queueMicrotask});
const segment={assetKey:'eating',startMs:500,endMs:1000,loop:false};
const props={segment,onAnimationComplete:()=>completed.push('done'),onStepComplete:i=>stepsCompleted.push(i)};
function render(overrides={}){index=0;effects=[];const tree=module.exports.PetVideoRenderer({...props,...overrides});effects.forEach(fn=>fn());return tree;}
render(); assert.equal(players.eating.replacements,1); assert.equal(players.idle.replacements,0); assert.equal(players.correct.replacements,0);
activity={active:false,reduceMotion:false};render();assert.ok(Object.values(players).every(player=>!player.playing));assert.equal(timers.size,0,'Background clears polling and reveal timers');
activity={active:true,reduceMotion:true};render();advance(600);await Promise.resolve();assert.equal(completed.length,1);assert.ok(Object.values(players).every(player=>!player.playing));
const scenario=[{assetKey:'correct',loop:false},{assetKey:'eating',loop:false},{assetKey:'idle',loop:false}];
render({segment:undefined,scenarioSteps:scenario});advance(1800);await Promise.resolve();assert.equal(completed.length,2);assert.equal(stepsCompleted.length,4,'Each reduced-motion scenario step still completes');
render({segment:undefined,scenarioSteps:[{assetKey:'eating',loop:false}]});players.eating.emit('statusChange',{status:'error'});players.eating.emit('statusChange',{status:'error'});await Promise.resolve();assert.equal(completed.length,3,'Repeated decode failures complete the action once');
for(const entry of slots)entry?.cleanup?.();
console.log('Verified dog lazy clip loading, background pause, reduced-motion scenario completion, and idempotent media-error recovery.');
