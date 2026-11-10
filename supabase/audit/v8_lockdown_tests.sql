-- YKC V8 LOCKDOWN TESTS. Ends by raising an error on purpose, which rolls back all test data.
-- The error text IS the report: every line should say PASS.

DO $$
DECLARE
  v_a UUID; v_b UUID; v_cust UUID; v_new UUID; v_chef UUID; v_admin UUID;
  v_loc1 UUID; v_loc2 UUID; v_date DATE := CURRENT_DATE + 14; v_order UUID;
  v_r TEXT := E'\n'; v_n INT; v_txt TEXT; v_res JSONB; v_dir JSONB; v_id TEXT := gen_random_uuid()::TEXT;
BEGIN
  WHILE EXTRACT(DOW FROM v_date) IN (0, 6)
     OR EXISTS (SELECT 1 FROM public.public_holidays WHERE holiday_date = v_date) LOOP
    v_date := v_date + 1;
  END LOOP;

  INSERT INTO public.companies (name, street_address, discount_type, discount_value, distance_km)
  VALUES ('Test A ' || v_id, 'x', 'percentage', 10, 8) RETURNING id INTO v_a;
  INSERT INTO public.companies (name, street_address, discount_value)
  VALUES ('Test B ' || v_id, 'y', 50) RETURNING id INTO v_b;
  INSERT INTO public.delivery_locations (company_id, location_name, building_name, street_address)
  VALUES (v_a, 'Site One', 'Bldg 1', 's1') RETURNING id INTO v_loc1;
  INSERT INTO public.delivery_locations (company_id, location_name, building_name, street_address)
  VALUES (v_a, 'Site Two', 'Bldg 2', 's2') RETURNING id INTO v_loc2;
  INSERT INTO public.dropoff_floors (location_id, floor_label) VALUES (v_loc1, 'Floor A'), (v_loc2, 'Floor B');

  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), 'cust-' || v_id || '@gmail.example', NOW()) RETURNING id INTO v_cust;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), 'new-' || v_id || '@gmail.example', NOW()) RETURNING id INTO v_new;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), 'chef-' || v_id || '@example.com', NOW()) RETURNING id INTO v_chef;
  UPDATE public.profiles SET role = 'chef' WHERE id = v_chef;
  SELECT id INTO v_admin FROM public.profiles WHERE role = 'admin' LIMIT 1;
  UPDATE public.profiles SET company_id = v_a, location_name = 'Site One', delivery_floor = 'Floor A' WHERE id = v_cust;
  INSERT INTO public.menu_categories (id, name, slug) VALUES ('cat_' || v_id, 'T', 'slug-' || v_id);
  INSERT INTO public.menu_items (id, category_id, name, price_regular) VALUES ('item_' || v_id, 'cat_' || v_id, 'Dish', 100);
  INSERT INTO public.orders (order_number, user_id, target_delivery_date) VALUES ('T-' || v_id, v_cust, v_date) RETURNING id INTO v_order;

  -- Signed-out visitor
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'anon', true);
  BEGIN
    SELECT count(*) INTO v_n FROM public.companies;
    v_r := v_r || E'FAIL anonymous read companies\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS anonymous cannot read companies\n'; END;
  BEGIN
    SELECT count(*) INTO v_n FROM public.menu_items;
    v_r := v_r || E'FAIL anonymous read menu\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS anonymous cannot read menu\n'; END;
  BEGIN
    v_dir := public.signup_company_directory();
    v_r := v_r || E'FAIL anonymous called the company directory\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS anonymous cannot call the company directory\n'; END;

  -- Bound customer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cust, 'role', 'authenticated')::TEXT, true);
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    UPDATE public.profiles SET company_id = v_b WHERE id = v_cust;
    v_r := v_r || E'FAIL customer switched company\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot switch company\n'; END;
  BEGIN
    UPDATE public.profiles SET company_id = NULL WHERE id = v_cust;
    v_r := v_r || E'FAIL customer cleared company\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot clear company\n'; END;
  BEGIN
    UPDATE public.profiles SET location_name = '12 My Own Street' WHERE id = v_cust;
    v_r := v_r || E'FAIL customer set own address\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot set own address\n'; END;
  BEGIN
    UPDATE public.profiles SET delivery_floor = 'My House' WHERE id = v_cust;
    v_r := v_r || E'FAIL customer set own drop-off point\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot invent a drop-off point\n'; END;

  UPDATE public.profiles SET building_name = 'Fake Building' WHERE id = v_cust;
  SELECT building_name INTO v_txt FROM public.profiles WHERE id = v_cust;
  v_r := v_r || format(E'%s building name cannot be forged\n', CASE WHEN v_txt IS DISTINCT FROM 'Fake Building' THEN 'PASS' ELSE 'FAIL' END);

  UPDATE public.profiles SET location_name = 'Site Two', delivery_floor = 'Floor B' WHERE id = v_cust;
  SELECT building_name INTO v_txt FROM public.profiles WHERE id = v_cust;
  v_r := v_r || format(E'%s customer can pick another branch of their company (%s)\n', CASE WHEN v_txt = 'Bldg 2' THEN 'PASS' ELSE 'FAIL' END, v_txt);

  SELECT count(*) INTO v_n FROM public.companies WHERE id = v_b;
  v_r := v_r || format(E'%s customer cannot see another company (%s)\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END, v_n);
  SELECT count(*) INTO v_n FROM public.platform_settings;
  v_r := v_r || format(E'%s customer cannot read platform settings (%s)\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END, v_n);
  v_dir := public.signup_company_directory();
  v_r := v_r || format(E'%s bound customer gets no directory\n', CASE WHEN jsonb_array_length(v_dir) = 0 THEN 'PASS' ELSE 'FAIL' END);

  v_res := public.create_checkout(jsonb_build_object('floor', 'My House', 'dates', jsonb_build_array(
    jsonb_build_object('date', v_date, 'items', jsonb_build_array(jsonb_build_object('menuItemId', 'item_' || v_id, 'quantity', 1))))));
  v_r := v_r || format(E'%s personal email gets the company discount: 190 (got %s)\n',
    CASE WHEN (v_res ->> 'amount')::NUMERIC = 190 THEN 'PASS' ELSE 'FAIL' END, v_res ->> 'amount');
  SELECT delivery_floor INTO v_txt FROM public.orders WHERE payment_intent_id = (v_res ->> 'intentId')::UUID;
  v_r := v_r || format(E'%s checkout ignores an invented drop-off (%s)\n', CASE WHEN v_txt <> 'My House' THEN 'PASS' ELSE 'FAIL' END, v_txt);

  BEGIN
    PERFORM public.confirm_payfast_payment((v_res ->> 'intentId')::UUID, 'x', 190, 'COMPLETE', '{}');
    v_r := v_r || E'FAIL customer confirmed a payment\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot confirm a payment\n'; END;

  -- New user who has signed in but not chosen a company yet
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_new, 'role', 'authenticated')::TEXT, true);
  v_dir := public.signup_company_directory();
  v_txt := v_dir::TEXT;
  v_r := v_r || format(E'%s sign-up directory has companies but no discounts or billing\n',
    CASE WHEN jsonb_array_length(v_dir) > 0 AND v_txt NOT LIKE '%discount%' AND v_txt NOT LIKE '%billing%' THEN 'PASS' ELSE 'FAIL' END);
  BEGIN
    UPDATE public.profiles SET company_id = v_a, location_name = 'Somewhere Else' WHERE id = v_new;
    v_r := v_r || E'FAIL registered at a site outside the company\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS registration needs a real company site\n'; END;
  UPDATE public.profiles SET company_id = v_a, location_name = 'Site One • Bldg 1', delivery_floor = 'nonsense' WHERE id = v_new;
  SELECT count(*) INTO v_n FROM public.profiles
  WHERE id = v_new AND delivery_location_id = v_loc1 AND delivery_floor = 'Floor A';
  v_r := v_r || format(E'%s registration binds the real site and floor (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);
  BEGIN
    UPDATE public.profiles SET company_id = v_b WHERE id = v_new;
    v_r := v_r || E'FAIL company changed after registration\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS company is fixed after registration\n'; END;

  -- Chef: reads and exports, changes nothing
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_chef, 'role', 'authenticated')::TEXT, true);
  SELECT count(*) INTO v_n FROM public.orders WHERE id = v_order;
  v_r := v_r || format(E'%s chef can read orders for exports (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);
  SELECT count(*) INTO v_n FROM public.companies WHERE id = v_b;
  v_r := v_r || format(E'%s chef can read companies (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);
  UPDATE public.orders SET status = 'delivered' WHERE id = v_order;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_r := v_r || format(E'%s chef cannot change orders (%s rows)\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END, v_n);
  UPDATE public.menu_items SET price_regular = 1 WHERE id = 'item_' || v_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_r := v_r || format(E'%s chef cannot change the menu (%s rows)\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END, v_n);
  DELETE FROM public.menu_items WHERE id = 'item_' || v_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_r := v_r || format(E'%s chef cannot delete the menu (%s rows)\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END, v_n);
  BEGIN
    INSERT INTO public.companies (name, street_address) VALUES ('Chef Co ' || v_id, 'z');
    v_r := v_r || E'FAIL chef created a company\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS chef cannot create a company\n'; END;
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = v_chef;
    v_r := v_r || E'FAIL chef promoted themselves\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS chef cannot become admin\n'; END;
  UPDATE public.profiles SET role = 'user' WHERE id = v_cust;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_r := v_r || format(E'%s chef cannot edit other users (%s rows)\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END, v_n);

  -- Admin keeps full control
  IF v_admin IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::TEXT, true);
    UPDATE public.menu_items SET price_regular = 120 WHERE id = 'item_' || v_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_r := v_r || format(E'%s admin can edit the menu (%s rows)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);
    UPDATE public.profiles SET company_id = v_b WHERE id = v_cust;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_r := v_r || format(E'%s admin can correct a customer''s company (%s rows)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);
  ELSE
    v_r := v_r || E'SKIP no admin profile, admin checks not run\n';
  END IF;

  -- Aborting undoes every change above and shows the report in any SQL client.
  RAISE EXCEPTION 'LOCKDOWN TEST REPORT (all changes rolled back): %', v_r;
END$$;
