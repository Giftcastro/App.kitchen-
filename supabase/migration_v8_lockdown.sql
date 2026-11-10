-- =====================================================================
-- YOUR KITCHEN CO. (YKC) - MIGRATION V8: LOCKDOWN (IDEMPOTENT)
-- Requires v6 and v7. Run supabase/audit/v8_lockdown_tests.sql afterwards.
--
--   1. Customers are bound to one company for good
--   2. Customers pick only that company's branches; address text is server-set
--   3. Chefs are read-only everywhere except their own profile
--   4. Signed-out visitors can read nothing at all
--   5. Customers see only their own company's data
--   6. Function execute rights reduced to what each role needs
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_is_chef()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'chef'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Accepts the labels the app shows: "Name" or "Name • Building".
CREATE OR REPLACE FUNCTION public.company_location_id(p_company UUID, p_label TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.id FROM public.delivery_locations l
  WHERE l.company_id = p_company
    AND p_label IN (l.location_name, l.location_name || ' • ' || l.building_name)
  ORDER BY l.created_at
  LIMIT 1;
$$;

-- A drop-off is a branch label or a floor at one of the company's branches.
CREATE OR REPLACE FUNCTION public.is_valid_company_dropoff(p_company UUID, p_label TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.company_location_id(p_company, p_label) IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.dropoff_floors f
      JOIN public.delivery_locations l ON l.id = f.location_id
      WHERE l.company_id = p_company AND f.floor_label = p_label
    );
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_company UUID;
  v_location public.delivery_locations%ROWTYPE;
  v_binding BOOLEAN;
  v_location_changed BOOLEAN;
BEGIN
  -- Server contexts (no user JWT) and admins are the only ones exempt.
  IF auth.uid() IS NULL OR public.current_user_is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user'::public.app_role;
    NEW.is_suspended := FALSE;
    v_old_company := NULL;
  ELSE
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
      RAISE EXCEPTION 'Only an administrator can change role or suspension status'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR LOWER(NEW.email) IS DISTINCT FROM LOWER(OLD.email) THEN
      RAISE EXCEPTION 'Account identity cannot be changed here' USING ERRCODE = '42501';
    END IF;
    v_old_company := OLD.company_id;
  END IF;

  -- Set once at registration. After that only an administrator can move a customer.
  IF v_old_company IS NOT NULL AND NEW.company_id IS DISTINCT FROM v_old_company THEN
    RAISE EXCEPTION 'Your company cannot be changed after registration' USING ERRCODE = '42501';
  END IF;

  v_binding := v_old_company IS NULL AND NEW.company_id IS NOT NULL;

  IF v_binding AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = NEW.company_id AND is_active
  ) THEN
    RAISE EXCEPTION 'That company is not available' USING ERRCODE = '42501';
  END IF;

  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_location_changed := v_binding OR NEW.location_name IS DISTINCT FROM OLD.location_name;

  IF v_location_changed THEN
    SELECT * INTO v_location FROM public.delivery_locations
    WHERE id = public.company_location_id(NEW.company_id, NEW.location_name);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose one of your company''s delivery sites' USING ERRCODE = '42501';
    END IF;

    -- These come from the company's record, never from the client.
    NEW.delivery_location_id := v_location.id;
    NEW.building_name := v_location.building_name;

    IF NOT public.is_valid_company_dropoff(NEW.company_id, NEW.delivery_floor) THEN
      SELECT f.floor_label INTO NEW.delivery_floor
      FROM public.dropoff_floors f
      WHERE f.location_id = v_location.id
      ORDER BY f.is_default DESC, f.created_at
      LIMIT 1;
      NEW.delivery_floor := COALESCE(NEW.delivery_floor, NEW.location_name);
    END IF;
  ELSE
    NEW.delivery_location_id := OLD.delivery_location_id;
    NEW.building_name := OLD.building_name;

    IF NEW.delivery_floor IS DISTINCT FROM OLD.delivery_floor
       AND NOT public.is_valid_company_dropoff(NEW.company_id, NEW.delivery_floor) THEN
      RAISE EXCEPTION 'Choose one of your company''s delivery points' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- Chefs: restrictive policies combine with AND, so no other policy can undo these.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "chef_no_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "chef_no_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "chef_no_delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "chef_no_insert" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.current_user_is_chef())', t);
    EXECUTE format('CREATE POLICY "chef_no_update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.current_user_is_chef())', t);
    EXECUTE format('CREATE POLICY "chef_no_delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.current_user_is_chef())', t);
  END LOOP;
END$$;

-- Company data: own company only, staff see all. Replaces every old read policy.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND cmd = 'SELECT'
      AND tablename IN ('companies', 'company_domains', 'delivery_locations', 'dropoff_floors')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END$$;

CREATE POLICY "companies_read_own" ON public.companies FOR SELECT TO authenticated
  USING (public.current_user_is_staff() OR id = public.current_user_company_id());
CREATE POLICY "company_domains_read_own" ON public.company_domains FOR SELECT TO authenticated
  USING (public.current_user_is_staff() OR company_id = public.current_user_company_id());
CREATE POLICY "delivery_locations_read_own" ON public.delivery_locations FOR SELECT TO authenticated
  USING (public.current_user_is_staff() OR company_id = public.current_user_company_id());
CREATE POLICY "dropoff_floors_read_own" ON public.dropoff_floors FOR SELECT TO authenticated
  USING (
    public.current_user_is_staff() OR EXISTS (
      SELECT 1 FROM public.delivery_locations l
      WHERE l.id = dropoff_floors.location_id AND l.company_id = public.current_user_company_id()
    )
  );

-- Only someone who is signed in and not yet bound gets the sign-up list.
-- It holds names and sites only: no discounts, billing details or domains.
CREATE OR REPLACE FUNCTION public.signup_company_directory()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_company_id() IS NOT NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'slug', c.slug, 'street_address', c.street_address, 'is_active', c.is_active,
      'delivery_locations', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.id, 'location_name', l.location_name, 'building_name', l.building_name,
          'street_address', l.street_address,
          'dropoff_floors', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('floor_label', f.floor_label))
            FROM public.dropoff_floors f WHERE f.location_id = l.id
          ), '[]'::jsonb)
        ))
        FROM public.delivery_locations l WHERE l.company_id = c.id
      ), '[]'::jsonb)
    ) ORDER BY c.name)
    FROM public.companies c WHERE c.is_active
  ), '[]'::jsonb);
END;
$$;

-- Platform settings are staff business, not something customers need.
DROP POLICY IF EXISTS "platform_settings_read_authenticated" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_read_staff" ON public.platform_settings;
CREATE POLICY "platform_settings_read_staff" ON public.platform_settings FOR SELECT TO authenticated
  USING (public.current_user_is_staff());

-- Signed-out visitors get nothing. Sign-in itself goes through Supabase Auth.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- Functions: closed by default, reopened only where RLS or the app needs them.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- The blanket grant above must not reach these.
REVOKE EXECUTE ON FUNCTION public.confirm_payfast_payment(UUID, TEXT, NUMERIC, TEXT, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO supabase_auth_admin;

-- Older helpers created without a fixed search_path.
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f.sig);
  END LOOP;
END$$;

INSERT INTO public.applied_migrations (version, notes)
VALUES ('v8_lockdown', 'Company binding, read-only chefs, no anonymous access')
ON CONFLICT (version) DO NOTHING;

COMMIT;
