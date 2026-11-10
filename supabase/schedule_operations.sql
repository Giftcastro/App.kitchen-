-- Run after migration_v11_operations_and_retention.sql and after deploying daily-kitchen-manifest.
-- In DataGrip run one step at a time: each needs the one before it to have finished.

-- Step 1: lets the database call the email function.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: creates a private key shared with the function. Nobody needs to copy it.
SELECT vault.create_secret(
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  'manifest_cron_secret'
)
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'manifest_cron_secret');

-- Step 3: lets only the server check that key.
CREATE OR REPLACE FUNCTION public.verify_manifest_secret(p_secret TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'manifest_cron_secret' AND decrypted_secret = p_secret
  );
END;
$$;
REVOKE ALL ON FUNCTION public.verify_manifest_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_manifest_secret(TEXT) TO service_role;

-- Step 4: 09:00 SAST, weekdays. Emails the Production Sheet and Delivery Notes.
SELECT cron.schedule(
  'morning-kitchen-manifest',
  '0 7 * * 1-5',
  $job$
  SELECT net.http_post(
    url := 'https://hazlxumtnlgdvuyluxfp.supabase.co/functions/v1/daily-kitchen-manifest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'manifest_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);

-- Step 5: 10:00 SAST, weekdays. Marks today's orders Out for Delivery and notifies customers.
SELECT cron.schedule('ten-am-dispatch', '0 8 * * 1-5', $job$SELECT public.run_morning_dispatch()$job$);

-- Step 6: monthly. Removes anonymised records older than 5 years.
SELECT cron.schedule('retention-purge', '0 2 1 * *', $job$SELECT public.purge_expired_records()$job$);

-- Step 7: expect four rows, all active, including purge-abandoned-signups.
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
