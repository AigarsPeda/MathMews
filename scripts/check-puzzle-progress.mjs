/** Completion fills forward; saved progress starts filled and keeps its semantics. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx=(type,props)=>({type,props});
let fill,animatedStyle,requests=[];
const module={exports:{}};
const source=fs.readFileSync('components/puzzle/PuzzleProgress.tsx','utf8');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{
 module,exports:module.exports,require:id=>{
  if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};
  if(id==='react')return{useEffect:fn=>fn()};
  if(id==='react-native')return{View:'View',StyleSheet:{create:s=>s}};
  if(id==='@/utils/scale')return{moderateScale:n=>n};
  if(id==='@/constants/puzzle-theme')return{PuzzleColors:{progress:'green',progressTop:'lime',progressTrack:'gray'}};
  if(id==='react-native-reanimated')return{__esModule:true,default:{View:'Fill'},ReduceMotion:{System:'system'},Easing:{cubic:n=>n*n*n,out:fn=>fn},
   useSharedValue:initial=>fill??={value:initial,get(){return this.value;},set(value){this.value=value;}},
   useAnimatedStyle:fn=>{animatedStyle=fn;return{};},withTiming:(to,options)=>{requests.push({from:fill.get(),to,...options});return to;}};
  throw new Error(`Unexpected import ${id}`);
 },
});
const{PuzzleProgress}=module.exports;
PuzzleProgress({steps:[false,false,false,false],label:'Puzzle 1 of 4'});
assert.equal(fill.get(),0);
requests=[];const bar=PuzzleProgress({steps:[true,false,false,false],label:'Puzzle 2 of 4'});
assert.equal(requests[0].from,0,'Completing a puzzle animates from previous progress');
assert.equal(requests[0].to,.25,'One of four completed tasks fills a quarter of the bar');
assert.ok(requests[0].duration>0&&requests[0].duration<600,'Feedback finishes without delaying the puzzle flow');
assert.equal(requests[0].reduceMotion,'system','Completion respects the device motion preference');
fill.set(.125);
assert.equal(animatedStyle().width,'12.5%','The fill exposes an intermediate state');
assert.equal(bar.props.children.props.style[0].left,0,'Completion grows from the left edge');
fill=undefined;requests=[];
const saved=PuzzleProgress({steps:[true,true,false,false],label:'Puzzle 3 of 4'});
assert.equal(requests[0].from,.5,'Saved progress is visible from its first frame');
assert.equal(saved.props.accessibilityRole,'progressbar');
assert.equal(saved.props.accessibilityValue.now,2);
assert.equal(saved.props.accessibilityValue.max,4);
fill=undefined;PuzzleProgress({steps:[],label:'No tasks'});
assert.equal(fill.get(),0,'An empty session never produces NaN');
fill=undefined;PuzzleProgress({steps:[true,true,true,true],label:'Complete'});
assert.equal(fill.get(),1,'A completed session fills the whole bar');
console.log('Verified continuous progress, saved completion, left-edge anchoring, accessible values and Reduce Motion.');
