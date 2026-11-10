-- YKC V10 PRIVACY AND ORDER RULE TESTS. Ends by raising an error on purpose, which rolls back all test data.
-- The error text IS the report: every line should say PASS.

DO $$
DECLARE
  v_id TEXT := gen_random_uuid()::TEXT;
  v_co UUID; v_other_co UUID; v_me UUID; v_other UUID; v_chef UUID;
  v_future DATE := CURRENT_DATE + 30;
  v_past DATE := CURRENT_DATE - 1;
  v_future_order UUID; v_past_order UUID; v_delivered UUID;
  v_me_email TEXT := 'me-' || v_id || '@x.example';
  v_other_email TEXT := 'other-' || v_id || '@x.example';
  v_co_name TEXT := 'Privacy A ' || v_id;
  v_r TEXT := E'\n'; v_n INT;
BEGIN
  WHILE EXTRACT(DOW FROM v_future) IN (0, 6)
     OR EXISTS (SELECT 1 FROM public.public_holidays WHERE holiday_date = v_future) LOOP
    v_future := v_future + 1;
  END LOOP;
  WHILE EXTRACT(DOW FROM v_past) IN (0, 6)
     OR EXISTS (SELECT 1 FROM public.public_holidays WHERE holiday_date = v_past) LOOP
    v_past := v_past - 1;
  END LOOP;

  INSERT INTO public.companies (name, street_address) VALUES (v_co_name, 'x') RETURNING id INTO v_co;
  INSERT INTO public.companies (name, street_address) VALUES ('Privacy B ' || v_id, 'y') RETURNING id INTO v_other_co;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), v_me_email, NOW()) RETURNING id INTO v_me;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), v_other_email, NOW()) RETURNING id INTO v_other;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (gen_random_uuid(), 'chef-' || v_id || '@x.example', NOW()) RETURNING id INTO v_chef;
  UPDATE public.profiles SET company_id = v_co WHERE id = v_me;
  UPDATE public.profiles SET company_id = v_other_co WHERE id = v_other;
  UPDATE public.profiles SET role = 'chef' WHERE id = v_chef;

  INSERT INTO public.orders (order_number, user_id, target_delivery_date, status) VALUES ('P1-' || v_id, v_me, v_future, 'paid_scheduled') RETURNING id INTO v_future_order;
  INSERT INTO public.orders (order_number, user_id, target_delivery_date, status) VALUES ('P2-' || v_id, v_me, v_past, 'paid_scheduled') RETURNING id INTO v_past_order;
  INSERT INTO public.orders (order_number, user_id, target_delivery_date, status) VALUES ('P3-' || v_id, v_me, v_past, 'delivered') RETURNING id INTO v_delivered;

  DELETE FROM public.broadcast_messages WHERE title LIKE 'T-%';
  INSERT INTO public.broadcast_messages (title, message, target_audience, is_active) VALUES
    ('T-all', 'x', 'All Companies', TRUE),
    ('T-mine', 'x', 'User: Me (' || v_me_email || ')', TRUE),
    ('T-theirs', 'x', 'User: Them (' || v_other_email || ')', TRUE),
    ('T-co', 'x', v_co_name, TRUE),
    ('T-otherco', 'x', 'Privacy B ' || v_id, TRUE),
    ('T-date', 'x', 'Active Clients (' || v_future || ')', TRUE),
    ('T-nodate', 'x', 'Active Clients (' || (v_future + 7) || ')', TRUE);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::TEXT, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE title = 'T-all';
  v_r := v_r || format(E'%s customer sees a message to everyone\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE title = 'T-mine';
  v_r := v_r || format(E'%s customer sees their own private message\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE title = 'T-theirs';
  v_r := v_r || format(E'%s customer cannot read another customer''s message\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE title = 'T-co';
  v_r := v_r || format(E'%s customer sees their company''s message\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE title = 'T-otherco';
  v_r := v_r || format(E'%s customer cannot read another company''s message\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE title = 'T-date';
  v_r := v_r || format(E'%s customer with an order that day gets the delivery-day message\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE title = 'T-nodate';
  v_r := v_r || format(E'%s customer without an order that day does not\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END);

  BEGIN
    UPDATE public.orders SET rating_score = 5 WHERE id = v_future_order;
    v_r := v_r || E'FAIL customer rated an undelivered order\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot rate an undelivered order\n'; END;

  UPDATE public.orders SET rating_score = 4, rating_feedback = 'Good', rated_at = NOW() WHERE id = v_delivered;
  SELECT count(*) INTO v_n FROM public.orders WHERE id = v_delivered AND rating_score = 4;
  v_r := v_r || format(E'%s customer can rate a delivered order\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END);

  BEGIN
    UPDATE public.orders SET status = 'unfulfilled', is_disputed = TRUE WHERE id = v_future_order;
    v_r := v_r || E'FAIL customer reported a problem before delivery day\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer cannot report a problem before delivery day\n'; END;

  UPDATE public.orders SET status = 'unfulfilled', is_disputed = TRUE, dispute_reason = 'Missing' WHERE id = v_past_order;
  SELECT count(*) INTO v_n FROM public.orders WHERE id = v_past_order AND status = 'unfulfilled';
  v_r := v_r || format(E'%s customer can report a problem from delivery day (%s)\n', CASE WHEN v_n = 1 THEN 'PASS' ELSE 'FAIL' END, v_n);

  BEGIN
    UPDATE public.orders SET total_amount = 1 WHERE id = v_delivered;
    v_r := v_r || E'FAIL customer changed a total\n';
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS customer still cannot change a total\n'; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_chef, 'role', 'authenticated')::TEXT, true);
  SELECT count(*) INTO v_n FROM public.broadcast_messages WHERE title LIKE 'T-%';
  v_r := v_r || format(E'%s staff see every message (%s)\n', CASE WHEN v_n = 7 THEN 'PASS' ELSE 'FAIL' END, v_n);

  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'anon', true);
  BEGIN
    SELECT count(*) INTO v_n FROM public.broadcast_messages;
    v_r := v_r || format(E'%s signed-out visitor reads no messages (%s)\n', CASE WHEN v_n = 0 THEN 'PASS' ELSE 'FAIL' END, v_n);
  EXCEPTION WHEN insufficient_privilege THEN v_r := v_r || E'PASS signed-out visitor reads no messages\n'; END;

  RAISE EXCEPTION '%', v_r;
END$$;
