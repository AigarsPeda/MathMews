import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import ts from 'typescript';
const cache=new Map();
async function load(file) {
 if(cache.has(file))return cache.get(file);
 let source=await fs.readFile(file,'utf8');
 for(const match of [...source.matchAll(/from '(\.\/[^']+\.ts)'/g)]) {
  const url=await compile(path.resolve(path.dirname(file),match[1]));source=source.replaceAll(`'${match[1]}'`,JSON.stringify(url));
 }
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const url=`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;cache.set(file,url);return url;
}
async function compile(file){return load(file);}
const {revenueCatReader,ReconciliationError}=await import(await load('supabase/functions/reconcile-purchases/revenuecat.ts'));
const {reconcilePurchases}=await import(await load('supabase/functions/reconcile-purchases/worker.ts'));
const {createReconciliationHandler}=await import(await load('supabase/functions/reconcile-purchases/handler.ts'));
const job={user_id:'10000000-0000-4000-8000-000000000001',environment:'sandbox',phase:'purchases',cursor:null,lease_token:'lease'};
const purchase={object:'purchase',id:'purchase-1',customer_id:job.user_id,original_customer_id:job.user_id,
 product_id:'internal-product',store_purchase_identifier:'store-transaction',environment:'sandbox',store:'app_store',
 ownership:'purchased',quantity:1,status:'owned',purchased_at:1000};
const product={object:'product',id:'internal-product',app_id:'configured-apple-app',store_identifier:'mathmews_coins_100',type:'consumable'};
function harness({jobs=[job],items=[purchase],next=null,failAt=0}={}) {
 const applied=[],issues=[],finishes=[];let applyCalls=0,productCalls=0;
 const reader=revenueCatReader('sk_private','project');
 return {applied,issues,finishes,get productCalls(){return productCalls;},deps:{claim:async()=>jobs,
  page:async()=>({items,next_page:next}),product:async()=>{productCalls++;return product;},cursor:reader.cursor,
  apply:async(j,event,snapshot)=>{if(++applyCalls===failAt)throw new Error('private detail');applied.push({job:j,event,snapshot});return {state:'processed'};},
  issue:async(j,id,reason)=>issues.push({id,reason}),finish:async(j,phase,cursor,error)=>finishes.push({phase,cursor,error}),
 }};
}
test('reconciliation requires the exact service credential and fails closed before claiming jobs',async()=>{
 let runs=0;const handler=createReconciliationHandler({authorization:'Bearer service-test',configured:true,run:async()=>{runs++;return {failed:0};}});
 const req=token=>new Request('https://example.invalid/reconcile',{method:'POST',headers:{authorization:token}});
 assert.equal((await handler(req('Bearer ordinary-user-jwt'))).status,401);
 assert.equal((await handler(new Request('https://example.invalid'))).status,405);
 assert.equal(runs,0);
 assert.equal((await handler(req('Bearer service-test'))).status,200);
 const missing=createReconciliationHandler({authorization:'Bearer service-test',configured:false,run:async()=>{throw new Error();}});
 assert.equal((await missing(req('Bearer service-test'))).status,503);
});
test('purchase recovery maps internal product IDs to store SKUs and never uses prices or client coin counts',async()=>{
 const h=harness();const result=await reconcilePurchases(h.deps);
 assert.equal(result.failed,0);assert.equal(h.applied.length,1);
 const {event,snapshot}=h.applied[0];
 assert.equal(event.product_id,'mathmews_coins_100');assert.equal(event.app_id,product.app_id);
 assert.equal(event.transaction_id,purchase.store_purchase_identifier);assert.equal(event.event_timestamp_ms,1000);
 assert.equal(event.app_user_id,job.user_id);assert.equal(snapshot,'owned');assert.equal(event.coins,undefined);
 assert.deepEqual(h.finishes,[{phase:'events',cursor:null,error:null}]);
});
test('wrong ownership and multi-quantity purchases require review without financial changes',async()=>{
 const h=harness({items:[{...purchase,original_customer_id:'other-user'},{...purchase,id:'p2',quantity:2}]});
 await reconcilePurchases(h.deps);assert.equal(h.applied.length,0);
 assert.deepEqual(h.issues.map(x=>x.reason),['ownership_mismatch','unsupported_quantity']);
});
test('an environment mismatch fails the page and never turns test money into production coins',async()=>{
 const h=harness({items:[{...purchase,environment:'production'}]});await reconcilePurchases(h.deps);
 assert.equal(h.applied.length,0);assert.equal(h.finishes[0].error,'invalid_response');
});
test('event history preserves causal timestamps and strips subscriber attributes',async()=>{
 const body={type:'REFUND_REVERSED',app_user_id:job.user_id,environment:'SANDBOX',store:'APP_STORE',
  transaction_id:'store-transaction',product_id:'mathmews_coins_100',event_timestamp_ms:3000,subscriber_attributes:{email:'private@example.invalid'}};
 const h=harness({jobs:[{...job,phase:'events'}],items:[{id:'original-event',type:'PURCHASES_REFUND_REVERSED',app_id:product.app_id,body,created_at:9999}]});
 await reconcilePurchases(h.deps);const event=h.applied[0].event;
 assert.equal(event.type,'REFUND_REVERSED');assert.equal(event.event_timestamp_ms,3000);
 assert.equal(event.subscriber_attributes,undefined);assert.equal(h.applied[0].snapshot,null);
 assert.deepEqual(h.finishes,[{phase:'purchases',cursor:null,error:null}]);
});
test('incomplete or identity-mismatched history is recorded for review, never guessed',async()=>{
 const h=harness({jobs:[{...job,phase:'events'}],items:[
  {id:'e1',type:'PURCHASES_CANCELLATION',app_id:'app',body:{app_user_id:'victim',environment:'SANDBOX'}},
  {id:'e2',type:'PURCHASES_CANCELLATION',app_id:'app',body:{app_user_id:job.user_id,environment:'SANDBOX'}}]});
 await reconcilePurchases(h.deps);assert.equal(h.applied.length,0);
 assert.deepEqual(h.issues.map(x=>x.reason),['identity_mismatch','incomplete_event']);
});
test('partial page failure repeats deterministic event IDs from the original cursor',async()=>{
 const items=[purchase,{...purchase,id:'purchase-2',store_purchase_identifier:'tx2'}];
 const first=harness({items,failAt:2});await reconcilePurchases(first.deps);
 assert.deepEqual(first.finishes,[{phase:'purchases',cursor:null,error:'provider_unavailable'}]);
 const retry=harness({items});await reconcilePurchases(retry.deps);
 assert.deepEqual(retry.applied[0].event,first.applied[0].event);assert.equal(retry.productCalls,1);
});
test('pagination is constrained to the same project/customer endpoint and uses only the cursor',async()=>{
 const calls=[];const api=revenueCatReader('sk_private','project',async(url,options)=>{calls.push({url,options});return Response.json({object:'list',items:[],next_page:null});});
 for(const next of ['https://evil.invalid/leak?starting_after=x','/v2/projects/other/customers/u/purchases?starting_after=x',
  `/v2/projects/project/customers/${job.user_id}/events?starting_after=x`])assert.throws(()=>api.cursor(job,next));
 const next=`/v2/projects/project/customers/${job.user_id}/purchases?starting_after=purchase-25`;
 assert.equal(api.cursor(job,next),'purchase-25');
 await api.page({...job,cursor:'purchase-25'});
 assert.ok(calls[0].url.includes('environment=sandbox'));assert.ok(calls[0].url.includes('starting_after=purchase-25'));
 assert.equal(calls[0].options.redirect,'error');
 assert.throws(()=>api.cursor({...job,cursor:'purchase-25'},next));
});
test('rate limits, bad provider responses and missing configuration do not advance a cursor',async()=>{
 for(const [response,reason] of [[new Response('',{status:429}),'rate_limited'],[Response.json({items:'wrong'}),'invalid_response'],[new Response('',{status:503}),'provider_unavailable']]){
  const api=revenueCatReader('sk_private','project',async()=>response);
  await assert.rejects(()=>api.page(job),error=>error instanceof ReconciliationError && error.reason===reason);
 }
 assert.equal(revenueCatReader('appl_public','project').configured,false);
 assert.equal(revenueCatReader('sk_private','TODO_PROJECT').configured,false);
 const api=revenueCatReader('sk_private','project',async()=>new Response('',{status:404}));
 assert.deepEqual(await api.page(job),{items:[],next_page:null});
});
test('a bad continuation is rejected before applying any purchase from its page',async()=>{
 const h=harness({next:'https://evil.invalid/leak?starting_after=x'});await reconcilePurchases(h.deps);
 assert.equal(h.applied.length,0);assert.equal(h.finishes[0].error,'invalid_response');
});

test('alternate service credentials require verified database authorization before any job is claimed',async()=>{
 let runs=0;const checks=[];
 const handler=createReconciliationHandler({authorization:'Bearer runtime-service-key',configured:true,
  authorize:async authorization=>{checks.push(authorization);return authorization==='Bearer verified-alternate-service-jwt';},
  run:async()=>{runs++;return {failed:0};}});
 const request=authorization=>new Request('https://example.invalid/reconcile',{method:'POST',headers:{authorization}});
 assert.equal((await handler(request('Bearer ordinary-user-jwt'))).status,401);
 assert.equal(runs,0);
 assert.equal((await handler(request('Bearer verified-alternate-service-jwt'))).status,200);
 assert.equal(runs,1);assert.equal(checks.length,2);
 const unavailable=createReconciliationHandler({authorization:'Bearer runtime-service-key',configured:true,
  authorize:async()=>{throw new Error('private server detail');},run:async()=>{runs++;return {failed:0};}});
 const response=await unavailable(request('Bearer another-token'));
 assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private server detail'));
 assert.equal(runs,1,'Failed authorization must never claim or change jobs');
});
