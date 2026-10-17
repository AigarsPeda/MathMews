-- Activation template only. Uses the EXISTING Supabase project and its hosted
-- Cron/pg_net extensions. No Docker or additional database is needed.
-- Requires migrations 009–011, deployed reconcile-purchases and its private
-- RevenueCat key/project ID. Use the dashboard to create Vault secrets named
-- mathmews_project_url and mathmews_service_role_key, as described in README.md.
-- Keep the actual service key out of SQL source, cron commands and the app.
begin;
do $$ begin
 if not exists(select 1 from vault.secrets where name='mathmews_project_url')
  or not exists(select 1 from vault.secrets where name='mathmews_service_role_key') then
  raise exception 'Configure the named Vault secrets before scheduling';
 end if;
end; $$;
select cron.schedule('mathmews-purchase-reconciliation','* * * * *', $job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='mathmews_project_url')||'/functions/v1/reconcile-purchases',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||
   (select decrypted_secret from vault.decrypted_secrets where name='mathmews_service_role_key')),
  body:='{}'::jsonb
 ) where exists (
  select 1 from wallet_private.purchase_reconciliation q join public.coin_wallets w using(user_id,environment)
  where q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<now()) and w.status='active'
 );
$job$);
commit;
