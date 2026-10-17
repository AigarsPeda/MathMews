begin;
alter table public.coin_wallet_entries drop constraint coin_wallet_entries_kind_check;
alter table public.coin_wallet_entries add constraint coin_wallet_entries_kind_check check (kind in
 ('admin_adjustment','purchase_grant','purchase_refund','purchase_refund_reversed','legacy_import','puzzle_reward','store_spend'));
alter table public.coin_wallets add column game_initialized boolean not null default false;
create table wallet_private.store_catalog (kind text not null, item_id text not null, price integer not null check(price >= 0), primary key(kind,item_id));
create table wallet_private.puzzle_catalog (puzzle_id text primary key, first_reward integer not null, replay_reward integer not null);
create table wallet_private.puzzle_completions (user_id uuid not null, environment text not null, puzzle_id text not null, primary key(user_id,environment,puzzle_id));

alter table wallet_private.store_catalog enable row level security;
alter table wallet_private.puzzle_catalog enable row level security;
alter table wallet_private.puzzle_completions enable row level security;

-- Only historical sandbox balances are imported. An existing admin adjustment,
-- purchase, or refund takes precedence. Production never imports client money.
create function public.initialize_my_game_wallet(p_environment text default 'production')
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
     from public.game_saves where user_id=auth.uid();
   if v_legacy>0 then perform wallet_private.append_entry(auth.uid(),p_environment,v_legacy,'legacy_import',
    'legacy:'||auth.uid()||':'||p_environment,'{}','One-time sandbox cloud balance import','migration'); end if;
  end if;
  update public.coin_wallets set game_initialized=true where user_id=auth.uid() and environment=p_environment;
 end if;
 select * into v_wallet from public.coin_wallets where user_id=auth.uid() and environment=p_environment;
 return v_wallet;
end; $$;

-- Rewards are bounded client assertions, not proof that a puzzle was solved.
-- The server chooses the amount and first/replay status, deduplicates attempts,
-- and caps credits at 1000 per UTC day per account/environment.
create function public.claim_puzzle_coins(p_environment text,p_puzzle_id text,p_attempt_id text)
returns public.coin_wallets language plpgsql security definer set search_path = '' as $$
declare v_key text; v_payload jsonb; v_entry public.coin_wallet_entries; v_amount integer; v_total bigint; v_wallet public.coin_wallets;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_attempt_id is null or length(p_attempt_id) not between 1 and 200 then raise exception 'Invalid attempt'; end if;
 v_key:='reward:'||auth.uid()||':'||p_environment||':'||p_attempt_id;
 v_payload:=jsonb_build_object('puzzle_id',p_puzzle_id);
 perform pg_advisory_xact_lock(hashtextextended(v_key,0));
 select * into v_entry from public.coin_wallet_entries where request_key=v_key;
 if found then
  if v_entry.request_payload<>v_payload then raise exception 'Attempt already used'; end if;
 else
  perform wallet_private.ensure_wallet(auth.uid(),p_environment);
  select case when exists(select 1 from wallet_private.puzzle_completions where user_id=auth.uid() and environment=p_environment and puzzle_id=p_puzzle_id)
    then replay_reward else first_reward end into v_amount from wallet_private.puzzle_catalog where puzzle_id=p_puzzle_id;
  if not found then raise exception 'Unknown puzzle'; end if;
  select coalesce(sum(delta),0) into v_total from public.coin_wallet_entries where user_id=auth.uid() and environment=p_environment
   and kind='puzzle_reward' and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  v_amount:=least(v_amount,greatest(0,1000-v_total));
  perform wallet_private.append_entry(auth.uid(),p_environment,v_amount,'puzzle_reward',v_key,v_payload,'Puzzle reward','game');
  insert into wallet_private.puzzle_completions values(auth.uid(),p_environment,p_puzzle_id) on conflict do nothing;
 end if;
 select * into v_wallet from public.coin_wallets where user_id=auth.uid() and environment=p_environment;
 return v_wallet;
end; $$;

create function public.spend_game_coins(p_environment text,p_save_id uuid,p_kind text,p_item_id text,p_request_id uuid)
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
 if not exists(select 1 from public.game_saves where id=p_save_id and user_id=auth.uid()) then raise exception 'Save unavailable' using errcode='42501'; end if;
 select price into v_price from wallet_private.store_catalog where kind=p_kind and item_id=p_item_id;
 if not found then raise exception 'Item unavailable'; end if;
 perform wallet_private.ensure_wallet(auth.uid(),p_environment);
 -- Unique unlocks cannot be charged again from an old cloud snapshot.
 if p_kind in ('room','bed','skin') and exists(select 1 from public.coin_wallet_entries where user_id=auth.uid() and environment=p_environment
  and kind='store_spend' and request_payload @> v_payload) then raise exception 'Already owned' using errcode='23505'; end if;
 return wallet_private.append_entry(auth.uid(),p_environment,-v_price,'store_spend',v_key,v_payload,'Store purchase','game');
end; $$;

create function public.get_my_game_orders(p_environment text,p_save_id uuid)
returns setof public.coin_wallet_entries language sql security definer set search_path = '' as $$
 select e.* from public.coin_wallet_entries e join public.coin_wallets w using(user_id,environment)
 where e.user_id=auth.uid() and e.environment=p_environment and w.status='active' and e.kind='store_spend'
 and e.request_payload->>'save_id'=p_save_id::text order by e.created_at,e.id;
$$;

create function public.has_my_coin_purchase(p_environment text,p_transaction_id text)
returns boolean language sql security definer set search_path = '' as $$
 select exists(select 1 from public.coin_purchases p join public.coin_wallets w using(user_id,environment)
 where p.user_id=auth.uid() and p.environment=p_environment and p.transaction_id=p_transaction_id
 and p.purchase_seen and p.credited_coins>0 and w.status='active');
$$;

revoke all on all tables in schema wallet_private from public,anon,authenticated,service_role;
revoke all on function public.initialize_my_game_wallet(text), public.claim_puzzle_coins(text,text,text),
 public.spend_game_coins(text,uuid,text,text,uuid),public.get_my_game_orders(text,uuid),public.has_my_coin_purchase(text,text) from public,anon,authenticated,service_role;
grant execute on function public.initialize_my_game_wallet(text), public.claim_puzzle_coins(text,text,text),
 public.spend_game_coins(text,uuid,text,text,uuid),public.get_my_game_orders(text,uuid),public.has_my_coin_purchase(text,text) to authenticated;

commit;
