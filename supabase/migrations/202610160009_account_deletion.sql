begin;
-- A retryable deletion outbox in the existing project. Never expose provider
-- identifiers or service credentials through an app-readable table.
create table wallet_private.account_deletions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique,
 confirmation_key text not null default (gen_random_uuid()::text || gen_random_uuid()::text),
 apple_subject text,
 apple_revoked boolean not null,
 revenuecat_deleted boolean not null default false,
 client_confirmed boolean not null default false,
 state text not null default 'pending' check(state in ('pending','completed')),
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
alter table wallet_private.account_deletions enable row level security;
revoke all on wallet_private.account_deletions from public,anon,authenticated;

create function public.begin_my_account_deletion()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_apple text; v_job wallet_private.account_deletions;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- The same account lock precedes every save write and wallet mutation. An
 -- already-running writer finishes before this request closes both wallets.
 perform 1 from auth.users where id=v_user for update;
 if not found then raise exception 'Account unavailable' using errcode='42501'; end if;
 select provider_id into v_apple from auth.identities where user_id=v_user and provider='apple' limit 1;
 insert into wallet_private.account_deletions(user_id,apple_subject,apple_revoked)
 values(v_user,v_apple,v_apple is null) on conflict(user_id) do nothing;
 update public.coin_wallets set status='closed',updated_at=now() where user_id=v_user;
 select * into v_job from wallet_private.account_deletions where user_id=v_user;
 return jsonb_build_object('id',v_job.id,'state',v_job.state,'apple_required',not v_job.apple_revoked,'confirmation_key',v_job.confirmation_key);
end; $$;
revoke all on function public.begin_my_account_deletion() from public,anon;
grant execute on function public.begin_my_account_deletion() to authenticated;

create function public.get_my_account_deletion()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'state',state,'apple_required',not apple_revoked)
 from wallet_private.account_deletions where user_id=auth.uid();
$$;
revoke all on function public.get_my_account_deletion() from public,anon;
grant execute on function public.get_my_account_deletion() to authenticated;

-- The 244-bit receipt only reveals pending/completed, never account data, and
-- cannot initiate deletion. It works after Auth and its sessions are gone.
create function public.check_account_deletion(p_user_id uuid,p_confirmation_key text)
returns text language sql stable security definer set search_path='' as $$
 select state from wallet_private.account_deletions
 where user_id=p_user_id and confirmation_key=p_confirmation_key;
$$;
revoke all on function public.check_account_deletion(uuid,text) from public;
grant execute on function public.check_account_deletion(uuid,text) to anon,authenticated;

create function wallet_private.prevent_deleted_account_writes()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users where id=new.user_id for key share;
 if not found or exists(select 1 from wallet_private.account_deletions where user_id=new.user_id) then
  raise exception 'Account deletion requested' using errcode='55000';
 end if;
 return new;
end; $$;
create trigger reject_deleting_account_saves before insert or update on public.game_saves
 for each row execute function wallet_private.prevent_deleted_account_writes();
create trigger reject_deleting_account_wallets before insert on public.coin_wallets
 for each row execute function wallet_private.prevent_deleted_account_writes();

-- Only the Edge Function's service role can read the outbox and acknowledge
-- provider cleanup. The phone can never choose another account to delete.
create function public.get_account_deletion_job(p_user_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(d) from wallet_private.account_deletions d where user_id=p_user_id;
$$;
create function public.list_retryable_account_deletions()
returns setof uuid language sql stable security definer set search_path='' as $$
 select user_id from wallet_private.account_deletions
 where state='pending' and client_confirmed and apple_revoked order by created_at limit 5;
$$;
create function public.advance_account_deletion(p_user_id uuid,p_step text)
returns void language plpgsql security definer set search_path='' as $$
declare v_job wallet_private.account_deletions;
begin
 perform 1 from auth.users where id=p_user_id for update;
 select * into v_job from wallet_private.account_deletions where user_id=p_user_id for update;
 if not found then raise exception 'Deletion request unavailable'; end if;
 if v_job.state='completed' then return; end if;
 if p_step='confirmed' then
  update wallet_private.account_deletions set client_confirmed=true where user_id=p_user_id;
 elsif p_step='apple_revoked' then
  update wallet_private.account_deletions set apple_revoked=true,apple_subject=null where user_id=p_user_id;
 elsif p_step='revenuecat_deleted' then
  update wallet_private.account_deletions set revenuecat_deleted=true where user_id=p_user_id;
 elsif p_step='complete' and v_job.client_confirmed and v_job.apple_revoked and v_job.revenuecat_deleted then
  delete from public.game_saves where user_id=p_user_id;
  delete from auth.users where id=p_user_id;
  update wallet_private.account_deletions set state='completed',completed_at=now(),apple_subject=null where user_id=p_user_id;
 else raise exception 'Provider cleanup is incomplete'; end if;
end; $$;
revoke all on function public.get_account_deletion_job(uuid),public.list_retryable_account_deletions(),public.advance_account_deletion(uuid,text) from public,anon,authenticated;
grant execute on function public.get_account_deletion_job(uuid),public.list_retryable_account_deletions(),public.advance_account_deletion(uuid,text) to service_role;
commit;
