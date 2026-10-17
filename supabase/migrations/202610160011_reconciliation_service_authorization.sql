begin;
-- The dashboard's legacy service JWT can differ from the runtime's built-in
-- credential. PostgREST verifies the submitted token's signature and database
-- role before this read-only function can run. It never claims or changes jobs.
create function public.authorize_purchase_reconciliation()
returns boolean language sql stable set search_path='' as $$
 select auth.role()='service_role';
$$;
revoke all on function public.authorize_purchase_reconciliation() from public,anon,authenticated;
grant execute on function public.authorize_purchase_reconciliation() to service_role;
commit;
