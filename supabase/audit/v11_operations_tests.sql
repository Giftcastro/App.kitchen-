-- YKC V11 TESTS. Ends by raising an error on purpose, which rolls back all test data.
-- The error text IS the report: every line should say PASS.

DO $$
DECLARE
  v_id TEXT := gen_random_uuid()::TEXT;
  v_co UUID; v_loc UUID; v_cust UUID; v_other UUID; v_chef UUID; v_admin UUID; v_gone UUID; v_busy UUID;
  v_today DATE := (NOW() AT TIME ZONE 'Africa/Johannesburg')::DATE;
  v_future DATE := CURRENT_DATE + 14;
  v_o1 UUID; v_o2 UUID; v_o3 UUID; v_o4 UUID; v_kept UUID; v_tick UUID;
  v_email TEXT := 'cust-' || v_id || '@x.example';
  v_gone_email TEXT := 'gone-' || v_id || '@x.example';
  v_r TEXT := E'\n'; v_n INT; v_txt TEXT; v_res JSONB; v_day TEXT; v_meal TEXT;
BEGIN
  WHILE EXTRACT(DOW FROM v_future) IN (0, 6)
     OR EXISTS (SELECT 1 FROM public.public_holidays WHERE holiday_date = v_future) LOOP
    v_future := v_future + 1;
  END LOOP;

  INSERT INTO public.companies (name, street_address, discount_value) VALUES ('Ops ' || v_id, 'x', 10) RETURNING id INTO v_co;
  INSERT INTO public.delivery_locations (company_id, location_name, building_name, street_address)
  VALUES (v_co, 'Site', 'Bldg', 's') RETURNING id INTO v_loc;
  INSERT INTO public.dropoff_floors (location_id, floor_label) VALUES (v_loc, 'Floor A');

  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), v_email, NOW()) RETURNING id INTO v_cust;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), 'other-' || v_id || '@x.example', NOW()) RETURNING id INTO v_other;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), 'chef-' || v_id || '@x.example', NOW()) RETURNING id INTO v_chef;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), v_gone_email, NOW()) RETURNING id INTO v_gone;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), 'busy-' || v_id || '@x.example', NOW()) RETURNING id INTO v_busy;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), 'adm-' || v_id || '@x.example', NOW()) RETURNING id INTO v_admin;
  UPDATE public.profiles SET role = 'chef' WHERE id = v_chef;
  UPDATE public.profiles SET role = 'admin' WHERE id = v_admin;
  UPDATE public.profiles SET company_id = v_co, location_name = 'Site', delivery_floor = 'Floor A', full_name = 'Test Person'
  WHERE id IN (v_cust, v_other, v_gone, v_busy);

  INSERT INTO public.orders (order_number, user_id, company_id, target_delivery_date, status) VALUES ('O1-' || v_id, v_cust, v_co, v_future, 'paid_scheduled') RETURNING id INTO v_o1;
  INSERT INTO public.orders (order_number, user_id, company_id, target_delivery_date, status) VALUES ('O2-' || v_id, v_cust, v_co, v_future, 'delivered') RETURNING id INTO v_o2;
  INSERT INTO public.orders (order_number, user_id, company_id, target_delivery_date, status) VALUES ('O3-' || v_id, v_busy, v_co, v_future, 'paid_scheduled') RETURNING id INTO v_o3;
  INSERT INTO public.orders (order_number, user_id, company_id, target_delivery_date, status, total_amount, rating_feedback)
  VALUES ('K-' || v_id, v_gone, v_co, v_future, 'delivered', 123.45, 'Personal comment') RETURNING id INTO v_kept;
  INSERT INTO public.order_items (order_id, dish_name, quantity, unit_price, total_price, allergy_notes)
  VALUES (v_kept, 'Dish', 1, 100, 100, 'Severe nut allergy');
  INSERT INTO public.broadcast_messages (title, message, target_audience, is_active)
  VALUES ('Private', 'x', 'User: Gone (' || v_gone_email || ')', TRUE);

  SELECT company_name_snapshot INTO v_txt FROM public.orders WHERE id = v_kept;
  v_r := v_r || format(E'%s order stores the company name\n', CASE WHEN v_txt = 'Ops ' || v_id THEN 'PASS' ELSE 'FAIL' END);

  -- Automatic 10:00 run only touches today's orders.
  UPDATE public.orders SET target_delivery_date = v_future WHERE id = v_o1;
  SELECT public.run_morning_dispatch() INTO v_n;
  SELECT count(*) INTO v_n FROM public.orders WHERE id = v_o1 AND status = 'paid_scheduled';
  v_r := v_r || format(E'%s automatic run leaves future orders alone\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);

  -- Dispatch rights.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cust, 'role', 'authenticated')::TEXT, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    PERFORM public.admin_mark_out_for_delivery(ARRAY[v_o1]);
    v_r := v_r || E'FAIL customer dispatched an order\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot dispatch\n'; END;
  BEGIN
    PERFORM public.run_morning_dispatch();
    v_r := v_r || E'FAIL customer ran the 10:00 job\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot run the 10:00 job\n'; END;
  BEGIN
    PERFORM public.anonymise_customer(v_other);
    v_r := v_r || E'FAIL customer deleted someone\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot delete anyone\n'; END;
  BEGIN
    PERFORM public.purge_expired_records();
    v_r := v_r || E'FAIL customer ran the purge\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot run the retention purge\n'; END;

  -- Complaints.
  INSERT INTO public.customer_complaints (user_id, body, category, order_id) VALUES (v_cust, 'Cold meal', 'quality', v_o2) RETURNING id INTO v_tick;
  SELECT count(*) INTO v_n FROM public.customer_complaints WHERE id = v_tick AND ticket_ref LIKE 'TCK-%';
  v_r := v_r || format(E'%s customer complaint is saved with a ticket\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  BEGIN
    INSERT INTO public.customer_complaints (user_id, body) VALUES (v_other, 'Forged');
    v_r := v_r || E'FAIL complaint forged for another person\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS complaint cannot be forged for someone else\n'; END;
  UPDATE public.customer_complaints SET status = 'resolved' WHERE id = v_tick;
  SELECT count(*) INTO v_n FROM public.customer_complaints WHERE id = v_tick AND status = 'open';
  v_r := v_r || format(E'%s customer cannot close their own complaint\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::TEXT, true);
  SELECT count(*) INTO v_n FROM public.customer_complaints WHERE id = v_tick;
  v_r := v_r || format(E'%s customer cannot read another complaint\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- Chef.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_chef, 'role', 'authenticated')::TEXT, true);
  SELECT count(*) INTO v_n FROM public.customer_complaints WHERE id = v_tick;
  v_r := v_r || format(E'%s chef can read complaints\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  UPDATE public.customer_complaints SET status = 'resolved' WHERE id = v_tick;
  SELECT count(*) INTO v_n FROM public.customer_complaints WHERE id = v_tick AND status = 'open';
  v_r := v_r || format(E'%s chef cannot change a complaint\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  BEGIN
    PERFORM public.admin_mark_out_for_delivery(ARRAY[v_o1]);
    v_r := v_r || E'FAIL chef dispatched an order\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS chef cannot dispatch\n'; END;

  -- Admin.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::TEXT, true);
  SELECT public.admin_mark_out_for_delivery(ARRAY[v_o1, v_o2]) INTO v_n;
  v_r := v_r || format(E'%s dispatch moves only undelivered orders (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);
  SELECT count(*) INTO v_n FROM public.orders WHERE id = v_o1 AND status = 'out_for_delivery' AND stage = 3;
  v_r := v_r || format(E'%s order is out for delivery\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.orders WHERE id = v_o2 AND status = 'delivered';
  v_r := v_r || format(E'%s delivered order is untouched\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE target_audience LIKE '%(' || v_email || ')';
  v_r := v_r || format(E'%s customer is notified once (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);
  PERFORM public.admin_mark_out_for_delivery(ARRAY[v_o1]);
  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE target_audience LIKE '%(' || v_email || ')';
  v_r := v_r || format(E'%s repeating does not notify again (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);

  UPDATE public.customer_complaints SET status = 'resolved', resolved_at = NOW() WHERE id = v_tick;
  SELECT count(*) INTO v_n FROM public.customer_complaints WHERE id = v_tick AND status = 'resolved';
  v_r := v_r || format(E'%s admin can resolve a complaint\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);

  -- Anonymisation.
  BEGIN
    PERFORM public.anonymise_customer(v_busy);
    v_r := v_r || E'FAIL deleted a customer with undelivered orders\n';
  EXCEPTION WHEN invalid_parameter_value THEN v_r := v_r || E'PASS customer with undelivered orders cannot be deleted\n'; END;
  BEGIN
    PERFORM public.anonymise_customer(v_chef);
    v_r := v_r || E'FAIL deleted a staff member\n';
  EXCEPTION WHEN invalid_parameter_value THEN v_r := v_r || E'PASS staff must be changed to customer first\n'; END;
  BEGIN
    PERFORM public.anonymise_customer(v_admin);
    v_r := v_r || E'FAIL admin deleted themselves\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS admin cannot delete themselves\n'; END;

  SELECT public.anonymise_customer(v_gone) INTO v_n;
  v_r := v_r || format(E'%s anonymise reports retained orders (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);

  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT count(*) INTO v_n FROM auth.users WHERE id = v_gone;
  v_r := v_r || format(E'%s sign-in account is gone\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.profiles WHERE id = v_gone;
  v_r := v_r || format(E'%s profile is gone\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.orders
  WHERE id = v_kept AND user_id IS NULL AND total_amount = 123.45 AND anonymised_at IS NOT NULL AND company_name_snapshot = 'Ops ' || v_id;
  v_r := v_r || format(E'%s order and amount are retained with no person linked\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.orders WHERE id = v_kept AND rating_feedback IS NULL;
  v_r := v_r || format(E'%s written feedback is removed\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.order_items WHERE order_id = v_kept AND allergy_notes IS NULL AND dish_name = 'Dish';
  v_r := v_r || format(E'%s allergy note is removed, meal retained\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE target_audience LIKE '%' || v_gone_email || '%';
  v_r := v_r || format(E'%s private messages naming them are removed\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.anonymisation_log WHERE orders_retained = 1 AND retain_until >= v_future + INTERVAL '5 years' - INTERVAL '1 day';
  v_r := v_r || format(E'%s anonymisation log records 5-year retention\n', CASE WHEN v_n >= 1 THEN 'PASS' ELSE 'FAIL' END);

  -- A direct database delete is scrubbed too.
  DELETE FROM auth.users WHERE id = v_busy;
  SELECT count(*) INTO v_n FROM public.orders WHERE id = v_o3 AND user_id IS NULL AND anonymised_at IS NOT NULL;
  v_r := v_r || format(E'%s direct delete also retains and anonymises\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);

  -- Retention purge.
  UPDATE public.orders SET target_delivery_date = v_future - INTERVAL '6 years' WHERE id = v_kept;
  PERFORM public.purge_expired_records();
  SELECT count(*) INTO v_n FROM public.orders WHERE id = v_kept;
  v_r := v_r || format(E'%s anonymised order older than 5 years is removed\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.orders WHERE id = v_o3;
  v_r := v_r || format(E'%s anonymised order within 5 years is kept\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);

  -- Chef's Choice names the dish in the plan.
  v_day := TRIM(TO_CHAR(v_future, 'Day'));
  IF NOT EXISTS (SELECT 1 FROM public.cycle_day_plans WHERE week_number = 1 AND day_name = v_day) THEN
    INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
    VALUES (1, v_day, 'Plan Main', 'v', 'h', 'c', 's');
  END IF;
  SELECT main_meal INTO v_meal FROM public.cycle_day_plans WHERE week_number = 1 AND day_name = v_day;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::TEXT, true);
  PERFORM set_config('role', 'authenticated', true);
  v_res := public.create_checkout(jsonb_build_object('floor', 'Floor A', 'dates', jsonb_build_array(jsonb_build_object(
    'date', v_future,
    'items', jsonb_build_array(jsonb_build_object('menuItemId', 'chef_1_' || v_day || '_main', 'size', 'standard', 'quantity', 1, 'addOns', '[]'::jsonb))
  ))));
  PERFORM set_config('role', 'postgres', true);
  SELECT count(*) INTO v_n FROM public.order_items i JOIN public.orders o ON o.id = i.order_id
  WHERE o.payment_intent_id = (v_res ->> 'intentId')::UUID AND i.dish_name LIKE '%' || v_meal || '%';
  v_r := v_r || format(E'%s Chef''s Choice order names the planned dish (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_meal);

  RAISE EXCEPTION '%', v_r;
END$$;
