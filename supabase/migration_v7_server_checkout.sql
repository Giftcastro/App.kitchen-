-- =====================================================================
-- YOUR KITCHEN CO. (YKC) - MIGRATION V7: SERVER-SIDE CHECKOUT (IDEMPOTENT)
-- Requires v6.
--
-- DEPLOY ORDER MATTERS. This removes customers' direct INSERT on orders.
-- Apply only when the payfast-create-payment and payfast-itn functions are
-- deployed and the client from this branch is in use, or checkout will fail.
--
-- Adds:
--   1. payment_intents: one PayFast payment covering one or more orders
--   2. create_checkout(): prices, validates and creates pending orders
--   3. confirm_payfast_payment(): the only path that marks an order paid
--   4. Suspended users blocked at the database
--   5. app_error_logs: first-party client error monitoring
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'amount_mismatch')),
  pf_payment_id TEXT UNIQUE,
  raw_itn JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON public.payment_intents(user_id, created_at DESC);
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_intent_id UUID REFERENCES public.payment_intents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON public.orders(payment_intent_id);

DROP POLICY IF EXISTS "payment_intents_select_own" ON public.payment_intents;
CREATE POLICY "payment_intents_select_own"
  ON public.payment_intents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_staff());
-- No write policies: only the SECURITY DEFINER functions below can write.

-- SAST has no daylight saving, so this zone is stable year-round.
CREATE OR REPLACE FUNCTION public.order_cutoff_for(p_delivery DATE)
RETURNS TIMESTAMP
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day DATE := p_delivery;
  v_left INT := 2;
BEGIN
  -- Mirrors calculateCutoffDate in src/utils/sastTime.ts.
  WHILE v_left > 0 LOOP
    v_day := v_day - 1;
    IF EXTRACT(DOW FROM v_day) NOT IN (0, 6) THEN
      v_left := v_left - 1;
    END IF;
  END LOOP;
  RETURN v_day + TIME '09:00';
END;
$$;

-- Replaces the v6 guard: a customer's own unpaid order may also expire to cancelled.
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
     AND NOT (NEW.status::TEXT = 'unfulfilled' AND OLD.status::TEXT <> 'pending_payment')
     AND NOT (NEW.status::TEXT = 'cancelled' AND OLD.status::TEXT = 'pending_payment') THEN
    RAISE EXCEPTION 'Customers cannot set order status to %', NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
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

CREATE OR REPLACE FUNCTION public.create_checkout(p_cart JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_chef_price CONSTANT NUMERIC := 80.00; -- Mirrors getChefsChoiceDishesForDate
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_company JSONB;
  v_company_id UUID;
  v_now_sast TIMESTAMP := NOW() AT TIME ZONE 'Africa/Johannesburg';
  v_floor TEXT;
  v_intent UUID;
  v_grand NUMERIC := 0;
  v_numbers JSONB := '[]'::jsonb;
  v_date_obj JSONB;
  v_item JSONB;
  v_addon JSONB;
  v_date DATE;
  v_order UUID;
  v_number TEXT;
  v_subtotal NUMERIC;
  v_discount_type TEXT;
  v_discount_value NUMERIC;
  v_discount NUMERIC;
  v_fee NUMERIC;
  v_distance NUMERIC;
  v_total NUMERIC;
  v_item_id TEXT;
  v_size TEXT;
  v_qty INT;
  v_unit NUMERIC;
  v_name TEXT;
  v_category_addons JSONB;
  v_selected JSONB;
  v_addon_price NUMERIC;
  v_parts TEXT[];
  v_menu public.menu_items%ROWTYPE;
  v_item_count INT := 0;
  v_lines JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to place an order' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND OR v_profile.is_suspended THEN
    RAISE EXCEPTION 'This account cannot place orders' USING ERRCODE = '42501';
  END IF;
  IF v_profile.company_id IS NULL THEN
    RAISE EXCEPTION 'Choose your company drop-off before ordering' USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(c) INTO v_company FROM public.companies c
  WHERE c.id = v_profile.company_id AND c.is_active;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Your company is not active for ordering' USING ERRCODE = '22023';
  END IF;
  v_company_id := v_profile.company_id;

  IF jsonb_typeof(p_cart -> 'dates') <> 'array'
     OR jsonb_array_length(p_cart -> 'dates') NOT BETWEEN 1 AND 15 THEN
    RAISE EXCEPTION 'Invalid cart' USING ERRCODE = '22023';
  END IF;

  -- Delivery only ever goes to one of the customer's company sites.
  v_floor := NULLIF(TRIM(p_cart ->> 'floor'), '');
  IF v_floor IS NULL OR NOT public.is_valid_company_dropoff(v_company_id, v_floor) THEN
    v_floor := v_profile.delivery_floor;
  END IF;

  -- Stops one account flooding the kitchen and PayFast with unpaid checkouts.
  IF (SELECT COUNT(*) FROM public.payment_intents
      WHERE user_id = v_uid AND status = 'pending' AND created_at > NOW() - INTERVAL '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'Too many checkout attempts. Please wait a few minutes.' USING ERRCODE = '22023';
  END IF;

  -- Abandoned checkouts expire so they never reach the kitchen.
  UPDATE public.orders SET status = 'cancelled', updated_at = NOW()
  WHERE status = 'pending_payment' AND payment_intent_id IN (
    SELECT id FROM public.payment_intents
    WHERE user_id = v_uid AND status = 'pending' AND created_at < NOW() - INTERVAL '60 minutes'
  );
  UPDATE public.payment_intents SET status = 'cancelled', completed_at = NOW()
  WHERE user_id = v_uid AND status = 'pending' AND created_at < NOW() - INTERVAL '60 minutes';

  -- The real amount is set below, once every order has been priced.
  INSERT INTO public.payment_intents (user_id, amount) VALUES (v_uid, 0.01) RETURNING id INTO v_intent;

  FOR v_date_obj IN SELECT * FROM jsonb_array_elements(p_cart -> 'dates') LOOP
    v_date := (v_date_obj ->> 'date')::DATE;

    IF v_date > (v_now_sast::DATE + 31) THEN
      RAISE EXCEPTION 'Delivery date is too far ahead' USING ERRCODE = '22023';
    END IF;
    IF v_now_sast >= public.order_cutoff_for(v_date) THEN
      RAISE EXCEPTION 'The ordering cutoff for % has passed', v_date USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_date_obj -> 'items') <> 'array'
       OR jsonb_array_length(v_date_obj -> 'items') = 0 THEN
      RAISE EXCEPTION 'Invalid cart' USING ERRCODE = '22023';
    END IF;

    v_number := 'ORD-' || TO_CHAR(v_now_sast, 'YYYY') || '-'
      || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)) || '-KCO';

    -- Lines are priced first so the order row is inserted once, complete.
    v_subtotal := 0;
    v_lines := '[]'::jsonb;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_date_obj -> 'items') LOOP
      v_item_count := v_item_count + 1;
      IF v_item_count > 100 THEN
        RAISE EXCEPTION 'Cart is too large' USING ERRCODE = '22023';
      END IF;

      v_item_id := v_item ->> 'menuItemId';
      v_size := COALESCE(v_item ->> 'size', 'standard');
      v_qty := (v_item ->> 'quantity')::INT;
      IF v_qty IS NULL OR v_qty NOT BETWEEN 1 AND 50 OR v_size NOT IN ('standard', 'large') THEN
        RAISE EXCEPTION 'Invalid quantity or size' USING ERRCODE = '22023';
      END IF;

      v_selected := '[]'::jsonb;

      IF v_item_id LIKE 'chef\_%' THEN
        -- Format: chef_<week>_<Weekday>_<slot>. The price is fixed server-side.
        v_parts := string_to_array(v_item_id, '_');
        IF array_length(v_parts, 1) <> 4
           OR v_parts[2] !~ '^[1-8]$'
           OR v_parts[3] <> TRIM(TO_CHAR(v_date, 'Day')) THEN
          RAISE EXCEPTION 'Chef''s Choice item does not match its delivery date' USING ERRCODE = '22023';
        END IF;
        v_name := CASE v_parts[4]
          WHEN 'main' THEN 'Chef’s Main Meal of the Day'
          WHEN 'veg' THEN 'Chef’s Vegetarian Meal of the Day'
          WHEN 'healthy' THEN 'Chef’s Health Meal of the Day'
          WHEN 'curry' THEN 'Curry of the Day'
          WHEN 'sandwich' THEN 'Gourmet Sandwich of the Day'
        END;
        IF v_name IS NULL THEN
          RAISE EXCEPTION 'Unknown Chef''s Choice item' USING ERRCODE = '22023';
        END IF;
        v_unit := c_chef_price;
        v_item_id := NULL;
        SELECT add_ons INTO v_category_addons FROM public.menu_categories WHERE id = 'cat_chefs_choice';
      ELSE
        SELECT * INTO v_menu FROM public.menu_items WHERE id = v_item_id AND is_available;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'A meal in your cart is no longer available' USING ERRCODE = '22023';
        END IF;
        IF v_size = 'large' AND v_menu.price_large IS NULL THEN
          RAISE EXCEPTION '% has no large size', v_menu.name USING ERRCODE = '22023';
        END IF;
        v_name := v_menu.name;
        v_unit := CASE WHEN v_size = 'large' THEN v_menu.price_large ELSE v_menu.price_regular END;
        SELECT add_ons INTO v_category_addons FROM public.menu_categories WHERE id = v_menu.category_id;
      END IF;

      -- Add-on prices always come from the category, never the client.
      FOR v_addon IN SELECT * FROM jsonb_array_elements(COALESCE(v_item -> 'addOns', '[]'::jsonb)) LOOP
        SELECT (a ->> 'price')::NUMERIC INTO v_addon_price
        FROM jsonb_array_elements(COALESCE(v_category_addons, '[]'::jsonb)) a
        WHERE a ->> 'name' = v_addon #>> '{}'
        LIMIT 1;
        IF v_addon_price IS NULL THEN
          RAISE EXCEPTION 'Unknown add-on: %', LEFT(v_addon #>> '{}', 60) USING ERRCODE = '22023';
        END IF;
        v_unit := v_unit + v_addon_price;
        v_selected := v_selected || jsonb_build_object('name', v_addon #>> '{}', 'price', v_addon_price);
      END LOOP;

      v_lines := v_lines || jsonb_build_object(
        'menu_item_id', v_item_id, 'dish_name', v_name, 'size', v_size, 'quantity', v_qty,
        'unit_price', v_unit, 'total_price', v_unit * v_qty, 'selected_add_ons', v_selected,
        'allergy_notes', NULLIF(LEFT(TRIM(v_item ->> 'allergyNotes'), 500), '')
      );

      v_subtotal := v_subtotal + (v_unit * v_qty);
    END LOOP;

    -- Delivery fee: mirrors getActiveDateTotals. Column names differ by schema version.
    v_distance := COALESCE((v_company ->> 'distance_km')::NUMERIC, 8);
    v_fee := CASE COALESCE(v_company ->> 'delivery_fee_mode', 'distance')
      WHEN 'free' THEN 0
      WHEN 'flat' THEN COALESCE((v_company ->> 'flat_fee_amount')::NUMERIC, (v_company ->> 'flat_fee_zar')::NUMERIC, 20)
      ELSE CASE WHEN v_distance <= 15 THEN 100 WHEN v_distance <= 20 THEN 140 WHEN v_distance <= 30 THEN 200 ELSE 350 END
    END;

    v_discount_type := COALESCE(v_company ->> 'discount_type', 'percentage');
    v_discount_value := GREATEST(COALESCE((v_company ->> 'discount_value')::NUMERIC, 0), 0);
    v_discount := ROUND(CASE WHEN v_discount_type = 'fixed_zar'
      THEN LEAST(v_subtotal, v_discount_value)
      ELSE v_subtotal * LEAST(v_discount_value, 100) / 100 END, 2);
    v_total := ROUND(GREATEST(v_subtotal - v_discount, 0) + v_fee, 2);

    -- The holiday and weekend trigger on orders also fires on this insert.
    INSERT INTO public.orders (
      order_number, user_id, company_id, target_delivery_date, delivery_date_formatted,
      delivery_floor, company_location, status, stage, payment_method, payment_reference,
      payment_intent_id, tax_invoice_number, item_subtotal, discount_type, discount_value,
      discount_zar, delivery_fee, vat_amount, total_amount
    ) VALUES (
      v_number, v_uid, v_company_id, v_date, TO_CHAR(v_date, 'FMDay, FMDD Mon YYYY'),
      v_floor, COALESCE(v_profile.location_name, v_company ->> 'name'), 'pending_payment', 1, 'PayFast', v_intent::TEXT,
      v_intent, 'INV-KC-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)),
      v_subtotal, v_discount_type, v_discount_value, v_discount, v_fee, 0, v_total
    ) RETURNING id INTO v_order;

    INSERT INTO public.order_items (
      order_id, menu_item_id, dish_name, size, quantity, unit_price, total_price,
      selected_add_ons, allergy_notes
    )
    SELECT v_order, l.menu_item_id, l.dish_name, l.size, l.quantity, l.unit_price, l.total_price,
           COALESCE(l.selected_add_ons, '[]'::jsonb), l.allergy_notes
    FROM jsonb_to_recordset(v_lines) AS l(
      menu_item_id TEXT, dish_name TEXT, size TEXT, quantity INT, unit_price NUMERIC,
      total_price NUMERIC, selected_add_ons JSONB, allergy_notes TEXT
    );

    v_grand := v_grand + v_total;
    v_numbers := v_numbers || to_jsonb(v_number);
  END LOOP;

  IF v_grand < 5 THEN
    RAISE EXCEPTION 'Order total is below the payment minimum' USING ERRCODE = '22023';
  END IF;

  UPDATE public.payment_intents SET amount = v_grand WHERE id = v_intent;

  RETURN jsonb_build_object(
    'intentId', v_intent,
    'amount', v_grand,
    'email', v_profile.email,
    'fullName', v_profile.full_name,
    'orderNumbers', v_numbers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_checkout(JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.confirm_payfast_payment(
  p_intent UUID, p_pf_payment_id TEXT, p_amount NUMERIC, p_status TEXT, p_raw JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'unknown_intent';
  END IF;

  -- PayFast retries notifications, so repeats must change nothing.
  IF v_intent.status = 'paid' THEN
    RETURN 'already_paid';
  END IF;

  IF p_status = 'COMPLETE' THEN
    IF ABS(v_intent.amount - p_amount) > 0.01 THEN
      UPDATE public.payment_intents
      SET status = 'amount_mismatch', raw_itn = p_raw, completed_at = NOW()
      WHERE id = p_intent;
      RETURN 'amount_mismatch';
    END IF;

    UPDATE public.payment_intents
    SET status = 'paid', pf_payment_id = p_pf_payment_id, raw_itn = p_raw, completed_at = NOW()
    WHERE id = p_intent;

    UPDATE public.orders
    SET status = 'paid_scheduled', stage = 1, itn_verified_at = NOW(),
        payment_reference = p_pf_payment_id, updated_at = NOW()
    WHERE payment_intent_id = p_intent AND status IN ('pending_payment', 'cancelled');
    RETURN 'paid';
  END IF;

  IF p_status IN ('CANCELLED', 'FAILED') THEN
    UPDATE public.payment_intents
    SET status = CASE WHEN p_status = 'FAILED' THEN 'failed' ELSE 'cancelled' END,
        raw_itn = p_raw, completed_at = NOW()
    WHERE id = p_intent;
    UPDATE public.orders SET status = 'cancelled', updated_at = NOW()
    WHERE payment_intent_id = p_intent AND status = 'pending_payment';
    RETURN 'cancelled';
  END IF;

  RETURN 'ignored';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payfast_payment(UUID, TEXT, NUMERIC, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payfast_payment(UUID, TEXT, NUMERIC, TEXT, JSONB) TO service_role;

-- Customers no longer insert orders directly.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('orders', 'order_items') AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END$$;

CREATE POLICY "orders_insert_staff" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_staff());
CREATE POLICY "order_items_insert_staff" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_staff());

-- Suspension is enforced with restrictive policies, which combine with AND.
CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT NOT is_suspended FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;
REVOKE ALL ON FUNCTION public.current_user_is_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO authenticated, service_role;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders', 'order_items', 'order_ratings', 'order_disputes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "block_suspended" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "block_suspended" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
       USING (public.current_user_is_active()) WITH CHECK (public.current_user_is_active())', t);
  END LOOP;
END$$;

-- Suspended users may still read their profile, so the app can explain why.
DROP POLICY IF EXISTS "block_suspended_update" ON public.profiles;
CREATE POLICY "block_suspended_update" ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.current_user_is_active()) WITH CHECK (public.current_user_is_active());

-- Client error monitoring. Insert-only for users, readable by staff.
CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  context TEXT NOT NULL CHECK (char_length(context) <= 120),
  message TEXT NOT NULL CHECK (char_length(message) <= 1000),
  platform TEXT CHECK (char_length(platform) <= 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_error_logs_created ON public.app_error_logs(created_at DESC);
ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_error_logs_insert_own" ON public.app_error_logs;
CREATE POLICY "app_error_logs_insert_own" ON public.app_error_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "app_error_logs_read_staff" ON public.app_error_logs;
CREATE POLICY "app_error_logs_read_staff" ON public.app_error_logs FOR SELECT TO authenticated
  USING (public.current_user_is_staff());
GRANT SELECT, INSERT ON public.app_error_logs TO authenticated;
GRANT SELECT ON public.payment_intents TO authenticated;

INSERT INTO public.applied_migrations (version, notes)
VALUES ('v7_server_checkout', 'Server pricing, PayFast ITN, suspension, error logs')
ON CONFLICT (version) DO NOTHING;

COMMIT;
