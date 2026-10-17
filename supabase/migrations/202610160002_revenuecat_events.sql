begin;

-- Service-only input. Call only after authenticating RevenueCat's webhook.
-- Event storage, purchase state and the wallet entry commit together.
create function public.record_revenuecat_event(p_event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id text := p_event ->> 'id';
  v_type text := p_event ->> 'type';
  v_app text := p_event ->> 'app_id';
  v_store text := p_event ->> 'store';
  v_environment text;
  v_user uuid;
  v_coins integer;
  v_purchase public.coin_purchases;
  v_existing public.revenuecat_events;
  v_time bigint;
  v_desired integer;
  v_delta integer;
  v_reason text;
  v_kind text;
begin
  if jsonb_typeof(p_event) is distinct from 'object' or v_id is null or length(v_id) not between 1 and 200
    or v_type is null then raise exception 'Invalid RevenueCat event' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rc-event:' || v_id, 0));
  select * into v_existing from public.revenuecat_events where event_id = v_id;
  if found then
    if v_existing.event <> p_event then
      raise exception 'Event ID was already used with a different payload' using errcode = '22023';
    end if;
    if v_existing.state in ('processed', 'ignored') then
      return jsonb_build_object('state', v_existing.state, 'duplicate', true);
    end if;
  else
    insert into public.revenuecat_events (event_id, event) values (v_id, p_event);
  end if;

  if v_type = 'TEST' or v_type not in ('NON_RENEWING_PURCHASE', 'CANCELLATION', 'REFUND_REVERSED', 'TRANSFER') then
    update public.revenuecat_events set state = 'ignored', reason = 'non_coin_event', processed_at = now() where event_id = v_id;
    return jsonb_build_object('state', 'ignored');
  end if;

  v_environment := case p_event ->> 'environment' when 'SANDBOX' then 'sandbox' when 'PRODUCTION' then 'production' end;
  if v_type = 'TRANSFER' then v_reason := 'ownership_transfer_requires_review';
  elsif v_environment is null then v_reason := 'invalid_environment';
  elsif not exists (select 1 from public.revenuecat_apps where app_id = v_app and store = v_store
    and active and v_environment = any(environments)) then v_reason := 'app_not_configured';
  elsif coalesce(p_event ->> 'transaction_id', '') = '' then v_reason := 'missing_transaction';
  elsif coalesce(p_event ->> 'app_user_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_reason := 'unmapped_customer';
  elsif jsonb_typeof(p_event -> 'event_timestamp_ms') is distinct from 'number'
    or (p_event ->> 'event_timestamp_ms') !~ '^[0-9]{1,16}$' then v_reason := 'invalid_timestamp';
  elsif v_type = 'CANCELLATION' and coalesce(p_event ->> 'cancel_reason', '') <> 'CUSTOMER_SUPPORT' then
    v_reason := 'unrecognized_cancellation';
  end if;

  if v_reason is null then
    v_user := (p_event ->> 'app_user_id')::uuid;
    perform 1 from auth.users where id = v_user for key share;
    if not found then v_reason := 'missing_or_deleted_account';
    elsif exists (select 1 from public.coin_wallets where user_id = v_user
      and environment = v_environment and status <> 'active') then v_reason := 'wallet_not_active'; end if;
  end if;

  if v_reason is null then
    select coins into v_coins from public.coin_pack_products where product_id = p_event ->> 'product_id' and active;
    if not found then v_reason := 'unknown_product'; end if;
  end if;

  if v_reason is null then
    perform pg_advisory_xact_lock(hashtextextended('rc-transaction:' ||
      jsonb_build_array(v_app, v_store, v_environment, p_event ->> 'transaction_id')::text, 0));
    select * into v_purchase from public.coin_purchases where app_id = v_app and store = v_store
      and environment = v_environment and transaction_id = p_event ->> 'transaction_id';
    if found and (v_purchase.user_id <> v_user or v_purchase.product_id <> p_event ->> 'product_id') then
      v_reason := 'transaction_owner_or_product_conflict';
    end if;
  end if;

  if v_reason is not null then
    update public.revenuecat_events set state = 'quarantined', reason = v_reason, processed_at = now() where event_id = v_id;
    return jsonb_build_object('state', 'quarantined', 'reason', v_reason);
  end if;

  perform wallet_private.ensure_wallet(v_user, v_environment);
  if v_purchase.transaction_id is null then
    insert into public.coin_purchases (app_id, store, environment, transaction_id, user_id, product_id, coins)
      values (v_app, v_store, v_environment, p_event ->> 'transaction_id', v_user, p_event ->> 'product_id', v_coins)
      returning * into v_purchase;
  end if;
  v_time := (p_event ->> 'event_timestamp_ms')::bigint;
  if v_type = 'NON_RENEWING_PURCHASE' then
    v_purchase.purchase_seen := true;
  elsif v_type = 'CANCELLATION' and v_time >= v_purchase.refund_state_at_ms then
    v_purchase.refunded := true;
    v_purchase.refund_state_at_ms := v_time;
  elsif v_type = 'REFUND_REVERSED' and v_time > v_purchase.refund_state_at_ms then
    v_purchase.refunded := false;
    v_purchase.refund_state_at_ms := v_time;
  end if;
  v_desired := case when v_purchase.purchase_seen and not v_purchase.refunded then v_purchase.coins else 0 end;
  v_delta := v_desired - v_purchase.credited_coins;
  if v_delta <> 0 then
    v_kind := case when v_delta < 0 then 'purchase_refund'
      when v_type = 'REFUND_REVERSED' then 'purchase_refund_reversed' else 'purchase_grant' end;
    perform wallet_private.append_entry(v_user, v_environment, v_delta, v_kind, 'revenuecat:' || v_id,
      p_event, 'RevenueCat ' || v_type, 'RevenueCat', true);
  end if;
  update public.coin_purchases set purchase_seen = v_purchase.purchase_seen, refunded = v_purchase.refunded,
    refund_state_at_ms = v_purchase.refund_state_at_ms, credited_coins = v_desired, updated_at = now()
    where app_id = v_app and store = v_store and environment = v_environment
      and transaction_id = v_purchase.transaction_id;
  update public.revenuecat_events set state = 'processed', reason = null, processed_at = now() where event_id = v_id;
  return jsonb_build_object('state', 'processed', 'credited_delta', v_delta);
end;
$$;

revoke all on function public.record_revenuecat_event(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.record_revenuecat_event(jsonb) to service_role;

commit;
