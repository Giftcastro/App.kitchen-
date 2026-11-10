GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT USAGE ON TYPE public.app_role TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO postgres, service_role, supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role := 'user'::public.app_role;
  v_company_id UUID := NULL;
  v_full_name TEXT;
BEGIN
  IF LOWER(COALESCE(NEW.email, '')) LIKE '%admin%' OR (NEW.raw_user_meta_data->>'role') = 'admin' THEN
    v_role := 'admin'::public.app_role;
  ELSIF (NEW.raw_user_meta_data->>'role') = 'chef' THEN
    v_role := 'chef'::public.app_role;
  ELSE
    v_role := 'user'::public.app_role;
  END IF;

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
    v_role,
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

select * from profiles;