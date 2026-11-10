-- YKC V9 SIGN-UP TESTS. Ends by raising an error on purpose, which rolls back all test data.
-- The error text IS the report: every line should say PASS.

DO $$
DECLARE
  v_co UUID; v_loc UUID; v_id TEXT := gen_random_uuid()::TEXT;
  v_typed UUID; v_confirmed UUID; v_oauth UUID;
  v_stale UUID; v_fresh UUID; v_unfinished UUID; v_recent UUID; v_bound UUID; v_chef UUID; v_buyer UUID; v_other UUID;
  v_r TEXT := E'\n'; v_n INT;
  v_p public.profiles%ROWTYPE;
BEGIN
  INSERT INTO public.companies (name, street_address) VALUES ('Sign-up test ' || v_id, 'x') RETURNING id INTO v_co;

  -- Typing an email creates no profile.
  INSERT INTO auth.users (id, email, raw_user_meta_data, created_at)
  VALUES (gen_random_uuid(), 'typed-' || v_id || '@gmail.example',
          json_build_object('company_id', v_co, 'phone_number', '+27 00 000 0000', 'location_name', 'Forged', 'role', 'admin')::jsonb,
          NOW())
  RETURNING id INTO v_typed;
  SELECT count(*) INTO v_n FROM public.profiles WHERE id = v_typed;
  v_r := v_r || format(E'%s unconfirmed email creates no profile (%s)\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END, v_n);

  -- Confirming creates an empty one, ignoring everything the client sent.
  UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = v_typed;
  SELECT * INTO v_p FROM public.profiles WHERE id = v_typed;
  v_r := v_r || format(E'%s confirming creates the profile\n', CASE WHEN v_p.id IS NOT NULL THEN 'PASS' ELSE 'FAIL' END);
  v_r := v_r || format(E'%s phone stays empty (%s)\n', CASE WHEN v_p.phone_number IS NULL THEN 'PASS' ELSE 'FAIL' END, v_p.phone_number);
  v_r := v_r || format(E'%s location, building and floor stay empty\n',
    CASE WHEN v_p.location_name IS NULL AND v_p.building_name IS NULL AND v_p.delivery_floor IS NULL THEN 'PASS' ELSE 'FAIL' END);
  v_r := v_r || format(E'%s company from sign-up metadata is ignored\n', CASE WHEN v_p.company_id IS NULL THEN 'PASS' ELSE 'FAIL' END);
  v_r := v_r || format(E'%s role from sign-up metadata is ignored (%s)\n', CASE WHEN v_p.role = 'user' THEN 'PASS' ELSE 'FAIL' END, v_p.role);

  -- A second confirmation-type update must not change an existing profile.
  UPDATE public.profiles SET phone_number = '+27 71 000 0000' WHERE id = v_typed;
  UPDATE auth.users SET email_confirmed_at = NULL WHERE id = v_typed;
  UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = v_typed;
  SELECT count(*) INTO v_n FROM public.profiles WHERE id = v_typed AND phone_number = '+27 71 000 0000';
  v_r := v_r || format(E'%s reconfirming leaves the profile alone (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);

  -- Google and Apple accounts arrive already confirmed.
  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at)
  VALUES (gen_random_uuid(), 'oauth-' || v_id || '@gmail.example', '{"full_name":"Google Person"}'::jsonb, NOW(), NOW())
  RETURNING id INTO v_oauth;
  SELECT count(*) INTO v_n FROM public.profiles WHERE id = v_oauth AND full_name = 'Google Person' AND phone_number IS NULL;
  v_r := v_r || format(E'%s already-confirmed account gets a profile with its name (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);

  -- Purge fixtures.
  INSERT INTO auth.users (id, email, created_at) VALUES (gen_random_uuid(), 'stale-' || v_id || '@x.example', NOW() - INTERVAL '25 hours') RETURNING id INTO v_stale;
  INSERT INTO auth.users (id, email, created_at) VALUES (gen_random_uuid(), 'fresh-' || v_id || '@x.example', NOW() - INTERVAL '1 hour') RETURNING id INTO v_fresh;
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES (gen_random_uuid(), 'unfinished-' || v_id || '@x.example', NOW(), NOW() - INTERVAL '8 days') RETURNING id INTO v_unfinished;
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES (gen_random_uuid(), 'recent-' || v_id || '@x.example', NOW(), NOW() - INTERVAL '6 days') RETURNING id INTO v_recent;
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES (gen_random_uuid(), 'bound-' || v_id || '@x.example', NOW(), NOW() - INTERVAL '30 days') RETURNING id INTO v_bound;
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES (gen_random_uuid(), 'chef-' || v_id || '@x.example', NOW(), NOW() - INTERVAL '30 days') RETURNING id INTO v_chef;
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES (gen_random_uuid(), 'buyer-' || v_id || '@x.example', NOW(), NOW() - INTERVAL '30 days') RETURNING id INTO v_buyer;
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES (gen_random_uuid(), 'other-' || v_id || '@x.example', NOW(), NOW()) RETURNING id INTO v_other;
  UPDATE public.profiles SET company_id = v_co WHERE id = v_bound;
  UPDATE public.profiles SET role = 'chef' WHERE id = v_chef;
  INSERT INTO public.orders (order_number, user_id, target_delivery_date) VALUES ('S-' || v_id, v_buyer, CURRENT_DATE + 30);

  PERFORM public.purge_abandoned_signups();

  SELECT count(*) INTO v_n FROM auth.users WHERE id = v_stale;
  v_r := v_r || format(E'%s unconfirmed after 24 hours is removed\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM auth.users WHERE id = v_fresh;
  v_r := v_r || format(E'%s unconfirmed for 1 hour is kept\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM auth.users WHERE id = v_unfinished;
  v_r := v_r || format(E'%s confirmed, no company, 8 days inactive is removed\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM auth.users WHERE id = v_recent;
  v_r := v_r || format(E'%s confirmed, no company, 6 days inactive is kept\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM auth.users WHERE id = v_bound;
  v_r := v_r || format(E'%s registered customer is kept\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM auth.users WHERE id = v_chef;
  v_r := v_r || format(E'%s staff with no company is kept\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM auth.users WHERE id = v_buyer;
  v_r := v_r || format(E'%s account with an order is kept\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);

  -- Signed-in callers cannot run the purge.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_bound, 'role', 'authenticated')::TEXT, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    PERFORM public.purge_abandoned_signups();
    v_r := v_r || E'FAIL customer ran the purge\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot run the purge\n'; END;

  -- Chefs cannot change anyone else's profile.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_chef, 'role', 'authenticated')::TEXT, true);
  UPDATE public.profiles SET full_name = 'Changed by chef' WHERE id = v_other;
  SELECT count(*) INTO v_n FROM public.profiles WHERE id = v_other AND full_name = 'Changed by chef';
  v_r := v_r || format(E'%s chef cannot edit another profile (%s)\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END, v_n);
  UPDATE public.profiles SET full_name = 'Chef Own' WHERE id = v_chef;
  SELECT count(*) INTO v_n FROM public.profiles WHERE id = v_chef AND full_name = 'Chef Own';
  v_r := v_r || format(E'%s chef can edit own profile (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);

  RAISE EXCEPTION '%', v_r;
END$$;
