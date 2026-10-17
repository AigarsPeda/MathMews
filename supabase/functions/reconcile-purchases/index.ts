import { revenueCatReader } from './revenuecat.ts';
import { reconcilePurchases } from './worker.ts';
import { createReconciliationHandler } from './handler.ts';
declare const Deno: {env: {get(name: string): string|undefined};serve(handler: (request: Request)=>Promise<Response>): void};
const url=Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const api=revenueCatReader(Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? '',Deno.env.get('REVENUECAT_PROJECT_ID') ?? '');
async function rpc(name: string,body: unknown,authorization=`Bearer ${serviceKey}`) {
 const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceKey,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(name==='authorize_purchase_reconciliation' && [401,403].includes(response.status))return false;
 if(!response.ok)throw new Error('Reconciliation persistence unavailable');
 const text=await response.text();return text ? JSON.parse(text) : null;
}
const scope=(job: {user_id: string;environment: string;lease_token: string})=>({p_user_id:job.user_id,p_environment:job.environment,p_token:job.lease_token});
Deno.serve(createReconciliationHandler({authorization:serviceKey?`Bearer ${serviceKey}`:'',configured:!!url && api.configured,
 // A valid service JWT need not be byte-for-byte equal to the runtime key.
 // PostgREST verifies its signature and service-only EXECUTE permission.
 authorize:async authorization=>await rpc('authorize_purchase_reconciliation',{},authorization)===true,
 run:()=>reconcilePurchases({
  ...api,claim:async()=>await rpc('claim_purchase_reconciliations',{}),
  apply:async(job,event,snapshot)=>await rpc('apply_purchase_reconciliation',{...scope(job),p_event:event,p_snapshot_status:snapshot}),
  issue:async(job,id,reason)=>{await rpc('note_purchase_reconciliation_issue',{...scope(job),p_source_id:id,p_reason:reason});},
  finish:async(job,phase,cursor,error)=>{if(!await rpc('finish_purchase_reconciliation',{...scope(job),p_phase:phase,p_cursor:cursor,p_error:error}))throw new Error('Reconciliation lease expired');},
 }),
}));
