-- Transactional fixtures only. Existing accounts and balances are untouched.
begin;
set local plpgsql.check_asserts=on;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 app text:='reconcile-test-'||gen_random_uuid(); jobs jsonb; token uuid; replacement uuid:=gen_random_uuid();
 event jsonb; result jsonb; requested timestamptz; b_token uuid; b_event jsonb;
begin
 assert not has_function_privilege('anon','public.authorize_purchase_reconciliation()','execute');
 assert not has_function_privilege('authenticated','public.authorize_purchase_reconciliation()','execute');
 assert has_function_privilege('service_role','public.authorize_purchase_reconciliation()','execute');
 assert not has_function_privilege('authenticated','public.claim_purchase_reconciliations()','execute');
 assert not has_function_privilege('authenticated','public.apply_purchase_reconciliation(uuid,text,uuid,jsonb,text)','execute');
 assert not has_function_privilege('anon','public.request_my_purchase_reconciliation(text)','execute');
 insert into auth.users(id,is_anonymous,aud,role)values(a,true,'authenticated','authenticated'),(b,true,'authenticated','authenticated'),(c,true,'authenticated','authenticated');
 insert into public.revenuecat_apps(app_id,store,environments)values(app,'APP_STORE',array['sandbox','production']);
 perform wallet_private.ensure_wallet(a,'sandbox');perform wallet_private.ensure_wallet(a,'production');perform wallet_private.ensure_wallet(b,'sandbox');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.request_my_purchase_reconciliation('sandbox');
 update wallet_private.purchase_reconciliation set requested_at=now()-interval '1 minute',next_attempt_at=now()+interval '6 hours' where user_id=a and environment='sandbox';
 select requested_at into requested from wallet_private.purchase_reconciliation where user_id=a and environment='sandbox';
 perform public.request_my_purchase_reconciliation('sandbox');
 assert (select requested_at=requested and next_attempt_at>now() from wallet_private.purchase_reconciliation where user_id=a and environment='sandbox'),'Client request cooldown was bypassed';
 assert (select requested_at is null from wallet_private.purchase_reconciliation where user_id=b),'Another account was queued by the caller';
 update wallet_private.purchase_reconciliation set next_attempt_at='1970-01-01' where user_id in (a,b);
 jobs:=public.claim_purchase_reconciliations();
 select (j->>'lease_token')::uuid into token from jsonb_array_elements(jobs) j where j->>'user_id'=a::text and j->>'environment'='sandbox';
 assert token is not null,'Fixture was not claimed';
 select (j->>'lease_token')::uuid into b_token from jsonb_array_elements(jobs) j where j->>'user_id'=b::text and j->>'environment'='sandbox';
 event:=jsonb_build_object('id','rc-snapshot:'||gen_random_uuid(),'type','NON_RENEWING_PURCHASE','app_id',app,'store','APP_STORE',
  'environment','SANDBOX','app_user_id',a::text,'transaction_id','transaction-1','product_id','mathmews_coins_100','event_timestamp_ms',1000,'cancel_reason',null);
 result:=public.apply_purchase_reconciliation(a,'sandbox',token,event,'owned');
 assert result->>'state'='processed';
 assert (select balance=100 from public.coin_wallets where user_id=a and environment='sandbox');
 perform public.apply_purchase_reconciliation(a,'sandbox',token,event,'owned');
 -- Same purchase arriving later by the real webhook uses transaction uniqueness.
 perform public.record_revenuecat_event(jsonb_set(event,'{id}',to_jsonb(gen_random_uuid()::text)));
 assert (select balance=100 from public.coin_wallets where user_id=a and environment='sandbox'),'Webhook and recovery credited twice';
 assert (select balance=0 from public.coin_wallets where user_id=a and environment='production'),'Snapshot crossed environments';
 b_event:=event||jsonb_build_object('id','rc-snapshot:'||gen_random_uuid(),'app_user_id',b::text,'transaction_id','admin-preservation');
 perform public.apply_purchase_reconciliation(b,'sandbox',b_token,b_event,'owned');
 perform public.admin_set_coin_balance(b,500,'Disposable reconciliation/admin test',gen_random_uuid(),'sandbox','rollback test');
 perform public.apply_purchase_reconciliation(b,'sandbox',b_token,b_event,'owned');
 assert (select balance=500 from public.coin_wallets where user_id=b and environment='sandbox'),'Reconciliation overwrote an admin-set balance';

 result:=public.apply_purchase_reconciliation(a,'sandbox',token,event,'refunded');
 assert (select balance=0 from public.coin_wallets where user_id=a and environment='sandbox'),'Missing refund was not recovered';
 -- An old owned snapshot cannot undo a refund.
 result:=public.apply_purchase_reconciliation(a,'sandbox',token,event,'owned');
 assert result->>'review_required'='true';
 assert (select balance=0 from public.coin_wallets where user_id=a and environment='sandbox');
 -- Authoritative event time wins even when event history arrives out of order.
 perform public.record_revenuecat_event(event||jsonb_build_object('id',gen_random_uuid()::text,'type','REFUND_REVERSED','event_timestamp_ms',3000));
 assert (select balance=100 from public.coin_wallets where user_id=a and environment='sandbox');
 result:=public.apply_purchase_reconciliation(a,'sandbox',token,event,'refunded');
 assert result->>'review_required'='true';
 assert (select balance=100 from public.coin_wallets where user_id=a and environment='sandbox'),'A stale refund snapshot undid a newer reversal';
 perform public.record_revenuecat_event(event||jsonb_build_object('id',gen_random_uuid()::text,'type','CANCELLATION','event_timestamp_ms',2000,'cancel_reason','CUSTOMER_SUPPORT'));
 assert (select balance=100 from public.coin_wallets where user_id=a and environment='sandbox'),'Out-of-order cancellation undid a reversal';
 -- A newer genuine cancellation still applies after that reversal.
 perform public.record_revenuecat_event(event||jsonb_build_object('id',gen_random_uuid()::text,'type','CANCELLATION','event_timestamp_ms',4000,'cancel_reason','CUSTOMER_SUPPORT'));
 assert (select balance=0 from public.coin_wallets where user_id=a and environment='sandbox');

 begin
  perform public.apply_purchase_reconciliation(a,'sandbox',token,jsonb_set(event,'{app_user_id}',to_jsonb(b::text)),'owned');
  raise exception 'Cross-account payload was accepted';
 exception when raise_exception then if sqlerrm='Cross-account payload was accepted' then raise;end if;end;
 update wallet_private.purchase_reconciliation set lease_token=replacement where user_id=a and environment='sandbox';
 begin
  perform public.apply_purchase_reconciliation(a,'sandbox',token,event,'owned');
  raise exception 'Old lease was accepted';
 exception when raise_exception then if sqlerrm='Old lease was accepted' then raise;end if;end;
 assert not public.finish_purchase_reconciliation(a,'sandbox',token,'events','old-cursor',null),'A stale worker advanced the cursor';
 -- A checkout request made while a page was leased must not be buried by the
 -- usual six-hour periodic sweep when that older page finishes.
 update wallet_private.purchase_reconciliation set requested_at=now()+interval '1 second' where user_id=a and environment='sandbox';
 assert public.finish_purchase_reconciliation(a,'sandbox',replacement,'purchases',null,null);
 assert (select next_attempt_at<now()+interval '3 minutes' from wallet_private.purchase_reconciliation where user_id=a and environment='sandbox'),'A request during the lease was lost';
 update wallet_private.purchase_reconciliation set lease_token=replacement,lease_until=now()+interval '3 minutes' where user_id=a and environment='sandbox';
 assert public.finish_purchase_reconciliation(a,'sandbox',replacement,'events','purchase-25','rate_limited');
 assert (select cursor='purchase-25' and phase='events' and next_attempt_at>now() and last_error='rate_limited'
  from wallet_private.purchase_reconciliation where user_id=a and environment='sandbox'),'Retry cursor or backoff lost';

 -- Deletion fences both phases, and completion removes queue/review PII.
 perform public.begin_my_account_deletion();
 update wallet_private.purchase_reconciliation set lease_until=null,next_attempt_at='1960-01-01' where user_id=a;
 jobs:=public.claim_purchase_reconciliations();
 assert not exists(select 1 from jsonb_array_elements(jobs) j where j->>'user_id'=a::text),'Deleting account was claimed';
 perform public.advance_account_deletion(a,'confirmed');perform public.advance_account_deletion(a,'revenuecat_deleted');perform public.advance_account_deletion(a,'complete');
 assert not exists(select 1 from wallet_private.purchase_reconciliation where user_id=a),'Deleted account left a live job';
 assert not exists(select 1 from wallet_private.purchase_reconciliation_issues where user_id=a),'Deleted account left review data';
 -- A transferred/restored transaction cannot be credited to a second user.
 perform wallet_private.ensure_wallet(c,'sandbox');
 result:=public.record_revenuecat_event(event||jsonb_build_object('id',gen_random_uuid()::text,'app_user_id',c::text));
 assert result->>'reason'='transaction_owner_or_product_conflict';
 assert (select balance=0 from public.coin_wallets where user_id=c and environment='sandbox');
end; $$;
select 'Purchase recovery, duplicate webhooks, refund ordering, leases, environment isolation and deletion fencing passed' as result;
rollback;
