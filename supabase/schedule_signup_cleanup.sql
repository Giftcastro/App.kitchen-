-- Run once, after migration_v9_signup_cleanup.sql, to remove abandoned sign-ups every night.
-- In DataGrip, run step 1 by itself first. cron.schedule does not exist until it has finished.
-- Deletes accounts unconfirmed for 24 hours, and accounts confirmed but without a company
-- and inactive for 7 days. See purge_abandoned_signups() for the accounts it protects.

-- Step 1
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Step 2
SELECT cron.schedule(
  'purge-abandoned-signups',
  '0 1 * * *', -- 01:00 UTC, 03:00 in South Africa
  $$SELECT public.purge_abandoned_signups()$$
);

-- Step 3: expect one row, with active = true
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'purge-abandoned-signups';
