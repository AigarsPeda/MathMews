-- Additive backend foundation. Existing game_saves are deliberately untouched.
begin;

create schema if not exists wallet_private;
revoke all on schema wallet_private from public, anon, authenticated, service_role;

-- Keep closed wallets as transaction tombstones when an auth account is removed.
-- No auth FK: deleting authentication must not erase purchase uniqueness.
create table public.coin_wallets (
  user_id uuid not null,
  environment text not null check (environment in ('sandbox', 'production')),
  balance bigint not null default 0 check (balance between -2147483647 and 2147483647),
  status text not null default 'active' check (status in ('active', 'blocked', 'closed')),
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, environment)
);

create table public.coin_wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  environment text not null,
  kind text not null check (kind in ('admin_adjustment', 'purchase_grant', 'purchase_refund', 'purchase_refund_reversed')),
  delta bigint not null,
  balance_before bigint not null,
  balance_after bigint not null check (balance_after = balance_before + delta),
  request_key text not null unique,
  request_payload jsonb not null,
  reason text not null,
  actor text not null,
  database_role text not null,
  created_at timestamptz not null default now(),
  foreign key (user_id, environment) references public.coin_wallets (user_id, environment)
);
create index coin_wallet_entries_owner_idx on public.coin_wallet_entries (user_id, environment, created_at desc);

create table public.coin_pack_products (
  product_id text primary key,
  coins integer not null check (coins > 0),
  active boolean not null default true
);
insert into public.coin_pack_products (product_id, coins) values
  ('mathmews_coins_100', 100), ('mathmews_coins_500', 500), ('mathmews_coins_1200', 1200);

-- Explicitly register each RevenueCat app before any event can grant coins.
create table public.revenuecat_apps (
  app_id text primary key check (length(app_id) between 1 and 200),
  store text not null check (store in ('APP_STORE', 'PLAY_STORE', 'TEST_STORE')),
  environments text[] not null default array['sandbox']::text[]
    check (cardinality(environments) > 0 and environments <@ array['sandbox', 'production']::text[]),
  active boolean not null default true,
  check (store <> 'TEST_STORE' or environments = array['sandbox']::text[])
);

create table public.revenuecat_events (
  event_id text primary key,
  event jsonb not null,
  state text not null default 'pending' check (state in ('pending', 'processed', 'quarantined', 'ignored')),
  reason text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index revenuecat_events_unresolved_idx on public.revenuecat_events (received_at)
  where state in ('pending', 'quarantined');

create table public.coin_purchases (
  app_id text not null,
  store text not null,
  environment text not null check (environment in ('sandbox', 'production')),
  transaction_id text not null,
  user_id uuid not null,
  product_id text not null,
  coins integer not null check (coins > 0),
  purchase_seen boolean not null default false,
  refunded boolean not null default false,
  refund_state_at_ms bigint not null default -1,
  credited_coins integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_id, store, environment, transaction_id),
  foreign key (user_id, environment) references public.coin_wallets (user_id, environment),
  check (credited_coins in (0, coins))
);

create function wallet_private.ensure_wallet(p_user_id uuid, p_environment text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null or p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'Invalid wallet identity or environment' using errcode = '22023';
  end if;
  -- Serialize against auth deletion before obtaining a wallet lock.
  perform 1 from auth.users where id = p_user_id for key share;
  if not found then
    raise exception 'Account does not exist' using errcode = '22023';
  end if;
  insert into public.coin_wallets (user_id, environment) values (p_user_id, p_environment)
    on conflict do nothing;
  perform 1 from public.coin_wallets where user_id = p_user_id and environment = p_environment
    and status = 'active' for update;
  if not found then
    raise exception 'Wallet is blocked or closed' using errcode = '55000';
  end if;
end;
$$;

create function wallet_private.append_entry(
  p_user_id uuid, p_environment text, p_delta bigint, p_kind text,
  p_request_key text, p_request_payload jsonb, p_reason text, p_actor text,
  p_allow_debt boolean default false
)
returns public.coin_wallet_entries language plpgsql security definer set search_path = '' as $$
declare
  v_before bigint;
  v_entry public.coin_wallet_entries;
begin
  perform wallet_private.ensure_wallet(p_user_id, p_environment);
  select balance into v_before from public.coin_wallets
    where user_id = p_user_id and environment = p_environment;
  if not p_allow_debt and v_before + p_delta < 0 then
    raise exception 'Insufficient coins' using errcode = '22003';
  end if;
  update public.coin_wallets set balance = balance + p_delta, revision = revision + 1, updated_at = now()
    where user_id = p_user_id and environment = p_environment;
  insert into public.coin_wallet_entries
    (user_id, environment, kind, delta, balance_before, balance_after, request_key, request_payload, reason, actor, database_role)
    values (p_user_id, p_environment, p_kind, p_delta, v_before, v_before + p_delta,
      p_request_key, p_request_payload, p_reason, p_actor,
      coalesce(nullif(current_setting('role', true), 'none'), session_user)) returning * into v_entry;
  return v_entry;
end;
$$;

create function wallet_private.admin_change(
  p_user_id uuid, p_environment text, p_operation text, p_amount bigint,
  p_reason text, p_request_id uuid, p_operator text
)
returns public.coin_wallet_entries language plpgsql security definer set search_path = '' as $$
declare
  v_request jsonb;
  v_entry public.coin_wallet_entries;
  v_delta bigint;
  v_key text := 'admin:' || p_request_id::text;
begin
  if p_request_id is null or p_amount is null or p_operation not in ('adjust', 'set')
    or p_reason is null or length(btrim(p_reason)) not between 1 and 500
    or p_operator is null or length(btrim(p_operator)) not between 1 and 200
    or (p_operation = 'set' and p_amount < 0) then
    raise exception 'Request ID, valid amount, reason and operator are required' using errcode = '22023';
  end if;
  v_request := jsonb_build_object('user_id', p_user_id, 'environment', p_environment,
    'operation', p_operation, 'amount', p_amount, 'reason', p_reason, 'operator', p_operator);
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  select * into v_entry from public.coin_wallet_entries where request_key = v_key;
  if found then
    if v_entry.request_payload <> v_request then
      raise exception 'Request ID was already used with different arguments' using errcode = '22023';
    end if;
    return v_entry;
  end if;
  perform wallet_private.ensure_wallet(p_user_id, p_environment);
  select case when p_operation = 'set' then p_amount - balance else p_amount end into v_delta
    from public.coin_wallets where user_id = p_user_id and environment = p_environment;
  return wallet_private.append_entry(p_user_id, p_environment, v_delta, 'admin_adjustment',
    v_key, v_request, p_reason, p_operator);
end;
$$;

-- These two functions are SQL-editor/admin only, never mobile RPCs.
create function public.admin_adjust_coins(
  p_user_id uuid, p_amount bigint, p_reason text, p_request_id uuid,
  p_environment text default 'sandbox', p_operator text default 'SQL editor'
)
returns public.coin_wallet_entries language sql security definer set search_path = '' as $$
  select wallet_private.admin_change(p_user_id, p_environment, 'adjust', p_amount, p_reason, p_request_id, p_operator);
$$;

create function public.admin_set_coin_balance(
  p_user_id uuid, p_balance bigint, p_reason text, p_request_id uuid,
  p_environment text default 'sandbox', p_operator text default 'SQL editor'
)
returns public.coin_wallet_entries language sql security definer set search_path = '' as $$
  select wallet_private.admin_change(p_user_id, p_environment, 'set', p_balance, p_reason, p_request_id, p_operator);
$$;

create function public.get_my_coin_wallet(p_environment text default 'production')
returns public.coin_wallets language plpgsql security definer set search_path = '' as $$
declare v_wallet public.coin_wallets;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform wallet_private.ensure_wallet(auth.uid(), p_environment);
  select * into v_wallet from public.coin_wallets where user_id = auth.uid() and environment = p_environment;
  return v_wallet;
end;
$$;

create function wallet_private.close_deleted_account_wallets()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.coin_wallets set status = 'closed', updated_at = now() where user_id = old.id;
  return old;
end;
$$;
create trigger close_coin_wallets_on_auth_deletion before delete on auth.users
  for each row execute function wallet_private.close_deleted_account_wallets();

create function wallet_private.reject_ledger_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Wallet ledger entries are immutable; use a compensating adjustment' using errcode = '55000'; end;
$$;
create trigger immutable_coin_wallet_entries before update or delete on public.coin_wallet_entries
  for each row execute function wallet_private.reject_ledger_mutation();

alter table public.coin_wallets enable row level security;
alter table public.coin_wallet_entries enable row level security;
alter table public.coin_pack_products enable row level security;
alter table public.revenuecat_apps enable row level security;
alter table public.revenuecat_events enable row level security;
alter table public.coin_purchases enable row level security;
create policy "Read own active wallet" on public.coin_wallets for select to authenticated
  using (user_id = (select auth.uid()) and status <> 'closed');
create policy "Read own wallet entries" on public.coin_wallet_entries for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.coin_wallets w where w.user_id = coin_wallet_entries.user_id
      and w.environment = coin_wallet_entries.environment and w.status <> 'closed'));

revoke all on public.coin_wallets, public.coin_wallet_entries, public.coin_pack_products,
  public.revenuecat_apps, public.revenuecat_events, public.coin_purchases from public, anon, authenticated, service_role;
grant select on public.coin_wallets, public.coin_wallet_entries to authenticated;
revoke all on all functions in schema wallet_private from public, anon, authenticated, service_role;
revoke all on function public.admin_adjust_coins(uuid, bigint, text, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_coin_balance(uuid, bigint, text, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.get_my_coin_wallet(text) from public, anon, authenticated, service_role;
grant execute on function public.get_my_coin_wallet(text) to authenticated;

commit;
