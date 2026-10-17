-- OPTIONAL ACTIVATION TEMPLATE, not applied automatically.
-- Uses only the existing hosted Supabase project. No Docker or second database.
-- Enable Supabase Cron (pg_cron) and pg_net in the dashboard first.
-- TODO: use the dashboard to create Vault secrets named:
--   mathmews_project_url      existing https://<project>.supabase.co URL
--   mathmews_service_role_key existing service-role key, SERVER ONLY
-- Never paste the actual service key into a scheduled SQL command or the app.
-- Deploy migration 009 and delete-account, configure its provider secrets and
-- verify deletion with disposable accounts before enabling this schedule.
begin;
do $$ begin
 if not exists(select 1 from vault.secrets where name='mathmews_project_url')
  or not exists(select 1 from vault.secrets where name='mathmews_service_role_key') then
  raise exception 'Configure the two named Vault secrets before scheduling';
 end if;
end; $$;
select cron.schedule('mathmews-account-deletion-retry','*/10 * * * *', $job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='mathmews_project_url')||'/functions/v1/delete-account/retry',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||
   (select decrypted_secret from vault.decrypted_secrets where name='mathmews_service_role_key')),
  body:='{}'::jsonb
 ) where exists (
  select 1 from wallet_private.account_deletions where state='pending' and client_confirmed and apple_revoked
 );
$job$);
commit;
