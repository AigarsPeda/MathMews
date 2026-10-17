-- Hosted Supabase regression. All fixtures, prices and ledger entries roll back.
begin;
set local plpgsql.check_asserts=on;
insert into wallet_private.store_catalog(kind,item_id,price,sale_price,sale_starts_at,sale_ends_at)
 values('toy','catalog-test',100,40,now()-interval '1 hour',now()+interval '1 hour');
do $$ begin
 assert (select effective_price=40 from wallet_private.current_store_catalog where item_id='catalog-test'),'Active sale not applied';
 update wallet_private.store_catalog set sale_starts_at=now()+interval '1 minute' where item_id='catalog-test';
 assert (select effective_price=100 from wallet_private.current_store_catalog where item_id='catalog-test'),'Future sale started early';
 update wallet_private.store_catalog set sale_starts_at=now()-interval '1 hour',sale_ends_at=now() where item_id='catalog-test';
 assert (select effective_price=100 from wallet_private.current_store_catalog where item_id='catalog-test'),'Expired sale remained active';
 update wallet_private.store_catalog set sale_ends_at=now()+interval '1 hour' where item_id='catalog-test';
 begin
  update wallet_private.store_catalog set sale_price=101 where item_id='catalog-test';
  raise exception 'Invalid discount accepted';
 exception when check_violation then null; end;
 assert has_function_privilege('anon','public.get_store_catalog()','EXECUTE'),'Guest cannot read prices';
 assert not has_table_privilege('anon','wallet_private.store_catalog','UPDATE'),'Guest can edit prices';
 assert not has_table_privilege('authenticated','wallet_private.store_catalog','UPDATE'),'Player can edit prices';
end $$;
set local role anon;
do $$ begin
 assert (select (item->>'price')::int=40 from jsonb_array_elements(public.get_store_catalog()->'items') item where item->>'item_id'='catalog-test'),'Public catalog differs from checkout';
end $$;
reset role;
select set_config('catalog_test.user',gen_random_uuid()::text,true);
select set_config('catalog_test.save',gen_random_uuid()::text,true);
select set_config('catalog_test.request',gen_random_uuid()::text,true);
insert into auth.users(id,is_anonymous,aud,role) values(current_setting('catalog_test.user')::uuid,true,'authenticated','authenticated');
insert into public.game_saves(id,user_id,save,environment) values(current_setting('catalog_test.save')::uuid,current_setting('catalog_test.user')::uuid,'{}','sandbox');
select public.admin_set_coin_balance(current_setting('catalog_test.user')::uuid,500,'Rollback catalog test',gen_random_uuid());
select set_config('request.jwt.claim.sub',current_setting('catalog_test.user'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('catalog_test.user'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare e public.coin_wallet_entries; w public.coin_wallets; begin
 begin
  perform public.spend_game_coins('sandbox',current_setting('catalog_test.save')::uuid,'toy','catalog-test',gen_random_uuid(),100);
  raise exception 'Stale price charged';
 exception when raise_exception then assert sqlerrm='Store price changed','Wrong stale-price rejection'; end;
 w:=public.get_my_coin_wallet('sandbox'); assert w.balance=500,'Rejected price changed balance';
 e:=public.spend_game_coins('sandbox',current_setting('catalog_test.save')::uuid,'toy','catalog-test',current_setting('catalog_test.request')::uuid,40);
 assert e.delta=-40 and e.balance_after=460,'Sale price not charged';
end $$;
reset role;
update wallet_private.store_catalog set sale_price=null,price=200 where item_id='catalog-test';
set local role authenticated;
do $$ declare e public.coin_wallet_entries; begin
 e:=public.spend_game_coins('sandbox',current_setting('catalog_test.save')::uuid,'toy','catalog-test',current_setting('catalog_test.request')::uuid,40);
 assert e.delta=-40 and e.balance_after=460,'Promotion change broke receipt replay';
 e:=public.spend_game_coins('sandbox',current_setting('catalog_test.save')::uuid,'toy','catalog-test',gen_random_uuid());
 assert e.delta=-200 and e.balance_after=260,'Legacy endpoint ignored server price';
end $$;
reset role;
update wallet_private.store_catalog set sale_price=0 where item_id='catalog-test';
set local role authenticated;
do $$ declare e public.coin_wallet_entries; begin
 e:=public.spend_game_coins('sandbox',current_setting('catalog_test.save')::uuid,'toy','catalog-test',gen_random_uuid(),0);
 assert e.delta=0 and e.balance_after=260,'Free promotion failed';
end $$;
reset role;
rollback;
