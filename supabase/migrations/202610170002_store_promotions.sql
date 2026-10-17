-- Server-managed prices and optional scheduled promotions. Bundled app prices
-- are display defaults only. Both catalog reads and spending use this view.
begin;
alter table wallet_private.store_catalog
 add column sale_price integer,
 add column sale_starts_at timestamptz,
 add column sale_ends_at timestamptz,
 add column sale_label text,
 add constraint store_catalog_sale_price_check check (sale_price is null or (sale_price>=0 and sale_price<=price)),
 add constraint store_catalog_sale_dates_check check (sale_starts_at is null or sale_ends_at is null or sale_ends_at>sale_starts_at),
 add constraint store_catalog_sale_label_check check (sale_label is null or length(sale_label)<=80);

create view wallet_private.current_store_catalog as
 select kind,item_id,price as base_price,sale_price,sale_starts_at,sale_ends_at,sale_label,
 case when sale_price is not null and (sale_starts_at is null or now()>=sale_starts_at)
  and (sale_ends_at is null or now()<sale_ends_at) then sale_price else price end as effective_price
 from wallet_private.store_catalog;
revoke all on wallet_private.current_store_catalog from public,anon,authenticated,service_role;

create function public.get_store_catalog()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('server_time',now(),'items',coalesce(jsonb_agg(jsonb_build_object(
  'kind',kind,'item_id',item_id,'price',effective_price,'base_price',base_price,'sale_price',sale_price,
  'sale_starts_at',sale_starts_at,'sale_ends_at',sale_ends_at,'sale_label',sale_label
 ) order by kind,item_id),'[]'::jsonb)) from wallet_private.current_store_catalog;
$$;
revoke all on function public.get_store_catalog() from public,anon,authenticated,service_role;
grant execute on function public.get_store_catalog() to anon,authenticated;

create or replace function public.spend_game_coins(p_environment text,p_save_id uuid,p_kind text,p_item_id text,p_request_id uuid,p_expected_price integer)
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
 if not exists(select 1 from public.game_saves where id=p_save_id and user_id=auth.uid() and environment=p_environment) then raise exception 'Save unavailable' using errcode='42501'; end if;
 select effective_price into v_price from wallet_private.current_store_catalog where kind=p_kind and item_id=p_item_id;
 if not found then raise exception 'Item unavailable'; end if;
 if p_expected_price is not null and p_expected_price<>v_price then raise exception 'Store price changed' using errcode='P0001'; end if;
 perform wallet_private.ensure_wallet(auth.uid(),p_environment);
 -- Unique unlocks cannot be charged again from an old cloud snapshot.
 if p_kind in ('room','bed','skin') and exists(select 1 from public.coin_wallet_entries where user_id=auth.uid() and environment=p_environment
  and kind='store_spend' and request_payload @> v_payload) then raise exception 'Already owned' using errcode='23505'; end if;
 return wallet_private.append_entry(auth.uid(),p_environment,-v_price,'store_spend',v_key,v_payload,'Store purchase','game');
end; $$;

-- Retain the five-argument endpoint for already installed app versions and
-- pre-upgrade pending request IDs. New clients also send their displayed price.
create or replace function public.spend_game_coins(p_environment text,p_save_id uuid,p_kind text,p_item_id text,p_request_id uuid)
returns public.coin_wallet_entries language sql security definer set search_path='' as $$
 select public.spend_game_coins(p_environment,p_save_id,p_kind,p_item_id,p_request_id,null::integer);
$$;
revoke all on function public.spend_game_coins(text,uuid,text,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.spend_game_coins(text,uuid,text,text,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
