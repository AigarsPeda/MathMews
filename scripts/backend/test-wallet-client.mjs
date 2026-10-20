/* eslint-disable react-hooks/rules-of-hooks -- This unit runner executes hooks with a test dispatcher, without a native renderer. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { createRequire } from 'node:module';
const {validateStoreConfig}=createRequire(import.meta.url)('./release-config.cjs');

function harness({dev=true,environment='production'}={}) {
  const cache=new Map(),stored=new Map(),calls=[],entries=[],orders=[];
  let save,coinBalance=500,revision=1,failAfterDebit=false,queueUnavailable=false,authUser='account-a',storePrice=null,offline=false,forcedRejection=null,walletGate=null,failSettlementSave=false;
  const rewarded=new Set();
  let reconnect;
  const react={useCallback:fn=>fn,useEffect:()=>{},useLayoutEffect:fn=>fn(),useMemo:fn=>fn(),useRef:value=>({current:value}),useState:value=>[value,()=>{}]};
  const storage={getItem:async key=>stored.get(key)??null,setItem:async(key,value)=>{if(failSettlementSave && key.includes('game-save') && !JSON.parse(value).pendingWalletPurchases?.length){failSettlementSave=false;throw new Error('Disk interrupted');}stored.set(key,value);},removeItem:async key=>stored.delete(key),
    multiSet:async values=>values.forEach(([key,value])=>stored.set(key,value))};
  const wallet=()=>({user_id:authUser,environment:dev?'sandbox':environment,balance:coinBalance,revision});
  const db={rpc:async(name,args)=>{
    calls.push({name,args});
    if(offline) throw new Error('Offline');
    if(walletGate && (name==='initialize_my_game_wallet'||name==='get_my_coin_wallet')) {const gate=walletGate;walletGate=null;await gate;}
    if(name==='request_my_purchase_reconciliation' && queueUnavailable) throw new Error('Recovery queue not deployed');
    if(name==='get_store_catalog') return {data:{server_time:new Date().toISOString(),items:storePrice===null?[]:[{kind:'toy',item_id:'blueBall',base_price:storePrice,sale_price:null,sale_starts_at:null,sale_ends_at:null,sale_label:null}]}};
    if(name==='spend_game_coins') {
      let order=orders.find(o=>o.requestId===args.p_request_id);
      if(!order) {
        if(forcedRejection) return {error:forcedRejection};
        if(coinBalance<(storePrice??args.p_expected_price??12)) return {error:{code:'22003',message:'Insufficient coins'}};
        if(storePrice!==null && args.p_expected_price!==undefined && args.p_expected_price!==storePrice) return {error:{code:'P0001',message:'Store price changed'}};
        order={id:`receipt-${orders.length}`,requestId:args.p_request_id,request_payload:{save_id:args.p_save_id,kind:args.p_kind,item_id:args.p_item_id}};
        orders.push(order);const cost=storePrice??args.p_expected_price??12;coinBalance-=cost;revision++;
        entries.push({...order,kind:'store_spend',delta:-cost,balance_after:coinBalance,created_at:new Date().toISOString()});
      }
      if(failAfterDebit) {failAfterDebit=false;offline=true;return {error:{message:'Connection interrupted'}};}
      return {data:order};
    }
    if(name==='claim_puzzle_coins' && !rewarded.has(args.p_attempt_id)){rewarded.add(args.p_attempt_id);coinBalance+=25;revision++;}
    if(name==='get_my_game_delivery') return {data:{wallet:wallet(),orders:orders.filter(o=>o.request_payload.save_id===args.p_save_id)}};
    return {data:wallet()};
  },from:()=>{const query={select:()=>query,eq:()=>query,order:()=>query,limit:async()=>({data:[...entries].reverse()})};return query;}};
  function load(id,base=process.cwd()) {
    if(id==='react') return react;
    if(id==='@/hooks/use-network-reconnect') return {useNetworkReconnect:callback=>{reconnect=callback;}};
    if(id==='@/hooks/use-world-clock-now') return {useWorldClockNow:()=>Date.now()};
    if(id==='react-native') return {Platform:{OS:'ios'},AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Dimensions:{get:()=>({width:390,height:844})},PixelRatio:{roundToNearestPixel:n=>n}};
    if(id==='@react-native-async-storage/async-storage') return storage;
    if(id==='@/lib/app-diagnostics') return {reportAppError(){}};
    if(id==='@/lib/supabase') return {supabase:db};
    let file=id.startsWith('@/')?path.resolve(id.slice(2)):path.resolve(base,id);
    if(/\.(png|webp|mp4)$/.test(file)) return file;
    if(!fs.existsSync(file)) file=['.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);
    assert.ok(file,`Resolve ${id}`);
    if(cache.has(file)) return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    if(file.endsWith('.json')) {module.exports=JSON.parse(fs.readFileSync(file,'utf8'));return module.exports;}
    const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
    vm.runInNewContext(source,{module,exports:module.exports,require:child=>load(child,path.dirname(file)),Date,Math,Set,Map,Promise,console,AbortController,setTimeout,clearTimeout,__DEV__:dev,process:{env:{EXPO_PUBLIC_APP_ENVIRONMENT:environment}},setInterval:()=>0,clearInterval:()=>{}});
    return module.exports;
  }
  const {useServerWallet}=load('@/hooks/use-server-wallet');
  save={...load('@/utils/game-storage').createDefaultGameSave(),accountOwnerId:authUser,walletAuthority:wallet(),wallet:{coins:coinBalance}};
  const authorityRef={current:null},activeSaveIdRef={current:'save-a'};
  const mount=()=>useServerWallet({userId:authUser,enabled:true,activeSaveIdRef,getSave:()=>save,setSave:fn=>{save=typeof fn==='function'?fn(save):fn;},authorityRef,syncRef:{current:async()=>{}}});
  let api=mount();
  return {get api(){return api;},restoreOldSave(){save=load('@/utils/game-storage').createDefaultGameSave();},restart(){const raw=stored.get(load('@/types/save').GAME_SAVE_STORAGE_KEY); save=raw?JSON.parse(raw):load('@/utils/game-storage').createDefaultGameSave(); authorityRef.current=null;api=mount();},load,calls,stored,orders,activeSaveIdRef,authorityRef,get save(){return save;},get balance(){return coinBalance;},
    reconnect:()=>reconnect(),setSave(next){save=next;},setOffline(value=true){offline=value;},rejectWith(error){forcedRejection=error;},failSettlementSave(){failSettlementSave=true;},pauseWallet(){let release;walletGate=new Promise(resolve=>{release=resolve;});return release;},
    disconnectAfterDebit(){failAfterDebit=true;},disableRecoveryQueue(){queueUnavailable=true;},adjust(amount){coinBalance=amount;revision++;},setAuthUser(id){authUser=id;},setStorePrice(price){storePrice=price;}};
}

test('ambiguous purchase is retried with the persisted ID and delivers once after restart/refresh',async()=>{
  const h=harness();h.setStorePrice(12);await h.load('@/services/store-catalog').refreshStoreCatalog();h.disconnectAfterDebit();
  assert.equal(await h.api.spend('toy','blueBall'),'queued');
  assert.equal(h.balance,488);
  assert.equal(h.orders.length,1);
  assert.ok([...h.stored.keys()].some(k=>k.includes('wallet-outbox:')));
  h.setOffline(false);h.restart();await h.api.refresh();
  assert.equal(h.balance,488);
  assert.equal(h.save.progress.toyQuantities.blueBall,1);
  assert.equal(h.save.appliedWalletOrderIds.length,1);
  assert.ok(![...h.stored.keys()].some(k=>k.includes('wallet-outbox:')));
  const ids=h.calls.filter(c=>c.name==='spend_game_coins').map(c=>c.args.p_request_id);
  assert.equal(ids[0],ids[1]);
  h.restart();h.adjust(1000);await h.api.refresh();await h.api.refresh();
  assert.equal(h.save.wallet.coins,1000,'Admin adjustment must replace cached coins');
  assert.equal(h.save.progress.toyQuantities.blueBall,1,'Polling cannot redeliver a receipt');
  h.restoreOldSave();await h.api.refresh();
  assert.equal(h.save.progress.toyQuantities.blueBall,1,'Restoring an older snapshot of the same pet must recover its item receipts');
  assert.equal(h.save.wallet.coins,1000,'Restoring old progress cannot overwrite an admin balance');
});

test('receipts for another save are not applied to the selected pet',async()=>{
  const h=harness();h.disconnectAfterDebit();await h.api.spend('toy','blueBall');
  h.activeSaveIdRef.current='save-b';h.restoreOldSave();h.setOffline(false);await h.api.refresh();
  assert.equal(h.save.progress.toyQuantities.blueBall,undefined);
  h.activeSaveIdRef.current='save-a';await h.api.refresh();
  assert.equal(h.save.progress.toyQuantities.blueBall,1);
});

test('a missing reconciliation deployment does not interrupt authoritative wallet spending',async()=>{
  const h=harness();h.setStorePrice(12);await h.load('@/services/store-catalog').refreshStoreCatalog();h.disableRecoveryQueue();
  assert.equal(await h.api.spend('toy','blueBall'),'purchased');
  assert.equal(h.balance,488);assert.equal(h.save.progress.toyQuantities.blueBall,1);
});

test('responses for a different authenticated account never replace the wallet',async()=>{
  const h=harness();h.setAuthUser('account-b');await h.api.refresh();
  assert.equal(h.authorityRef.current,null);
  assert.equal(h.save.walletAuthority.user_id,'account-a');
});

test('dev, store sandbox and production isolate phone storage and wallet environment',()=>{
  const dev=harness({dev:true,environment:'production'}),prod=harness({dev:false}),sandbox=harness({dev:false,environment:'sandbox'});
  assert.equal(dev.load('@/services/wallet/environment').getWalletEnvironment(),'sandbox');
  assert.equal(prod.load('@/services/wallet/environment').getWalletEnvironment(),'production');
  assert.equal(sandbox.load('@/services/wallet/environment').getWalletEnvironment(),'sandbox');
  assert.notEqual(dev.load('@/types/save').GAME_SAVE_STORAGE_KEY,prod.load('@/types/save').GAME_SAVE_STORAGE_KEY);
  assert.notEqual(dev.load('@/utils/save-id').ACTIVE_SAVE_ID_KEY,prod.load('@/utils/save-id').ACTIVE_SAVE_ID_KEY);
});

test('store builds reject empty, placeholder and Test Store billing keys',()=>{
  const valid={EXPO_PUBLIC_APPLE_AUTH_ENABLED:'true',EXPO_PUBLIC_GOOGLE_AUTH_ENABLED:'true',EXPO_PUBLIC_SUPABASE_URL:'https://exampleproject.supabase.co',EXPO_PUBLIC_SUPABASE_ANON_KEY:'public-key',EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:'appl_example',EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:'goog_example',EXPO_PUBLIC_APP_ENVIRONMENT:'production'};
  Object.assign(valid,{EXPO_PUBLIC_PUBLISHER_NAME:'Example Publisher',EXPO_PUBLIC_SUPPORT_EMAIL:'support@mathmews.com',
    EXPO_PUBLIC_PRIVACY_POLICY_URL:'https://mathmews.com/privacy',EXPO_PUBLIC_SUPPORT_URL:'https://mathmews.com/support',EXPO_PUBLIC_ACCOUNT_DELETION_URL:'https://mathmews.com/delete-account'});
  assert.doesNotThrow(()=>validateStoreConfig(valid));
  for(const value of ['', 'TODO', 'test_example']) assert.throws(()=>validateStoreConfig({...valid,EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:value},'ios'));
  assert.throws(()=>validateStoreConfig({...valid,EXPO_PUBLIC_SUPABASE_URL:'TODO'}));
  for(const field of ['EXPO_PUBLIC_PUBLISHER_NAME','EXPO_PUBLIC_SUPPORT_EMAIL','EXPO_PUBLIC_PRIVACY_POLICY_URL','EXPO_PUBLIC_SUPPORT_URL','EXPO_PUBLIC_ACCOUNT_DELETION_URL']) {
    assert.throws(()=>validateStoreConfig({...valid,[field]:''}));
    assert.throws(()=>validateStoreConfig({...valid,[field]:'TODO'}));
  }
  assert.throws(()=>validateStoreConfig({...valid,EXPO_PUBLIC_ACCOUNT_DELETION_URL:'http://mathmews.com/delete-account'}));
});

test('store configuration excludes development/storage permissions and private backend credentials',()=>{
  const env={EXPO_PUBLIC_APPLE_AUTH_ENABLED:'true',EAS_BUILD_PROFILE:'production',EAS_BUILD_PLATFORM:'ios',EXPO_PUBLIC_APP_ENVIRONMENT:'production',
    EXPO_PUBLIC_SUPABASE_URL:'https://project.supabase.co',EXPO_PUBLIC_SUPABASE_ANON_KEY:'public-key',
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:'appl_public',EXPO_PUBLIC_PUBLISHER_NAME:'Example Publisher',EXPO_PUBLIC_SUPPORT_EMAIL:'support@mathmews.com',
    EXPO_PUBLIC_PRIVACY_POLICY_URL:'https://mathmews.com/privacy',EXPO_PUBLIC_SUPPORT_URL:'https://mathmews.com/support',
    EXPO_PUBLIC_ACCOUNT_DELETION_URL:'https://mathmews.com/delete-account',REVENUECAT_SECRET_API_KEY:'sk_server_only_test'};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync('app.config.js','utf8'),{module,process:{env},require:()=>({validateStoreConfig})});
  const base=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
  const release=module.exports({config:base});
  for(const permission of ['SYSTEM_ALERT_WINDOW','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE','RECORD_AUDIO'])
    assert.ok(release.android.blockedPermissions.includes('android.permission.'+permission));
  assert.ok(!JSON.stringify(release).includes(env.REVENUECAT_SECRET_API_KEY));
  env.EAS_BUILD_PROFILE='development';
  assert.ok(!module.exports({config:base}).android.blockedPermissions.includes('android.permission.SYSTEM_ALERT_WINDOW'));
  env.EAS_BUILD_PROFILE='production';env.EXPO_PUBLIC_APP_ENVIRONMENT='sandbox';
  assert.throws(()=>module.exports({config:base}),/production data/);
});

test('RevenueCat identity changes wait until the previous purchase completes',async()=>{
  const events=[];
  let finish;
  const purchaseGate=new Promise(resolve=>{finish=resolve;});
  const module={exports:{}};
  const sdk={configure:options=>events.push(['configure',options.appUserID]),setLogLevel(){},logIn:async id=>{events.push(['login',id]);}};
  const compiled=ts.transpileModule(fs.readFileSync('services/iap/revenuecat.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(compiled,{module,exports:module.exports,__DEV__:true,console,Promise,require:id=>{
    if(id==='react-native') return {Platform:{OS:'ios'}};
    if(id==='react-native-purchases') return {__esModule:true,default:sdk,LOG_LEVEL:{VERBOSE:0}};
    if(id==='@/utils/revenuecat-keys') return {resolveRevenueCatApiKey:()=> 'test_example',assertValidReleaseRevenueCatKey(){}};
    if(id==='@/constants/iap-products') return {COIN_PACK_PRODUCTS:{},COIN_PACK_PRODUCT_IDS:[]};
    throw new Error(id);
  }});
  const {withRevenueCatUser}=module.exports;
  const first=withRevenueCatUser('a',async()=>{events.push(['purchase','a']);await purchaseGate;events.push(['finished','a']);});
  const second=withRevenueCatUser('b',async()=>{events.push(['purchase','b']);});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(events.some(([event,id])=>event==='login' && id==='b'),false);
  finish();await Promise.all([first,second]);
  assert.deepEqual(events,[['configure','a'],['purchase','a'],['finished','a'],['login','b'],['purchase','b']]);
});

test('the parent gate and coin catalog share one native sheet',()=>{
  let cursor=0;
  const slots=[];
  const react={useCallback:fn=>fn,useEffect(){},useState:value=>{const i=cursor++;if(!(i in slots)) slots[i]=value;return [slots[i],next=>{slots[i]=next;}];}};
  const module={exports:{}};
  const jsx=(type,props)=>({type,props});
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/economy/CoinPackSheet.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {module,exports:module.exports,require:id=>{
      if(id==='react') return react;
      if(id==='react/jsx-runtime') return {jsx,jsxs:jsx};
      if(id==='react-i18next') return {useTranslation:()=>({t:key=>key})};
      if(id==='react-native') return {Platform:{OS:'ios'},StyleSheet:{create:x=>x},View:'View'};
      if(id==='expo-router') return {useRouter:()=>({push(){}})};
      if(id==='expo-haptics') return {ImpactFeedbackStyle:{Light:0},impactAsync(){}};
      if(id==='@/contexts/IAPProvider') return {useIAP:()=>({isSupported:true,isReady:true,coinPackCatalog:[],refreshOfferings:async()=>{}})};
      if(id==='@/constants/game') return {GameColors:{}};
      if(id==='@/utils/scale') return {moderateScale:n=>n};
      if(id.startsWith('@/components/')) {const name=path.basename(id);return {[name]:name};}
      throw new Error(id);
    }});
  const render=()=>{cursor=0;return module.exports.CoinPackSheet({visible:true,onClose(){}});};
  let sheet=render();assert.equal(sheet.type,'AppBottomSheet');assert.equal(sheet.props.visible,true);
  assert.equal(sheet.props.children.type,'ParentGateSheet');assert.equal(sheet.props.children.props.embedded,true);
  sheet.props.children.props.onPass();
  sheet=render();assert.equal(sheet.type,'AppBottomSheet');assert.equal(sheet.props.visible,true);
  assert.equal(sheet.props.children.type,'View','Passing the gate replaces content without dismissing the native sheet');
});


// Execute the source callbacks so these checks follow the shipped purchase flow.
function accountOperations() {
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync('services/auth/account-operation.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports});
  return module.exports;
}
function sourceCallback(file, match) {
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if(match(node,source)) callback=node.arguments?.[0] ?? node.initializer.arguments[0];
    ts.forEachChild(node,visit);
  }
  visit(source);assert.ok(callback,`Find callback in ${file}`);
  return context=>vm.runInNewContext(ts.transpileModule(`(${callback.getText(source)})`,{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText,{...accountOperations(),...context});
}

test('only a delivered purchase closes the coin sheet',async()=>{
  const load=sourceCallback('components/economy/CoinPackSheet.tsx',node=>ts.isVariableDeclaration(node)&&node.name.getText()==='handlePurchase');
  for(const status of ['purchased','cancelled','pending','delivery_pending','error']) {
    const events=[];
    const purchase=load({purchasingId:null,setStatusMessage:value=>events.push(['message',value]),
      setStatusKind:()=>{},setPurchasingId:()=>{},triggerHaptic:()=>{},Haptics:{ImpactFeedbackStyle:{Medium:1}},
      purchaseCoinPack:async()=>({status,coins:100}),onClose:()=>events.push(['close']),t:key=>key});
    await purchase('coins_100');
    assert.equal(events.filter(([kind])=>kind==='close').length,status==='purchased'?1:0,status);
    if(status==='pending'||status==='delivery_pending'||status==='error') assert.ok(events.some(([kind,text])=>kind==='message'&&text),status);
  }
});

test('coin celebrations wait for verified delivery and never cross accounts',async()=>{
  const load=sourceCallback('contexts/IAPProvider.tsx',node=>ts.isVariableDeclaration(node)&&node.name.getText()==='handlePurchase');
  for(const status of ['purchased','cancelled','pending','error']) {
    let celebration=null,refreshed=false;
    const userRef={current:'a'};
    const purchase=load({isReady:true,userId:'a',userRef,supabase:{rpc:async name=>({data:name==='get_my_coin_wallet'?{user_id:'a'}:true})},busy:{current:false},
      withRevenueCatUser:async(id,fn)=>fn(),purchaseCoinPack:async()=>({status,coins:500,transactionId:'tx'}),
      getWalletEnvironment:()=> 'sandbox',refreshWallet:async()=>{refreshed=true;},
      setCoinCelebration:fn=>{assert.ok(refreshed);celebration=fn(celebration);},setTimeout:fn=>fn()});
    assert.equal((await purchase('coins_500')).status,status);
    assert.equal(celebration?.coins??0,status==='purchased'?500:0);
  }
  let celebrated=false;
  const userRef={current:'a'};
  const purchase=load({isReady:true,userId:'a',userRef,supabase:{rpc:async name=>({data:name==='get_my_coin_wallet'?{user_id:'a'}:true})},busy:{current:false},
    withRevenueCatUser:async(id,fn)=>fn(),purchaseCoinPack:async()=>({status:'purchased',coins:100,transactionId:'tx'}),
    getWalletEnvironment:()=> 'sandbox',refreshWallet:async()=>{userRef.current='b';},
    setCoinCelebration:()=>{celebrated=true;},setTimeout:fn=>fn()});
  assert.equal((await purchase('coins_100')).status,'delivery_pending');
  assert.equal(celebrated,false);
});

test('a closed or unavailable server wallet prevents the native checkout',async()=>{
  const load=sourceCallback('contexts/IAPProvider.tsx',node=>ts.isVariableDeclaration(node)&&node.name.getText()==='handlePurchase');
  for(const response of [{error:{code:'55000'}},{data:{user_id:'other-user'}},{}]) {
    let sdkCalls=0;
    const purchase=load({isReady:true,userId:'a',userRef:{current:'a'},supabase:{rpc:async()=>response},busy:{current:false},
      withRevenueCatUser:async(id,fn)=>fn(),purchaseCoinPack:async()=>{sdkCalls++;},getWalletEnvironment:()=> 'sandbox'});
    assert.equal((await purchase('coins_100')).status,'error');
    assert.equal(sdkCalls,0);
  }
});

test('pending or failed deletion never clears the phone or starts a new guest',async()=>{
  const load=sourceCallback('contexts/GameProvider.tsx',node=>ts.isVariableDeclaration(node)&&node.name.getText()==='deleteAllUserData');
  for(const state of ['pending','failed']) {
    const events=[];
    const remove=load({userId:'a',setIsDeletingAccount:value=>events.push(['paused',value]),
      deleteRemoteUserData:async()=>({state,id:'deletion-request'}),
      clearGameSave:async()=>events.push(['clear']),supabase:{auth:{signOut:async()=>events.push(['signOut']),signInAnonymously:async()=>events.push(['newGuest'])}}});
    const result=await remove();
    assert.equal(result.ok,false);assert.equal(result.pending===true,state==='pending');
    assert.ok(!events.some(([event])=>['clear','signOut','newGuest'].includes(event)));
  }
});

test('Restore keeps the checked wallet available and reports whether recovery actually queued',async()=>{
  const load=sourceCallback('contexts/IAPProvider.tsx',node=>ts.isVariableDeclaration(node)&&node.name.getText()==='restorePurchases');
  for(const available of [true,false]) {
    const calls=[];
    const restore=load({isSupported:true,isAuthReady:true,userId:'a',userRef:{current:'a'},busy:{current:false},
      supabase:{rpc:name=>({then:resolve=>Promise.resolve(resolve(name==='request_my_purchase_reconciliation'
        ? {error:available?null:{code:'PGRST202'}} : {data:{balance:100}}))})},
      getWalletEnvironment:()=> 'sandbox',withRevenueCatUser:async(id,fn)=>fn(),
      restoreRevenueCatPurchases:async()=>calls.push('sdk'),refreshWallet:async()=>calls.push('wallet')});
    const result=await restore();
    assert.equal(result.coins,0);assert.equal(result.recoveryQueued,available);
    assert.deepEqual(calls,['sdk','wallet']);
  }
});

test('the purchase dance waits for Home, supports reduced motion, and cleans up on navigation',()=>{
  const load=sourceCallback('app/index.tsx',(node,source)=>ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0].getText(source).includes('pendingCoinCelebration'));
  function run(options={}) {
    const calls=[],timers=new Map();
    const context={pendingCoinCelebration:500,homeActive:true,isReady:true,hasCompletedOnboarding:true,
      transition:null,isCareAnimationPlaying:false,pet:{type:'cat',homeRoomId:'livingRoom'},
      getCatHomeRoomId:()=> 'livingRoom',handleVisitRoom:room=>calls.push(['visit',room]),
      clearCoinCelebration:()=>calls.push(['consume']),setDecoratingRoom:()=>{},recordInteraction:()=>{},
      showSpeech:text=>calls.push(['speech',text]),t:(key,{count})=>`${count} coins added!`,reduceMotion:false,
      sendPetCommand:command=>calls.push(['command',command.mood,command.wasAsleep]),
      setTimeout:(fn,delay)=>{assert.equal(delay,500);timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id),...options};
    const cleanup=load(context)();
    return {calls,timers,cleanup,fire:()=>{for(const fn of timers.values()) fn();timers.clear();}};
  }
  for(const options of [{homeActive:false},{isReady:false},{hasCompletedOnboarding:false},{transition:{}},{isCareAnimationPlaying:true},{pendingCoinCelebration:0}]) {
    const h=run(options);assert.equal(h.timers.size,0);assert.equal(h.calls.length,0);
  }
  let h=run();assert.equal(h.calls.length,0,'The native sheet gets time to dismiss');h.fire();
  assert.deepEqual(h.calls,[['consume'],['speech','500 coins added!'],['command','dancing',false]]);
  h=run({reduceMotion:true});h.fire();assert.deepEqual(h.calls,[['consume'],['speech','500 coins added!']]);
  h=run({pet:{type:'cat',isAsleep:true}});h.fire();assert.deepEqual(h.calls.at(-1),['command','dancing',true]);
  h=run({getCatHomeRoomId:()=> 'bedroom'});h.fire();assert.deepEqual(h.calls,[['visit','bedroom']],'Visit the cat before consuming its reaction');
  h=run();h.cleanup();h.fire();assert.equal(h.calls.length,0,'Navigation cancels the timer without consuming feedback');
});

test('production checkout requires a linked account while sandbox guests remain usable',async()=>{
  for(const environment of ['production','sandbox']) for(const linked of [false,true]) {
    let slot=0,sdkCalls=0;
    const module={exports:{}};
    const jsx=(type,props)=>({type,props});
    const react={createContext:()=>({Provider:'Provider'}),useCallback:fn=>fn,useEffect(){},useLayoutEffect:fn=>fn(),
      useMemo:fn=>fn(),useRef:value=>({current:value}),useState:value=>[slot++===0?'a':value,()=>{}]};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('contexts/IAPProvider.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
      {module,exports:module.exports,require:id=>{
        if(id==='react')return react;
        if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
        if(id==='@/contexts/AuthProvider')return {useAuth:()=>({isAuthReady:true,userId:'a',isPlatformAccountLinked:linked})};
        if(id==='@/contexts/GameProvider')return {useGame:()=>({refreshWallet:async()=>{},isWalletReady:true})};
        if(id==='@/services/wallet/environment')return {getWalletEnvironment:()=>environment};
        if(id==='@/services/auth/account-operation')return accountOperations();
        if(id==='@/lib/app-diagnostics') return {reportAppError(){}};
    if(id==='@/lib/supabase')return {supabase:{rpc:async name=>({data:name==='get_my_coin_wallet'?{user_id:'a'}:false})}};
        if(id==='@/services/iap/revenuecat')return {isRevenueCatSupported:()=>true,withRevenueCatUser:async(id,fn)=>fn(),purchaseCoinPack:async()=>{sdkCalls++;return {status:'cancelled'};}};
        throw new Error(id);
      }});
    const api=module.exports.IAPProvider({children:null}).props.value;
    const blocked=environment==='production'&&!linked;
    assert.equal(api.requiresAccountLink,blocked);assert.equal(api.isReady,!blocked);
    await api.purchaseCoinPack('coins_100');assert.equal(sdkCalls,blocked?0:1);
  }
});

test('loading a legacy game retains its owner before a different session clears the cached wallet',()=>{
  const load=sourceCallback('contexts/GameProvider.tsx',node=>ts.isVariableDeclaration(node)&&node.name.getText()==='setSave');
  const clock={};let next;
  const saveRef={current:{worldClock:clock}};
  const setSave=load({saveRef,walletAuthorityRef:{current:null},accountRef:{current:'account-b'},
    removeRoomNavigationDoors:pet=>pet,currentPuzzleStreak:()=>0,getWalletEnvironment:()=> 'sandbox',
    setSaveState:value=>{next=value;}});
  setSave({worldClock:clock,pet:{name:'Account A'},progress:{streak:0},wallet:{coins:3200},
    walletAuthority:{user_id:'account-a',environment:'sandbox',balance:3200,revision:8}});
  assert.equal(next.accountOwnerId,'account-a','Account preparation must still see the legacy owner');
  assert.equal(next.walletAuthority,undefined);assert.equal(next.wallet.coins,0);
});

test('deletion cannot overlap checkout, and a receipt clears the deleted account archives after its session expires',async()=>{
  const load=sourceCallback('contexts/GameProvider.tsx',node=>ts.isVariableDeclaration(node)&&node.name.getText()==='deleteAllUserData');
  const operations=accountOperations();const release=operations.acquireAccountOperation('purchase');
  let deletionCalls=0;
  const blocked=load({...operations,deleteRemoteUserData:async()=>{deletionCalls++;}});
  assert.equal((await blocked()).ok,false);assert.equal(deletionCalls,0);release();
  const calls=[];
  const remove=load({userId:null,supabase:null,setIsDeletingAccount(){},deleteRemoteUserData:async()=>({state:'completed'}),
    clearGameSave:async()=>calls.push('game'),loadDeletionReceipt:async()=>({userId:'deleted-a'}),
    clearAccountGameArchives:async id=>calls.push(['archives',id]),clearActiveSaveId:async()=>{},clearBackedUpSession:async()=>{},
    createDefaultGameSave:()=>({}),walletAuthorityRef:{current:null},accountRef:{current:null},skipNextPersist:{current:false},
    activeSaveIdRef:{current:null},setSave(){},saveGameSave:async()=>{},clearDeletionReceipt:async()=>calls.push('receipt')});
  assert.equal((await remove()).ok,true);
  assert.deepEqual(calls,['game',['archives','deleted-a'],'receipt']);
});


test('a changed price causes no debit, refreshes the shop and requires a fresh purchase',async()=>{
  const h=harness();h.setStorePrice(12);
  assert.equal(await h.load('@/services/store-catalog').refreshStoreCatalog(),true);
  h.setStorePrice(20);
  assert.equal(await h.api.spend('toy','blueBall'),'price_changed');
  assert.equal(h.balance,500);assert.equal(h.orders.length,0);
  assert.equal(h.load('@/utils/store-catalog').getStoreCoinPrice('toy','blueBall'),20);
  assert.ok(JSON.parse([...h.stored].find(([key])=>key.includes('wallet-outbox:'))[1]).some(p=>p.status==='rejected'));
  assert.equal(await h.api.spend('toy','blueBall'),'purchased');
  assert.equal(h.balance,480);assert.equal(h.orders.length,1);
});

test('an ambiguous successful purchase retains its expected price and receipt across a promotion change',async()=>{
  const h=harness();h.setStorePrice(12);await h.load('@/services/store-catalog').refreshStoreCatalog();h.disconnectAfterDebit();
  assert.equal(await h.api.spend('toy','blueBall'),'queued');
  h.setStorePrice(20);h.setOffline(false);h.restart();await h.api.refresh();
  assert.equal(h.balance,488);assert.equal(h.orders.length,1);
  const calls=h.calls.filter(c=>c.name==='spend_game_coins');
  assert.equal(calls[0].args.p_request_id,calls[1].args.p_request_id);
  assert.equal(calls[1].args.p_expected_price,12);
});

test('checkout keeps the rendered price even if the local catalog refreshes before the tap',async()=>{
  const h=harness();h.setStorePrice(20);
  await h.load('@/services/store-catalog').refreshStoreCatalog();
  assert.equal(await h.api.spend('toy','blueBall',12),'price_changed');
  assert.equal(h.balance,500);assert.equal(h.orders.length,0);
  assert.equal(h.calls.find(c=>c.name==='spend_game_coins').args.p_expected_price,12);
});

test('offline purchases reserve funds durably, survive restart, and replay in order',async()=>{
  const h=harness();h.setOffline();
  assert.deepEqual(await Promise.all([h.api.spend('toy','blueBall',200),h.api.spend('toy','blueBall',200),h.api.spend('toy','blueBall',200)]),['queued','queued','insufficient_funds']);
  assert.equal(h.save.wallet.coins,100);assert.equal(h.save.progress.toyQuantities.blueBall,2);
  const ids=h.save.pendingWalletPurchases.map(p=>p.id);
  h.restart();assert.equal(h.save.wallet.coins,100);
  h.setOffline(false);await h.api.refresh();
  assert.equal(h.balance,100);assert.equal(h.save.wallet.coins,100);
  assert.equal(h.save.progress.toyQuantities.blueBall,2);assert.equal(h.save.pendingWalletPurchases.length,0);
  assert.deepEqual(h.orders.map(o=>o.requestId),Array.from(ids));assert.equal(h.save.walletNotices?.length??0,0);
});

test('a rejected queue removes provisional copies while preserving confirmed items',async()=>{
  const h=harness();h.setOffline();
  for(let i=0;i<3;i++)assert.equal(await h.api.spend('toy','blueBall',100),'queued');
  h.adjust(150);h.setOffline(false);await h.api.refresh();
  assert.equal(h.orders.length,1);assert.equal(h.balance,50);assert.equal(h.save.wallet.coins,50);
  assert.equal(h.save.progress.toyQuantities.blueBall,1);
  assert.equal(h.save.pet.placedToys.filter(t=>t.toyId==='blueBall').length,1);
  assert.equal(h.save.walletNotices.length,2);assert.equal(h.save.pendingWalletPurchases.length,0);
  assert.equal(h.save.coinTransactions.filter(t=>t.syncStatus==='rejected').length,2);
  h.setSave({...h.save,walletNotices:[]});await h.api.refresh();
  assert.equal(h.save.walletNotices.length,0,'Acknowledged cancellations must not return on each poll');
  assert.equal(h.save.progress.toyQuantities.blueBall,1);
});

test('rollback cleans every room and saved layout, including moved or recreated furniture copies',()=>{
  const h=harness(),u=h.load('@/services/wallet/offline-orders');
  const confirmed=h.load('@/services/wallet/orders').applyWalletOrder(h.save,{id:'confirmed',request_payload:{save_id:'save-a',kind:'decoration',item_id:'plantSmall'}});
  const purchase=u.createPendingPurchase(confirmed,{id:'offline',userId:'account-a',environment:'sandbox',saveId:'save-a',kind:'decoration',itemId:'plantSmall',expectedPrice:24,at:1});
  let pending=u.applyProvisionalPurchase(confirmed,purchase);
  const stored=pending.pendingWalletPurchases[0];
  const existing=confirmed.pet.placedDecorations.find(d=>d.decorationId==='plantSmall');
  const added=pending.pet.placedDecorations.find(d=>stored.undo.addedInstances.includes(d.instanceId));
  const layout={placedDecorations:[existing,added],roomLayerOrder:[{kind:'decoration',decorationId:'plantSmall',instanceId:existing.instanceId},{kind:'decoration',decorationId:'plantSmall',instanceId:added.instanceId}]};
  const recreated={...layout,placedDecorations:[existing,{...added,instanceId:'recreated-copy'}]};
  pending={...pending,pet:{...pending.pet,...layout,roomLayouts:{room1:layout},savedRoomLayouts:{room2:recreated},homeRooms:{bedroom:{...layout,roomId:'room1',roomLayouts:{room1:layout},savedRoomLayouts:{room1:recreated}}}}};
  const rejected=u.rejectProvisionalPurchase(pending,stored,'insufficient_funds');
  const {pet}=rejected;
  for(const room of [pet,pet.roomLayouts.room1,pet.savedRoomLayouts.room2,pet.homeRooms.bedroom,pet.homeRooms.bedroom.roomLayouts.room1,pet.homeRooms.bedroom.savedRoomLayouts.room1]){
    assert.equal(room.placedDecorations.filter(d=>d.decorationId==='plantSmall').length,1);
    assert.equal(room.placedDecorations.find(d=>d.decorationId==='plantSmall').instanceId,existing.instanceId);
    assert.ok(!room.roomLayerOrder.some(item=>item.instanceId===added.instanceId));
  }
  assert.equal(rejected.progress.decorationQuantities.plantSmall,1);
  const twice=u.rejectProvisionalPurchase(rejected,stored,'insufficient_funds');
  assert.equal(twice.progress.decorationQuantities.plantSmall,1);assert.equal(twice.walletNotices.length,1);
});

test('cancelled room finishes and beds fall back to owned choices in all named rooms',()=>{
  const h=harness(),u=h.load('@/services/wallet/offline-orders');
  for(const [kind,itemId,key,fallback] of [['room','room27','roomId','room1'],['bed','green','bedId','brown']]){
    const purchase=u.createPendingPurchase(h.save,{id:kind,userId:'account-a',environment:'sandbox',saveId:'save-a',kind,itemId,expectedPrice:56,at:1});
    let save=u.applyProvisionalPurchase(h.save,purchase);
    save={...save,pet:{...save.pet,[key]:itemId,homeRooms:{bedroom:{[key]:itemId,roomLayouts:{room27:{[key]:itemId}},savedRoomLayouts:{room27:{[key]:itemId}}}},savedRoomLayouts:{room27:{[key]:itemId}}}};
    const rejected=u.rejectProvisionalPurchase(save,save.pendingWalletPurchases[0],'price_changed');
    assert.equal(rejected.pet[key],fallback);assert.equal(rejected.pet.homeRooms.bedroom[key],fallback);
    assert.equal(rejected.pet.homeRooms.bedroom.savedRoomLayouts.room27[key],fallback);
    assert.equal(rejected.pet.savedRoomLayouts.room27[key],fallback);
    assert.ok(!rejected.progress[kind==='room'?'roomsUnlocked':'bedsUnlocked'].includes(itemId));
  }
});

test('rejected requests cannot reappear when an older provisional cloud snapshot is restored',async()=>{
  const h=harness();h.setOffline();await h.api.spend('room','room27',56);
  const old=JSON.parse(JSON.stringify(h.save));
  h.adjust(0);h.setOffline(false);await h.api.refresh();assert.equal(h.save.pet.roomId,'room1');
  h.adjust(1000);h.setSave(old);await h.api.refresh();
  assert.equal(h.save.pet.roomId,'room1');assert.ok(!h.save.progress.roomsUnlocked.includes('room27'));
  assert.equal(h.orders.length,0,'A cancelled intent must not later debit the wallet');
});

test('a crash after recording confirmation releases the reserve without delivering twice',async()=>{
  const h=harness();h.setOffline();await h.api.spend('toy','blueBall',12);
  h.failSettlementSave();h.setOffline(false);await h.api.refresh();
  assert.equal(h.balance,488);h.restart();await h.api.refresh();
  assert.equal(h.save.progress.toyQuantities.blueBall,1);assert.equal(h.save.wallet.coins,488);
  assert.equal(h.save.pendingWalletPurchases.length,0);assert.equal(h.orders.length,1);
});

test('a tap during background wallet polling is queued rather than silently dropped',async()=>{
  const h=harness(),release=h.pauseWallet();
  const polling=h.api.refresh();
  const purchase=h.api.spend('toy','blueBall',12);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(h.save.progress.toyQuantities.blueBall,1);
  release();await polling;
  assert.equal(await purchase,'purchased');assert.equal(h.orders.length,1);
});

test('offline puzzle rewards replay before the purchases they fund',async()=>{
  const h=harness();h.adjust(0);await h.api.refresh();
  h.setSave({...h.save,pendingCoinRewards:[{userId:'account-a',environment:'sandbox',puzzleId:'puzzle-1',attemptId:'attempt-1',amount:25,at:1}]});
  h.setOffline();assert.equal(await h.api.spend('toy','blueBall',12),'queued');
  assert.equal(h.save.wallet.coins,13);
  h.setOffline(false);const start=h.calls.length;await h.api.refresh();
  const replay=h.calls.slice(start).filter(c=>c.name==='claim_puzzle_coins'||c.name==='spend_game_coins');
  assert.deepEqual(replay.map(c=>c.name),['claim_puzzle_coins','spend_game_coins']);
  assert.equal(h.balance,13);assert.equal(h.save.wallet.coins,13);assert.equal(h.save.pendingCoinRewards.length,0);
});

test('an account without a synced wallet cannot manufacture an offline balance',async()=>{
  const h=harness();h.restoreOldSave();h.setOffline();
  assert.equal(await h.api.spend('toy','blueBall',12),'unavailable');
  assert.equal(h.save.pendingWalletPurchases?.length??0,0);
});

test('room editor Undo cannot restore a cancelled placement',()=>{
  const h=harness(),module={exports:{}},slots=[],effects=[];
  let cursor=0;
  const react={useCallback:fn=>fn,useRef:value=>{const i=cursor++;return slots[i]??(slots[i]={current:value});},
    useState:value=>{const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],update=>{slots[i]=typeof update==='function'?update(slots[i]):update;}];},
    useEffect:(callback,deps)=>{const i=cursor++;if(!slots[i]||deps.some((value,index)=>value!==slots[i][index])){slots[i]=deps;effects.push(callback);}}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('hooks/use-room-editor.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {module,exports:module.exports,require:id=>id==='react'?react:h.load(id)});
  let pet={...h.save.pet,placedToys:[{toyId:'blueBall',instanceId:'pending-copy',offset:{x:0,y:0}}]},progress={...h.save.progress,toyQuantities:{blueBall:1}};
  const setPet=update=>{pet=update(pet);};
  const render=()=>{cursor=0;const api=module.exports.useRoomEditor(pet,setPet,progress);effects.splice(0).forEach(effect=>effect());return api;};
  render();pet={...pet,placedToys:[{...pet.placedToys[0],offset:{x:.5,y:.5}}]};render();
  assert.equal(render().canUndo,true);
  pet={...pet,placedToys:[]};progress={...progress,toyQuantities:{blueBall:0}};
  render();const after=render();assert.equal(after.canUndo,false);
  after.undo();assert.equal(pet.placedToys.length,0);
});

test('permission or authentication interruptions keep purchases queued for retry',async()=>{
  const h=harness();h.rejectWith({code:'42501',message:'Save unavailable'});
  assert.equal(await h.api.spend('toy','blueBall',12),'queued');
  assert.equal(h.save.walletNotices?.length??0,0);assert.equal(h.save.progress.toyQuantities.blueBall,1);
  h.rejectWith(null);await h.api.refresh();assert.equal(h.orders.length,1);assert.equal(h.save.wallet.coins,488);
});

test('a crash while saving a cancellation still removes its item after restart',async()=>{
  const h=harness();h.setOffline();await h.api.spend('decoration','plantSmall',24);
  h.adjust(0);h.failSettlementSave();h.setOffline(false);await h.api.refresh();
  h.restart();await h.api.refresh();
  assert.equal(h.save.progress.decorationQuantities.plantSmall,0);
  assert.ok(!h.save.progress.decorationsUnlocked.includes('plantSmall'));
  assert.ok(!h.save.pet.placedDecorations.some(d=>d.decorationId==='plantSmall'));
  assert.equal(h.save.walletNotices.length,1);assert.equal(h.save.wallet.coins,0);
  await h.api.refresh();assert.equal(h.save.walletNotices.length,1);assert.equal(h.orders.length,0);
});

test('a persisted intent recovers if the app closes before its local grant is saved',async()=>{
  const h=harness(),u=h.load('@/services/wallet/offline-orders');
  const intent=u.createPendingPurchase(h.save,{id:'interrupted-intent',userId:'account-a',environment:'sandbox',saveId:'save-a',kind:'toy',itemId:'blueBall',expectedPrice:12,at:1});
  await h.load('@/services/wallet/outbox').updateWalletOutbox('account-a:sandbox',()=>[intent]);
  await h.api.refresh();
  assert.equal(h.save.progress.toyQuantities.blueBall,1);assert.equal(h.balance,488);assert.equal(h.save.wallet.coins,488);
  assert.equal(h.orders[0].requestId,intent.id);
});

test('concurrent queued life purchases cannot charge beyond the life limit',async()=>{
  const h=harness(),max=h.load('@/constants/game').MAX_LIVES;
  h.setSave({...h.save,progress:{...h.save.progress,lives:{current:max-1,nextRegenAt:Date.now()+300000}}});h.setOffline();
  const results=await Promise.all([h.api.spend('life','one',10),h.api.spend('life','one',10)]);
  assert.deepEqual(results,['queued','already_owned']);
  assert.equal(h.save.progress.lives.current,max);assert.equal(h.save.pendingWalletPurchases.length,1);
  assert.equal(h.save.wallet.coins,490);
});

test('restored connectivity drains queued rewards and purchases without remounting',async()=>{
  const h=harness();
  h.setOffline();
  h.setSave({...h.save,pendingCoinRewards:[{userId:'account-a',environment:'sandbox',puzzleId:'puzzle-1',attemptId:'reconnect-reward',amount:25,at:1}]});
  assert.equal(await h.api.spend('toy','blueBall',12),'queued');
  const requestId=h.save.pendingWalletPurchases[0].id;
  h.setOffline(false);
  await h.reconnect();
  assert.equal(h.save.pendingCoinRewards.length,0);
  assert.equal(h.save.pendingWalletPurchases.length,0);
  assert.equal(h.balance,513);
  assert.equal(h.save.progress.toyQuantities.blueBall,1);
  assert.equal(h.orders[0].requestId,requestId);
  await h.reconnect();
  assert.equal(h.balance,513);
  assert.equal(h.orders.length,1);
});
