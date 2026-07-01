-- BrainPet — migrate away from iap_grants (existing projects only)
-- Run this if you already created the old schema with iap_grants.
-- Safe to run on fresh projects (no-op if table missing).

drop table if exists public.iap_grants;
