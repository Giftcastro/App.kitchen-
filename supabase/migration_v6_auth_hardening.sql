-- =====================================================================
-- YOUR KITCHEN CO. (YKC) - MIGRATION V6: AUTH HARDENING (IDEMPOTENT)
-- Run supabase/audit/v6_preflight.sql first and review its output.
-- Then run this file, then supabase/audit/v6_attack_tests.sql.
--
-- Closes:
--   1. Sign-up granting admin from the email text or user-supplied metadata
--   2. Users changing their own role or suspension flag
--   3. Anyone being able to write public.platform_settings
--   4. Customers rewriting amounts, payment fields or status on their orders
--
-- Does NOT close the PayFast gap: orders are still marked paid by the
-- client until a server-side ITN handler exists.
-- =====================================================================

BEGIN;

-- Migration ledger: every migration from v6 onward records itself here.
CREATE TABLE IF NOT EXISTS public.applied_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);
ALTER TABLE public.applied_migrations ENABLE ROW LEVEL SECURITY;

-- Production never received v5, so make sure this table exists here too.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-contained helpers, so this does not depend on which of the older
-- is_admin / is_chef / has_role functions exist in the target database.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin'::public.app_role, 'chef'::public.app_role)
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_staff() TO authenticated, service_role;

-- 1. Every new account starts as a plain user. Staff roles are granted
--    afterwards by an admin, never derived from sign-up input.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID := NULL;
  v_full_name TEXT;
BEGIN
  IF (NEW.raw_user_meta_data->>'company_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
  END IF;

  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(COALESCE(NEW.email, 'user'), '@', 1)
  );

  INSERT INTO public.profiles (
    id, email, full_name, phone_number, role, company_id,
    location_name, building_name, delivery_floor, created_at, updated_at
  )
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    v_full_name,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', '+27 82 555 0192'),
    'user'::public.app_role,
    v_company_id,
    COALESCE(NEW.raw_user_meta_data->>'location_name', 'Corporate Campus'),
    COALESCE(NEW.raw_user_meta_data->>'building_name', 'Main Building'),
    COALESCE(NEW.raw_user_meta_data->>'delivery_floor', 'Floor 3 (Reception Pantry)'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block Supabase Auth from creating the auth.users row
  RAISE WARNING 'handle_new_auth_user warning for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. Only admins, or trusted server contexts with no user JWT, may set
--    role or is_suspended.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user'::public.app_role;
    NEW.is_suspended := FALSE;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
    RAISE EXCEPTION 'Only an administrator can change role or suspension status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- 3. platform_settings: signed-in read, admin-only write. Removes every
--    existing policy first because the v5 write policy allowed all callers.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'platform_settings'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.platform_settings', p.policyname);
  END LOOP;
END$$;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings_read_authenticated"
  ON public.platform_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "platform_settings_write_admin"
  ON public.platform_settings FOR ALL TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- 4. Customers may only add a rating or report a problem on their orders.
--    Column names are compared as JSON so this works across schema versions.
CREATE OR REPLACE FUNCTION public.guard_customer_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_blocked TEXT[];
BEGIN
  IF auth.uid() IS NULL OR public.current_user_is_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Only a future server-side payment handler may set this.
    NEW.itn_verified_at := NULL;
    RETURN NEW;
  END IF;

  SELECT COALESCE(array_agg(n.key ORDER BY n.key), ARRAY[]::TEXT[])
    INTO v_blocked
  FROM jsonb_each(to_jsonb(NEW)) AS n
  WHERE n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key)
    AND n.key NOT IN (
      'status', 'updated_at',
      'rating_score', 'rating_feedback', 'rated_at',
      'is_disputed', 'dispute_reason', 'dispute_ticket_ref', 'dispute_reported_at'
    );

  IF cardinality(v_blocked) > 0 THEN
    RAISE EXCEPTION 'Customers cannot change these order fields: %', array_to_string(v_blocked, ', ')
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status::TEXT IS DISTINCT FROM OLD.status::TEXT
     AND NEW.status::TEXT <> 'unfulfilled' THEN
    RAISE EXCEPTION 'Customers cannot set order status to %', NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_customer_order_changes ON public.orders;
CREATE TRIGGER trg_guard_customer_order_changes
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_order_changes();

DROP POLICY IF EXISTS "applied_migrations_read_staff" ON public.applied_migrations;
CREATE POLICY "applied_migrations_read_staff"
  ON public.applied_migrations FOR SELECT TO authenticated
  USING (public.current_user_is_staff());

INSERT INTO public.applied_migrations (version, notes)
VALUES ('v6_auth_hardening', 'Role, settings and customer order guards')
ON CONFLICT (version) DO NOTHING;

COMMIT;
