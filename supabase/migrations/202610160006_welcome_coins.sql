begin;
alter table public.coin_wallet_entries drop constraint coin_wallet_entries_kind_check;
alter table public.coin_wallet_entries add constraint coin_wallet_entries_kind_check check (kind in
 ('admin_adjustment','purchase_grant','purchase_refund','purchase_refund_reversed','legacy_import','starter_grant','puzzle_reward','store_spend'));
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
     from public.game_saves where user_id=auth.uid();
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
