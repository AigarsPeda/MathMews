/** Inject failures into the real hooks/view; validate cancellation, recovery and persisted diagnostics. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function execute(file, mocks, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: id => {
    assert.ok(id in mocks, `Missing mock: ${id} in ${file}`); return mocks[id];
  }, setTimeout, clearTimeout, console, ...globals }, { filename: file });
  return module.exports;
}
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
function hookHarness() {
  let cursor = 0, states = [], effects = [], cleanups = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useEffect(effect) { effects.push(effect); },
    useMemo(fn,deps) { const i=cursor++, old=states[i];
      if (!old || deps.some((v,index)=>v!==old.deps[index])) states[i]={deps,value:fn()};
      return states[i].value;
    },
  };
  return { react, render(fn) { cursor = 0; effects = []; return fn(); },
    mount() { cleanups = effects.map(effect => effect()).filter(Boolean); },
    unmount() { cleanups.forEach(fn => fn()); cleanups = []; } };
}
const cleanupMock = { withCleanupScope: fn => fn };
const recoveryDir = 'scripts/native/filament-recovery/';
for (const file of ['hooks/useDisposableResource.ts','hooks/useBuffer.ts', 'hooks/useModel.ts','hooks/useWorkletEffect.ts','react/FilamentView.tsx']) {
  assert.equal(fs.readFileSync(`node_modules/react-native-filament/src/${file}`, 'utf8'),
    fs.readFileSync(recoveryDir + file.split('/').at(-1) + '.txt', 'utf8'), 'Installed dependency must match its reproducible patch');
}
for (const kind of ['sync', 'async']) {
  const h = hookHarness();
  const { useDisposableResource: hook } = execute('node_modules/react-native-filament/src/hooks/useDisposableResource.ts', {
    react: h.react, '../utilities/withCleanupScope': cleanupMock,
  });
  const failure = new Error(`${kind} allocation failure`);
  const initializer = () => { if (kind === 'sync') throw failure; return Promise.reject(failure); };
  h.render(() => hook(initializer, [])); h.mount(); await settle();
  assert.throws(() => h.render(() => hook(initializer, [])), error => error === failure,
    'Allocation errors must reach a scene boundary during render');
  h.unmount();
}
for (const reject of [false,true]) {
  const h = hookHarness(), pending = deferred(); let released = 0;
  const { useDisposableResource: hook } = execute('node_modules/react-native-filament/src/hooks/useDisposableResource.ts', {
    react: h.react, '../utilities/withCleanupScope': cleanupMock,
  });
  h.render(() => hook(() => pending.promise, [])); h.mount(); await settle(); h.unmount();
  if (reject) pending.reject(new Error('Cancelled initialization')); else pending.resolve({release(){released++;}});
  await settle(); assert.equal(released, reject ? 0 : 1, 'Late allocations are released once');
  assert.equal(h.render(() => hook(() => undefined, [])), undefined, 'Cancelled effects never publish errors or resources');
}
{
  const h = hookHarness(); let initialized = 0;
  const { useDisposableResource: hook } = execute('node_modules/react-native-filament/src/hooks/useDisposableResource.ts', {react:h.react,'../utilities/withCleanupScope':cleanupMock});
  h.render(() => hook(() => {initialized++;}, []));h.mount();h.unmount();await settle();
  assert.equal(initialized,0,'Do not begin allocations after unmount');
}
for (const releaseOnUnmount of [false,true]) {
  const h=hookHarness(), pending=deferred();let released=0;
  const {useBuffer:hook}=execute('node_modules/react-native-filament/src/hooks/useBuffer.ts',{
    react:h.react,'../utilities/withCleanupScope':cleanupMock,'../native/FilamentProxy':{FilamentProxy:{loadAsset:()=>pending.promise}},
    'react-native':{Image:{resolveAssetSource:()=>({uri:'bundle://cat.glb'})}},
  });
  h.render(()=>hook({source:1,releaseOnUnmount}));h.mount();await settle();h.unmount();
  pending.resolve({release(){released++;}});await settle();
  assert.equal(released,1,'Even model-owned buffers must be released if they never reached useModel');
  assert.equal(h.render(()=>hook({source:1,releaseOnUnmount})),undefined);
}
{
  const h=hookHarness(), failure=new Error('Asset missing');
  const {useBuffer:hook}=execute('node_modules/react-native-filament/src/hooks/useBuffer.ts',{
    react:h.react,'../utilities/withCleanupScope':cleanupMock,'../native/FilamentProxy':{FilamentProxy:{loadAsset:()=>Promise.reject(failure)}},
    'react-native':{Image:{resolveAssetSource:()=>({uri:'bundle://cat.glb'})}},
  });h.render(()=>hook({source:1}));h.mount();await settle();
  assert.throws(()=>h.render(()=>hook({source:1})),error=>error===failure,'Failed assets must recover rather than load forever');h.unmount();
}
{
  const h=hookHarness(), failure=new Error('Worklet setup failed'), reported=[];
  const {useWorkletEffect:hook}=execute('node_modules/react-native-filament/src/hooks/useWorkletEffect.ts',{
    react:h.react,'./useFilamentContext':{useFilamentContext:()=>({workletContext:{runAsync:async fn=>fn()}})},
    'react-native-worklets-core':{getWorkletDependencies:()=>[],isWorklet:()=>true},'../ErrorUtils':{reportWorkletError:(...args)=>reported.push(args)},
  });const fn=()=>{throw failure;};h.render(()=>hook(fn));h.mount();await settle();
  assert.throws(()=>h.render(()=>hook(fn)),error=>error===failure);h.unmount();await settle();
  assert.ok(reported.every(([,fatal])=>fatal===false),'Cleanup failures must not be promoted to fatal errors');
}
class Component {
  constructor(props){this.props=props;}
  setState(next){this.state={...this.state,...next};}
}
const jsx = (type,props)=>({type,props});
let frame, draws=0, stops=0, nativeReports=[];
const context={renderer:{setClearContent(){},beginFrame(){draws++;return true;},render(){},endFrame(){}},view:{},engine:{setSwapChain(){throw Error('Must not install late swapchain');}},
  workletContext:{runAsync:async fn=>fn()},choreographer:{addFrameCallbackListener(fn){frame=fn;return{remove(){}};},start(){},stop(){stops++;}}};
const {FilamentView}=execute('node_modules/react-native-filament/src/react/FilamentView.tsx',{
  react:{PureComponent:Component,createRef:()=>({current:{}})},'react/jsx-runtime':{jsx},
  '../native/FilamentProxy':{FilamentProxy:{}},'../native/specs/FilamentViewNativeComponent':{},
  '../ErrorUtils':{reportWorkletError:(...args)=>nativeReports.push(args)},'../hooks/useFilamentContext':{FilamentContext:{}},
  'react-native':{findNodeHandle:()=>1},'react-native-worklets-core':{Worklets:{createSharedValue:value=>({value}),createRunOnJS:fn=>fn}},
  '../utilities/logger/Logger':{getLogger:()=>({debug(){},info(){}})},'./TouchHandlerContext':{getTouchHandlers:()=>({})},
});
{
  const view=new FilamentView({enableTransparentRendering:true});view.context=context;view.componentDidMount();
  const failure=new Error('Bad animation frame');let called=0;
  await view.updateRenderCallback(()=>{called++;throw failure;},{isValid:true});
  frame({timestamp:1});frame({timestamp:2});assert.equal(called,1,'Stop frames at the first failure');
  assert.equal(draws,0,'Do not draw the failed scene');assert.equal(stops,1);assert.equal(nativeReports.length,0,'Frame failures belong to the scene boundary');
  assert.throws(()=>view.render(),/Bad animation frame/);view.componentWillUnmount();
}
{
  const view=new FilamentView({enableTransparentRendering:true});view.context=context;view.componentDidMount();let called=0;
  await view.updateRenderCallback(()=>called++,{isValid:false});frame({timestamp:1});
  assert.equal(called,0);assert.throws(()=>view.render(),/released before drawing/);view.componentWillUnmount();
}
{
  const view=new FilamentView({enableTransparentRendering:true}), pending=deferred();let released=0;
  view.context={...context,workletContext:{runAsync:()=>pending.promise}};view.componentDidMount();
  const creating=view.onSurfaceCreated({});view.componentWillUnmount();pending.resolve({release(){released++;}});
  await creating;assert.equal(released,1);assert.equal(view.swapChain,undefined,'Never install a surface after its view was removed');
}
let reports=[];
const {RecoveryBoundary}=execute('components/recovery/RecoveryBoundary.tsx',{
  react:{Component},'@/lib/app-diagnostics':{reportAppError:(...args)=>reports.push(args)},
});
const boundary=new RecoveryBoundary({scope:'room',children:'game',fallback:(_,retry)=>({retry})});
boundary.state=RecoveryBoundary.getDerivedStateFromError(new Error('Scene failure'));
boundary.componentDidCatch(boundary.state.error,{componentStack:'Room'});assert.equal(reports.length,1);
boundary.render().retry();assert.equal(boundary.render(),'game','Retry preserves parent game state');
let timeout, sceneActive = true;
const h=hookHarness();const {SceneLoadGuard}=execute('components/recovery/SceneLoadGuard.tsx',{
  react:h.react,'react/jsx-runtime':{jsx},
  "@/hooks/use-animation-activity": { useAnimationActivity: () => ({active:sceneActive}) },
},{setTimeout:fn=>{timeout=fn;return 1;},clearTimeout(){}});
h.render(()=>SceneLoadGuard({ready:false,children:'loading'}));h.mount();timeout();
assert.throws(()=>h.render(()=>SceneLoadGuard({ready:false,children:'loading'})),/20 seconds/);
assert.equal(h.render(()=>SceneLoadGuard({ready:true,children:'ready'})),'ready');h.unmount();
sceneActive = false;
assert.equal(h.render(()=>SceneLoadGuard({ready:false,children:'covered'})),'covered','Covered scenes must not trigger recovery');
h.mount();h.unmount();sceneActive=true;
assert.equal(h.render(()=>SceneLoadGuard({ready:false,children:'resuming'})),'resuming','Returning to Home gets a fresh loading deadline');


// A root failure during startup must expose the recovery controls, not leave a native splash on top.
const ah=hookHarness();let hideSplash=0,recoveryFrame;
const {AppRecoveryScreen}=execute('components/recovery/AppRecoveryScreen.tsx',{
 react:ah.react,'react/jsx-runtime':{jsx,jsxs:jsx},
 'react-native':{View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:styles=>styles}},
 'expo-splash-screen':{hideAsync:async()=>{hideSplash++;}},'@/i18n':{t:key=>key},'@/constants/game':{GameColors:{}},
},{requestAnimationFrame:fn=>{recoveryFrame=fn;return 1;},cancelAnimationFrame(){}});
ah.render(()=>AppRecoveryScreen({retry(){}}));ah.mount();recoveryFrame();await settle();
assert.equal(hideSplash,1,'Startup failures reveal recovery controls');ah.unmount();
let handler,delegated=0;
execute('lib/init-error-reporting.ts',{'@/lib/app-diagnostics':{reportAppError:(...args)=>reports.push(args)}},{
 ErrorUtils:{getGlobalHandler:()=>()=>{delegated++;},setGlobalHandler:fn=>{handler=fn;}},
});handler(new Error('Unhandled error'),true);
assert.equal(delegated,1,'Unknown fatal errors must retain React Native handling');assert.equal(reports.at(-1)[2],true);

const saves=[];
const diagnostics=execute('lib/app-diagnostics.ts',{'@react-native-async-storage/async-storage':{
  getItem:async()=>null,setItem:async(key,value)=>saves.push([key,value]),
}});
await diagnostics.diagnosticsReady;
for(let i=0;i<45;i++)diagnostics.reportAppError(`scene-${i}`,{message:`error ${i} https://example.com/path?access_token=secret password=hidden Authorization: Bearer privatecredential`,stack:'stack'});
diagnostics.reportAppError('scene-44',{message:'error 44 https://example.com/path?access_token=secret password=hidden Authorization: Bearer privatecredential',stack:'stack'});
await settle();assert.equal(diagnostics.getAppDiagnostics().length,30);assert.equal(diagnostics.getAppDiagnostics()[0].scope,'scene-15');
assert.ok(!diagnostics.formatAppDiagnostics().includes('secret'));assert.ok(!diagnostics.formatAppDiagnostics().includes('hidden'));assert.ok(!diagnostics.formatAppDiagnostics().includes('privatecredential'));
for(let i=0;i<200;i++)await Promise.resolve();assert.ok(saves.length);assert.ok(saves.every(([key])=>key==='@mathmews/diagnostics'),'Diagnostics never overwrite the game save');
assert.equal(JSON.parse(saves.at(-1)[1]).length,30);
const stored=saves.at(-1)[1];const restored=execute('lib/app-diagnostics.ts',{'@react-native-async-storage/async-storage':{getItem:async()=>stored,setItem:async()=>{}}});
await restored.diagnosticsReady;assert.equal(restored.getAppDiagnostics().length,30,'Reports survive a restart');
for(const failing of [false,true]){
 const pending=deferred(), writes=[], mode=execute('lib/graphics-mode.ts',{
  react:{useSyncExternalStore(){}},'@/lib/app-diagnostics':{reportAppError(){}},
  '@react-native-async-storage/async-storage':{getItem:()=>pending.promise,setItem:async(key,value)=>writes.push(value)},
 });assert.equal(mode.getGraphicsMode(),'loading');mode.enableSimpleGraphicsForSession();
 if(failing)pending.reject(Error('Storage failed'));else pending.resolve('3d');await mode.graphicsModeReady;await settle();
 assert.equal(mode.getGraphicsMode(),'simple','A late storage read cannot override automatic recovery');assert.equal(writes.length,0,'Automatic recovery never persists Simple graphics');
 mode.setSimpleGraphics(false);await settle();assert.equal(mode.getGraphicsMode(),'3d');assert.equal(writes.at(-1),'3d');
 mode.setSimpleGraphics(true);await settle();assert.equal(writes.at(-1),'simple','An explicit Settings choice is saved');
}
for (const preference of [null, '3d', 'simple', 'true', 'invalid', new Error('Storage failed')]) {
 const mode = execute('lib/graphics-mode.ts', {
  react:{useSyncExternalStore(){}},'@/lib/app-diagnostics':{reportAppError(){}},
  '@react-native-async-storage/async-storage':{getItem:async key=>{
   assert.equal(key,'@mathmews/graphics-mode','Legacy persisted crash flags cannot override the new default');
   if(preference instanceof Error)throw preference;return preference;
  },setItem:async()=>{}},
 });await mode.graphicsModeReady;
 assert.equal(mode.getGraphicsMode(),preference==='simple'?'simple':'3d','3D is the default; only an explicit Simple preference disables it');
}
const rooms=['livingRoom','bedroom','bathroom','kitchen'];
const cache=execute('utils/native-scene-cache.ts',{'@/constants/home-rooms':{HOME_ROOM_IDS:rooms}});
assert.deepEqual(rooms.filter(room=>cache.shouldMountNativeRoom(room)),rooms,'All four home scenes warm at startup and stay mounted');
assert.equal(cache.shouldMountNativeRoom('unknown'),false);
let timers=[],ready=0,completed=0,steps=[];
const sh=hookHarness();sh.react.useRef=value=>({current:value});
const clips=JSON.parse(fs.readFileSync('scripts/3d/clips.json','utf8'));
const {StaticCatDisplay}=execute('components/pet/native/StaticCatDisplay.tsx',{
 react:sh.react,'react/jsx-runtime':{jsx},'react-native':{Image:'Image',StyleSheet:{absoluteFill:{}}},
 '@/constants/cat-animation-clips':{CAT_ANIMATION_CLIPS:clips},'@/hooks/use-animation-activity':{useAnimationActivity:()=>({active:true})},
 '@/assets/3d/cat-preview.png':1,
},{setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){}});
const playback={kind:'scenario',steps:[{assetKey:'excited'},{assetKey:'eating'}]};
const portrait=sh.render(()=>StaticCatDisplay({playback,onReady:()=>ready++,onStepComplete:index=>steps.push(index),onAnimationComplete:()=>completed++}));sh.mount();
assert.equal(portrait.props.style[1].width,"100%","Intrinsic PNG dimensions must not overflow the cat slot");
assert.equal(ready,1);timers.forEach(({fn})=>fn());assert.equal(steps.join(','),'0,1');assert.equal(completed,1);
assert.ok(timers[1].ms>timers[0].ms,'Fallback care scenarios preserve step ordering');sh.unmount();
console.log('Verified rejected/synchronous loads, cancelled resources, frame stop/recovery, late surfaces, retry, stalled scenes, bounded local reports, graphics persistence, engine limits and fallback care completion.');

for (const staleBeforeLoad of [false,true]) {
  let valid=true,loaded=0,released=0,initializer;
  const buffer={get isValid(){return valid;},release(){assert.equal(valid,true);valid=false;released++;}};
  const asset={release(){},getBoundingBox:()=>({}),getRoot:()=>({})};
  const {useModel:renderModel}=execute('node_modules/react-native-filament/src/hooks/useModel.ts',{
    react:{useMemo:fn=>fn()},'./useBuffer':{useBuffer:()=>buffer},
    './useFilamentContext':{useFilamentContext:()=>({engine:{loadAsset(value){assert.equal(value.isValid,true);loaded++;return asset;}},scene:{},workletContext:{runAsync:async fn=>{if(staleBeforeLoad)valid=false;return fn();}}})},
    './useDisposableResource':{useDisposableResource:fn=>{initializer=fn;}},'./usePrevious':()=>false,'./useWorkletEffect':{useWorkletEffect(){}},
  });
  renderModel(1);await initializer();
  assert.equal(loaded,staleBeforeLoad?0:1);assert.equal(released,staleBeforeLoad?0:1);
  const retry=initializer();assert.equal(retry,undefined,'A consumed buffer waits for a fresh allocation after Fast Refresh');
}
console.log('Verified consumed model buffers and buffers released before queued loading are never reused.');
