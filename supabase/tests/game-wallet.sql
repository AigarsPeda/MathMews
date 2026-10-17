-- Hosted Supabase only; every fixture and transaction is rolled back.
begin;
set local plpgsql.check_asserts=on;
select set_config('wallet_test.a',gen_random_uuid()::text,true);
select set_config('wallet_test.b',gen_random_uuid()::text,true);
select set_config('wallet_test.save',gen_random_uuid()::text,true);
insert into auth.users(id,is_anonymous,aud,role) values
(current_setting('wallet_test.a')::uuid,true,'authenticated','authenticated'),
(current_setting('wallet_test.b')::uuid,true,'authenticated','authenticated');
insert into public.game_saves(id,user_id,save) values
(current_setting('wallet_test.save')::uuid,current_setting('wallet_test.a')::uuid,'{"wallet":{"coins":350}}'),
(gen_random_uuid(),current_setting('wallet_test.b')::uuid,'{"wallet":{"coins":50000}}');
select public.admin_set_coin_balance(current_setting('wallet_test.a')::uuid,500,'Preserve admin balance',gen_random_uuid());
select set_config('request.jwt.claim.sub',current_setting('wallet_test.a'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('wallet_test.a'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare w public.coin_wallets; e public.coin_wallet_entries; retry public.coin_wallet_entries; r uuid:=gen_random_uuid(); puzzle text;
begin
 w:=public.initialize_my_game_wallet('sandbox');
 assert w.balance=500,'Bootstrap overwrote admin target';
 w:=public.initialize_my_game_wallet('production');
 assert w.balance=42,'Welcome reward missing';
 w:=public.initialize_my_game_wallet('production');
 assert w.balance=42,'Welcome reward duplicated';
 begin
  perform public.spend_game_coins('production',current_setting('wallet_test.save')::uuid,'room','room2',gen_random_uuid());
  raise exception 'Sandbox save spent production coins';
 exception when insufficient_privilege then null; end;
 e:=public.spend_game_coins('sandbox',current_setting('wallet_test.save')::uuid,'room','room2',r);
 assert e.delta=-12 and e.balance_after=488,'Server catalog price not used';
 retry:=public.spend_game_coins('sandbox',current_setting('wallet_test.save')::uuid,'room','room2',r);
 assert retry.id=e.id,'Spend retry charged twice';
 begin
  perform public.spend_game_coins('sandbox',current_setting('wallet_test.save')::uuid,'room','room3',r);
  raise exception 'Changed spend payload accepted';
 exception when raise_exception then assert sqlerrm='Request ID already used','Wrong replay rejection'; end;
 begin
  perform public.spend_game_coins('sandbox',current_setting('wallet_test.save')::uuid,'room','room2',gen_random_uuid());
  raise exception 'Unique item charged twice';
 exception when unique_violation then null; end;
 begin
  perform public.spend_game_coins('sandbox',gen_random_uuid(),'room','room3',gen_random_uuid());
  raise exception 'Foreign save accepted';
 exception when insufficient_privilege then null; end;
 assert (select count(*)=1 from public.get_my_game_orders('sandbox',current_setting('wallet_test.save')::uuid)),'Receipt recovery failed';
 assert jsonb_array_length(public.get_my_game_delivery('sandbox',current_setting('wallet_test.save')::uuid)->'orders')=1,'Delivery snapshot missing receipts';
 w:=public.get_my_coin_wallet('sandbox'); assert w.balance=488,'Ledger spend missing';
 begin
  perform public.claim_puzzle_coins('sandbox','fake-puzzle','unknown'); raise exception 'Unknown puzzle granted';
 exception when raise_exception then assert sqlerrm='Unknown puzzle','Wrong puzzle rejection'; end;
end; $$;
reset role;
-- Use an actual catalog puzzle and check server-selected first/replay amounts.
do $$
declare p record; w public.coin_wallets; first_balance bigint;
begin
 select * into p from wallet_private.puzzle_catalog order by puzzle_id limit 1;
 w:=public.claim_puzzle_coins('sandbox',p.puzzle_id,'attempt-1');
 first_balance:=488+p.first_reward;
 assert w.balance=first_balance,'First reward wrong';
 w:=public.claim_puzzle_coins('sandbox',p.puzzle_id,'attempt-1'); assert w.balance=first_balance,'Reward replay duplicated';
 w:=public.claim_puzzle_coins('sandbox',p.puzzle_id,'attempt-2'); assert w.balance=first_balance+p.replay_reward,'Replay reward wrong';
 perform wallet_private.append_entry(auth.uid(),'sandbox',999-p.first_reward-p.replay_reward,'puzzle_reward','cap-fixture','{}','Rollback cap fixture','test');
 w:=public.claim_puzzle_coins('sandbox',p.puzzle_id,'attempt-3'); assert w.balance=1488,'Daily cap did not clip';
 w:=public.claim_puzzle_coins('sandbox',p.puzzle_id,'attempt-4'); assert w.balance=1488,'Daily cap exceeded';
 assert w.balance=(select sum(delta) from public.coin_wallet_entries where user_id=auth.uid() and environment='sandbox'),'Ledger diverged';
end; $$;
-- The second account cannot read the first account's receipts or purchase status.
select set_config('request.jwt.claim.sub',current_setting('wallet_test.b'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('wallet_test.b'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 assert not exists(select 1 from public.get_my_game_orders('sandbox',current_setting('wallet_test.save')::uuid)),'Foreign receipt exposed';
 assert not public.has_my_coin_purchase('sandbox','anything'),'Foreign purchase exposed';
 assert (public.initialize_my_game_wallet('sandbox')).balance=10000,'Legacy sandbox import was not capped';
 assert (public.initialize_my_game_wallet('sandbox')).balance=10000,'Legacy import duplicated';
 assert (public.initialize_my_game_wallet('production')).balance=42,'Test credits leaked into production';
end; $$;
reset role;
rollback;
select 'Game wallet checks passed; all changes rolled back.' as result;
