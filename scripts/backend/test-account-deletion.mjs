import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { Buffer } from 'node:buffer';
async function load(file) {
 const source=await fs.readFile(file,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const {createAccountDeletion}=await load('supabase/functions/delete-account/handler.ts');
const {deletionProviders}=await load('supabase/functions/delete-account/providers.ts');
const request=(body={},authorization='Bearer user-session')=>new Request('https://example.invalid/delete-account',{
 method:'POST',headers:{authorization,'Content-Type':'application/json'},body:JSON.stringify(body),
});
function harness({apple=false,failStep}={}) {
 const calls=[];
 const job={id:'request-1',user_id:'actual-user',state:'pending',apple_subject:apple?'apple-user':null,apple_revoked:!apple,revenuecat_deleted:false};
 const handler=createAccountDeletion({
  authenticate:async token=>token==='Bearer user-session'?'actual-user':null,
  begin:async()=>calls.push('begin'),job:async()=>job,
  advance:async(userId,step)=>{assert.equal(userId,'actual-user');calls.push(step);
   if(step===failStep)throw new Error('private service token');
   if(step==='apple_revoked')job.apple_revoked=true;
   if(step==='revenuecat_deleted')job.revenuecat_deleted=true;
   if(step==='complete')job.state='completed';
  },
  revokeApple:async(code,sub)=>{assert.equal(code,'fresh-code');assert.equal(sub,'apple-user');calls.push('apple');},
  deleteRevenueCat:async userId=>{assert.equal(userId,'actual-user');calls.push('revenuecat');if(failStep==='revenuecat')throw new Error('private service token');},
 });
 return {handler,calls,job};
}
test('deletion validates authentication and request before touching any account',async()=>{
 const h=harness();
 assert.equal((await h.handler(request({},'Bearer somebody-else'))).status,401);
 assert.equal((await h.handler(new Request('https://example.invalid'))).status,405);
 assert.equal((await h.handler(request({appleAuthorizationCode:42}))).status,400);
 assert.equal((await h.handler(request({padding:'x'.repeat(9000)}))).status,413);
 assert.deepEqual(h.calls,[]);
});
test('the caller cannot select a different deletion target, and success follows provider cleanup',async()=>{
 const h=harness();const response=await h.handler(request({userId:'victim',appleSubject:'victim'}));
 assert.deepEqual(await response.json(),{id:'request-1',state:'completed'});
 assert.deepEqual(h.calls,['begin','confirmed','revenuecat','revenuecat_deleted','complete']);
 h.calls.length=0;assert.equal((await h.handler(request())).status,200);
 assert.deepEqual(h.calls,['begin'],'Completed retries never repeat provider cleanup');
});
test('provider outage retains the pending request and never claims success or removes auth',async()=>{
 const h=harness({failStep:'revenuecat'});const response=await h.handler(request());
 assert.equal(response.status,202);assert.equal((await response.json()).state,'pending');
 assert.ok(!h.calls.includes('complete'));assert.equal(h.job.state,'pending');
});
test('Apple authorization is bound to the stored identity and completed steps survive retry',async()=>{
 const h=harness({apple:true,failStep:'revenuecat'});
 assert.equal((await h.handler(request())).status,202);assert.deepEqual(h.calls,['begin','confirmed']);
 const response=await h.handler(request({appleAuthorizationCode:'fresh-code'}));
 assert.equal(response.status,202);assert.equal(h.job.apple_revoked,true);
 h.calls.length=0;await h.handler(request());
 assert.ok(!h.calls.includes('apple'),'No second authorization is needed after confirmed revocation');
});
test('missing database configuration fails without revealing internal errors',async()=>{
 const handler=createAccountDeletion({authenticate:async()=>{throw new Error('a-secret');}});
 const response=await handler(request());assert.equal(response.status,503);
 assert.ok(!(await response.text()).includes('a-secret'));
});
test('RevenueCat deletion requires a private key and tolerates an already removed customer',async()=>{
 const calls=[];const send=async(url,options)=>{calls.push({url,options});return new Response('',{status:404});};
 await assert.rejects(()=>deletionProviders({revenueCatKey:'appl_public'},send).deleteRevenueCat('user'));
 assert.equal(calls.length,0);
 await deletionProviders({revenueCatKey:'sk_test_private',revenueCatProjectId:'proj_test'},send).deleteRevenueCat('safe-user');
 assert.equal(calls[0].options.method,'GET');
 assert.equal(calls[0].options.redirect,'error');
 assert.equal(calls[0].url,'https://api.revenuecat.com/v2/projects/proj_test/customers/safe-user');
 await assert.rejects(()=>deletionProviders({revenueCatKey:'sk_test_private',revenueCatProjectId:''},send).deleteRevenueCat('user'));
 await assert.rejects(()=>deletionProviders({revenueCatKey:'sk_test_private'},send).deleteRevenueCat('user'));
 assert.equal(calls.length,1,'Missing project configuration cannot call RevenueCat');
});
test('V2 customer deletion waits for asynchronous removal and retries without resubmitting',async()=>{
 const methods=[];let deleted=false;
 const config={revenueCatKey:'sk_test_private',revenueCatProjectId:'proj_test'};
 const send=async(_url,options)=>{
  methods.push(options.method);
  if(options.method==='DELETE')return Response.json({object:'customer',id:'safe-user',deleted_at:1});
  return deleted ? new Response(null,{status:404}) : Response.json({object:'customer',id:'safe-user'});
 };
 const provider=deletionProviders(config,send);
 await assert.rejects(()=>provider.deleteRevenueCat('safe-user'),/pending/);
 assert.deepEqual(methods,['GET','DELETE','GET'],'A queued response must not report completed removal');
 deleted=true;await provider.deleteRevenueCat('safe-user');
 assert.deepEqual(methods,['GET','DELETE','GET','GET']);
 const denied=deletionProviders(config,async()=>new Response(null,{status:403}));
 await assert.rejects(()=>denied.deleteRevenueCat('safe-user'),/unavailable/,'Missing permissions must not count as deleted');
 const wrong=deletionProviders(config,async()=>Response.json({object:'customer',id:'another-user'}));
 await assert.rejects(()=>wrong.deleteRevenueCat('safe-user'),/mismatch/);
});
test('native Apple code exchange checks account ownership before token revocation',async()=>{
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const pkcs8=await crypto.subtle.exportKey('pkcs8',keys.privateKey);
 const config={appleClientId:'com.mathmews.app',appleTeamId:'TEAM',appleKeyId:'KEY',
  applePrivateKey:`-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString('base64')}\n-----END PRIVATE KEY-----`};
 let subject='another-user';const calls=[];
 const send=async(url,options)=>{
  const form=options.body;calls.push(url);
  const [header,payload,signature]=form.get('client_secret').split('.');
  assert.ok(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},keys.publicKey,Buffer.from(signature,'base64url'),new TextEncoder().encode(header+'.'+payload)));
  assert.equal(JSON.parse(Buffer.from(payload,'base64url')).sub,config.appleClientId);
  if(url.endsWith('/token'))return Response.json({refresh_token:'private-refresh',id_token:'header.'+Buffer.from(JSON.stringify({sub:subject,aud:config.appleClientId,iss:'https://appleid.apple.com',exp:Math.floor(Date.now()/1000)+60})).toString('base64url')+'.signature'});
  assert.equal(form.get('token'),'private-refresh');return new Response('');
 };
 const providers=deletionProviders(config,send);
 await assert.rejects(()=>providers.revokeApple('code','actual-user'));
 assert.equal(calls.length,1,'A different Apple account cannot be revoked');
 subject='actual-user';await providers.revokeApple('code','actual-user');
 assert.ok(calls.at(-1).endsWith('/revoke'));
});

test('a completed receipt is checked without an expired Auth session',async()=>{
 const vm=await import('node:vm');
 const stored=new Map();const calls=[];
 const module={exports:{}};
 const compiled=ts.transpileModule(await fs.readFile('services/cloud-save/deletion-receipt.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 vm.runInNewContext(compiled,{module,exports:module.exports,JSON,AbortController,setTimeout,clearTimeout,
  fetch:async(url,options)=>{calls.push({url,options});return Response.json('completed');},
  require:id=>{
   if(id==='@react-native-async-storage/async-storage')return {getItem:async key=>stored.get(key)??null,setItem:async(key,value)=>stored.set(key,value),removeItem:async key=>stored.delete(key)};
   if(id==='@/lib/supabase')return {resolveSupabaseConfig:()=>({url:'https://project.supabase.co',anonKey:'public-key'})};
   throw new Error(id);
  },
 });
 const api=module.exports;
 const receipt={id:'request',userId:'user',confirmationKey:'opaque-server-generated-receipt'};
 await api.saveDeletionReceipt(receipt);
 assert.equal(JSON.stringify(await api.loadDeletionReceipt()),JSON.stringify(receipt));
 assert.equal(await api.checkDeletionReceipt(receipt),'completed');
 assert.equal(calls[0].options.headers.Authorization,undefined,'Never attempt to refresh or reuse a removed Auth session');
 assert.equal(JSON.parse(calls[0].options.body).p_confirmation_key,receipt.confirmationKey);
 await api.clearDeletionReceipt();assert.equal(await api.loadDeletionReceipt(),null);
});

test('manual deletion retries require a server credential verified by the backend',async()=>{
 const vm=await import('node:vm');
 let handler;const probes=[];
 const module={exports:{}};
 const source=ts.transpileModule(await fs.readFile('supabase/functions/delete-account/index.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,Request,Response,URL,TextEncoder,Uint8Array,crypto,AbortSignal,
  Deno:{env:{get:name=>({SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'runtime-service',SUPABASE_ANON_KEY:'public-key'})[name]},serve:fn=>{handler=fn;}},
  require:id=>id==='./handler.ts'?{createAccountDeletion,finishAccountDeletion:async()=>{}}:{deletionProviders:()=>({})},
  fetch:async(url,options)=>{
   if(url.endsWith('/authorize_purchase_reconciliation')) {
    probes.push(options.headers.Authorization);
    return options.headers.Authorization==='Bearer verified-legacy-service' ? Response.json(true) : new Response(null,{status:401});
   }
   if(url.endsWith('/list_retryable_account_deletions'))return Response.json([]);
   throw new Error('Unexpected request');
  },
 });
 const invoke=token=>handler(new Request('https://project.supabase.co/functions/v1/delete-account/retry',{method:'POST',headers:token?{Authorization:token}:{}}));
 for(const token of [null,'Bearer public-key','Bearer unverified-service-claims'])assert.equal((await invoke(token)).status,401);
 assert.equal((await invoke('Bearer runtime-service')).status,200);
 assert.equal((await invoke('Bearer verified-legacy-service')).status,200);
 assert.ok(probes.includes('Bearer unverified-service-claims'),'A claimed service role is never trusted without a backend check');
});
