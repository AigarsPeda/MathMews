import { object, string, timestamp, ReconciliationError, type Job, type RecordData, type Page } from './revenuecat.ts';
type Event = Record<string,string|number|null>;
type Result = {state: string; review_required?: boolean};
type Dependencies = {
 claim: ()=>Promise<Job[]>;
 page: (job: Job)=>Promise<Page>;
 product: (id: string)=>Promise<RecordData>;
 cursor: (job: Job,next: string|null)=>string|null;
 apply: (job: Job,event: Event,snapshot: string|null)=>Promise<Result>;
 issue: (job: Job,sourceId: string,reason: string)=>Promise<void>;
 finish: (job: Job,phase: Job['phase'],cursor: string|null,error: string|null)=>Promise<void>;
 now?: ()=>number;
};
async function sourceId(prefix: string,id: unknown) {
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(string(id,1500)));
 return prefix+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
const stores: Record<string,string>={app_store:'APP_STORE',play_store:'PLAY_STORE',test_store:'TEST_STORE'};
const eventTypes=new Set(['NON_RENEWING_PURCHASE','CANCELLATION','REFUND_REVERSED']);

export async function reconcilePurchases(deps: Dependencies) {
 const now=deps.now ?? Date.now; const deadline=now()+55000;
 const totals={pages:0,processed:0,quarantined:0,review:0,failed:0};
 const jobs=await deps.claim();
 const products=new Map<string,RecordData>();
 for(const job of jobs) {
  try {
   const page=await deps.page(job);
   // Validate continuation before applying any financial effects from this page.
   const cursor=deps.cursor(job,page.next_page);
   for(const item of page.items) {
    if(now()>deadline)throw new ReconciliationError('run_timeout');
    if(job.phase==='purchases') {
     const id=await sourceId('rc-snapshot:',item.id);
     if(item.environment!==job.environment)throw new ReconciliationError('invalid_response');
     if(item.customer_id!==job.user_id || item.original_customer_id!==job.user_id || item.ownership!=='purchased') {
      await deps.issue(job,id,'ownership_mismatch');totals.review++;continue;
     }
     if(item.quantity!==1){await deps.issue(job,id,'unsupported_quantity');totals.review++;continue;}
     if(!['owned','refunded'].includes(item.status as string))throw new ReconciliationError('invalid_response');
     const store=stores[string(item.store)];
     if(!store)continue; // Other stores cannot grant this game's currency.
     const productId=string(item.product_id,255);
     if(!products.has(productId)) {
      if(products.size>=20)throw new ReconciliationError('run_timeout');
      products.set(productId,await deps.product(productId));
     }
     const product=products.get(productId)!;
     if(!(product.type==='consumable' || product.type==='one_time' && object(product.one_time).is_consumable===true))continue;
     const event: Event={id,type:'NON_RENEWING_PURCHASE',app_id:string(product.app_id),app_user_id:job.user_id,
      product_id:string(product.store_identifier),store,environment:job.environment.toUpperCase(),
      transaction_id:string(item.store_purchase_identifier),event_timestamp_ms:timestamp(item.purchased_at),cancel_reason:null};
     const result=await deps.apply(job,event,item.status as string);
     if(result.state==='quarantined')totals.quarantined++;else totals.processed++;
     if(result.review_required)totals.review++;
    } else {
     const type=string(item.type).replace(/^PURCHASES_/,'');
     if(!eventTypes.has(type))continue;
     const id=await sourceId('rc-history:',item.id);
     let body: RecordData;
     try{body=object(item.body);}catch{await deps.issue(job,id,'incomplete_event');totals.review++;continue;}
     if(body.app_user_id!==job.user_id || body.environment!==job.environment.toUpperCase()) {
      await deps.issue(job,id,'identity_mismatch');totals.review++;continue;
     }
     if(body.quantity!==undefined && body.quantity!==1){await deps.issue(job,id,'unsupported_quantity');totals.review++;continue;}
     let event: Event;
     try {
      if(body.type!==undefined && body.type!==type)throw new Error();
      if(body.app_id!==undefined && body.app_id!==item.app_id)throw new Error();
      event={id,type,app_id:string(item.app_id),app_user_id:job.user_id,environment:job.environment.toUpperCase(),
       store:string(body.store),transaction_id:string(body.transaction_id),product_id:string(body.product_id),
       cancel_reason:body.cancel_reason==null ? null : string(body.cancel_reason),
       event_timestamp_ms:timestamp(body.event_timestamp_ms ?? item.occurred_at)};
     } catch {await deps.issue(job,id,'incomplete_event');totals.review++;continue;}
     const result=await deps.apply(job,event,null);
     if(result.state==='quarantined')totals.quarantined++;else totals.processed++;
    }
   }
   const phase=cursor ? job.phase : job.phase==='purchases' ? 'events' : 'purchases';
   await deps.finish(job,phase,cursor,null);totals.pages++;
  } catch(error) {
   totals.failed++;
   const reason=error instanceof ReconciliationError ? error.reason : 'provider_unavailable';
   // A partial page repeats from the original cursor. Ledger transaction
   // uniqueness and original event timestamps make that retry harmless.
   try{await deps.finish(job,job.phase,job.cursor,reason);}catch{/* An expired lease is reclaimed later. */}
  }
 }
 return totals;
}
