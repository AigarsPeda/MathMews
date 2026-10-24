import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness({ platform='ios', enabled=true, environment='sandbox' }={}) {
  const cache=new Map(), stored=new Map(), calls=[], effects=[], timers=new Map();
  let browser={type:'cancel'}, apple={ok:false,cancelled:true}, authError=null, readError=null, rows=[], currentAccount='guest';
  let reconnect, writeError=null, readGate=null, holdWrites=false, serverRow=null;
  const pendingWrites=[];
  const storage={getItem:async key=>stored.get(key)??null, setItem:async(key,value)=>stored.set(key,value),
    removeItem:async key=>stored.delete(key),multiRemove:async keys=>keys.forEach(key=>stored.delete(key)),
    multiSet:async pairs=>pairs.forEach(([key,value])=>stored.set(key,value))};
  const auth={signOut:async()=>{calls.push('signOut');currentAccount=null;},
    signInWithOAuth:async()=>{calls.push('oauth');return {data:{url:'https://provider.invalid/authorize'},error:authError};},
    linkIdentity:async()=>({data:{url:'https://provider.invalid/authorize'},error:authError}),
    exchangeCodeForSession:async code=>{calls.push(['exchange',code]);if(!authError)currentAccount='restored';return {error:authError};},
    signInWithOtp:async()=>{calls.push('email');return {error:authError};}};
  const db={auth,from:()=>{
    const q={select:()=>q,eq:()=>q,order:async()=>({data:rows,error:readError}),
      maybeSingle:async()=>{if(readGate)await readGate;return {data:rows[0]??null,error:readError};},
      upsert:async value=>{
        calls.push(['write',value]);
        if(holdWrites)await new Promise(resolve=>pendingWrites.push(resolve));
        if(!writeError)serverRow=value;
        return {error:writeError};
      }};return q;
  }};
  const react={useEffect:fn=>effects.push(fn),useCallback:fn=>fn,useRef:value=>({current:value}),useState:value=>[value,()=>{}]};
  function load(id,base=process.cwd()) {
    if(id==='react')return react;
    if(id==='@/hooks/use-network-reconnect')return {useNetworkReconnect:callback=>{reconnect=callback;}};
    if(id==='@/hooks/use-world-clock-now')return {useWorldClockNow:()=>Date.now()};
    if(id==='@react-native-async-storage/async-storage')return storage;
    if(id==='react-native')return {Platform:{OS:platform},AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Dimensions:{get:()=>({width:390,height:844})},PixelRatio:{roundToNearestPixel:n=>n}};
    if(id==='@/lib/supabase')return {supabase:db,isSupabaseConfigured:()=>true};
    if(id==='@/services/auth/apple-native')return {getNativeAppleIdToken:async()=>{calls.push('apple');return apple;},signInWithAppleIdToken:async()=>{calls.push('appleSignIn');if(!authError)currentAccount='restored';return authError?{ok:false,error:'unavailable'}:{ok:true};}};
    if(id==='expo-auth-session')return {makeRedirectUri:()=> 'mathmews://auth/callback'};
    if(id==='expo-auth-session/build/QueryParams')return {getQueryParams:url=>({params:Object.fromEntries(new URL(url).searchParams)})};
    if(id==='expo-web-browser')return {maybeCompleteAuthSession(){},openAuthSessionAsync:async()=>browser};
    let file=id.startsWith('@/')?path.resolve(id.slice(2)):path.resolve(base,id);
    if(/\.(png|webp|mp4)$/.test(file))return file;
    if(!fs.existsSync(file))file=['.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);
    assert.ok(file,`Resolve ${id}`);
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    if(file.endsWith('.json')){module.exports=JSON.parse(fs.readFileSync(file,'utf8'));return module.exports;}
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,
      {module,exports:module.exports,require:child=>load(child,path.dirname(file)),URL,Date,Math,Set,Map,Promise,console:{log(){},warn(){}},__DEV__:false,
        process:{env:{EXPO_PUBLIC_APP_ENVIRONMENT:environment,EXPO_PUBLIC_APPLE_AUTH_ENABLED:String(enabled),EXPO_PUBLIC_GOOGLE_AUTH_ENABLED:String(enabled)}},
        setTimeout:(fn,delay)=>{timers.set(delay,fn);return delay;},clearTimeout:id=>timers.delete(id),
        setInterval:(fn,delay)=>{timers.set(`interval:${delay}`,fn);return `interval:${delay}`;},clearInterval:id=>timers.delete(id)});
    return module.exports;
  }
  return {load,stored,calls,effects,timers,pendingWrites,get serverRow(){return serverRow;},get currentAccount(){return currentAccount;},
    pauseRead(){let release;readGate=new Promise(resolve=>{release=resolve;});return release;},
    holdWrites(){holdWrites=true;},
    browser:value=>{browser=value;},apple:value=>{apple=value;},failAuth:()=>{authError={message:'provider unavailable'};},
    reconnect:()=>reconnect(),failWrite:()=>{writeError={message:'offline'};},recover:()=>{readError=null;writeError=null;},
    remote:value=>{rows=value;},failRead:()=>{readError={message:'offline'};}};
}

test('cancelled and failed Apple/Google recovery retain the existing guest session',async()=>{
  for(const platform of ['ios','android']) {
    for(const outcome of ['cancel','failed']) {
      const h=harness({platform});
      if(outcome==='failed') {h.apple({ok:true,idToken:'test-token'});h.browser({type:'success',url:'mathmews://auth/callback?code=test-code'});h.failAuth();}
      const result=await h.load('@/services/auth/protect-progress').restoreProgress();
      assert.equal(result.ok,false);assert.equal(h.currentAccount,'guest');assert.ok(!h.calls.includes('signOut'));
      if(outcome==='cancel')assert.equal(result.cancelled,true);
    }
  }
  const h=harness();
  await h.load('@/services/auth/protect-progress').sendParentEmailCode('parent@example.invalid','restore');
  assert.equal(h.currentAccount,'guest','Requesting a code must not sign out the current game');
});

test('unconfigured recovery fails before opening either provider',async()=>{
  for(const platform of ['ios','android']) {
    const h=harness({platform,enabled:false}),api=h.load('@/services/auth/protect-progress');
    assert.equal((await api.protectProgress()).error,'provider_not_configured');
    assert.equal((await api.restoreProgress()).error,'provider_not_configured');
    assert.equal(h.calls.length,0);
  }
});

test('OAuth accepts only a PKCE code on the application callback',async()=>{
  const h=harness(),{finishOAuthFromUrl}=h.load('@/services/auth/platform-account');
  for(const url of ['https://evil.invalid/auth/callback?code=x','mathmews://other?code=x',
    'mathmews://auth/callback#access_token=foreign&refresh_token=foreign','mathmews://auth/callback?code=x&access_token=foreign','invalid']) {
    assert.equal((await finishOAuthFromUrl(url)).ok,false,url);
  }
  assert.equal(h.calls.length,0);assert.equal(h.currentAccount,'guest');
  assert.equal((await finishOAuthFromUrl('mathmews://auth/callback?code=verified-code')).ok,true);
  assert.equal(JSON.stringify(h.calls),JSON.stringify([['exchange','verified-code']]));
});

test('switching accounts archives each game and restores its original save identity and timestamp',async()=>{
  const h=harness(),storage=h.load('@/utils/game-storage'),api=h.load('@/services/cloud-save/account-game');
  const a={...storage.createDefaultGameSave(),accountOwnerId:'a',hasCompletedOnboarding:true,
    wallet:{coins:3200},walletAuthority:{user_id:'a',environment:'sandbox',balance:3200,revision:8},
    pendingCoinRewards:[{userId:'a',attemptId:'old'}]};
  a.pet={...a.pet,name:'Account A'};
  const b=await api.prepareAccountGame('b',a,'save-a',1234);
  assert.equal(b.saveId,null);assert.equal(b.clientUpdatedAt,0);assert.equal(b.save.accountOwnerId,'b');
  assert.equal(b.save.walletAuthority,undefined);assert.equal(b.save.pendingCoinRewards,undefined);
  assert.equal(b.save.hasCompletedOnboarding,false);assert.notEqual(b.save.pet.name,'Account A');
  const back=await api.prepareAccountGame('a',b.save,'save-b',5678);
  assert.equal(back.saveId,'save-a');assert.equal(back.clientUpdatedAt,1234);assert.equal(back.save.wallet.coins,3200);
  assert.equal(back.save.pet.name,'Account A');
  await storage.restoreGameSaveSnapshot(back.save,back.clientUpdatedAt);
  assert.equal(await storage.getLocalSaveUpdatedAt(),1234,'Restoring an archive cannot make it newer than a cloud save');
  const again=await api.prepareAccountGame('b',back.save,back.saveId,back.clientUpdatedAt);
  assert.equal(again.saveId,'save-b');assert.equal(again.clientUpdatedAt,5678);
});

test('legacy wallet ownership is respected, corrupt archives fail closed, and deletion clears both environments',async()=>{
  const h=harness(),api=h.load('@/services/cloud-save/account-game'),save=h.load('@/utils/game-storage').createDefaultGameSave();
  const legacy={...save,walletAuthority:{user_id:'a',environment:'sandbox',balance:900,revision:1}};
  const b=await api.prepareAccountGame('b',legacy,'a-save',12);
  assert.equal(b.save.hasCompletedOnboarding,false);assert.equal(b.save.walletAuthority,undefined);
  h.stored.set('@mathmews/account-game:sandbox:a','{broken');
  await assert.rejects(()=>api.prepareAccountGame('a',b.save,'b-save',13));
  h.stored.set('@mathmews/account-game:production:a','server-independent-cache');
  for(const environment of ['sandbox','production']) h.stored.set(`@mathmews/wallet-outbox:a:${environment}`,'pending');
  h.stored.set('@mathmews/wallet-outbox:b:sandbox','other-account');
  await api.clearAccountGameArchives('a');
  for(const environment of ['sandbox','production']) assert.ok(!h.stored.has(`@mathmews/wallet-outbox:a:${environment}`));
  assert.ok(h.stored.has('@mathmews/wallet-outbox:b:sandbox'));
  assert.ok(!h.stored.has('@mathmews/account-game:sandbox:a'));
  assert.ok(!h.stored.has('@mathmews/account-game:production:a'));
  assert.ok(h.stored.has('@mathmews/account-game:sandbox:b'),'Other accounts remain intact');
});

test('cloud writes cannot cross accounts or run during authentication; read errors stay errors',async()=>{
  const h=harness(),api=h.load('@/services/cloud-save/cloud-save'),ops=h.load('@/services/auth/account-operation');
  const save={...h.load('@/utils/game-storage').createDefaultGameSave(),accountOwnerId:'a'};
  assert.equal(await api.pushRemoteSave('b','save-a',{save,clientUpdatedAt:1}),false);
  const release=ops.acquireAccountOperation('auth');
  assert.equal(await api.pushRemoteSave('a','save-a',{save,clientUpdatedAt:1}),false);release();
  assert.equal(h.calls.length,0);
  assert.equal(await api.pushRemoteSave('a','save-a',{save,clientUpdatedAt:1}),true);
  h.remote([{id:'save-b',save,client_updated_at:50,updated_at:new Date().toISOString()}]);
  assert.equal((await api.pullRemoteSave('b','save-b')).save.accountOwnerId,'b','The database row owner scopes restored progress');
  h.failRead();
  await assert.rejects(()=>api.listRemoteSaves('a'));await assert.rejects(()=>api.pullRemoteSave('a','save-a'));
  await assert.rejects(()=>api.listRemoteSaveSnapshots('a'));
});

test('authentication and checkout cannot overlap and a duplicate release cannot unlock another operation',()=>{
  const ops=harness().load('@/services/auth/account-operation');
  const auth=ops.acquireAccountOperation('auth');assert.equal(ops.acquireAccountOperation('purchase'),null);
  assert.equal(ops.isAccountTransitionActive(),true);auth();
  const purchase=ops.acquireAccountOperation('purchase');auth();
  assert.equal(ops.acquireAccountOperation('auth'),null);purchase();
  assert.ok(ops.acquireAccountOperation('auth'));
});

test('a failed initial cloud read enables offline play without authorizing uploads',async()=>{
  const h=harness();h.failRead();
  let save={...h.load('@/utils/game-storage').createDefaultGameSave(),accountOwnerId:'a'},complete=0;
  const cloudSyncRef={current:null};
  h.load('@/hooks/use-cloud-save-sync').useCloudSaveSync({isGameReady:true,isAuthReady:true,userId:'a',save,
    getSave:()=>save,setSave:next=>{save=next;},skipNextPersist:{current:true},activeSaveIdRef:{current:'save-a'},
    cloudSyncRef,onInitialCloudCheckComplete:()=>{complete++;}});
  const cleanups=h.effects.map(fn=>fn());
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(complete,1);assert.ok(h.timers.has(15000));
  await cloudSyncRef.current();
  assert.ok(!h.calls.some(call=>call[0]==='write'));
  cleanups.forEach(fn=>fn?.());assert.ok(!h.timers.has(15000));
});

test('failed cloud uploads retry the latest local save on reconnect and on the fallback timer',async()=>{
  const h=harness();
  let save={...h.load('@/utils/game-storage').createDefaultGameSave(),accountOwnerId:'a',hasCompletedOnboarding:true};
  const cloudSyncRef={current:null};
  h.load('@/hooks/use-cloud-save-sync').useCloudSaveSync({isGameReady:true,isAuthReady:true,userId:'a',save,
    getSave:()=>save,setSave:next=>{save=next;},skipNextPersist:{current:false},activeSaveIdRef:{current:'save-a'},cloudSyncRef});
  const cleanups=h.effects.map(fn=>fn());
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  await settle();
  h.failWrite();
  save={...save,pet:{...save.pet,name:'Offline progress'}};
  await assert.rejects(()=>cloudSyncRef.current(),/upload unavailable/);
  save={...save,pet:{...save.pet,name:'Latest offline progress'}};
  h.recover();h.reconnect();await settle();
  assert.equal(h.calls.filter(call=>call[0]==='write').at(-1)[1].save.pet.name,'Latest offline progress');
  const count=()=>h.calls.filter(call=>call[0]==='write').length;
  const afterReconnect=count();
  h.timers.get('interval:15000')();await settle();
  assert.equal(count(),afterReconnect,'A healthy idle sync must not upload repeatedly');
  h.failWrite();await assert.rejects(()=>cloudSyncRef.current());
  h.recover();h.timers.get('interval:15000')();await settle();
  assert.equal(count(),afterReconnect+2,'A pending failure retries even without a network event or save change');
  cleanups.forEach(fn=>fn?.());assert.ok(!h.timers.has('interval:15000'));
});

test('the Settings recovery action stays behind the parent gate and saves before changing identity',async()=>{
  let cursor=0;const slots=[],events=[];
  const react={useEffect(){},useState:value=>{const index=cursor++;if(!(index in slots))slots[index]=value;
    return [slots[index],next=>{slots[index]=next;}];}};
  const jsx=(type,props)=>({type,props}),module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync('components/settings/AccountRecoverySection.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,require:id=>{
    if(id==='react')return react;
    if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(id==='react-native')return {View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:value=>value}};
    if(id==='react-i18next')return {useTranslation:()=>({t:key=>key})};
    if(id==='@/constants/platform-auth')return {isPlatformAuthEnabled:()=>true,getPlatformRestoreProviderLabel:()=> 'Apple'};
    if(id==='@/contexts/AuthProvider')return {useAuth:()=>({userId:'a',isAuthReady:true,isAccountChanging:false,isPlatformAccountLinked:false,
      platformRestoreProvider:'apple',platformRestoreLabel:'Apple',restoreProgress:async()=>{events.push('restore');return {ok:false,cancelled:true};}})};
    if(id==='@/contexts/GameProvider')return {useGameActions:()=>({syncToCloud:async()=>events.push('save')})};
    if(id==='@/constants/game')return {GameColors:{}};
    if(id==='@/utils/scale')return {moderateScale:n=>n};
    if(id.startsWith('@/components/')){const name=path.basename(id);return {[name]:name};}
    throw new Error(id);
  }});
  const render=()=>{cursor=0;return module.exports.AccountRecoverySection();};
  let tree=render();tree.props.children.find(node=>node?.type==='Pressable' && node.props.children.props.children==='settings.account.restore').props.onPress();
  tree=render();let sheet=tree.props.children.find(node=>node?.type==='AppBottomSheet');
  assert.equal(sheet.props.children.type,'ParentGateSheet');assert.equal(events.length,0);
  sheet.props.children.props.onPass();
  tree=render();sheet=tree.props.children.find(node=>node?.type==='AppBottomSheet');
  await sheet.props.children.props.children.find(node=>node?.type==='Pressable').props.onPress();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(events,['save','restore']);
  assert.ok(!render().props.children.some(node=>node?.type==='AppBottomSheet'),'Cancellation closes the sheet without an error');
});

const settleSync = () => new Promise(resolve => setImmediate(resolve));
function mountCloudSync(h) {
  let save = { ...h.load('@/utils/game-storage').createDefaultGameSave(), accountOwnerId: 'a', hasCompletedOnboarding: true };
  const cloudSyncRef = { current: null }, activeSaveIdRef = { current: 'save-a' };
  h.load('@/hooks/use-cloud-save-sync').useCloudSaveSync({
    isGameReady: true, isAuthReady: true, userId: 'a', save,
    getSave: () => save, setSave: next => { save = next; },
    skipNextPersist: { current: false }, activeSaveIdRef, cloudSyncRef,
  });
  const cleanups = h.effects.map(fn => fn());
  return {
    cloudSyncRef, activeSaveIdRef, get save() { return save; },
    rename(name) { save = { ...save, pet: { ...save.pet, name } }; },
    cleanup() { cleanups.forEach(fn => fn?.()); },
  };
}

test('a delayed initial cloud read preserves and uploads gameplay made while it was pending', async () => {
  for (const hasRemote of [false, true]) {
    const h = harness(), release = h.pauseRead();
    if (hasRemote) h.remote([{ id: 'save-a', save: {
      ...h.load('@/utils/game-storage').createDefaultGameSave(), accountOwnerId: 'a', hasCompletedOnboarding: true,
    }, client_updated_at: Date.now(), updated_at: new Date().toISOString() }]);
    const m = mountCloudSync(h);
    await settleSync();
    m.rename('Played during recovery');
    release(); await settleSync();
    assert.equal(m.save.pet.name, 'Played during recovery');
    assert.equal(h.serverRow.save.pet.name, 'Played during recovery');
    const disk = await h.load('@/utils/game-storage').loadGameSave();
    assert.equal(disk.save.pet.name, 'Played during recovery');
    m.cleanup();
  }
});

test('a newer remote still restores when no gameplay occurred during the read', async () => {
  const h = harness(), release = h.pauseRead(), storage = h.load('@/utils/game-storage');
  const remote = { ...storage.createDefaultGameSave(), accountOwnerId: 'a', hasCompletedOnboarding: true };
  remote.pet = { ...remote.pet, name: 'Newer cloud progress' };
  h.remote([{ id: 'save-a', save: remote, client_updated_at: Date.now(), updated_at: new Date().toISOString() }]);
  const m = mountCloudSync(h); await settleSync(); release(); await settleSync();
  assert.equal(m.save.pet.name, remote.pet.name);
  m.cleanup();
});

test('overlapping cloud flushes serialize writes and finish with the newest snapshot', async () => {
  const h = harness(), m = mountCloudSync(h); await settleSync(); h.holdWrites();
  m.rename('Older'); const older = m.cloudSyncRef.current(); await settleSync();
  m.rename('Newer'); const newer = m.cloudSyncRef.current(); await settleSync();
  assert.equal(h.pendingWrites.length, 1, 'The newer request must wait for the older server write');
  h.pendingWrites.shift()(); await older; await settleSync();
  assert.equal(h.pendingWrites.length, 1);
  h.pendingWrites.shift()(); await newer;
  assert.equal(h.serverRow.save.pet.name, 'Newer');
  const count = h.calls.length;
  h.timers.get('interval:15000')(); await settleSync();
  assert.equal(h.calls.length, count, 'A completed queue does not keep retrying');
  m.cleanup();
});

test('gameplay during the initial upload is flushed after initialization completes', async () => {
  const h = harness(); h.holdWrites(); const m = mountCloudSync(h); await settleSync();
  assert.equal(h.pendingWrites.length, 1);
  m.rename('Played during upload'); h.pendingWrites.shift()(); await settleSync();
  assert.equal(h.pendingWrites.length, 1, 'The latest edit must not wait for an unrelated future edit');
  h.pendingWrites.shift()(); await settleSync();
  assert.equal(h.serverRow.save.pet.name, 'Played during upload');
  m.cleanup();
});

test('a queued cloud write rechecks account deletion and a failed write does not block the queue', async () => {
  const h = harness(), api = h.load('@/services/cloud-save/cloud-save');
  const save = { ...h.load('@/utils/game-storage').createDefaultGameSave(), accountOwnerId: 'a' };
  h.holdWrites();
  const first = api.pushRemoteSave('a', 'save-a', { save, clientUpdatedAt: 1 }); await settleSync();
  const second = api.pushRemoteSave('a', 'save-a', { save, clientUpdatedAt: 2 }); await settleSync();
  api.pauseAccountCloudWrites('a', true);
  h.pendingWrites.shift()(); await first;
  assert.equal(await second, false);
  assert.equal(h.pendingWrites.length, 0);
  api.pauseAccountCloudWrites('a', false);
  h.failWrite();
  const failed = api.pushRemoteSave('a', 'save-a', { save, clientUpdatedAt: 3 }); await settleSync();
  h.pendingWrites.shift()(); assert.equal(await failed, false);
  h.recover();
  const recovered = api.pushRemoteSave('a', 'save-a', { save, clientUpdatedAt: 4 }); await settleSync();
  h.pendingWrites.shift()(); assert.equal(await recovered, true);
});
