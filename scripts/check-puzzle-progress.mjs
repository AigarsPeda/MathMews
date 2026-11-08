/** Completion uses fixed-size translated materials, including interrupted updates. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx=(type,props)=>({type,props});
let fill,width=0,animatedStyles=[],requests=[];
const module={exports:{}};
const source=fs.readFileSync('components/puzzle/PuzzleProgress.tsx','utf8');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{
 module,exports:module.exports,require:id=>{
  if(id==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'Fragment'};
  if(id==='react')return{useEffect:fn=>fn(),useState:()=>[width,value=>{width=value;} ]};
  if(id==='react-native')return{View:'View',StyleSheet:{create:s=>s,absoluteFillObject:{position:'absolute',left:0,right:0,top:0,bottom:0}}};
  if(id==='@/utils/scale')return{moderateScale:n=>n};
  if(id==='@/constants/puzzle-theme')return{PuzzleColors:{progress:'green',progressTop:'lime',progressTrack:'gray'},TopicPathColors:{progress:'purple',progressTrack:'lavender'}};
  if(id==='react-native-reanimated')return{__esModule:true,default:{View:'Fill'},ReduceMotion:{System:'system'},Easing:{cubic:n=>n*n*n,out:fn=>fn},
   useSharedValue:initial=>fill??={value:initial,get(){return this.value;},set(value){this.value=value;}},
   useAnimatedStyle:fn=>{animatedStyles.push(fn);return{};},withTiming:(to,options)=>{requests.push({from:fill.get(),to,...options});return to;}};
  throw new Error(`Unexpected import ${id}`);
 },
});
const{PuzzleProgress}=module.exports;
function render(props){animatedStyles=[];return PuzzleProgress(props);}
function fresh(){fill=undefined;width=0;requests=[];}
const props=steps=>({steps,label:'Puzzle progress'});
fresh();
let bar=render(props([false,false,false,false]));
assert.equal(fill.get(),0);
assert.equal(bar.props.children.props.style.at(-1).width,'0%','The unmeasured track never flashes full');
bar.props.onLayout({nativeEvent:{layout:{width:200}}});
requests=[];bar=render(props([true,false,false,false]));
assert.equal(requests[0].from,0);
assert.equal(requests[0].to,.25);
assert.ok(requests[0].duration>0&&requests[0].duration<600);
assert.equal(requests[0].reduceMotion,'system');
fill.set(.125);
for(const style of animatedStyles){
 assert.equal(style().transform[0].translateX,-175,'An intermediate frame reveals exactly 12.5% of the measured track');
 assert.deepEqual(Object.keys(style()),['transform'],'Animation must not change layout properties');
}
const material=bar.props.children.props.children[0];
assert.equal(material.props.style[0].left,0);
assert.equal(material.props.style[1].right,0,'The fill keeps its full measured size');
assert.equal(material.props.pointerEvents,'none');
fill.set(.375);requests=[];render(props([true,true,true,false]));
assert.equal(requests[0].from,.375,'An interrupted update continues from the current visible fill');
assert.equal(requests[0].to,.75);
fresh();
const saved=render(props([true,true,false,false]));
assert.equal(requests[0].from,.5);
assert.equal(saved.props.children.props.style.at(-1).width,'50%','Saved progress paints before measurement');
assert.equal(saved.props.accessibilityRole,'progressbar');
assert.equal(saved.props.accessibilityValue.now,2);
assert.equal(saved.props.accessibilityValue.max,4);
saved.props.onLayout({nativeEvent:{layout:{width:200}}});render(props([true,true,false,false]));
assert.equal(animatedStyles[0]().transform[0].translateX,-100,'Measurement does not change visible completion');
width=320;render(props([true,true,false,false]));
assert.equal(animatedStyles[0]().transform[0].translateX,-160,'Resize preserves the completion ratio');
fresh();render({steps:[],label:'No tasks'});assert.equal(fill.get(),0);
fresh();render(props([true,true,true,true]));assert.equal(fill.get(),1);
requests=[];
const instant=render({...props([true,false,false,false]),animated:false});
assert.equal(requests.length,0);
assert.equal(instant.props.children.props.style.at(-1).width,'25%');
console.log('Verified transform-only fill, interrupted updates, first-frame saved progress, resize, accessible values and Reduce Motion.');
