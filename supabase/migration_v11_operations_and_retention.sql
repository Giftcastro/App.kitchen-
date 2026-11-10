-- YKC V11: delivery-day dispatch, complaints, Chef's Choice dish names, and
-- anonymised 5-year record retention. Safe to run more than once.

BEGIN;

-- 1. Editing an old order must not fail because a date later became a holiday.
CREATE OR REPLACE FUNCTION public.validate_order_delivery_schedule()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.target_delivery_date IS NOT DISTINCT FROM OLD.target_delivery_date THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.public_holidays WHERE holiday_date = NEW.target_delivery_date) THEN
    RAISE EXCEPTION 'Deliveries cannot be scheduled on South African statutory public holidays (%).', NEW.target_delivery_date;
  END IF;
  IF EXTRACT(DOW FROM NEW.target_delivery_date) IN (0, 6) THEN
    RAISE EXCEPTION 'Kitchen Co deliveries operate strictly Monday through Friday. Weekend delivery is not supported.';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Menu, 8-week cycle and company edits reach open apps immediately.
DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['menu_items', 'menu_categories', 'cycle_rotations', 'cycle_day_plans', 'companies'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END$$;

ALTER TABLE public.broadcast_messages ADD COLUMN IF NOT EXISTS recipient_count INTEGER;

-- 3. The company stays on the order, whatever later happens to the customer or company.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS company_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS anonymised_at TIMESTAMPTZ;

UPDATE public.orders o
SET company_name_snapshot = COALESCE(
  (SELECT c.name FROM public.companies c WHERE c.id = o.company_id),
  (SELECT c.name FROM public.profiles p JOIN public.companies c ON c.id = p.company_id WHERE p.id = o.user_id)
)
WHERE o.company_name_snapshot IS NULL;

CREATE OR REPLACE FUNCTION public.set_order_company_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.company_name_snapshot IS NULL AND NEW.company_id IS NOT NULL THEN
    SELECT name INTO NEW.company_name_snapshot FROM public.companies WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_company_snapshot ON public.orders;
CREATE TRIGGER trg_set_order_company_snapshot
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_company_snapshot();

-- 4. Chef's Choice orders name the actual dish from the 8-week plan, for the kitchen and invoices.
DO $$
DECLARE
  v_def TEXT := pg_get_functiondef('public.create_checkout(jsonb)'::regprocedure);
  v_marker TEXT := 'v_unit := c_chef_price;';
BEGIN
  IF POSITION('cycle_day_plans' IN v_def) = 0 THEN
    IF POSITION(v_marker IN v_def) = 0 THEN
      RAISE EXCEPTION 'create_checkout has changed; update this migration';
    END IF;
    EXECUTE REPLACE(v_def, v_marker, v_marker || $add$
        v_name := COALESCE(v_name || ' - ' || NULLIF(TRIM((
          SELECT CASE v_parts[4]
            WHEN 'main' THEN p.main_meal
            WHEN 'veg' THEN p.vegetarian_meal
            WHEN 'healthy' THEN p.healthy_meal
            WHEN 'curry' THEN p.curry_of_the_day
            WHEN 'sandwich' THEN p.gourmet_sandwich
          END
          FROM public.cycle_day_plans p
          WHERE p.week_number = v_parts[2]::INT AND p.day_name = v_parts[3]
          LIMIT 1
        )), ''), v_name);$add$);
  END IF;
END$$;

-- 5. Out for delivery: moves paid orders and tells each customer once.
CREATE OR REPLACE FUNCTION public.dispatch_orders_for_delivery(p_order_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH moved AS (
    UPDATE public.orders
    SET status = 'out_for_delivery', stage = 3, updated_at = NOW()
    WHERE id = ANY(p_order_ids) AND status IN ('paid_scheduled', 'kitchen_prepping')
    RETURNING user_id, target_delivery_date
  ), recipients AS (
    SELECT DISTINCT m.target_delivery_date, p.full_name, LOWER(p.email) AS email
    FROM moved m JOIN public.profiles p ON p.id = m.user_id
    WHERE p.email IS NOT NULL
  ), sent AS (
    INSERT INTO public.broadcast_messages (title, message, target_audience, is_active, recipient_count)
    SELECT
      'Your lunch is on its way',
      'Your meals for ' || TO_CHAR(r.target_delivery_date, 'FMDay, FMDD Mon')
        || ' are out for delivery and will arrive at your drop-off point at 12:00.',
      'User: ' || COALESCE(NULLIF(TRIM(r.full_name), ''), 'Customer') || ' (' || r.email || ')',
      TRUE,
      1
    FROM recipients r
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM moved;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_orders_for_delivery(UUID[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_mark_out_for_delivery(p_order_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an administrator can dispatch orders' USING ERRCODE = '42501';
  END IF;
  RETURN public.dispatch_orders_for_delivery(p_order_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_mark_out_for_delivery(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_out_for_delivery(UUID[]) TO authenticated, service_role;

-- Runs at 10:00 SAST on weekdays. Anything an admin already dispatched is skipped.
CREATE OR REPLACE FUNCTION public.run_morning_dispatch()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.dispatch_orders_for_delivery(ARRAY(
    SELECT id FROM public.orders
    WHERE target_delivery_date = (NOW() AT TIME ZONE 'Africa/Johannesburg')::DATE
      AND status IN ('paid_scheduled', 'kitchen_prepping')
  ));
END;
$$;
REVOKE ALL ON FUNCTION public.run_morning_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_morning_dispatch() TO service_role;

-- 6. Complaints are stored and reach staff.
CREATE TABLE IF NOT EXISTS public.customer_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_ref TEXT NOT NULL UNIQUE
    DEFAULT 'TCK-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 10)),
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (char_length(category) <= 40),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_customer_complaints_created ON public.customer_complaints(created_at DESC);
ALTER TABLE public.customer_complaints ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.customer_complaints TO authenticated;

DROP POLICY IF EXISTS "complaints_insert_own" ON public.customer_complaints;
CREATE POLICY "complaints_insert_own" ON public.customer_complaints FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND status = 'open' AND resolved_at IS NULL
    AND public.current_user_is_active()
    AND (order_id IS NULL OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()))
  );
DROP POLICY IF EXISTS "complaints_select" ON public.customer_complaints;
CREATE POLICY "complaints_select" ON public.customer_complaints FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_staff());
DROP POLICY IF EXISTS "complaints_update_admin" ON public.customer_complaints;
CREATE POLICY "complaints_update_admin" ON public.customer_complaints FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 7. Retention: orders and payments outlive the customer, without identifying them.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders', 'order_ratings', 'order_disputes', 'payment_intents'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP NOT NULL', t);
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_user_id_fkey');
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL',
        t, t || '_user_id_fkey'
      );
    END IF;
  END LOOP;
END$$;

CREATE TABLE IF NOT EXISTS public.anonymisation_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  anonymised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  orders_retained INTEGER NOT NULL,
  retain_until DATE NOT NULL
);
ALTER TABLE public.anonymisation_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.anonymisation_log TO authenticated;
DROP POLICY IF EXISTS "anonymisation_log_read_admin" ON public.anonymisation_log;
CREATE POLICY "anonymisation_log_read_admin" ON public.anonymisation_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Runs for every deletion of a sign-in account, however it is deleted.
CREATE OR REPLACE FUNCTION public.scrub_customer_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orders INTEGER;
  v_last DATE;
BEGIN
  DELETE FROM public.orders WHERE user_id = OLD.id AND status = 'pending_payment';

  UPDATE public.order_items i SET allergy_notes = NULL
  FROM public.orders o
  WHERE o.id = i.order_id AND o.user_id = OLD.id AND i.allergy_notes IS NOT NULL;

  UPDATE public.orders
  SET rating_feedback = NULL,
      dispute_reason = CASE WHEN dispute_reason IS NULL THEN NULL ELSE '[removed]' END,
      anonymised_at = NOW()
  WHERE user_id = OLD.id;

  UPDATE public.payment_intents
  SET raw_itn = raw_itn - ARRAY['name_first', 'name_last', 'email_address', 'cell_number']
  WHERE user_id = OLD.id AND raw_itn IS NOT NULL;

  UPDATE public.customer_complaints SET body = '[removed]' WHERE user_id = OLD.id;

  IF OLD.email IS NOT NULL THEN
    DELETE FROM public.broadcast_messages
    WHERE LOWER(target_audience) LIKE 'user:%'
      AND POSITION('(' || LOWER(OLD.email) || ')' IN LOWER(target_audience)) > 0;
  END IF;

  SELECT COUNT(*), MAX(target_delivery_date) INTO v_orders, v_last
  FROM public.orders WHERE user_id = OLD.id;

  IF v_orders > 0 THEN
    INSERT INTO public.anonymisation_log (orders_retained, retain_until)
    VALUES (v_orders, (v_last + INTERVAL '5 years')::DATE);
  END IF;

  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.scrub_customer_before_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_scrub ON auth.users;
CREATE TRIGGER on_auth_user_scrub
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.scrub_customer_before_delete();

CREATE OR REPLACE FUNCTION public.anonymise_customer(p_user UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_retained INTEGER;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an administrator can delete a customer' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND role <> 'user') THEN
    RAISE EXCEPTION 'Change this person to Customer before deleting them' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE user_id = p_user AND status IN ('paid_scheduled', 'kitchen_prepping', 'out_for_delivery')
  ) THEN
    RAISE EXCEPTION 'This customer still has orders to be delivered' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_retained FROM public.orders
  WHERE user_id = p_user AND status <> 'pending_payment';

  DELETE FROM auth.users WHERE id = p_user;
  RETURN v_retained;
END;
$$;
REVOKE ALL ON FUNCTION public.anonymise_customer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anonymise_customer(UUID) TO authenticated, service_role;

-- Runs monthly. Only anonymised records are removed, 5 years after delivery.
CREATE OR REPLACE FUNCTION public.purge_expired_records()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.orders
  WHERE user_id IS NULL AND anonymised_at IS NOT NULL
    AND target_delivery_date < ((NOW() AT TIME ZONE 'Africa/Johannesburg')::DATE - INTERVAL '5 years');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM public.payment_intents i
  WHERE i.user_id IS NULL
    AND i.created_at < NOW() - INTERVAL '5 years'
    AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.payment_intent_id = i.id);

  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_records() TO service_role;

INSERT INTO public.applied_migrations (version, notes)
VALUES ('v11_operations_and_retention', 'Dispatch, complaints, Chef''s Choice names, anonymised retention')
ON CONFLICT (version) DO NOTHING;

COMMIT;
