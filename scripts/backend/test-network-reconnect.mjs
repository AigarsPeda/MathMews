import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function execute(file, globals) {
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,...globals});
  return module.exports;
}
const wifi={type:'WIFI',isConnected:true,isInternetReachable:true};
const offline={type:'NONE',isConnected:false,isInternetReachable:false};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function monitor() {
  let listener,appListener,state=wifi,query=()=>Promise.resolve(state),removed=0,reconnects=0;
  const AppState={currentState:'active',addEventListener:(_,callback)=>{appListener=callback;return {remove(){removed++;}};}};
  const network={addNetworkStateListener:callback=>{listener=callback;return {remove(){removed++;}};},getNetworkStateAsync:()=>query()};
  const {subscribeToNetworkReconnect}=execute('hooks/use-network-reconnect.ts',{require:id=>{
    if(id==='react')return {useEffect(){}};
    if(id==='react-native')return {AppState};
    if(id==='expo-network')return network;
    throw new Error(id);
  }});
  const stop=subscribeToNetworkReconnect(()=>{reconnects++;});
  return {stop,get count(){return reconnects;},get removed(){return removed;},query:fn=>{query=fn;},
    network:next=>{state=next;listener(next);},app:next=>{AppState.currentState=next;appListener(next);}};
}

test('network recovery and Wi-Fi/cellular switches wake sync once, repeated online events do not',async()=>{
  const h=monitor();await settle();assert.equal(h.count,0);
  h.network(offline);h.network(wifi);assert.equal(h.count,1);
  h.network(wifi);assert.equal(h.count,1);
  h.network({...wifi,type:'CELLULAR'});assert.equal(h.count,2);
  h.network({...wifi,isInternetReachable:false});assert.equal(h.count,2);
  h.network(wifi);assert.equal(h.count,3);
  h.stop();assert.equal(h.removed,2);
  h.network(offline);h.network(wifi);assert.equal(h.count,3);
});

test('recovery in background waits for resume and stale state queries cannot hide a newer event',async()=>{
  const h=monitor();await settle();
  h.app('background');h.network(offline);h.network(wifi);assert.equal(h.count,0);
  h.app('active');await settle();assert.equal(h.count,1);
  let release;h.query(()=>new Promise(resolve=>{release=resolve;}));
  h.app('active');h.network(offline);release(wifi);await settle();
  assert.equal(h.count,1,'An older query cannot overwrite the offline event');
  h.network(wifi);assert.equal(h.count,2);
  h.stop();
});

function transport(fetch) {
  const timers=new Map();let next=0;
  const {backendFetch}=execute('lib/backend-fetch.ts',{fetch,AbortController,
    setTimeout:callback=>{const id=++next;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id)});
  return {fetch:backendFetch,timers};
}
test('backend deadlines abort a stuck request and allow a new request without replaying a write',async()=>{
  let calls=0,signal;
  const h=transport(async(_,init)=>{calls++;signal=init.signal;if(calls===1)return new Promise(()=>{});return {status:200};});
  const first=h.fetch('https://backend.invalid/rpc/spend',{method:'POST',body:'persisted-request-id'});
  const rejected=assert.rejects(first,/timed out/);
  [...h.timers.values()][0]();await rejected;
  assert.equal(signal.aborted,true);assert.equal(calls,1);assert.equal(h.timers.size,0);
  assert.equal((await h.fetch('https://backend.invalid/status')).status,200);
  assert.equal(calls,2);assert.equal(h.timers.size,0);
});
test('backend fetch preserves caller cancellation and releases its deadline after a response',async()=>{
  const outer=new AbortController();let signal;
  const h=transport(async(_,init)=>{signal=init.signal;return {status:200};});
  const pending=h.fetch('https://backend.invalid/status',{signal:outer.signal});
  outer.abort('account changed');
  await pending;assert.equal(signal.aborted,true);assert.equal(signal.reason,'account changed');assert.equal(h.timers.size,0);
});
