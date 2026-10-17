begin;
-- Math Mews / RevenueCat project fbac6be5. Test Store is sandbox only.
insert into public.revenuecat_apps(app_id,store,environments,active)
values('appff09380af7','TEST_STORE',array['sandbox'],true)
on conflict(app_id) do update set store=excluded.store,environments=excluded.environments,active=excluded.active;
commit;
