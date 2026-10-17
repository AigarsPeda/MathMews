import { createAccountDeletion, finishAccountDeletion, type DeletionDependencies, type DeletionJob } from './handler.ts';
import { deletionProviders } from './providers.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const url=Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey=Deno.env.get('SUPABASE_ANON_KEY') ?? '';
async function rpc(name: string, body: unknown, authorization=`Bearer ${serviceKey}`) {
 const response=await fetch(`${url}/rest/v1/rpc/${name}`,{
  method:'POST',headers:{apikey:serviceKey,Authorization:authorization,'Content-Type':'application/json'},
  body:JSON.stringify(body),signal:AbortSignal.timeout(15000),
 });
 if(!response.ok)throw new Error('Deletion persistence unavailable');
 const text=await response.text(); return text ? JSON.parse(text) : null;
}
const deps: DeletionDependencies = {
 async authenticate(authorization) {
  if(!url || !serviceKey || !anonKey)throw new Error('Backend configuration required');
  if(!/^Bearer\s+\S+$/i.test(authorization))return null;
  const response=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anonKey,Authorization:authorization},signal:AbortSignal.timeout(15000)});
  if(response.status===401 || response.status===403)return null;
  if(!response.ok)throw new Error('Authentication unavailable');
  const user=await response.json();return typeof user.id==='string' ? user.id : null;
 },
 async begin(authorization) { await rpc('begin_my_account_deletion',{},authorization); },
 async job(userId) { return await rpc('get_account_deletion_job',{p_user_id:userId}) as DeletionJob; },
 async advance(userId,step) { await rpc('advance_account_deletion',{p_user_id:userId,p_step:step}); },
 ...deletionProviders({
  revenueCatKey:Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? '',
  revenueCatProjectId:Deno.env.get('REVENUECAT_PROJECT_ID') ?? '',
  appleClientId:Deno.env.get('APPLE_CLIENT_ID') ?? '',appleTeamId:Deno.env.get('APPLE_TEAM_ID') ?? '',
  appleKeyId:Deno.env.get('APPLE_KEY_ID') ?? '',applePrivateKey:Deno.env.get('APPLE_PRIVATE_KEY') ?? '',
 }),
};
const handler=createAccountDeletion(deps);
Deno.serve(async request=>{
 // Supabase Cron can retry the outbox without an expired phone session. The
 // service credential is verified here even when the JWT gateway is enabled.
 if(request.method==='POST' && new URL(request.url).pathname.endsWith('/retry')) {
  const actual=request.headers.get('authorization') ?? '';
  const digest=async(value: string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const [a,b]=await Promise.all([digest(actual),digest(`Bearer ${serviceKey}`)]);
  let difference=0; for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
  // Dashboard legacy service JWTs can differ from the runtime key. Reuse the
  // deployed read-only, service-role-only authorization probe; PostgREST verifies
  // the signature and role before its EXECUTE grant allows this call.
  let authorized=!!serviceKey && difference===0;
  if (!authorized && /^Bearer\s+\S+$/i.test(actual)) {
   try { authorized=(await rpc('authorize_purchase_reconciliation',{},actual))===true; } catch { /* Fail closed. */ }
  }
  if(!authorized)return new Response(null,{status:401});
  const ids=await rpc('list_retryable_account_deletions',{}) as string[];
  let completed=0;
  for(const userId of ids)try { await finishAccountDeletion(deps,await deps.job(userId));completed++; }catch { /* Retain failed jobs for the next run. */ }
  return Response.json({attempted:ids.length,completed});
 }
 return handler(request);
});
