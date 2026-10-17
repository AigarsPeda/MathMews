begin;
-- One durable queue in the existing project. Cursors survive timeouts, rate
-- limits and restarts; no subscriber list or balance supplied by a phone is trusted.
create table wallet_private.purchase_reconciliation (
 user_id uuid not null references auth.users(id) on delete cascade,
 environment text not null check(environment in ('sandbox','production')),
 phase text not null default 'purchases' check(phase in ('purchases','events')),
 cursor text,
 next_attempt_at timestamptz not null default now(),
 requested_at timestamptz,
 lease_token uuid,
 lease_started_at timestamptz,
 lease_until timestamptz,
 last_completed_at timestamptz,
 last_error text,
 attempts integer not null default 0,
 primary key(user_id,environment)
);
alter table wallet_private.purchase_reconciliation enable row level security;
revoke all on wallet_private.purchase_reconciliation from public,anon,authenticated;
create index purchase_reconciliation_due_idx on wallet_private.purchase_reconciliation(next_attempt_at);
create table wallet_private.purchase_reconciliation_issues (
 user_id uuid not null references auth.users(id) on delete cascade,
 environment text not null,
 source_id text not null,
 reason text not null,
 details jsonb not null default '{}',
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 primary key(user_id,environment,source_id)
);
alter table wallet_private.purchase_reconciliation_issues enable row level security;
revoke all on wallet_private.purchase_reconciliation_issues from public,anon,authenticated;

create function wallet_private.queue_wallet_reconciliation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into wallet_private.purchase_reconciliation(user_id,environment) values(new.user_id,new.environment) on conflict do nothing;
 return new;
end; $$;
create trigger queue_new_wallet_reconciliation after insert on public.coin_wallets
 for each row execute function wallet_private.queue_wallet_reconciliation();
insert into wallet_private.purchase_reconciliation(user_id,environment)
 select w.user_id,w.environment from public.coin_wallets w join auth.users u on u.id=w.user_id where w.status='active';

create function public.request_my_purchase_reconciliation(p_environment text default 'production')
returns void language plpgsql security definer set search_path='' as $$
begin
 perform wallet_private.ensure_wallet(auth.uid(),p_environment);
 insert into wallet_private.purchase_reconciliation(user_id,environment) values(auth.uid(),p_environment) on conflict do nothing;
 -- A client can accelerate only its own job, at most once every two minutes.
 update wallet_private.purchase_reconciliation set next_attempt_at=least(next_attempt_at,now()),requested_at=now()
 where user_id=auth.uid() and environment=p_environment and (requested_at is null or requested_at<now()-interval '2 minutes');
end; $$;
revoke all on function public.request_my_purchase_reconciliation(text) from public,anon;
grant execute on function public.request_my_purchase_reconciliation(text) to authenticated;

create function public.claim_purchase_reconciliations()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_jobs jsonb;
begin
 with due as (
  select q.user_id,q.environment from wallet_private.purchase_reconciliation q
  join public.coin_wallets w using(user_id,environment)
  where q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<now()) and w.status='active'
   and not exists(select 1 from wallet_private.account_deletions d where d.user_id=q.user_id)
  order by q.next_attempt_at limit 3 for update of q skip locked
 ), claimed as (
  update wallet_private.purchase_reconciliation q set lease_token=gen_random_uuid(),lease_started_at=now(),lease_until=now()+interval '3 minutes',attempts=attempts+1
  from due where q.user_id=due.user_id and q.environment=due.environment returning q.*
 ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into v_jobs from claimed;
 return v_jobs;
end; $$;

create function public.apply_purchase_reconciliation(p_user_id uuid,p_environment text,p_token uuid,p_event jsonb,p_snapshot_status text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_purchase public.coin_purchases; v_key text;
begin
 -- Keep the Auth -> queue -> wallet lock order, including during deletion.
 perform 1 from auth.users where id=p_user_id for key share;
 if not found then raise exception 'Account unavailable'; end if;
 perform 1 from wallet_private.purchase_reconciliation where user_id=p_user_id and environment=p_environment
  and lease_token=p_token and lease_until>now() for update;
 if not found then raise exception 'Reconciliation lease expired'; end if;
 if p_event->>'app_user_id' is distinct from p_user_id::text or p_event->>'environment' is distinct from upper(p_environment)
  or length(p_event::text)>8192 then raise exception 'Reconciliation identity mismatch'; end if;
 if p_snapshot_status is not null and p_snapshot_status not in ('owned','refunded') then raise exception 'Invalid snapshot'; end if;
 -- Snapshot purchase time is only a lower bound for a refund. Never invent a
 -- current refund timestamp that could override a later REFUND_REVERSED event.
 if p_snapshot_status='refunded' then
  v_result:=public.record_revenuecat_event(jsonb_set(jsonb_set(jsonb_set(p_event,'{id}',to_jsonb((p_event->>'id')||':refund')),
   '{type}','"CANCELLATION"'),'{cancel_reason}','"CUSTOMER_SUPPORT"'));
 end if;
 v_result:=public.record_revenuecat_event(p_event);
 if p_snapshot_status is not null and v_result->>'state'='processed' then
  select * into v_purchase from public.coin_purchases where app_id=p_event->>'app_id' and store=p_event->>'store'
   and environment=p_environment and transaction_id=p_event->>'transaction_id';
  v_key:=p_event->>'id';
  if v_purchase.refunded is distinct from (p_snapshot_status='refunded') then
   insert into wallet_private.purchase_reconciliation_issues(user_id,environment,source_id,reason,details)
   values(p_user_id,p_environment,v_key,'snapshot_state_conflict',jsonb_build_object('app_id',v_purchase.app_id,'store',v_purchase.store,
    'transaction_id',v_purchase.transaction_id,'snapshot_status',p_snapshot_status))
   on conflict(user_id,environment,source_id) do update set last_seen_at=now(),reason=excluded.reason,details=excluded.details;
   return v_result||'{"review_required":true}'::jsonb;
  else delete from wallet_private.purchase_reconciliation_issues where user_id=p_user_id and environment=p_environment and source_id=v_key; end if;
 end if;
 return v_result;
end; $$;

create function public.note_purchase_reconciliation_issue(p_user_id uuid,p_environment text,p_token uuid,p_source_id text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from wallet_private.purchase_reconciliation where user_id=p_user_id and environment=p_environment
  and lease_token=p_token and lease_until>now() for update;
 if not found then raise exception 'Reconciliation lease expired'; end if;
 if length(p_source_id)>200 or p_reason not in ('unsupported_quantity','ownership_mismatch','incomplete_event','product_not_configured','identity_mismatch') then raise exception 'Invalid review issue'; end if;
 insert into wallet_private.purchase_reconciliation_issues(user_id,environment,source_id,reason)
 values(p_user_id,p_environment,p_source_id,p_reason) on conflict(user_id,environment,source_id) do update set last_seen_at=now(),reason=excluded.reason;
end; $$;

create function public.finish_purchase_reconciliation(p_user_id uuid,p_environment text,p_token uuid,p_phase text,p_cursor text,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_phase not in ('purchases','events') or length(p_cursor)>1000 or p_error is not null and p_error not in ('provider_unavailable','rate_limited','invalid_response','run_timeout') then raise exception 'Invalid continuation'; end if;
 update wallet_private.purchase_reconciliation set phase=p_phase,cursor=p_cursor,lease_token=null,lease_until=null,
  last_error=p_error,next_attempt_at=case when p_error is not null then now()+interval '10 minutes'
   when p_phase='purchases' and p_cursor is null then case
    when requested_at>=lease_started_at or requested_at>now()-interval '2 minutes' then now()+interval '2 minutes'
    else now()+interval '6 hours' end else now() end,
  last_completed_at=case when p_error is null and p_phase='purchases' and p_cursor is null then now() else last_completed_at end
 where user_id=p_user_id and environment=p_environment and lease_token=p_token and lease_until>now();
 if not found then return false; end if;
 if p_error is null and p_phase='purchases' and p_cursor is null then
  -- Event replay may have resolved a conservative snapshot conflict.
  delete from wallet_private.purchase_reconciliation_issues i using public.coin_purchases p
  where i.user_id=p_user_id and i.environment=p_environment and i.reason='snapshot_state_conflict'
   and p.user_id=i.user_id and p.environment=i.environment and p.app_id=i.details->>'app_id'
   and p.store=i.details->>'store' and p.transaction_id=i.details->>'transaction_id'
   and p.refunded=(i.details->>'snapshot_status'='refunded');
 end if;
 return true;
end; $$;

revoke all on function public.claim_purchase_reconciliations(),public.apply_purchase_reconciliation(uuid,text,uuid,jsonb,text),
 public.note_purchase_reconciliation_issue(uuid,text,uuid,text,text),public.finish_purchase_reconciliation(uuid,text,uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.claim_purchase_reconciliations(),public.apply_purchase_reconciliation(uuid,text,uuid,jsonb,text),
 public.note_purchase_reconciliation_issue(uuid,text,uuid,text,text),public.finish_purchase_reconciliation(uuid,text,uuid,text,text,text)
 to service_role;
commit;
