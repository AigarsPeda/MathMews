-- Math Mews — migrate game_saves from one row per user to many rows per user
-- Run once in Supabase SQL Editor if your table still uses user_id as primary key.

alter table public.game_saves add column if not exists id uuid;

update public.game_saves
set id = gen_random_uuid()
where id is null;

alter table public.game_saves alter column id set not null;
alter table public.game_saves alter column id set default gen_random_uuid();

alter table public.game_saves drop constraint if exists game_saves_pkey;
alter table public.game_saves add primary key (id);

create index if not exists game_saves_user_id_idx on public.game_saves (user_id);
