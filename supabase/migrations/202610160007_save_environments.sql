begin;
-- Existing saves came from development and remain sandbox. New clients write
-- the build environment explicitly; one hosted project serves both modes.
alter table public.game_saves add column environment text not null default 'sandbox'
 check(environment in ('sandbox','production'));
create index game_saves_environment_owner_idx on public.game_saves(user_id,environment,updated_at desc);
create or replace function public.spend_game_coins(p_environment text,p_save_id uuid,p_kind text,p_item_id text,p_request_id uuid)
returns public.coin_wallet_entries language plpgsql security definer set search_path = '' as $$
declare v_key text; v_payload jsonb; v_entry public.coin_wallet_entries; v_price integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'Request ID required'; end if;
 v_key:='spend:'||auth.uid()||':'||p_environment||':'||p_request_id;
 v_payload:=jsonb_build_object('save_id',p_save_id,'kind',p_kind,'item_id',p_item_id);
 perform pg_advisory_xact_lock(hashtextextended(v_key,0));
 select * into v_entry from public.coin_wallet_entries where request_key=v_key;
 if found then
  if v_entry.request_payload<>v_payload then raise exception 'Request ID already used'; end if;
  return v_entry;
 end if;
 if not exists(select 1 from public.game_saves where id=p_save_id and user_id=auth.uid() and environment=p_environment) then raise exception 'Save unavailable' using errcode='42501'; end if;
 select price into v_price from wallet_private.store_catalog where kind=p_kind and item_id=p_item_id;
 if not found then raise exception 'Item unavailable'; end if;
 perform wallet_private.ensure_wallet(auth.uid(),p_environment);
 -- Unique unlocks cannot be charged again from an old cloud snapshot.
 if p_kind in ('room','bed','skin') and exists(select 1 from public.coin_wallet_entries where user_id=auth.uid() and environment=p_environment
  and kind='store_spend' and request_payload @> v_payload) then raise exception 'Already owned' using errcode='23505'; end if;
 return wallet_private.append_entry(auth.uid(),p_environment,-v_price,'store_spend',v_key,v_payload,'Store purchase','game');
end; $$;

create or replace function public.initialize_my_game_wallet(p_environment text default 'production')
returns public.coin_wallets language plpgsql security definer set search_path = '' as $$
declare v_wallet public.coin_wallets; v_legacy bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform wallet_private.ensure_wallet(auth.uid(),p_environment);
 select * into v_wallet from public.coin_wallets where user_id=auth.uid() and environment=p_environment;
 if not v_wallet.game_initialized then
  if p_environment='sandbox' and v_wallet.revision=0 then
   select least(10000, greatest(0,coalesce(max(case when (save->'wallet'->>'coins') ~ '^[0-9]{1,9}$'
     then (save->'wallet'->>'coins')::bigint else 0 end),0))) into v_legacy
     from public.game_saves where user_id=auth.uid() and environment='sandbox';
   if v_legacy>0 then perform wallet_private.append_entry(auth.uid(),p_environment,v_legacy,'legacy_import',
    'legacy:'||auth.uid()||':'||p_environment,'{}','One-time sandbox cloud balance import','migration'); end if;
  end if;
  if v_wallet.revision=0 and coalesce(v_legacy,0)=0 then
   perform wallet_private.append_entry(auth.uid(),p_environment,42,'starter_grant',
    'starter:'||auth.uid()||':'||p_environment,'{}','Welcome coins','game');
  end if;
  update public.coin_wallets set game_initialized=true where user_id=auth.uid() and environment=p_environment;
 end if;
 select * into v_wallet from public.coin_wallets where user_id=auth.uid() and environment=p_environment;
 return v_wallet;
end; $$;



commit;
