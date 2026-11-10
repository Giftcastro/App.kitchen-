-- YKC V6 ATTACK TESTS. Ends by raising an error on purpose, which rolls back all test data.
-- The error text IS the report: every line should say PASS. Needs one profile with role 'user'.

DO $$
DECLARE
  v_user UUID;
  v_admin UUID;
  v_order UUID;
  v_order2 UUID;
  v_probe UUID := gen_random_uuid();
  v_date DATE := CURRENT_DATE + 30;
  v_count INT;
  v_role TEXT;
  v_itn TIMESTAMPTZ;
  v_status TEXT;
  v_report TEXT := E'
';
BEGIN
  SELECT id INTO v_user FROM public.profiles WHERE role = 'user' LIMIT 1;
  SELECT id INTO v_admin FROM public.profiles WHERE role = 'admin' LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Need one profile with role user to run these tests';
  END IF;

  -- Find a deliverable weekday that is not a public holiday.
  WHILE EXTRACT(DOW FROM v_date) IN (0, 6)
     OR EXISTS (SELECT 1 FROM public.public_holidays WHERE holiday_date = v_date) LOOP
    v_date := v_date + 1;
  END LOOP;

  INSERT INTO public.orders (order_number, user_id, target_delivery_date, total_amount)
  VALUES ('ATTACK-' || gen_random_uuid(), v_user, v_date, 100)
  RETURNING id INTO v_order;

  -- Sign-up cannot grant admin through email text or metadata.
  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (v_probe, 'admin-attack-' || v_probe || '@example.com', '{"role":"admin"}'::jsonb, NOW());
  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = v_probe;
  v_report := v_report || format(E'%s sign-up with admin email and metadata gets role user (got %s)
',
    CASE WHEN v_role = 'user' THEN 'PASS' ELSE 'FAIL' END, v_role);

  -- Everything below runs as the signed-in customer.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::TEXT, true);
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = v_user;
    v_report := v_report || format(E'FAIL customer promoted themselves to admin
');
  EXCEPTION WHEN insufficient_privilege THEN
    v_report := v_report || format(E'PASS customer cannot change own role
');
  END;

  BEGIN
    UPDATE public.profiles SET is_suspended = TRUE WHERE id = v_user;
    v_report := v_report || format(E'FAIL customer changed own suspension flag
');
  EXCEPTION WHEN insufficient_privilege THEN
    v_report := v_report || format(E'PASS customer cannot change suspension flag
');
  END;

  UPDATE public.profiles SET full_name = 'Attack Test' WHERE id = v_user;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_report := v_report || format(E'%s customer can still edit own name
', CASE WHEN v_count = 1 THEN 'PASS' ELSE 'FAIL' END);

  UPDATE public.platform_settings SET setting_value = '{"hacked":true}'::jsonb;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_report := v_report || format(E'%s customer cannot write platform_settings (%s rows)
',
    CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END, v_count);

  BEGIN
    UPDATE public.orders SET total_amount = 1 WHERE id = v_order;
    v_report := v_report || format(E'FAIL customer changed order total
');
  EXCEPTION WHEN insufficient_privilege THEN
    v_report := v_report || format(E'PASS customer cannot change order total
');
  END;

  BEGIN
    UPDATE public.orders SET status = 'delivered' WHERE id = v_order;
    v_report := v_report || format(E'FAIL customer marked order delivered
');
  EXCEPTION WHEN insufficient_privilege THEN
    v_report := v_report || format(E'PASS customer cannot mark order delivered
');
  END;

  -- This order is 30 days away; v10_privacy_tests covers reporting on delivery day.
  BEGIN
    UPDATE public.orders SET status = 'unfulfilled' WHERE id = v_order;
    v_report := v_report || format(E'FAIL customer reported a problem before delivery day
');
  EXCEPTION WHEN insufficient_privilege THEN
    v_report := v_report || format(E'PASS customer cannot report a problem before delivery day
');
  END;

  BEGIN
    INSERT INTO public.orders (order_number, user_id, target_delivery_date, itn_verified_at)
    VALUES ('ATTACK-' || gen_random_uuid(), v_user, v_date, NOW())
    RETURNING id, itn_verified_at INTO v_order2, v_itn;
    v_report := v_report || format(E'%s customer cannot claim PayFast verification
', CASE WHEN v_itn IS NULL THEN 'PASS' ELSE 'FAIL' END);
  EXCEPTION WHEN insufficient_privilege THEN
    -- After v7 customers cannot insert orders at all.
    v_report := v_report || E'PASS customer cannot insert an order directly
';
  END;

  -- Anonymous visitors.
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'anon', true);
  BEGIN
    UPDATE public.platform_settings SET setting_value = '{"hacked":true}'::jsonb;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_report := v_report || format(E'%s anonymous cannot write platform_settings (%s rows)
',
      CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END, v_count);
  EXCEPTION WHEN insufficient_privilege THEN
    v_report := v_report || format(E'PASS anonymous cannot write platform_settings (denied)
');
  END;

  -- Admins must keep working.
  IF v_admin IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::TEXT, true);
    PERFORM set_config('role', 'authenticated', true);
    UPDATE public.orders SET status = 'delivered' WHERE id = v_order RETURNING status::TEXT INTO v_status;
    v_report := v_report || format(E'%s admin can still move an order
', CASE WHEN v_status = 'delivered' THEN 'PASS' ELSE 'FAIL' END);
    UPDATE public.profiles SET role = 'chef' WHERE id = v_user RETURNING role::TEXT INTO v_role;
    v_report := v_report || format(E'%s admin can still change a role
', CASE WHEN v_role = 'chef' THEN 'PASS' ELSE 'FAIL' END);
  ELSE
    v_report := v_report || format(E'SKIP no admin profile, admin checks not run
');
  END IF;

  -- Aborting undoes every change above and shows the report in any SQL client.
  RAISE EXCEPTION 'ATTACK TEST REPORT (all changes rolled back): %', v_report;
END$$;
