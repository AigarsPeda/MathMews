export type Job = {user_id: string; environment: 'sandbox'|'production'; phase: 'purchases'|'events'; cursor: string|null; lease_token: string};
export type RecordData = Record<string,unknown>;
export type Page = {items: RecordData[]; next_page: string|null};
export class ReconciliationError extends Error {
 constructor(public reason: 'provider_unavailable'|'rate_limited'|'invalid_response'|'run_timeout') { super(reason); }
}
export function object(value: unknown): RecordData {
 if(!value || typeof value!=='object' || Array.isArray(value))throw new ReconciliationError('invalid_response');
 return value as RecordData;
}
export function string(value: unknown, max=200): string {
 if(typeof value!=='string' || !value || value.length>max)throw new ReconciliationError('invalid_response');
 return value;
}
export function timestamp(value: unknown): number {
 if(typeof value!=='number' || !Number.isSafeInteger(value) || value<0)throw new ReconciliationError('invalid_response');
 return value;
}

/** The server key is sent only to fixed RevenueCat endpoints. Cursors are
 * extracted from same-customer pagination links, never followed as arbitrary URLs. */
export function revenueCatReader(key: string, projectId: string, send: typeof fetch = fetch) {
 const base=`/v2/projects/${encodeURIComponent(projectId)}`;
 const configured=/^sk_\S+$/.test(key) && /^[a-zA-Z0-9_-]{1,100}$/.test(projectId) && !/TODO|REPLACE/.test(projectId);
 const get=async(path: string): Promise<RecordData>=>{
  if(!configured)throw new ReconciliationError('provider_unavailable');
  let response: Response;
  try { response=await send(`https://api.revenuecat.com${path}`,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)}); }
  catch { throw new ReconciliationError('provider_unavailable'); }
  if(response.status===429)throw new ReconciliationError('rate_limited');
  if(response.status===404)return {object:'list',items:[],next_page:null,not_found:true};
  if(!response.ok)throw new ReconciliationError('provider_unavailable');
  const reader=response.body?.getReader(); if(!reader)throw new ReconciliationError('invalid_response');
  const chunks: Uint8Array[]=[]; let size=0;
  try {
   for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>2*1024*1024)throw new ReconciliationError('invalid_response');chunks.push(value);}
  } finally {await reader.cancel().catch(()=>undefined);reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try {return object(JSON.parse(new TextDecoder().decode(bytes)));}catch {throw new ReconciliationError('invalid_response');}
 };
 const path=(job: Job)=>`${base}/customers/${encodeURIComponent(job.user_id)}/${job.phase}`;
 return {
  configured,
  async page(job: Job): Promise<Page> {
   const query=new URLSearchParams({environment:job.environment,limit:'25'});
   if(job.cursor)query.set('starting_after',job.cursor);
   const data=await get(`${path(job)}?${query}`);
   if(data.object!=='list' || !Array.isArray(data.items) || data.items.length>100 || !(data.next_page==null || typeof data.next_page==='string'))throw new ReconciliationError('invalid_response');
   return {items:data.items.map(object),next_page:data.next_page==null ? null : data.next_page as string};
  },
  async product(id: string) {
   const data=await get(`${base}/products/${encodeURIComponent(string(id,255))}`);
   if(data.object!=='product' || data.id!==id)throw new ReconciliationError('invalid_response');
   return data;
  },
  cursor(job: Job, next: string|null): string|null {
   if(next===null)return null;
   let url: URL;try{url=new URL(next,'https://api.revenuecat.com');}catch{throw new ReconciliationError('invalid_response');}
   const cursor=url.searchParams.get('starting_after');
   if(url.origin!=='https://api.revenuecat.com' || url.pathname!==path(job) || url.username || url.password
    || !cursor || cursor.length>1000 || cursor===job.cursor)throw new ReconciliationError('invalid_response');
   return cursor;
  },
 };
}
