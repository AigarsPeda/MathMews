/** Run the native gesture callbacks offline, including cancellation and scroll locking. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const shared = initial => ({ value:initial,get(){return this.value;},set(value){this.value=value;} });
let context, queue=[];
const flush=()=>{const pending=queue;queue=[];pending.forEach(fn=>fn());};
const jsx=(type,props)=>({type,props});
const mocks={
 react:{createContext:()=>({}),useContext:()=>context,useCallback:fn=>fn,useEffect:()=>{},useMemo:fn=>fn(),useRef:value=>({current:value}),useState:value=>[value,()=>{}]},
 'react/jsx-runtime':{jsx,jsxs:jsx},
 'react-native':{View:'View',Text:'Text',StyleSheet:{create:styles=>styles,absoluteFill:{}}},
 'expo-haptics':{selectionAsync:async()=>{}},
 '@/constants/game':{GameColors:{}},'@/utils/scale':{moderateScale:n=>n},
 'react-native-worklets':{scheduleOnRN:(fn,...args)=>queue.push(()=>fn(...args))},
 'react-native-reanimated':{__esModule:true,default:{View:'AnimatedView'},useSharedValue:shared,useAnimatedRef:()=>({rect:{pageX:110,pageY:220,width:64,height:60}}),measure:ref=>ref.rect,useAnimatedStyle:fn=>fn()},
 'react-native-gesture-handler':{GestureDetector:'GestureDetector',Gesture:{Pan(){const gesture={handlers:{},options:{}};for(const key of ['enabled','maxPointers','minDistance'])gesture[key]=value=>{gesture.options[key]=value;return gesture;};for(const key of ['onBegin','onStart','onUpdate','onEnd','onFinalize'])gesture[key]=fn=>{gesture.handlers[key]=fn;return gesture;};return gesture;}}},
};
const cache=new Map();
function load(id){
 if(mocks[id])return mocks[id];
 if(cache.has(id))return cache.get(id);
 const file=id.replace('@/','')+(id.endsWith('.tsx')?'':'.ts');
 const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,require:load,Map,Set});cache.set(id,module.exports);return module.exports;
}
const {PuzzleDragBoard,PuzzleDragTile}=load('@/components/puzzle/PuzzleDragBoard.tsx');
// Native measurement callbacks run on JS while shared-value writes are queued
// for the UI thread. Reading a shared value between writes returns old geometry.
const board=PuzzleDragBoard({children:null,onDrop:()=>{},onDragStateChange:()=>{}}).props.value;
board.board.current={};
const measurementCallbacks=[],zoneWrites=[];
board.zones.set=value=>zoneWrites.push(value);
for(const [i,id] of ['bank','gap-0','gap-1'].entries()){
 board.register(id,{measureLayout:(_ancestor,done)=>measurementCallbacks.push(()=>done(i*80,0,64,60))});
}
board.refresh();measurementCallbacks.splice(0).forEach(done=>done());
assert.deepEqual(Array.from(zoneWrites.at(-1),zone=>zone.id),['bank','gap-0','gap-1'],'All native drop targets survive queued UI-thread writes');
board.register('gap-0',null);
assert.deepEqual(Array.from(zoneWrites.at(-1),zone=>zone.id),['bank','gap-1'],'Unmounting a gap preserves the other native targets');
board.refresh();board.register('gap-1',null);measurementCallbacks.splice(0).forEach(done=>done());
assert.deepEqual(Array.from(zoneWrites.at(-1),zone=>zone.id),['bank'],'Late measurements cannot resurrect an unmounted target');
function setup(disabled=false){
 const locks=[],drops=[];
 context={board:{rect:{pageX:100,pageY:200,width:300,height:500}},zones:shared([{id:'basket',x:130,y:100,width:100,height:140}]),source:shared(''),hovered:shared(null),position:shared({x:0,y:0,width:0,height:0}),begin:()=>locks.push(true),finish:(id,target)=>{locks.push(false);if(target!==null)drops.push([id,target]);}};
 const element=PuzzleDragTile({id:'tile',label:'12',disabled,accessibilityLabel:'12',accessibilityHint:'Drag',actions:[{id:'basket',label:'Move to basket'}]});
 return {...element.props.gesture,element,locks,drops};
}
function begin(g){g.handlers.onBegin();flush();g.handlers.onStart();}
const g=setup();begin(g);
assert.equal(g.locks.at(-1),true,'The scroll view locks for a tile gesture');
g.handlers.onUpdate({translationX:170,translationY:130,absoluteX:280,absoluteY:370});
assert.equal(context.position.get().x,180,'The tile follows the finger relative to its board');
assert.equal(context.position.get().y,150);
assert.equal(context.hovered.get(),'basket','A hovered target is highlighted');
g.handlers.onEnd({absoluteX:280,absoluteY:370});g.handlers.onFinalize({},true);flush();
assert.deepEqual(g.drops,[['tile','basket']]);assert.equal(g.locks.at(-1),false);assert.equal(context.source.get(),'');assert.equal(context.hovered.get(),null);
const outside=setup();begin(outside);outside.handlers.onEnd({absoluteX:500,absoluteY:700});outside.handlers.onFinalize({},true);flush();
assert.deepEqual(outside.drops,[],'Releasing outside a target preserves the assignment');assert.equal(outside.locks.at(-1),false);
const cancelled=setup();begin(cancelled);cancelled.handlers.onUpdate({translationX:170,translationY:130,absoluteX:280,absoluteY:370});cancelled.handlers.onEnd({absoluteX:280,absoluteY:370});cancelled.handlers.onFinalize({},false);flush();
assert.deepEqual(cancelled.drops,[],'Cancelled gestures never place a tile, even over a valid target');assert.equal(cancelled.locks.at(-1),false);assert.equal(context.hovered.get(),null);
const tap=setup();tap.handlers.onBegin();flush();tap.handlers.onFinalize({},false);flush();assert.equal(tap.locks.at(-1),false,'A touch that never becomes a drag unlocks scrolling');
const missing=setup();context.board.rect=null;begin(missing);missing.handlers.onEnd({absoluteX:280,absoluteY:370});missing.handlers.onFinalize({},true);flush();assert.deepEqual(missing.drops,[],'A missing native measurement cannot cause an accidental placement');assert.equal(missing.locks.at(-1),false);
const answered=setup(true);assert.equal(answered.options.enabled,false);assert.equal(answered.element.props.children.props.accessibilityActions.length,0,'Solved boards disable accessible placement actions too');
const accessible=setup();accessible.element.props.children.props.onAccessibilityAction({nativeEvent:{actionName:'basket'}});assert.deepEqual(accessible.drops,[['tile','basket']],'Screen-reader actions perform the same placement');
console.log('Verified native drop-target registration across queued UI-thread writes, movement, board coordinates, target highlighting, outside drops, cancellation, unavailable measurements, scroll unlocking, solved boards and accessibility actions.');
