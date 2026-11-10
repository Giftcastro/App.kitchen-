-- YKC V10: broadcasts reach only their audience; ratings and problem reports follow delivery.
-- Safe to run more than once.

BEGIN;

-- 1. Previously every signed-in user could read every broadcast, including private
--    messages that name another customer and their email address.
CREATE OR REPLACE FUNCTION public.broadcast_is_for_me(p_audience TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_audience TEXT := LOWER(TRIM(COALESCE(p_audience, 'all')));
  v_email TEXT;
  v_company_id UUID;
  v_date_text TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  IF public.current_user_is_staff() THEN
    RETURN TRUE;
  END IF;
  IF v_audience IN ('all', 'all customers', 'all companies') THEN
    RETURN TRUE;
  END IF;

  SELECT LOWER(email), company_id INTO v_email, v_company_id
  FROM public.profiles WHERE id = auth.uid();

  IF v_audience LIKE 'user:%' THEN
    RETURN v_email IS NOT NULL AND POSITION('(' || v_email || ')' IN v_audience) > 0;
  END IF;

  v_date_text := SUBSTRING(v_audience FROM '^active clients \((\d{4}-\d{2}-\d{2})\)$');
  IF v_date_text IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = auth.uid()
        AND o.target_delivery_date = v_date_text::DATE
        AND o.status NOT IN ('pending_payment', 'cancelled')
    );
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = v_company_id AND LOWER(c.name) = v_audience
  );
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_is_for_me(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_is_for_me(TEXT) TO authenticated, service_role;

DROP POLICY IF EXISTS "broadcasts_select" ON public.broadcast_messages;
CREATE POLICY "broadcasts_select" ON public.broadcast_messages
  FOR SELECT TO authenticated
  USING (public.broadcast_is_for_me(target_audience));

-- 2. Customers may rate only delivered orders, and report a problem only from delivery day.
CREATE OR REPLACE FUNCTION public.guard_customer_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_blocked TEXT[];
  v_today DATE := (NOW() AT TIME ZONE 'Africa/Johannesburg')::DATE;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_is_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.itn_verified_at := NULL;
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  SELECT COALESCE(array_agg(n.key ORDER BY n.key), ARRAY[]::TEXT[])
    INTO v_blocked
  FROM jsonb_each(v_new) AS n
  WHERE n.value IS DISTINCT FROM (v_old -> n.key)
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

  IF (v_new -> 'rating_score') IS DISTINCT FROM (v_old -> 'rating_score')
     OR (v_new -> 'rating_feedback') IS DISTINCT FROM (v_old -> 'rating_feedback')
     OR (v_new -> 'rated_at') IS DISTINCT FROM (v_old -> 'rated_at') THEN
    IF OLD.status::TEXT <> 'delivered' THEN
      RAISE EXCEPTION 'Only delivered orders can be rated' USING ERRCODE = '42501';
    END IF;
    IF char_length(COALESCE(NEW.rating_feedback, '')) > 1000 THEN
      RAISE EXCEPTION 'Feedback is too long' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.status::TEXT = 'unfulfilled' AND OLD.status::TEXT <> 'unfulfilled'
     OR (v_new -> 'is_disputed') IS DISTINCT FROM (v_old -> 'is_disputed')
     OR (v_new -> 'dispute_reason') IS DISTINCT FROM (v_old -> 'dispute_reason')
     OR (v_new -> 'dispute_ticket_ref') IS DISTINCT FROM (v_old -> 'dispute_ticket_ref')
     OR (v_new -> 'dispute_reported_at') IS DISTINCT FROM (v_old -> 'dispute_reported_at') THEN
    IF OLD.target_delivery_date > v_today OR OLD.status::TEXT IN ('pending_payment', 'cancelled') THEN
      RAISE EXCEPTION 'A problem can be reported only from the delivery day' USING ERRCODE = '42501';
    END IF;
    IF char_length(COALESCE(NEW.dispute_reason, '')) > 2000 THEN
      RAISE EXCEPTION 'The description is too long' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

INSERT INTO public.applied_migrations (version, notes)
VALUES ('v10_privacy_and_order_rules', 'Broadcast audience enforced; rating and problem report rules')
ON CONFLICT (version) DO NOTHING;

COMMIT;
