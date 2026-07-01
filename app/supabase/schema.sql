-- Math Mews — Supabase schema (game_saves only)
-- Multiple saves per user — each game has its own row (id), never overwritten by a new game.
--
-- Wallet + IAP history live inside save JSON:
--   save.wallet.coins
--   save.coinTransactions[] (transactionId prevents double-credit)
--
-- If you previously created iap_grants, drop it first:
--   drop table if exists public.iap_grants;
--
-- If you have the old single-save schema (user_id as primary key), run:
--   app/supabase/migrate-multi-save.sql

create table public.game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  save jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  client_updated_at bigint
);

create index game_saves_user_id_idx on public.game_saves (user_id);

alter table public.game_saves enable row level security;

create policy "read own saves"
  on public.game_saves for select
  using (auth.uid() = user_id);

create policy "insert own saves"
  on public.game_saves for insert
  with check (auth.uid() = user_id);

create policy "update own saves"
  on public.game_saves for update
  using (auth.uid() = user_id);

create policy "delete own saves"
  on public.game_saves for delete
  using (auth.uid() = user_id);
