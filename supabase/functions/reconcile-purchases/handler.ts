export function createReconciliationHandler(deps: {authorization: string; configured: boolean; authorize?: (authorization: string)=>Promise<boolean>; run: ()=>Promise<{failed: number}>}) {
 return async(request: Request): Promise<Response>=>{
  const json=(status: number,body: unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(!deps.authorization)return json(503,{error:'configuration_required'});
  const hash=async(value: string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const [a,b]=await Promise.all([hash(request.headers.get('authorization') ?? ''),hash(deps.authorization)]);
  let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];
  if(different) {
   if(!deps.authorize)return json(401,{error:'service_authorization_required'});
   try {
    if(!await deps.authorize(request.headers.get('authorization') ?? ''))return json(401,{error:'service_authorization_required'});
   } catch {return json(503,{error:'reconciliation_unavailable'});}
  }
  if(!deps.configured)return json(503,{error:'configuration_required'});
  try{const result=await deps.run();return json(result.failed?503:200,result);}catch{return json(503,{error:'reconciliation_unavailable'});}
 };
}
