export type DeletionJob = {
 id: string; user_id: string; state: 'pending' | 'completed';
 apple_subject: string | null; apple_revoked: boolean; revenuecat_deleted: boolean;
};
export type DeletionDependencies = {
 authenticate: (authorization: string) => Promise<string | null>;
 begin: (authorization: string) => Promise<void>;
 job: (userId: string) => Promise<DeletionJob>;
 advance: (userId: string, step: string) => Promise<void>;
 revokeApple: (code: string, subject: string) => Promise<void>;
 deleteRevenueCat: (userId: string) => Promise<void>;
};
export async function finishAccountDeletion(deps: Pick<DeletionDependencies,'advance'|'deleteRevenueCat'>, job: DeletionJob) {
 if (!job.apple_revoked) throw new Error('Apple cleanup required');
 if (!job.revenuecat_deleted) {
  await deps.deleteRevenueCat(job.user_id);
  await deps.advance(job.user_id,'revenuecat_deleted');
 }
 await deps.advance(job.user_id,'complete');
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
 status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** Validates the session on the server; neither user IDs nor provider subjects
 * supplied in a request can authorize deletion. Errors never expose tokens. */
export function createAccountDeletion(deps: DeletionDependencies) {
 return async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json(405,{error:'method_not_allowed'});
  const authorization=request.headers.get('authorization') ?? '';
  let userId: string | null;
  try { userId=await deps.authenticate(authorization); }
  catch { return json(503,{error:'authentication_unavailable'}); }
  if (!userId) return json(401,{error:'authentication_required'});
  let code: string | undefined;
  try {
   // The only optional body field is a fresh one-use native Apple auth code.
   const reader=request.body?.getReader();
   let size=0; const chunks: Uint8Array[]=[];
   if (reader) try {
    for (;;) { const {value,done}=await reader.read(); if(done)break;
     size+=value.byteLength; if(size>8192)return json(413,{error:'body_too_large'}); chunks.push(value); }
   } finally { await reader.cancel().catch(()=>undefined); reader.releaseLock(); }
   const bytes=new Uint8Array(size); let offset=0;
   for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const body=JSON.parse(new TextDecoder().decode(bytes) || '{}');
   if(!body || Array.isArray(body) || typeof body!=='object')throw new Error();
   code=body.appleAuthorizationCode;
   if(code!==undefined && (typeof code!=='string' || code.length<1 || code.length>4096))throw new Error();
  } catch { return json(400,{error:'invalid_request'}); }
  let job: DeletionJob | undefined;
  try {
   await deps.begin(authorization);
   job=await deps.job(userId);
   if(job.state==='completed')return json(200,{id:job.id,state:'completed'});
   // The phone persisted its status receipt before invoking this function.
   // A lost prepare-RPC response alone must never authorize the cron worker.
   await deps.advance(userId,'confirmed');
   if(!job.apple_revoked){
    if(!code || !job.apple_subject)return json(202,{id:job.id,state:'pending',reason:'apple_authorization_required'});
    await deps.revokeApple(code,job.apple_subject);
    await deps.advance(userId,'apple_revoked');
   }
   if(!job.revenuecat_deleted){
    await deps.deleteRevenueCat(userId);
    await deps.advance(userId,'revenuecat_deleted');
   }
   await deps.advance(userId,'complete');
   return json(200,{id:job.id,state:'completed'});
  } catch {
   // Keep the session and the durable job for retries. A failure is never
   // represented as successful deletion or followed by a new guest account.
   return job ? json(202,{id:job.id,state:'pending',reason:'cleanup_pending'})
    : json(503,{error:'deletion_unavailable'});
  }
 };
}
