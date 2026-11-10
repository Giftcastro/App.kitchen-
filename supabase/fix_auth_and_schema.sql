-- =====================================================================
-- KITCHEN CO. V1 — DEFINITIVE AUTH & LIVE DATA RESTORATION SCRIPT
-- Run this in the Supabase Dashboard SQL Editor (hazlxumtnlgdvuyluxfp)
-- =====================================================================

DO $$
DECLARE
  v_ecogra_id UUID;
  v_rcl_id    UUID;
  v_tata_id   UUID;
  v_ingrid_id CONSTANT UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_ahmed_id  CONSTANT UUID := 'a0000000-0000-0000-0000-000000000002'::uuid;
  v_anele_id  CONSTANT UUID := 'a0000000-0000-0000-0000-000000000003'::uuid;
  v_tamryn_id CONSTANT UUID := 'a0000000-0000-0000-0000-000000000004'::uuid;
  v_chef_id   CONSTANT UUID := 'a0000000-0000-0000-0000-000000000005'::uuid;
BEGIN
  -- 1. Obtain Corporate Account IDs
  SELECT id INTO v_ecogra_id FROM public.companies WHERE name = 'eCOGRA' LIMIT 1;
  SELECT id INTO v_rcl_id FROM public.companies WHERE name = 'RCL Foods' LIMIT 1;
  SELECT id INTO v_tata_id FROM public.companies WHERE name = 'TATA Africa Holdings' LIMIT 1;

  -- 2. Clear out any previous identities for these 5 seeded accounts to prevent schema conflicts
  DELETE FROM auth.identities WHERE user_id IN (v_ingrid_id, v_ahmed_id, v_anele_id, v_tamryn_id, v_chef_id);

  -- 3. Upsert into auth.users with clean, non-null values matching GoTrue Go expectations
  -- User 1: Ingrid (Admin)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new,
    recovery_token, email_change_token_current, phone, phone_change, phone_change_token,
    reauthentication_token, is_super_admin, is_sso_user, is_anonymous, email_change_confirm_status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_ingrid_id, 'authenticated', 'authenticated',
    'ingrid@kyc.com', crypt(gen_random_uuid()::text, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Ingrid van der Merwe", "role": "admin", "sub": "a0000000-0000-0000-0000-000000000001", "email": "ingrid@kyc.com", "email_verified": true}'::jsonb,
    NOW(), NOW(), '', '', '', '', '', NULL, '', '', '', false, false, false, 0
  ) ON CONFLICT (id) DO UPDATE SET
    email = 'ingrid@kyc.com',
    encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
    email_confirmed_at = NOW(),
    confirmation_token = '',
    recovery_token = '',
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    phone = NULL,
    phone_change = '',
    phone_change_token = '',
    reauthentication_token = '',
    is_sso_user = false,
    is_anonymous = false,
    email_change_confirm_status = 0;

  -- User 2: Ahmed (eCOGRA)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new,
    recovery_token, email_change_token_current, phone, phone_change, phone_change_token,
    reauthentication_token, is_super_admin, is_sso_user, is_anonymous, email_change_confirm_status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_ahmed_id, 'authenticated', 'authenticated',
    'ahmed.maseko@ecogra.org', crypt(gen_random_uuid()::text, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Ahmed Maseko", "role": "user", "sub": "a0000000-0000-0000-0000-000000000002", "email": "ahmed.maseko@ecogra.org", "email_verified": true}'::jsonb,
    NOW(), NOW(), '', '', '', '', '', NULL, '', '', '', false, false, false, 0
  ) ON CONFLICT (id) DO UPDATE SET
    email = 'ahmed.maseko@ecogra.org',
    encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
    email_confirmed_at = NOW(),
    confirmation_token = '',
    recovery_token = '',
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    phone = NULL,
    phone_change = '',
    phone_change_token = '',
    reauthentication_token = '',
    is_sso_user = false,
    is_anonymous = false,
    email_change_confirm_status = 0;

  -- User 3: Anele (RCL Foods)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new,
    recovery_token, email_change_token_current, phone, phone_change, phone_change_token,
    reauthentication_token, is_super_admin, is_sso_user, is_anonymous, email_change_confirm_status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_anele_id, 'authenticated', 'authenticated',
    'anele.mthembu@rclfoods.com', crypt(gen_random_uuid()::text, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Anele Mthembu", "role": "user", "sub": "a0000000-0000-0000-0000-000000000003", "email": "anele.mthembu@rclfoods.com", "email_verified": true}'::jsonb,
    NOW(), NOW(), '', '', '', '', '', NULL, '', '', '', false, false, false, 0
  ) ON CONFLICT (id) DO UPDATE SET
    email = 'anele.mthembu@rclfoods.com',
    encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
    email_confirmed_at = NOW(),
    confirmation_token = '',
    recovery_token = '',
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    phone = NULL,
    phone_change = '',
    phone_change_token = '',
    reauthentication_token = '',
    is_sso_user = false,
    is_anonymous = false,
    email_change_confirm_status = 0;

  -- User 4: Tamryn (TATA Africa)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new,
    recovery_token, email_change_token_current, phone, phone_change, phone_change_token,
    reauthentication_token, is_super_admin, is_sso_user, is_anonymous, email_change_confirm_status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_tamryn_id, 'authenticated', 'authenticated',
    'tamryn.louw@tataafrica.com', crypt(gen_random_uuid()::text, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Tamryn Louw", "role": "user", "sub": "a0000000-0000-0000-0000-000000000004", "email": "tamryn.louw@tataafrica.com", "email_verified": true}'::jsonb,
    NOW(), NOW(), '', '', '', '', '', NULL, '', '', '', false, false, false, 0
  ) ON CONFLICT (id) DO UPDATE SET
    email = 'tamryn.louw@tataafrica.com',
    encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
    email_confirmed_at = NOW(),
    confirmation_token = '',
    recovery_token = '',
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    phone = NULL,
    phone_change = '',
    phone_change_token = '',
    reauthentication_token = '',
    is_sso_user = false,
    is_anonymous = false,
    email_change_confirm_status = 0;

  -- User 5: Chef Marco
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new,
    recovery_token, email_change_token_current, phone, phone_change, phone_change_token,
    reauthentication_token, is_super_admin, is_sso_user, is_anonymous, email_change_confirm_status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_chef_id, 'authenticated', 'authenticated',
    'chef@kitchenco.co.za', crypt(gen_random_uuid()::text, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Executive Chef Marco", "role": "chef", "sub": "a0000000-0000-0000-0000-000000000005", "email": "chef@kitchenco.co.za", "email_verified": true}'::jsonb,
    NOW(), NOW(), '', '', '', '', '', NULL, '', '', '', false, false, false, 0
  ) ON CONFLICT (id) DO UPDATE SET
    email = 'chef@kitchenco.co.za',
    encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
    email_confirmed_at = NOW(),
    confirmation_token = '',
    recovery_token = '',
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    phone = NULL,
    phone_change = '',
    phone_change_token = '',
    reauthentication_token = '',
    is_sso_user = false,
    is_anonymous = false,
    email_change_confirm_status = 0;

  -- 4. Re-insert identities with modern provider_id column
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES 
    (v_ingrid_id::text, v_ingrid_id, jsonb_build_object('sub', v_ingrid_id::text, 'email', 'ingrid@kyc.com', 'email_verified', true, 'phone_verified', false), 'email', NOW(), NOW(), NOW()),
    (v_ahmed_id::text, v_ahmed_id, jsonb_build_object('sub', v_ahmed_id::text, 'email', 'ahmed.maseko@ecogra.org', 'email_verified', true, 'phone_verified', false), 'email', NOW(), NOW(), NOW()),
    (v_anele_id::text, v_anele_id, jsonb_build_object('sub', v_anele_id::text, 'email', 'anele.mthembu@rclfoods.com', 'email_verified', true, 'phone_verified', false), 'email', NOW(), NOW(), NOW()),
    (v_tamryn_id::text, v_tamryn_id, jsonb_build_object('sub', v_tamryn_id::text, 'email', 'tamryn.louw@tataafrica.com', 'email_verified', true, 'phone_verified', false), 'email', NOW(), NOW(), NOW()),
    (v_chef_id::text, v_chef_id, jsonb_build_object('sub', v_chef_id::text, 'email', 'chef@kitchenco.co.za', 'email_verified', true, 'phone_verified', false), 'email', NOW(), NOW(), NOW());

  -- 5. Ensure public.profiles has all user records
  INSERT INTO public.profiles (id, email, full_name, phone_number, role, company_id, location_name, building_name, delivery_floor)
  VALUES
    (v_ingrid_id, 'ingrid@kyc.com', 'Ingrid van der Merwe', '+27 82 555 0192', 'admin', NULL, 'Kitchen Co Headquarters', 'Central Command Kitchen', 'Executive Suite'),
    (v_ahmed_id, 'ahmed.maseko@ecogra.org', 'Ahmed Maseko', '+27 82 555 0192', 'user', v_ecogra_id, 'eCOGRA Rosebank Hub', 'Rosebank Office Park', 'Floor 2 (IT & Compliance Pantry)'),
    (v_anele_id, 'anele.mthembu@rclfoods.com', 'Anele Mthembu', '+27 82 555 0192', 'user', v_rcl_id, 'RCL Foods Dunkeld HQ', 'Ten Bompas Office Complex, Building 2', 'Floor 1 (Corporate Canteen Pantry)'),
    (v_tamryn_id, 'tamryn.louw@tataafrica.com', 'Tamryn Louw', '+27 82 555 0192', 'user', v_tata_id, 'TATA Sandton Towers', '140 West Street Building, Tower B', 'Tower B, Floor 4 (Holding Operations Staging)'),
    (v_chef_id, 'chef@kitchenco.co.za', 'Executive Chef Marco', '+27 82 555 0192', 'chef', NULL, 'Kitchen Co Commercial Kitchen', 'Central Production Facility', 'Executive Kitchen Station')
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    company_id = EXCLUDED.company_id,
    location_name = EXCLUDED.location_name,
    building_name = EXCLUDED.building_name,
    delivery_floor = EXCLUDED.delivery_floor;

END$$;

-- 6. User creation trigger for seamless signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone_number, role, company_id, location_name, building_name, delivery_floor)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', '+27 82 555 0192'),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'user'::public.app_role),
    (NEW.raw_user_meta_data->>'company_id')::uuid,
    COALESCE(NEW.raw_user_meta_data->>'location_name', 'Sandhurst Building 1'),
    COALESCE(NEW.raw_user_meta_data->>'building_name', 'Sandhurst Office Complex'),
    COALESCE(NEW.raw_user_meta_data->>'delivery_floor', 'Floor 3 (Reception Pantry)')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone_number = EXCLUDED.phone_number,
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Grant anonymous and authenticated SELECT on foundational catalog and company tables
-- This ensures unauthenticated clients (e.g. at sign-in/sign-up screen) can fetch categories, items, and companies directly from Supabase
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'companies_select_anon') THEN
    CREATE POLICY "companies_select_anon" ON public.companies FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'company_domains_select_anon') THEN
    CREATE POLICY "company_domains_select_anon" ON public.company_domains FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delivery_locations_select_anon') THEN
    CREATE POLICY "delivery_locations_select_anon" ON public.delivery_locations FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dropoff_floors_select_anon') THEN
    CREATE POLICY "dropoff_floors_select_anon" ON public.dropoff_floors FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_holidays_select_anon') THEN
    CREATE POLICY "public_holidays_select_anon" ON public.public_holidays FOR SELECT USING (true);
  END IF;
END $$;

-- 8. Verification: Return confirmed accounts
SELECT id, email, role, email_confirmed_at, last_sign_in_at FROM auth.users ORDER BY created_at;
