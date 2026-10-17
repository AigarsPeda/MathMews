-- Run after migration 009, or concatenate the migration without its COMMIT to
-- this file. Fixtures, account deletions and DDL all roll back in the latter case.
-- No existing user or wallet is changed.
begin;
set local plpgsql.check_asserts=on;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 request jsonb; request2 jsonb; job jsonb; receipt text;
begin
 assert not has_function_privilege('anon','public.begin_my_account_deletion()','execute');
 assert not has_function_privilege('authenticated','public.advance_account_deletion(uuid,text)','execute');
 assert not has_function_privilege('authenticated','public.get_account_deletion_job(uuid)','execute');
 assert has_function_privilege('service_role','public.advance_account_deletion(uuid,text)','execute');
 insert into auth.users(id,is_anonymous,aud,role)values(a,true,'authenticated','authenticated'),(b,true,'authenticated','authenticated');
 insert into public.game_saves(user_id,environment,save)values(a,'sandbox','{}'),(a,'production','{}'),(b,'sandbox','{}');
 perform public.admin_adjust_coins(a,100,'Disposable deletion regression',gen_random_uuid(),'sandbox','rollback test');
 perform set_config('request.jwt.claim.sub',a::text,true);
 request:=public.begin_my_account_deletion();
 request2:=public.begin_my_account_deletion();
 assert request=request2,'Acceptance is idempotent';
 assert request->>'state'='pending';
 assert length(request->>'confirmation_key')=72;
 receipt:=request->>'confirmation_key';
 assert public.check_account_deletion(a,receipt)='pending';
 assert public.check_account_deletion(a,'wrong-key') is null;
 assert not exists(select 1 from public.list_retryable_account_deletions() id where id=a),'A prepare response alone must not authorize background deletion';
 perform public.advance_account_deletion(a,'confirmed');
 assert (select count(*)=1 from public.coin_wallet_entries where user_id=a),'Acceptance keeps the ledger';
 assert (select bool_and(status='closed') from public.coin_wallets where user_id=a);
 begin
  perform public.initialize_my_game_wallet('production');
  raise exception 'A deleting account created a new environment wallet';
 exception when sqlstate '55000' then null; end;
 begin
  insert into public.game_saves(user_id,save)values(a,'{}');
  raise exception 'A deleting account created a save';
 exception when sqlstate '55000' then null; end;
 begin
  update public.game_saves set save='{"stale":true}' where user_id=a;
  raise exception 'An in-flight save replaced deleting-account data';
 exception when sqlstate '55000' then null; end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 assert public.get_my_account_deletion() is null,'The second account cannot read the request';
 perform public.initialize_my_game_wallet('sandbox');
 begin
  perform public.advance_account_deletion(a,'complete');
  raise exception 'Completed without provider cleanup';
 exception when raise_exception then
  if sqlerrm='Completed without provider cleanup' then raise; end if;
 end;
 perform public.advance_account_deletion(a,'revenuecat_deleted');
 perform public.advance_account_deletion(a,'complete');
 assert not exists(select 1 from auth.users where id=a),'Auth account remains';
 assert not exists(select 1 from public.game_saves where user_id=a),'A save environment remains';
 assert exists(select 1 from auth.users where id=b),'Other account was removed';
 assert (select count(*)=1 from public.coin_wallet_entries where user_id=a),'Financial tombstone was lost';
 assert public.check_account_deletion(a,receipt)='completed','Status receipt must survive Auth deletion';
 perform public.advance_account_deletion(a,'complete');
end; $$;
select 'Account deletion isolation, write fencing, cleanup ordering, Auth removal and status receipts passed' as result;
rollback;
