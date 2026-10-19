/** Completion fills forward; saved progress starts filled and keeps its semantics. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx=(type,props)=>({type,props});
let fill,animatedStyle,requests=[];
const module={exports:{}};
const source=fs.readFileSync('components/puzzle/PuzzleProgress.tsx','utf8')+'\nexport { ProgressSegment };';
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{
 module,exports:module.exports,require:id=>{
  if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};
  if(id==='react')return{useEffect:fn=>fn()};
  if(id==='react-native')return{View:'View',StyleSheet:{create:s=>s}};
  if(id==='@/utils/scale')return{moderateScale:n=>n};
  if(id==='@/constants/game')return{GameColors:{success:'green',cardBorder:'peach'}};
  if(id==='react-native-reanimated')return{__esModule:true,default:{View:'Fill'},ReduceMotion:{System:'system'},Easing:{cubic:n=>n*n*n,out:fn=>fn},
   useSharedValue:initial=>fill??={value:initial,get(){return this.value;},set(value){this.value=value;}},
   useAnimatedStyle:fn=>{animatedStyle=fn;return{};},withTiming:(to,options)=>{requests.push({from:fill.get(),to,...options});return to;}};
  throw new Error(`Unexpected import ${id}`);
 },
});
const{ProgressSegment,PuzzleProgress}=module.exports;
ProgressSegment({done:false});
assert.equal(fill.get(),0);
requests=[];const segment=ProgressSegment({done:true});
assert.equal(requests[0].from,0,'Completing a puzzle starts from the empty segment');
assert.equal(requests[0].to,1,'The fill reaches the complete segment');
assert.ok(requests[0].duration>0&&requests[0].duration<600,'Feedback finishes without delaying the puzzle flow');
assert.equal(requests[0].reduceMotion,'system','Completion respects the device motion preference');
fill.set(.5);
assert.equal(animatedStyle().transform[0].scaleX,.5,'The green fill exposes an intermediate state');
assert.equal(segment.props.children.props.style[0].transformOrigin,'left center','Completion grows from the left edge');
fill=undefined;requests=[];ProgressSegment({done:true});
assert.equal(requests[0].from,1,'Previously completed progress is full from its first frame');
const bar=PuzzleProgress({steps:[true,true,false,false],label:'Puzzle 3 of 4'});
assert.equal(bar.props.accessibilityRole,'progressbar');
assert.equal(bar.props.accessibilityValue.now,2);
assert.equal(bar.props.accessibilityValue.max,4);
console.log('Verified progressive fill, saved progress, left-edge anchoring, accessible completion and Reduce Motion.');
