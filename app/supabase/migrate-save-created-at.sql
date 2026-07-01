-- Math Mews — add created_at to game_saves (when the save row was first created ≈ game start)
-- Run once if your table was created before created_at existed.

alter table public.game_saves add column if not exists created_at timestamptz;

update public.game_saves
set created_at = to_timestamp(client_updated_at / 1000.0)
where created_at is null
  and client_updated_at is not null
  and client_updated_at > 0;

update public.game_saves
set created_at = updated_at
where created_at is null;

alter table public.game_saves alter column created_at set default now();
alter table public.game_saves alter column created_at set not null;
