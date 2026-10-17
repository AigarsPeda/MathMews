// Explicit live acceptance test. Creates and removes ONLY its own disposable
// anonymous identity and RevenueCat customer. No existing account ID is accepted.
// A private temporary journal permits retry after an interrupted provider call.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const project='https://jcfppquntstgxubtlvqo.supabase.co';
const anon=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const rcKey=process.env.REVENUECAT_SECRET_API_KEY;
const rcProject=process.env.REVENUECAT_PROJECT_ID;
const journal='/tmp/mathmews-disposable-deletion.json';
if(!process.argv.includes('--confirm-disposable-account'))throw new Error('Pass --confirm-disposable-account to create and delete the isolated fixture.');
assert.equal(process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/,''),project);
assert.ok(anon && rcKey?.startsWith('sk_') && rcProject==='projfbac6be5','Existing project credentials required');
let state;
try {state=JSON.parse(await fs.readFile(journal,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const save=()=>fs.writeFile(journal,JSON.stringify(state),{mode:0o600});
const call=async(path,{token=anon,method='POST',body,prefer}={})=>{
 const response=await fetch(project+path,{method,headers:{apikey:anon,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
  body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(25000)});
 const value=await response.json().catch(()=>null);return {status:response.status,value};
};
const rc=async(method,body)=>fetch(`https://api.revenuecat.com/v2/projects/${rcProject}/customers${body?'':'/'+state.userId}`,{
 method,headers:{Authorization:`Bearer ${rcKey}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,
 redirect:'error',signal:AbortSignal.timeout(25000),
});
const result={checks:state?.checks??[],cron:'disabled',fixture:'agent-created anonymous account only'};
const check=(condition,name)=>{assert.ok(condition,name);result.checks.push(name);};
if(!state){
 const created=await call('/auth/v1/signup',{body:{data:{release_test:'disposable_account_deletion'}}});
 check(created.status===200 && created.value?.user?.is_anonymous===true && created.value.user.id && created.value.access_token,'disposable anonymous session created');
 state={createdBy:'mathmews-live-deletion-check',project,userId:created.value.user.id,token:created.value.access_token,saveId:randomUUID(),checks:result.checks};await save();
}
assert.equal(state.createdBy,'mathmews-live-deletion-check');assert.equal(state.project,project);
const priorStatus=state.receipt ? await call('/rest/v1/rpc/check_account_deletion',{
 body:{p_user_id:state.userId,p_confirmation_key:state.receipt.confirmation_key},
}) : null;
if(priorStatus?.value!=='completed') {
 const identity=await call('/auth/v1/user',{method:'GET',token:state.token});
 check(identity.status===200 && identity.value.id===state.userId && identity.value.is_anonymous===true
  && identity.value.user_metadata?.release_test==='disposable_account_deletion','journal matches the disposable test identity');
}
if(!state.receipt){
 const invalid=await call('/functions/v1/delete-account',{body:{}});check(invalid.status===401,'public key cannot delete accounts');
 const retry=await call('/functions/v1/delete-account/retry',{token:state.token,body:{}});check(retry.status===401,'ordinary user cannot run server deletion retries');
 const customer=await rc('POST',{id:state.userId});check([201,409].includes(customer.status),'disposable RevenueCat customer created');
 const wrote=await call('/rest/v1/game_saves',{token:state.token,prefer:'resolution=merge-duplicates',body:{id:state.saveId,user_id:state.userId,environment:'sandbox',save:{release_test:true},client_updated_at:1}});
 check(wrote.status===201,'disposable sandbox save created');
 const wallet=await call('/rest/v1/rpc/initialize_my_game_wallet',{token:state.token,body:{p_environment:'sandbox'}});check(wallet.status===200,'disposable sandbox wallet initialized');
 const receipt=await call('/rest/v1/rpc/begin_my_account_deletion',{token:state.token,body:{}});
 check(receipt.status===200 && receipt.value?.confirmation_key,'private completion receipt persisted');
 state.receipt=receipt.value;await save();
 const blocked=await call('/rest/v1/game_saves',{token:state.token,body:{id:randomUUID(),user_id:state.userId,environment:'sandbox',save:{release_test:true}}});
 check(blocked.status>=400,'deleting account cannot create another cloud save');
}
const deletion=priorStatus?.value==='completed' ? null : await call('/functions/v1/delete-account',{token:state.token,body:{}});
if(deletion)check([200,202].includes(deletion.status),'authenticated deletion accepted');
const status=await call('/rest/v1/rpc/check_account_deletion',{body:{p_user_id:state.userId,p_confirmation_key:state.receipt.confirmation_key}});
if(status.value!=='completed'){
 await save();
 console.log(JSON.stringify({...result,state:'pending',function_status:deletion?.status,instruction:'Rerun this same command to confirm asynchronous provider cleanup.'},null,2));process.exit(2);
}
check(true,'receipt confirms completed deletion without a user session');
const customer=await rc('GET');check(customer.status===404,'RevenueCat customer is actually removed');
const auth=await call('/auth/v1/user',{method:'GET',token:state.token});check([401,403].includes(auth.status),'deleted Auth session rejected');
const rows=await call(`/rest/v1/game_saves?select=id&user_id=eq.${state.userId}`,{method:'GET',token:state.token});check(rows.status===200 && rows.value.length===0,'deleted account has no cloud saves');
const replay=await call('/functions/v1/delete-account',{token:state.token,body:{}});check(replay.status===401,'deleted session cannot authorize another deletion');
const wrong=await call('/rest/v1/rpc/check_account_deletion',{body:{p_user_id:state.userId,p_confirmation_key:randomUUID()}});check(wrong.value===null,'incorrect receipt reveals no deletion status');
await fs.rm(journal);console.log(JSON.stringify({...result,state:'passed',fixture_user_id:state.userId,private_journal_removed:true},null,2));
