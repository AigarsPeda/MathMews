-- BrainPet — Supabase schema (game_saves only)
-- Run in Supabase Dashboard → SQL Editor (or via CLI migrations).
--
-- Wallet + IAP history live inside save JSON:
--   save.wallet.coins
--   save.coinTransactions[] (transactionId prevents double-credit)
--
-- If you previously created iap_grants, drop it first:
--   drop table if exists public.iap_grants;

-- Game progress (required)
create table public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save jsonb not null,
  updated_at timestamptz not null default now(),
  client_updated_at bigint
);

alter table public.game_saves enable row level security;

create policy "read own save"
  on public.game_saves for select
  using (auth.uid() = user_id);

create policy "insert own save"
  on public.game_saves for insert
  with check (auth.uid() = user_id);

create policy "update own save"
  on public.game_saves for update
  using (auth.uid() = user_id);

create policy "delete own save"
  on public.game_saves for delete
  using (auth.uid() = user_id);
