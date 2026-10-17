begin;
-- One snapshot keeps receipt delivery and its wallet revision consistent. A
-- scalar JSON result also avoids PostgREST's row limit truncating old inventories.
create function public.get_my_game_delivery(p_environment text,p_save_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('wallet',to_jsonb(w),'orders',(
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'request_payload',e.request_payload) order by e.created_at,e.id),'[]'::jsonb)
  from public.coin_wallet_entries e where e.user_id=w.user_id and e.environment=w.environment
   and e.kind='store_spend' and e.request_payload->>'save_id'=p_save_id::text
 )) from public.coin_wallets w where w.user_id=auth.uid() and w.environment=p_environment and w.status='active';
$$;
revoke all on function public.get_my_game_delivery(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_my_game_delivery(text,uuid) to authenticated;
commit;
