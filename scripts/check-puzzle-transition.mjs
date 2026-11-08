/** New content remains readable and gets one complete, layout-ready arrival. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
let value, started, style, requests=[], reduced=false, evaluating=false;
const jsx=(type,props)=>({type,props});
const module={exports:{}};
const source=fs.readFileSync('components/puzzle/PuzzleContentTransition.tsx','utf8');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{
 module,exports:module.exports,require:id=>{
  if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};
  if(id==='react')return{useRef:initial=>started??={current:initial}};
  if(id==='@/utils/scale')return{moderateScale:n=>{assert.equal(evaluating,false,'Scale helpers must not execute on the UI runtime');return n;}};
  if(id==='react-native-reanimated')return{__esModule:true,default:{View:'AnimatedView'},Easing:{cubic:'cubic',out:()=> 'out-cubic'},ReduceMotion:{System:'system'},useReducedMotion:()=>reduced,
   useSharedValue:initial=>value??={value:initial,get(){return this.value;},set(next){this.value=next;}},
   useAnimatedStyle:fn=>{style=()=>{evaluating=true;try{return fn();}finally{evaluating=false;}};return{};},
   withTiming:(to,options)=>{requests.push({to,...options});return to;}};
  throw new Error('Unexpected import '+id);
 },
});
const{PuzzleContentTransition}=module.exports;
function fresh(){value=undefined;started=undefined;requests=[];}
fresh();let layouts=0;
let tree=PuzzleContentTransition({children:'Question',onLayout:()=>layouts++});
assert.equal(requests.length,0,'Mount work must not consume the arrival animation');
assert.equal(style().opacity,.85,'Content is readable even before the animation starts');
assert.equal(style().transform[0].translateX,28);
tree.props.onLayout({nativeEvent:{layout:{height:400}}});
assert.equal(layouts,1);
assert.equal(requests.length,1);
assert.equal(requests[0].duration,280);
assert.equal(requests[0].easing,'out-cubic');
assert.equal(requests[0].reduceMotion,'system');
assert.equal(style().opacity,1);
assert.equal(style().transform[0].translateX,0);
tree.props.onLayout({nativeEvent:{layout:{height:500}}});
assert.equal(layouts,2,'Layout measurements remain available to the native review harness');
assert.equal(requests.length,1,'Resizing or editing does not restart the transition');
value.set(.5);assert.ok(Math.abs(style().opacity-.925)<1e-9);assert.equal(style().transform[0].translateX,14);
assert.deepEqual(Object.keys(style()),['opacity','transform'],'The transition never animates layout properties');
fresh();reduced=true;tree=PuzzleContentTransition({children:'Question'});
assert.equal(style().opacity,1,'Reduced motion starts fully visible');
assert.equal(style().transform[0].translateX,0,'Reduced motion has no first-frame displacement');
console.log('Verified readable first frame, one layout-ready arrival, UI-safe transforms, resize and Reduce Motion.');
