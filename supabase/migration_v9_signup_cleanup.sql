-- YKC V9: a profile exists only after the email is confirmed, and holds nothing invented.
-- Safe to run more than once. Abandoned sign-ups are removed by purge_abandoned_signups().

BEGIN;

-- 1. No invented values on new rows.
ALTER TABLE public.profiles
  ALTER COLUMN phone_number DROP DEFAULT,
  ALTER COLUMN delivery_floor DROP DEFAULT;

-- 2. The profile holds only identity until the person completes the details step.
--    Company, site and phone are never read from sign-up metadata, which the client controls.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), '')
    ),
    'user'::public.app_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block Supabase Auth. The details step creates the row if this fails.
  RAISE WARNING 'handle_new_auth_user warning for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_auth_user();

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. Clear what the old trigger invented.
UPDATE public.profiles SET phone_number = NULL
WHERE phone_number = '+27 82 555 0192';

UPDATE public.profiles
SET location_name = NULL, building_name = NULL, delivery_floor = NULL, delivery_location_id = NULL
WHERE role = 'user' AND company_id IS NULL;

DELETE FROM public.profiles p
USING auth.users u
WHERE u.id = p.id
  AND u.email_confirmed_at IS NULL
  AND p.role = 'user'
  AND p.company_id IS NULL;

-- 4. Remove sign-ups that were never finished. Nobody with a company, a staff role,
--    an order or a payment record is ever touched.
CREATE OR REPLACE FUNCTION public.purge_abandoned_signups()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM auth.users u
  WHERE (
      (u.email_confirmed_at IS NULL
       AND COALESCE(u.confirmation_sent_at, u.created_at) < NOW() - INTERVAL '24 hours')
      OR
      (u.email_confirmed_at IS NOT NULL
       AND COALESCE(u.last_sign_in_at, u.created_at) < NOW() - INTERVAL '7 days')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = u.id AND (p.company_id IS NOT NULL OR p.role <> 'user'::public.app_role)
    )
    AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.payment_intents i WHERE i.user_id = u.id);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_abandoned_signups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_abandoned_signups() TO service_role;

-- 5. Chefs may change only their own profile row.
DROP POLICY IF EXISTS chef_profiles_update_own_only ON public.profiles;
CREATE POLICY chef_profiles_update_own_only ON public.profiles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (id = auth.uid() OR NOT public.is_chef(auth.uid()))
  WITH CHECK (id = auth.uid() OR NOT public.is_chef(auth.uid()));

DROP POLICY IF EXISTS chef_profiles_insert_own_only ON public.profiles;
CREATE POLICY chef_profiles_insert_own_only ON public.profiles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR NOT public.is_chef(auth.uid()));

INSERT INTO public.applied_migrations (version, notes)
VALUES ('v9_signup_cleanup', 'Profiles created on confirmation, no invented values, abandoned sign-up purge')
ON CONFLICT (version) DO NOTHING;

COMMIT;
