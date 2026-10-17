-- Run in the EXISTING Supabase project's SQL editor after both migrations.
-- All fixtures and operations roll back. No other database or container is used.
begin;
set local plpgsql.check_asserts = on;
select set_config('mathmews.test_a', gen_random_uuid()::text, true);
select set_config('mathmews.test_b', gen_random_uuid()::text, true);
select set_config('mathmews.test_app', 'wallet-test-' || gen_random_uuid()::text, true);

insert into auth.users (id, is_anonymous, aud, role) values
  (current_setting('mathmews.test_a')::uuid, true, 'authenticated', 'authenticated'),
  (current_setting('mathmews.test_b')::uuid, true, 'authenticated', 'authenticated');
insert into public.revenuecat_apps (app_id, store, environments)
  values (current_setting('mathmews.test_app'), 'APP_STORE', array['sandbox', 'production']);

do $$
declare
  a uuid := current_setting('mathmews.test_a')::uuid;
  b uuid := current_setting('mathmews.test_b')::uuid;
  request_id uuid := gen_random_uuid();
  target_request uuid := gen_random_uuid();
  original_entry public.coin_wallet_entries;
  retry_entry public.coin_wallet_entries;
  purchase jsonb;
  refund jsonb;
  reversal jsonb;
  result jsonb;
  current_balance bigint;
  caller text;
  t text;
begin
  original_entry := public.admin_adjust_coins(a, 1000, 'Regression credit', request_id, 'sandbox', 'rollback test');
  perform public.admin_adjust_coins(b, 500, 'Other account', gen_random_uuid());
  perform public.admin_adjust_coins(a, 25, 'Environment isolation', gen_random_uuid(), 'production');
  retry_entry := public.admin_adjust_coins(a, 1000, 'Regression credit', request_id, 'sandbox', 'rollback test');
  assert retry_entry.id = original_entry.id, 'Adjustment retry must return the original entry';
  assert (select balance = 1000 from public.coin_wallets where user_id=a and environment='sandbox'), 'Top-up or retry failed';
  assert (select balance = 500 from public.coin_wallets where user_id=b and environment='sandbox'), 'Other account not adjusted';
  assert (select balance = 25 from public.coin_wallets where user_id=a and environment='production'), 'Environments not isolated';
  assert original_entry.kind = 'admin_adjustment' and original_entry.actor = 'rollback test', 'Missing audit information';

  begin
    perform public.admin_adjust_coins(a, 1001, 'Regression credit', request_id, 'sandbox', 'rollback test');
    raise exception 'Changed adjustment request unexpectedly accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.admin_adjust_coins(b, 1000, 'Regression credit', request_id, 'sandbox', 'rollback test');
    raise exception 'Request ID reused for another account';
  exception when sqlstate '22023' then null; end;

  perform public.admin_set_coin_balance(a, 500, 'Target balance', target_request);
  perform public.admin_adjust_coins(a, 100, 'Later credit', gen_random_uuid());
  perform public.admin_set_coin_balance(a, 500, 'Target balance', target_request);
  assert (select balance = 600 from public.coin_wallets where user_id=a and environment='sandbox'), 'Target retry erased later credits';
  begin
    perform public.admin_adjust_coins(a, -601, 'Overdraft', gen_random_uuid());
    raise exception 'Admin overdraft accepted';
  exception when sqlstate '22003' then null; end;
  begin
    perform public.admin_adjust_coins(gen_random_uuid(), 1, 'Missing account', gen_random_uuid());
    raise exception 'Missing account accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.admin_set_coin_balance(a, -1, 'Negative target', gen_random_uuid());
    raise exception 'Negative target accepted';
  exception when sqlstate '22023' then null; end;
  begin
    update public.coin_wallet_entries set reason='tampered' where id=original_entry.id;
    raise exception 'Ledger update accepted';
  exception when sqlstate '55000' then null; end;
  begin
    delete from public.coin_wallet_entries where id=original_entry.id;
    raise exception 'Ledger deletion accepted';
  exception when sqlstate '55000' then null; end;

  foreach caller in array array['anon', 'authenticated', 'service_role'] loop
    assert not has_function_privilege(caller, 'public.admin_adjust_coins(uuid,bigint,text,uuid,text,text)', 'execute'), 'Admin RPC exposed';
    assert not has_function_privilege(caller, 'public.admin_set_coin_balance(uuid,bigint,text,uuid,text,text)', 'execute'), 'Set balance RPC exposed';
    foreach t in array array['coin_wallets','coin_wallet_entries','coin_purchases','revenuecat_events','coin_pack_products','revenuecat_apps'] loop
      assert not has_table_privilege(caller, 'public.' || t, 'insert,update,delete'), 'Direct table mutation exposed';
    end loop;
  end loop;
  assert not has_function_privilege('authenticated', 'public.record_revenuecat_event(jsonb)', 'execute'), 'App can impersonate webhook';
  assert not has_function_privilege('anon', 'public.get_my_coin_wallet(text)', 'execute'), 'Unauthenticated wallet RPC exposed';
  assert has_function_privilege('service_role', 'public.record_revenuecat_event(jsonb)', 'execute'), 'Webhook cannot process events';

  purchase := jsonb_build_object('id', gen_random_uuid()::text, 'type', 'NON_RENEWING_PURCHASE',
    'app_id', current_setting('mathmews.test_app'), 'store', 'APP_STORE', 'environment', 'SANDBOX',
    'app_user_id', a::text, 'transaction_id', gen_random_uuid()::text,
    'product_id', 'mathmews_coins_100', 'event_timestamp_ms', 1000);
  result := public.record_revenuecat_event(purchase);
  assert result->>'state' = 'processed' and (result->>'credited_delta')::integer = 100, 'Purchase not delivered';
  assert public.record_revenuecat_event(purchase)->>'duplicate' = 'true', 'Event retry not deduplicated';
  result := public.record_revenuecat_event(purchase || jsonb_build_object('id', gen_random_uuid()::text));
  assert (result->>'credited_delta')::integer = 0, 'Transaction credited twice';
  result := public.record_revenuecat_event(purchase || jsonb_build_object('id', gen_random_uuid()::text, 'app_user_id', b::text));
  assert result->>'reason' = 'transaction_owner_or_product_conflict', 'Purchase transferred without authorization';
  result := public.record_revenuecat_event(purchase || jsonb_build_object('id', gen_random_uuid()::text, 'app_user_id', '$RCAnonymousID:old'));
  assert result->>'state' = 'quarantined', 'Unmapped identity granted';
  result := public.record_revenuecat_event(purchase || jsonb_build_object('id', gen_random_uuid()::text, 'product_id', 'unknown-product'));
  assert result->>'state' = 'quarantined', 'Unknown product granted';
  result := public.record_revenuecat_event(purchase || jsonb_build_object('id', gen_random_uuid()::text, 'app_id', 'unknown-app'));
  assert result->>'state' = 'quarantined', 'Unknown app granted';
  begin
    perform public.record_revenuecat_event(purchase || jsonb_build_object('product_id', 'mathmews_coins_500'));
    raise exception 'Event ID accepted a different payload';
  exception when sqlstate '22023' then null; end;

  perform public.admin_set_coin_balance(a, 0, 'Simulated spend', gen_random_uuid());
  refund := purchase || jsonb_build_object('id', gen_random_uuid()::text, 'type', 'CANCELLATION',
    'cancel_reason', 'CUSTOMER_SUPPORT', 'event_timestamp_ms', 2000);
  result := public.record_revenuecat_event(refund);
  assert (result->>'credited_delta')::integer = -100, 'Refund not debited';
  perform public.record_revenuecat_event(refund || jsonb_build_object('id', gen_random_uuid()::text));
  assert (select balance = -100 from public.coin_wallets where user_id=a and environment='sandbox'), 'Refund duplicated or debt lost';
  reversal := purchase || jsonb_build_object('id', gen_random_uuid()::text, 'type', 'REFUND_REVERSED', 'event_timestamp_ms', 3000);
  perform public.record_revenuecat_event(reversal);
  perform public.record_revenuecat_event(refund || jsonb_build_object('id', gen_random_uuid()::text));
  assert (select balance = 0 from public.coin_wallets where user_id=a and environment='sandbox'), 'Older refund overrode reversal';

  purchase := purchase || jsonb_build_object('id', gen_random_uuid()::text, 'transaction_id', gen_random_uuid()::text);
  perform public.record_revenuecat_event(purchase || jsonb_build_object('id', gen_random_uuid()::text,
    'type', 'CANCELLATION', 'cancel_reason', 'CUSTOMER_SUPPORT', 'event_timestamp_ms', 4000));
  perform public.record_revenuecat_event(purchase);
  assert (select balance = 0 from public.coin_wallets where user_id=a and environment='sandbox'), 'Refund before purchase allowed a stale grant';

  select balance into current_balance from public.coin_wallets where user_id=a and environment='sandbox';
  assert current_balance = (select sum(delta) from public.coin_wallet_entries where user_id=a and environment='sandbox'), 'Ledger and balance diverged';
end;
$$;

-- Exercise actual owner filtering with Supabase's authenticated role and auth.uid().
select set_config('request.jwt.claim.sub', current_setting('mathmews.test_a'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('mathmews.test_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  assert (select count(*) = 2 from public.coin_wallets), 'RLS exposed another account or hid own environments';
  assert not exists (select 1 from public.coin_wallet_entries where user_id <> auth.uid()), 'RLS exposed another ledger';
  perform public.get_my_coin_wallet('sandbox');
  begin
    perform public.admin_adjust_coins(auth.uid(), 1, 'Unauthorized', gen_random_uuid());
    raise exception 'App role executed an admin grant';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

do $$
declare a uuid := current_setting('mathmews.test_a')::uuid;
begin
  delete from auth.users where id=a;
  assert (select bool_and(status='closed') from public.coin_wallets where user_id=a), 'Auth deletion did not close wallets';
  assert (select count(*) > 0 from public.coin_purchases where user_id=a), 'Deletion erased transaction uniqueness';
  begin
    perform public.admin_adjust_coins(a, 1, 'Deleted account', gen_random_uuid());
    raise exception 'Deleted account received a grant';
  exception when sqlstate '22023' then null; end;
end;
$$;

rollback;
select 'Wallet regression checks passed; all test accounts and changes rolled back.' as result;
