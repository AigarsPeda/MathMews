type ProviderConfig = {
 revenueCatKey: string; revenueCatProjectId: string; appleClientId: string; appleTeamId: string;
 appleKeyId: string; applePrivateKey: string;
};
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const segment = (value: unknown) => encode(new TextEncoder().encode(JSON.stringify(value)));

export function deletionProviders(config: ProviderConfig, send: typeof fetch = fetch) {
 const post=async (path: string, data: Record<string,string>) => {
  const response=await send(`https://appleid.apple.com/auth/${path}`,{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams(data),signal:AbortSignal.timeout(15000),
  });
  if(!response.ok)throw new Error('Apple cleanup unavailable');
  return response;
 };
 return {
  async deleteRevenueCat(userId: string) {
   if(!/^sk_\S+$/.test(config.revenueCatKey) || typeof config.revenueCatProjectId!=='string'
    || !/^[a-zA-Z0-9_-]{1,100}$/.test(config.revenueCatProjectId)
    || /TODO|REPLACE/.test(config.revenueCatProjectId))throw new Error('RevenueCat V2 server configuration required');
   const endpoint=`https://api.revenuecat.com/v2/projects/${encodeURIComponent(config.revenueCatProjectId)}/customers/${encodeURIComponent(userId)}`;
   const request=(method: string)=>send(endpoint,{
    method,headers:{Authorization:`Bearer ${config.revenueCatKey}`},redirect:'error',signal:AbortSignal.timeout(15000),
   });
   const removed=async()=>{
    const response=await request('GET');
    if(response.status===404)return true;
    if(!response.ok)throw new Error('RevenueCat cleanup unavailable');
    const customer=await response.json();
    if(customer?.object!=='customer' || customer.id!==userId)throw new Error('RevenueCat customer mismatch');
    return false;
   };
   // V2 queues deletion asynchronously. Check before submitting, so an outbox
   // retry can confirm removal without putting the customer back in the queue.
   if(await removed())return;
   const response=await request('DELETE');
   if(!response.ok && response.status!==404)throw new Error('RevenueCat cleanup unavailable');
   if(!await removed())throw new Error('RevenueCat cleanup pending');
  },
  async revokeApple(code: string, expectedSubject: string) {
   if(!config.appleClientId || !config.appleTeamId || !config.appleKeyId || !config.applePrivateKey)throw new Error('Apple server credentials required');
   const now=Math.floor(Date.now()/1000);
   const signingInput=segment({alg:'ES256',kid:config.appleKeyId})+'.'+segment({iss:config.appleTeamId,iat:now,exp:now+300,aud:'https://appleid.apple.com',sub:config.appleClientId});
   const pem=config.applePrivateKey.replace(/\\n/g,'\n').replace(/-----[^-]+-----|\s/g,'');
   const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
   const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(signingInput));
   const client_secret=signingInput+'.'+encode(new Uint8Array(signature));
   const credentials={client_id:config.appleClientId,client_secret};
   const response=await post('token',{...credentials,code,grant_type:'authorization_code'});
   const tokens=await response.json();
   // This token comes directly from Apple's authenticated token endpoint,
   // never from an unverified client JWT. Bind it to the Supabase identity.
   const payload=tokens.id_token?.split('.')[1];
   const claims=payload && JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
   if(claims?.sub!==expectedSubject || claims.aud!==config.appleClientId || claims.iss!=='https://appleid.apple.com' || claims.exp<=now || !tokens.refresh_token)throw new Error('Apple identity mismatch');
   await post('revoke',{...credentials,token:tokens.refresh_token,token_type_hint:'refresh_token'});
  },
 };
}
