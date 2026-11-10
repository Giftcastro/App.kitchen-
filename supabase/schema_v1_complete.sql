-- =====================================================================
-- YOUR KITCHEN CO. (YKC) — COMPLETE PRODUCTION DATABASE SCHEMA V1
-- Target Supabase: hazlxumtnlgdvuyluxfp.supabase.co
-- Architecture: 3NF/BCNF Relational Normalization, ACID/BASE, SOLID
-- Built-in Automatic RLS, OAuth Preparedness, SAST Holiday Prevention
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. CUSTOM TYPES & ENUMS
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'chef', 'user');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'menu_type') THEN
    CREATE TYPE public.menu_type AS ENUM ('standard', 'chefs_choice');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM (
      'pending_payment',
      'paid_scheduled',
      'kitchen_prepping',
      'out_for_delivery',
      'delivered',
      'unfulfilled',
      'cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type') THEN
    CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed_zar');
  END IF;
END$$;

-- ---------------------------------------------------------------------
-- 2. CORE RELATIONAL TABLES (3NF / BCNF)
-- ---------------------------------------------------------------------

-- ---- Table: companies ----
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Johannesburg',
  postal_code TEXT NOT NULL DEFAULT '2196',
  distance_km NUMERIC(5,2) DEFAULT 8.0,
  discount_type public.discount_type DEFAULT 'percentage',
  discount_value NUMERIC(10,2) DEFAULT 10.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: company_domains ----
CREATE TABLE IF NOT EXISTS public.company_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: delivery_locations ----
CREATE TABLE IF NOT EXISTS public.delivery_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  building_name TEXT NOT NULL,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Johannesburg',
  postal_code TEXT NOT NULL DEFAULT '2196',
  scheduled_delivery_time TIME NOT NULL DEFAULT '12:00:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: dropoff_floors ----
CREATE TABLE IF NOT EXISTS public.dropoff_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.delivery_locations(id) ON DELETE CASCADE,
  floor_label TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: public_holidays (South Africa Statutory) ----
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  year INT NOT NULL,
  is_statutory BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: profiles (Extends auth.users) ----
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  phone_number TEXT DEFAULT '+27 82 555 0192',
  role public.app_role NOT NULL DEFAULT 'user',
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  delivery_location_id UUID REFERENCES public.delivery_locations(id) ON DELETE SET NULL,
  delivery_floor TEXT DEFAULT 'Floor 3 (Reception Pantry)',
  building_name TEXT,
  location_name TEXT,
  avatar_url TEXT,
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: menu_categories ----
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  menu_type public.menu_type NOT NULL DEFAULT 'standard',
  hero_image_url TEXT,
  display_order INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  add_ons JSONB DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: menu_items ----
CREATE TABLE IF NOT EXISTS public.menu_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category_id TEXT NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  ingredients TEXT DEFAULT 'Chef prepared fresh daily ingredients, fine herbs, sea salt and olive oil',
  dietary_tags TEXT[] DEFAULT '{}',
  price_regular NUMERIC(10,2) NOT NULL CHECK (price_regular >= 0),
  price_large NUMERIC(10,2),
  menu_type public.menu_type NOT NULL DEFAULT 'standard',
  image_url TEXT,
  calories INT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: cycle_rotations (8-Week Chef's Choice Control) ----
CREATE TABLE IF NOT EXISTS public.cycle_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INT NOT NULL UNIQUE CHECK (week_number BETWEEN 1 AND 8),
  title TEXT NOT NULL,
  description TEXT,
  is_active_now BOOLEAN NOT NULL DEFAULT FALSE,
  is_advance_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: cycle_day_plans (40 Days Chef's Choice Recipes) ----
CREATE TABLE IF NOT EXISTS public.cycle_day_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INT NOT NULL CHECK (week_number BETWEEN 1 AND 8),
  day_name TEXT NOT NULL CHECK (day_name IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  main_meal TEXT NOT NULL,
  vegetarian_meal TEXT NOT NULL,
  healthy_meal TEXT NOT NULL,
  curry_of_the_day TEXT NOT NULL,
  gourmet_sandwich TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cycle_week_day UNIQUE (week_number, day_name)
);

-- ---- Table: orders ----
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  delivery_location_id UUID REFERENCES public.delivery_locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'paid_scheduled',
  stage INT DEFAULT 1 CHECK (stage BETWEEN 1 AND 4),
  target_delivery_date DATE NOT NULL,
  delivery_date_formatted TEXT,
  delivery_slot TEXT DEFAULT '12:00 PM Sharp',
  delivery_floor TEXT DEFAULT 'Floor 3 (Reception Pantry)',
  company_location TEXT DEFAULT 'Main Corporate Campus',
  item_subtotal NUMERIC(10,2) DEFAULT 0.00,
  discount_type TEXT DEFAULT 'percentage',
  discount_value NUMERIC(10,2) DEFAULT 0.00,
  discount_zar NUMERIC(10,2) DEFAULT 0.00,
  delivery_fee NUMERIC(10,2) DEFAULT 0.00,
  vat_amount NUMERIC(10,2) DEFAULT 0.00,
  total_amount NUMERIC(10,2) DEFAULT 0.00,
  payment_method TEXT DEFAULT 'Instant EFT',
  payment_reference TEXT,
  itn_verified_at TIMESTAMPTZ,
  tax_invoice_number TEXT,
  pdf_invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: order_items ----
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id TEXT REFERENCES public.menu_items(id) ON DELETE SET NULL,
  dish_name TEXT NOT NULL,
  size TEXT DEFAULT 'standard',
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 80.00,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 80.00,
  selected_add_ons JSONB DEFAULT '[]'::jsonb,
  allergy_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: order_ratings ----
CREATE TABLE IF NOT EXISTS public.order_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: order_disputes ----
CREATE TABLE IF NOT EXISTS public.order_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_ref TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'investigating',
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ---- Table: dispatch_audit_logs ----
CREATE TABLE IF NOT EXISTS public.dispatch_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: broadcast_messages ----
CREATE TABLE IF NOT EXISTS public.broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience TEXT DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_company_domains_domain ON public.company_domains(domain);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON public.orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_target_date ON public.orders(target_delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON public.menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_cycle_day_plans_lookup ON public.cycle_day_plans(week_number, day_name);
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public.public_holidays(holiday_date);

-- ---------------------------------------------------------------------
-- 4. SECURITY DEFINER HELPER FUNCTIONS (No RLS Recursion)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chef(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'chef'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND (role = _role OR role = 'admin')
  );
$$;

-- ---------------------------------------------------------------------
-- 5. BUSINESS RULES: SAST HOLIDAY & WEEKEND TRIGGER
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_order_delivery_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify not a South African statutory public holiday
  IF EXISTS (SELECT 1 FROM public.public_holidays WHERE holiday_date = NEW.target_delivery_date) THEN
    RAISE EXCEPTION 'Deliveries cannot be scheduled on South African statutory public holidays (%).', NEW.target_delivery_date;
  END IF;
  -- Verify not weekend (0 = Sunday, 6 = Saturday)
  IF EXTRACT(DOW FROM NEW.target_delivery_date) IN (0, 6) THEN
    RAISE EXCEPTION 'Kitchen Co deliveries operate strictly Monday through Friday. Weekend delivery is not supported.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_delivery_schedule ON public.orders;
CREATE TRIGGER trg_validate_order_delivery_schedule
BEFORE INSERT OR UPDATE OF target_delivery_date ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_delivery_schedule();

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.companies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_domains       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropoff_floors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_holidays       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_rotations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_day_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_ratings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_disputes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_audit_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_messages    ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.companies TO anon, authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.companies TO authenticated;

GRANT SELECT ON public.company_domains TO anon, authenticated;
GRANT ALL ON public.company_domains TO service_role;
GRANT ALL ON public.company_domains TO authenticated;

GRANT SELECT ON public.delivery_locations TO anon, authenticated;
GRANT ALL ON public.delivery_locations TO service_role;
GRANT ALL ON public.delivery_locations TO authenticated;

GRANT SELECT ON public.dropoff_floors TO anon, authenticated;
GRANT ALL ON public.dropoff_floors TO service_role;
GRANT ALL ON public.dropoff_floors TO authenticated;

GRANT SELECT ON public.public_holidays TO anon, authenticated;
GRANT ALL ON public.public_holidays TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO anon, authenticated;
GRANT ALL ON public.menu_categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.cycle_rotations TO anon, authenticated;
GRANT ALL ON public.cycle_rotations TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.cycle_day_plans TO anon, authenticated;
GRANT ALL ON public.cycle_day_plans TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.order_ratings TO authenticated;
GRANT ALL ON public.order_ratings TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.order_disputes TO authenticated;
GRANT ALL ON public.order_disputes TO service_role;

GRANT SELECT, INSERT ON public.dispatch_audit_logs TO authenticated;
GRANT ALL ON public.dispatch_audit_logs TO service_role;

GRANT SELECT ON public.broadcast_messages TO anon, authenticated;
GRANT ALL ON public.broadcast_messages TO service_role;

-- Drop policies if exist to allow clean rerun
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END$$;

-- Core Policies
CREATE POLICY "public_companies_select" ON public.companies FOR SELECT USING (true);
CREATE POLICY "admin_companies_all" ON public.companies FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "public_company_domains_select" ON public.company_domains FOR SELECT USING (true);
CREATE POLICY "admin_company_domains_all" ON public.company_domains FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "public_locations_select" ON public.delivery_locations FOR SELECT USING (true);
CREATE POLICY "admin_locations_all" ON public.delivery_locations FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "public_dropoff_floors_select" ON public.dropoff_floors FOR SELECT USING (true);
CREATE POLICY "admin_dropoff_floors_all" ON public.dropoff_floors FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "public_holidays_select" ON public.public_holidays FOR SELECT USING (true);
CREATE POLICY "admin_holidays_all" ON public.public_holidays FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_chef(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "menu_categories_select" ON public.menu_categories FOR SELECT USING (true);
CREATE POLICY "menu_categories_manage" ON public.menu_categories FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_chef(auth.uid()));

CREATE POLICY "menu_items_select" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "menu_items_manage" ON public.menu_items FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_chef(auth.uid()));

CREATE POLICY "cycle_rotations_select" ON public.cycle_rotations FOR SELECT USING (true);
CREATE POLICY "cycle_rotations_manage" ON public.cycle_rotations FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_chef(auth.uid()));

CREATE POLICY "cycle_day_plans_select" ON public.cycle_day_plans FOR SELECT USING (true);
CREATE POLICY "cycle_day_plans_manage" ON public.cycle_day_plans FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_chef(auth.uid()));

CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_chef(auth.uid()));
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_chef(auth.uid()));
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_chef(auth.uid()))));
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "order_items_manage" ON public.order_items FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.is_chef(auth.uid()));

CREATE POLICY "ratings_select" ON public.order_ratings FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_chef(auth.uid()));
CREATE POLICY "ratings_insert" ON public.order_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "broadcasts_select" ON public.broadcast_messages FOR SELECT USING (true);
CREATE POLICY "broadcasts_manage" ON public.broadcast_messages FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_audit_logs;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_messages;
EXCEPTION WHEN OTHERS THEN
  NULL;
END$$;

-- ---------------------------------------------------------------------
-- 7. SEED DATA: STATUTORY PUBLIC HOLIDAYS
-- ---------------------------------------------------------------------
INSERT INTO public.public_holidays (holiday_date, name, year) VALUES
  ('2025-01-01', 'New Year''s Day', 2025),
  ('2025-03-21', 'Human Rights Day', 2025),
  ('2025-04-18', 'Good Friday', 2025),
  ('2025-04-21', 'Family Day', 2025),
  ('2025-04-27', 'Freedom Day', 2025),
  ('2025-04-28', 'Freedom Day (Observed)', 2025),
  ('2025-05-01', 'Workers'' Day', 2025),
  ('2025-06-16', 'Youth Day', 2025),
  ('2025-08-09', 'National Women''s Day', 2025),
  ('2025-09-24', 'Heritage Day', 2025),
  ('2025-12-16', 'Day of Reconciliation', 2025),
  ('2025-12-25', 'Christmas Day', 2025),
  ('2025-12-26', 'Day of Goodwill', 2025),
  ('2026-01-01', 'New Year''s Day', 2026),
  ('2026-03-21', 'Human Rights Day', 2026),
  ('2026-04-03', 'Good Friday', 2026),
  ('2026-04-06', 'Family Day', 2026),
  ('2026-04-27', 'Freedom Day', 2026),
  ('2026-05-01', 'Workers'' Day', 2026),
  ('2026-06-16', 'Youth Day', 2026),
  ('2026-08-09', 'National Women''s Day', 2026),
  ('2026-08-10', 'National Women''s Day (Observed)', 2026),
  ('2026-09-24', 'Heritage Day', 2026),
  ('2026-12-16', 'Day of Reconciliation', 2026),
  ('2026-12-25', 'Christmas Day', 2026),
  ('2026-12-26', 'Day of Goodwill', 2026),
  ('2027-01-01', 'New Year''s Day', 2027),
  ('2027-03-21', 'Human Rights Day', 2027),
  ('2027-03-22', 'Human Rights Day (Observed)', 2027),
  ('2027-03-26', 'Good Friday', 2027),
  ('2027-03-29', 'Family Day', 2027),
  ('2027-04-27', 'Freedom Day', 2027),
  ('2027-05-01', 'Workers'' Day', 2027),
  ('2027-06-16', 'Youth Day', 2027),
  ('2027-08-09', 'National Women''s Day', 2027),
  ('2027-09-24', 'Heritage Day', 2027),
  ('2027-12-16', 'Day of Reconciliation', 2027),
  ('2027-12-25', 'Christmas Day', 2027),
  ('2027-12-26', 'Day of Goodwill', 2027),
  ('2027-12-27', 'Day of Goodwill (Observed)', 2027)
ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name, year = EXCLUDED.year;

-- ---------------------------------------------------------------------
-- 8. SEED DATA: COMPANIES & MULTI-ADDRESS LOCATIONS
-- eCOGRA, RCL Foods, TATA Africa Holdings
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_ecogra_id UUID;
  v_rcl_id UUID;
  v_tata_id UUID;
  v_loc_id UUID;
BEGIN
  -- 1. eCOGRA
  INSERT INTO public.companies (name, slug, street_address, city, postal_code, distance_km, discount_type, discount_value)
  VALUES ('eCOGRA', 'ecogra', '160 Jan Smuts Ave, Rosebank', 'Johannesburg', '2196', 6.5, 'percentage', 10.0)
  ON CONFLICT (name) DO UPDATE SET street_address = EXCLUDED.street_address, distance_km = EXCLUDED.distance_km
  RETURNING id INTO v_ecogra_id;

  INSERT INTO public.company_domains (company_id, domain) VALUES
    (v_ecogra_id, 'ecogra.org'),
    (v_ecogra_id, 'ecogra.co.za')
  ON CONFLICT (domain) DO NOTHING;

  INSERT INTO public.delivery_locations (company_id, location_name, building_name, street_address, city, postal_code)
  VALUES (v_ecogra_id, 'eCOGRA Rosebank Hub', 'Rosebank Office Park', '160 Jan Smuts Ave, Rosebank', 'Johannesburg', '2196')
  RETURNING id INTO v_loc_id;

  INSERT INTO public.dropoff_floors (location_id, floor_label, description, is_default) VALUES
    (v_loc_id, 'Floor 2 (IT & Compliance Pantry)', 'IT and Security Operations break room pantry', true),
    (v_loc_id, 'Floor 3 (Executive Boardroom Staging)', 'Executive Suite catering hub', false),
    (v_loc_id, 'Ground Floor (Main Reception)', 'Front desk reception concierge drop-off', false);

  -- 2. RCL Foods
  INSERT INTO public.companies (name, slug, street_address, city, postal_code, distance_km, discount_type, discount_value)
  VALUES ('RCL Foods', 'rcl-foods', 'Ten Bompas Road, Dunkeld West', 'Johannesburg', '2196', 7.2, 'percentage', 12.0)
  ON CONFLICT (name) DO UPDATE SET street_address = EXCLUDED.street_address, distance_km = EXCLUDED.distance_km
  RETURNING id INTO v_rcl_id;

  INSERT INTO public.company_domains (company_id, domain) VALUES
    (v_rcl_id, 'rclfoods.com'),
    (v_rcl_id, 'rclfoods.co.za')
  ON CONFLICT (domain) DO NOTHING;

  INSERT INTO public.delivery_locations (company_id, location_name, building_name, street_address, city, postal_code)
  VALUES (v_rcl_id, 'RCL Foods Dunkeld HQ', 'Ten Bompas Office Complex, Building 2', 'Ten Bompas Road, Dunkeld West', 'Johannesburg', '2196')
  RETURNING id INTO v_loc_id;

  INSERT INTO public.dropoff_floors (location_id, floor_label, description, is_default) VALUES
    (v_loc_id, 'Floor 1 (Corporate Canteen Pantry)', 'Main corporate breakroom warming station', true),
    (v_loc_id, 'Floor 3 (Consumer Division Lounge)', 'Brand managers and commercial floor', false),
    (v_loc_id, 'Ground Floor (Security Concierge)', 'Building 2 entrance security dispatch area', false);

  -- 3. TATA Africa Holdings
  INSERT INTO public.companies (name, slug, street_address, city, postal_code, distance_km, discount_type, discount_value)
  VALUES ('TATA Africa Holdings', 'tata-africa', '140 West Street, Sandton', 'Johannesburg', '2196', 9.8, 'percentage', 10.0)
  ON CONFLICT (name) DO UPDATE SET street_address = EXCLUDED.street_address, distance_km = EXCLUDED.distance_km
  RETURNING id INTO v_tata_id;

  INSERT INTO public.company_domains (company_id, domain) VALUES
    (v_tata_id, 'tataafrica.com'),
    (v_tata_id, 'tata.com')
  ON CONFLICT (domain) DO NOTHING;

  INSERT INTO public.delivery_locations (company_id, location_name, building_name, street_address, city, postal_code)
  VALUES (v_tata_id, 'TATA Sandton Towers', '140 West Street Building, Tower B', '140 West Street, Sandton', 'Johannesburg', '2196')
  RETURNING id INTO v_loc_id;

  INSERT INTO public.dropoff_floors (location_id, floor_label, description, is_default) VALUES
    (v_loc_id, 'Tower B, Floor 4 (Holding Operations Staging)', 'Operations executive kitchenette', true),
    (v_loc_id, 'Tower B, Floor 6 (Executive Boardroom Suite)', 'Boardroom catering pantry and lounge', false),
    (v_loc_id, 'Ground Floor (Tower B Visitor Concierge)', 'Tower B front security and visitor reception desk', false);
END$$;

-- ---------------------------------------------------------------------
-- 9. SEED DATA: AUTH USERS & PROFILES
-- Admin: ingrid@kyc.com (Password: (removed)
-- Demo Users for eCOGRA, RCL Foods, TATA Africa, and Chef
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_ecogra_id UUID;
  v_rcl_id UUID;
  v_tata_id UUID;
  v_uid UUID;
BEGIN
  SELECT id INTO v_ecogra_id FROM public.companies WHERE name = 'eCOGRA' LIMIT 1;
  SELECT id INTO v_rcl_id FROM public.companies WHERE name = 'RCL Foods' LIMIT 1;
  SELECT id INTO v_tata_id FROM public.companies WHERE name = 'TATA Africa Holdings' LIMIT 1;
  v_uid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new,
    recovery_token, email_change_token_current, phone, phone_change, phone_change_token,
    reauthentication_token, is_super_admin, is_sso_user, is_anonymous, email_change_confirm_status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'ingrid@kyc.com', crypt(gen_random_uuid()::text, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Ingrid van der Merwe", "role": "admin", "sub": "a0000000-0000-0000-0000-000000000001", "email": "ingrid@kyc.com", "email_verified": true}'::jsonb,
    NOW(), NOW(), '', '', '', '', '', '', '', '', '', false, false, false, 0
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
    email_confirmed_at = NOW(), confirmation_token = '', recovery_token = '', email_change = '',
    email_change_token_new = '', email_change_token_current = '', phone = '', phone_change = '',
    phone_change_token = '', reauthentication_token = '', is_sso_user = false, is_anonymous = false, email_change_confirm_status = 0;

  DELETE FROM auth.identities WHERE user_id = v_uid;
  INSERT INTO auth.identities (identity_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', 'ingrid@kyc.com', 'email_verified', true, 'phone_verified', false), 'email', NOW(), NOW(), NOW());

  INSERT INTO public.profiles (id, email, full_name, phone_number, role, company_id, location_name, building_name, delivery_floor)
  VALUES (v_uid, 'ingrid@kyc.com', 'Ingrid van der Merwe', '+27 82 555 0192', 'admin', NULL, 'Kitchen Co Headquarters', 'Central Command Kitchen', 'Executive Suite')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = EXCLUDED.full_name, company_id = NULL, delivery_floor = EXCLUDED.delivery_floor;

  v_uid := 'a0000000-0000-0000-0000-000000000002'::uuid;
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new,
    recovery_token, email_change_token_current, phone, phone_change, phone_change_token,
    reauthentication_token, is_super_admin, is_sso_user, is_anonymous, email_change_confirm_status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'ahmed.maseko@ecogra.org', crypt(gen_random_uuid()::text, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Ahmed Maseko", "role": "user", "sub": "a0000000-0000-0000-0000-000000000002", "email": "ahmed.maseko@ecogra.org", "email_verified": true}'::jsonb,
    NOW(), NOW(), '', '', '', '', '', '', '', '', '', false, false, false, 0
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
    email_confirmed_at = NOW(), confirmation_token = '', recovery_token = '', email_change = '',
    email_change_token_new = '', email_change_token_current = '', phone = '', phone_change = '',
    phone_change_token = '', reauthentication_token = '', is_sso_user = false, is_anonymous = false, email_change_confirm_status = 0;

  DELETE FROM auth.identities WHERE user_id = v_uid;
  INSERT INTO auth.identities (identity_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', 'ahmed.maseko@ecogra.org', 'email_verified', true, 'phone_verified', false), 'email', NOW(), NOW(), NOW());

  INSERT INTO public.profiles (id, email, full_name, phone_number, role, company_id, location_name, building_name, delivery_floor)
  VALUES (v_uid, 'ahmed.maseko@ecogra.org', 'Ahmed Maseko', '+27 82 555 0192', 'user', v_ecogra_id, 'eCOGRA Rosebank Hub', 'Rosebank Office Park', 'Floor 2 (IT & Compliance Pantry)')
  ON CONFLICT (id) DO UPDATE SET role = 'user', full_name = EXCLUDED.full_name, company_id = v_ecogra_id, delivery_floor = EXCLUDED.delivery_floor;

  v_uid := 'a0000000-0000-0000-0000-000000000003'::uuid;
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new,
    recovery_token, email_change_token_current, phone, phone_change, phone_change_token,
    reauthentication_token, is_super_admin, is_sso_user, is_anonymous, email_change_confirm_status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'anele.mthembu@rclfoods.com', crypt(gen_random_uuid()::text, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Anele Mthembu", "role": "user", "sub": "a0000000-0000-0000-0000-000000000003", "email": "anele.mthembu@rclfoods.com", "email_verified": true}'::jsonb,
    NOW(), NOW(), '', '', '', '', '', '', '', '', '', false, false, false, 0
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
    email_confirmed_at = NOW(), confirmation_token = '', recovery_token = '', email_change = '',
    email_change_token_new = '', email_change_token_current = '', phone = '', phone_change = '',
    phone_change_token = '', reauthentication_token = '', is_sso_user = false, is_anonymous = false, email_change_confirm_status = 0;

  DELETE FROM auth.identities WHERE user_id = v_uid;
  INSERT INTO auth.identities (identity_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', 'anele.mthembu@rclfoods.com', 'email_verified', true, 'phone_verified', false), 'email', NOW(), NOW(), NOW());

  INSERT INTO public.profiles (id, email, full_name, phone_number, role, company_id, location_name, building_name, delivery_floor)
  VALUES (v_uid, 'anele.mthembu@rclfoods.com', 'Anele Mthembu', '+27 82 555 0192', 'user', v_rcl_id, 'RCL Foods Dunkeld HQ', 'Ten Bompas Office Complex, Building 2', 'Floor 1 (Corporate Canteen Pantry)')
  ON CONFLICT (id) DO UPDATE SET role = 'user', full_name = EXCLUDED.full_name, company_id = v_rcl_id, delivery_floor = EXCLUDED.delivery_floor;

  v_uid := 'a0000000-0000-0000-0000-000000000004'::uuid;
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new,
    recovery_token, email_change_token_current, phone, phone_change, phone_change_token,
    reauthentication_token, is_super_admin, is_sso_user, is_anonymous, email_change_confirm_status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'tamryn.louw@tataafrica.com', crypt(gen_random_uuid()::text, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Tamryn Louw", "role": "user", "sub": "a0000000-0000-0000-0000-000000000004", "email": "tamryn.louw@tataafrica.com", "email_verified": true}'::jsonb,
    NOW(), NOW(), '', '', '', '', '', '', '', '', '', false, false, false, 0
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
    email_confirmed_at = NOW(), confirmation_token = '', recovery_token = '', email_change = '',
    email_change_token_new = '', email_change_token_current = '', phone = '', phone_change = '',
    phone_change_token = '', reauthentication_token = '', is_sso_user = false, is_anonymous = false, email_change_confirm_status = 0;

  DELETE FROM auth.identities WHERE user_id = v_uid;
  INSERT INTO auth.identities (identity_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', 'tamryn.louw@tataafrica.com', 'email_verified', true, 'phone_verified', false), 'email', NOW(), NOW(), NOW());

  INSERT INTO public.profiles (id, email, full_name, phone_number, role, company_id, location_name, building_name, delivery_floor)
  VALUES (v_uid, 'tamryn.louw@tataafrica.com', 'Tamryn Louw', '+27 82 555 0192', 'user', v_tata_id, 'TATA Sandton Towers', '140 West Street Building, Tower B', 'Tower B, Floor 4 (Holding Operations Staging)')
  ON CONFLICT (id) DO UPDATE SET role = 'user', full_name = EXCLUDED.full_name, company_id = v_tata_id, delivery_floor = EXCLUDED.delivery_floor;

  v_uid := 'a0000000-0000-0000-0000-000000000005'::uuid;
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new,
    recovery_token, email_change_token_current, phone, phone_change, phone_change_token,
    reauthentication_token, is_super_admin, is_sso_user, is_anonymous, email_change_confirm_status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'chef@kitchenco.co.za', crypt(gen_random_uuid()::text, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Executive Chef Marco", "role": "chef", "sub": "a0000000-0000-0000-0000-000000000005", "email": "chef@kitchenco.co.za", "email_verified": true}'::jsonb,
    NOW(), NOW(), '', '', '', '', '', '', '', '', '', false, false, false, 0
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
    email_confirmed_at = NOW(), confirmation_token = '', recovery_token = '', email_change = '',
    email_change_token_new = '', email_change_token_current = '', phone = '', phone_change = '',
    phone_change_token = '', reauthentication_token = '', is_sso_user = false, is_anonymous = false, email_change_confirm_status = 0;

  DELETE FROM auth.identities WHERE user_id = v_uid;
  INSERT INTO auth.identities (identity_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', 'chef@kitchenco.co.za', 'email_verified', true, 'phone_verified', false), 'email', NOW(), NOW(), NOW());

  INSERT INTO public.profiles (id, email, full_name, phone_number, role, company_id, location_name, building_name, delivery_floor)
  VALUES (v_uid, 'chef@kitchenco.co.za', 'Executive Chef Marco', '+27 82 555 0192', 'chef', NULL, 'Kitchen Co Commercial Kitchen', 'Central Production Facility', 'Executive Kitchen Station')
  ON CONFLICT (id) DO UPDATE SET role = 'chef', full_name = EXCLUDED.full_name, company_id = NULL, delivery_floor = EXCLUDED.delivery_floor;

  UPDATE auth.users SET confirmation_token = COALESCE(confirmation_token, ''), recovery_token = COALESCE(recovery_token, ''), email_change = COALESCE(email_change, ''), email_change_token_new = COALESCE(email_change_token_new, ''), email_change_token_current = COALESCE(email_change_token_current, ''), phone = COALESCE(phone, ''), phone_change = COALESCE(phone_change, ''), phone_change_token = COALESCE(phone_change_token, ''), reauthentication_token = COALESCE(reauthentication_token, ''), is_sso_user = COALESCE(is_sso_user, false), is_anonymous = COALESCE(is_anonymous, false), email_change_confirm_status = COALESCE(email_change_confirm_status, 0);
END$$;

-- 10. SEED DATA: MENU CATEGORIES & HERO IMAGES
-- CIAO ITALY IS DISPLAY ORDER 1
-- ---------------------------------------------------------------------
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_ciao_italy', 'CIAO ITALY', 'ciao-italy', 'standard', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1200&auto=format&fit=crop&q=80', 1, true, '[{"name": "Extra Parmesan Cheese", "price": 25.0}, {"name": "Extra Mozzarella", "price": 25.0}, {"name": "Extra Macon", "price": 30.0}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_salad_bar', 'SALAD BAR', 'salad-bar', 'standard', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&auto=format&fit=crop&q=80', 2, true, '[{"name": "Grilled Chicken", "price": 30.0}, {"name": "Grilled Halloumi", "price": 30.0}, {"name": "Grilled Sirloin Steak 150g", "price": 95.0}, {"name": "Danish Feta", "price": 20.0}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_poke_bowl', 'POKE BOWL', 'poke-bowl', 'standard', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=80', 3, true, '[{"name": "Grilled Chicken", "price": 30.0}, {"name": "Grilled Halloumi", "price": 30.0}, {"name": "Grilled Sirloin Steak 150g", "price": 95.0}, {"name": "Danish Feta", "price": 20.0}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_stir_fry', 'STIR FRY', 'stir-fry', 'standard', 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=1200&auto=format&fit=crop&q=80', 4, true, '[{"name": "Extra Chicken", "price": 30.0}, {"name": "Extra Beef", "price": 45.0}, {"name": "Extra Tofu", "price": 25.0}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_wraps', 'WRAPS', 'wraps', 'standard', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=1200&auto=format&fit=crop&q=80', 5, true, '[{"name": "Wrap: Low-GI Wrap", "price": 0.0}, {"name": "Wrap: Gluten Free Bread", "price": 0.0}, {"name": "Cheese Sauce", "price": 35.0}, {"name": "Cheesy Jalapeno Sauce", "price": 35.0}, {"name": "Mushroom Sauce", "price": 35.0}, {"name": "Potato Wedges", "price": 35.0}, {"name": "Sweet Potato Wedges", "price": 35.0}, {"name": "Asian Slaw", "price": 20.0}, {"name": "Coleslaw", "price": 20.0}, {"name": "Village Greek Salad", "price": 25.0}, {"name": "Green Salad", "price": 20.0}, {"name": "Potato Salad", "price": 25.0}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_sandwiches', 'SANDWICHES', 'sandwiches', 'standard', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=1200&auto=format&fit=crop&q=80', 6, true, '[{"name": "Bread: Gluten Free Bread", "price": 0.0}, {"name": "Bread: Seeded", "price": 0.0}, {"name": "Bread: Sour Dough", "price": 0.0}, {"name": "Bread: Panini", "price": 0.0}, {"name": "Bread: Mini Baguette", "price": 0.0}, {"name": "Bread: Focaccia", "price": 0.0}, {"name": "Bread: Pita", "price": 0.0}, {"name": "Cheese Sauce", "price": 35.0}, {"name": "Cheesy Jalapeno Sauce", "price": 35.0}, {"name": "Mushroom Sauce", "price": 35.0}, {"name": "Potato Wedges", "price": 35.0}, {"name": "Sweet Potato Wedges", "price": 35.0}, {"name": "Asian Slaw", "price": 20.0}, {"name": "Coleslaw", "price": 20.0}, {"name": "Village Greek Salad", "price": 25.0}, {"name": "Green Salad", "price": 20.0}, {"name": "Potato Salad", "price": 25.0}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_hot_dogs', 'HOT DOG SALOON', 'hot-dog-saloon', 'standard', 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=1200&auto=format&fit=crop&q=80', 7, true, '[{"name": "Cheese Sauce", "price": 35.0}, {"name": "Cheesy Jalapeno Sauce", "price": 35.0}, {"name": "Mushroom Sauce", "price": 35.0}, {"name": "Potato Wedges", "price": 35.0}, {"name": "Sweet Potato Wedges", "price": 35.0}, {"name": "Asian Slaw", "price": 20.0}, {"name": "Coleslaw", "price": 20.0}, {"name": "Village Greek Salad", "price": 25.0}, {"name": "Green Salad", "price": 20.0}, {"name": "Potato Salad", "price": 25.0}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_burger_bar', 'BURGER BAR', 'burger-bar', 'standard', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&auto=format&fit=crop&q=80', 8, true, '[{"name": "Extra Beef Patty", "price": 40.0}, {"name": "Extra Chicken Fillet", "price": 35.0}, {"name": "Extra Halloumi", "price": 45.0}, {"name": "Extra Cheese", "price": 25.0}, {"name": "Extra Macon", "price": 30.0}, {"name": "Cheese Sauce", "price": 35.0}, {"name": "Cheesy Jalapeno Sauce", "price": 35.0}, {"name": "Mushroom Sauce", "price": 35.0}, {"name": "Potato Wedges", "price": 35.0}, {"name": "Sweet Potato Wedges", "price": 35.0}, {"name": "Asian Slaw", "price": 20.0}, {"name": "Coleslaw", "price": 20.0}, {"name": "Village Greek Salad", "price": 25.0}, {"name": "Green Salad", "price": 20.0}, {"name": "Potato Salad", "price": 25.0}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_sides_sauces', 'SIDES & SAUCES', 'sides-and-sauces', 'standard', 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=1200&auto=format&fit=crop&q=80', 9, true, '[]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_fitness_meals', 'FITNESS MEALS', 'fitness-meals', 'standard', 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=1200&auto=format&fit=crop&q=80', 10, true, '[]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_soups', 'HOMEMADE WINTER SOUPS', 'homemade-winter-soups', 'standard', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1200&auto=format&fit=crop&q=80', 11, true, '[{"name": "Side: Fresh Panini Roll & Butter", "price": 0.0}, {"name": "Side: Gluten Free Bread", "price": 0.0}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_ramen_bowls', 'RAMEN BOWLS', 'ramen-bowls', 'standard', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200&auto=format&fit=crop&q=80', 12, true, '[{"name": "Extra Chilli Oil", "price": 10.0}, {"name": "Extra Boiled Egg", "price": 15.0}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_vegan_meals', 'VEGAN MEALS', 'vegan-meals', 'standard', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&auto=format&fit=crop&q=80', 13, true, '[]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;
INSERT INTO public.menu_categories (id, name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
VALUES ('cat_chefs_choice', 'Chef''s Choice Daily Specials', 'chefs-choice-daily', 'chefs_choice', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80', 14, true, '[]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, hero_image_url = EXCLUDED.hero_image_url, display_order = EXCLUDED.display_order, add_ons = EXCLUDED.add_ons;

-- ---------------------------------------------------------------------
-- 11. SEED DATA: MENU DISHES (50+ Dishes with Prices & Dietary Tags)
-- ---------------------------------------------------------------------
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_01', 'cat_ciao_italy', 'Chicken Aglio e Olio Penne', 'Fresh Garlic, Olive Oil, Parmesan Cheese, Chicken', 'Fresh Garlic, Olive Oil, Parmesan Cheese, Chicken', ARRAY['Halaal']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_02', 'cat_ciao_italy', 'Spaghetti ala Courgette', 'Spaghetti aglio e olio, Courgette, Parmesan, Chilli Flakes', 'Spaghetti aglio e olio, Courgette, Parmesan, Chilli Flakes', ARRAY['Vegetarian']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_03', 'cat_ciao_italy', 'Penne Arrabbiata', 'A Spicy Italian pasta dish that packs a punch', 'A Spicy Italian pasta dish that packs a punch', ARRAY['Vegetarian']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_04', 'cat_ciao_italy', 'Roasted Vegetable Penne', 'Penne Pasta, Roasted vegetables, Napolitana Sauce, Ricotta', 'Penne Pasta, Roasted vegetables, Napolitana Sauce, Ricotta', ARRAY['Vegetarian']::text[], 80.00, 130.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_05', 'cat_ciao_italy', 'Chicken Napolitana Penne', 'Chicken, Tomato-based Sauce, Herbs, Onions, Garlic', 'Chicken, Tomato-based Sauce, Herbs, Onions, Garlic', ARRAY['Halaal']::text[], 80.00, 130.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_06', 'cat_ciao_italy', 'Spaghetti Meatballs', 'Spaghetti Pasta, Meatballs, Rich Tomato Gravy', 'Spaghetti Pasta, Meatballs, Rich Tomato Gravy', ARRAY['Halaal']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_07', 'cat_ciao_italy', 'Creamy Spinach and Feta Penne', 'Penne Pasta, Creamy spinach, Danish Feta Cheese', 'Penne Pasta, Creamy spinach, Danish Feta Cheese', ARRAY['Vegetarian']::text[], 80.00, 130.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_08', 'cat_ciao_italy', 'Chicken Alfredo Linguini Pasta', 'Tender grilled chicken slices, Linguini pasta, Butter, Heavy cream, Parmesan cheese, Garlic', 'Tender grilled chicken slices, Linguini pasta, Butter, Heavy cream, Parmesan cheese, Garlic', ARRAY['Halaal']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_09', 'cat_ciao_italy', 'Deboned Oxtail Risotto', 'Slow-braised gelatinous oxtail meat, Risotto rice', 'Slow-braised gelatinous oxtail meat, Risotto rice', ARRAY['Halaal']::text[], 120.00, 200.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_10', 'cat_ciao_italy', 'Porcini Mushroom Risotto', 'Traditional luxurious Italian rice dish', 'Traditional luxurious Italian rice dish', ARRAY['Vegetarian']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_11', 'cat_ciao_italy', 'Spaghetti Bolognese', 'Thick rich Bolognese', 'Thick rich Bolognese', ARRAY['Halaal']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_12', 'cat_ciao_italy', 'Spaghetti Cacio e pepe Carbonara', 'Parmesan Cheese, Egg Yolk, Pepper, Creamy Sauce', 'Parmesan Cheese, Egg Yolk, Pepper, Creamy Sauce', ARRAY['Vegetarian']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_13', 'cat_ciao_italy', 'Chicken Pesto Penne', 'Grilled Chicken, Basil Pesto, Dash of Cream', 'Grilled Chicken, Basil Pesto, Dash of Cream', ARRAY['Halaal']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_14', 'cat_ciao_italy', 'Butternut Napolitana Ravioli', 'Butternut Ravioli, Tomato-based Sauce, Herbs, Onions, Garlic', 'Butternut Ravioli, Tomato-based Sauce, Herbs, Onions, Garlic', ARRAY['Vegetarian']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_15', 'cat_ciao_italy', 'Beef Lasagne', 'Savoury Bolognese Sauce, Creamy Béchamel Sauce, Pasta Sheets, Melted Cheese', 'Savoury Bolognese Sauce, Creamy Béchamel Sauce, Pasta Sheets, Melted Cheese', ARRAY['Halaal']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_16', 'cat_ciao_italy', 'Macaroni Cheese and Macon', 'Macaroni pasta, Rich creamy cheese sauce, Macon', 'Macaroni pasta, Rich creamy cheese sauce, Macon', ARRAY['Halaal']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_17', 'cat_ciao_italy', 'Aubergine and Courgette Lasagne', 'Aubergine, Courgette, Creamy Béchamel Sauce, Pasta Sheets, Melted Cheese', 'Aubergine, Courgette, Creamy Béchamel Sauce, Pasta Sheets, Melted Cheese', ARRAY['Vegetarian']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_18', 'cat_ciao_italy', 'Mafia Gnocchi', 'Creamy Bolognaise, Mushroom, Chilli', 'Creamy Bolognaise, Mushroom, Chilli', ARRAY['Halaal']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ci_19', 'cat_ciao_italy', 'Creamy Lemon Prawn & Calamari Spaghetti', 'Spaghetti, Prawns, Calamari, Zesty Lemon Cream Sauce', 'Spaghetti, Prawns, Calamari, Zesty Lemon Cream Sauce', ARRAY['Halaal']::text[], 145.00, 300.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sb_01', 'cat_salad_bar', 'Tuna Salad', 'Lettuce, Green Beans, Tomato, Cucumber, Boiled Baby Potato, Olives, Boiled egg, French dressing', 'Lettuce, Green Beans, Tomato, Cucumber, Boiled Baby Potato, Olives, Boiled egg, French dressing', ARRAY['Halaal']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sb_02', 'cat_salad_bar', 'Roasted Butternut Salad', 'Roasted Butternut, Danish Feta Cheese, Sundry Tomato, Roasted Cashew Nuts, Rocket, Quinoa Sprinkles, Basil, Maple Dressing', 'Roasted Butternut, Danish Feta Cheese, Sundry Tomato, Roasted Cashew Nuts, Rocket, Quinoa Sprinkles, Basil, Maple Dressing', ARRAY['Vegetarian', 'Gluten-Free']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sb_03', 'cat_salad_bar', 'Grilled Chicken or Halloumi Chop Salad', 'Green and Red Cabbage, Roasted Cherry Tomato, Cucumber, Green Beans, Sweet Corn, Danish Feta Cheese, Chickpeas, Creamy Dressing', 'Green and Red Cabbage, Roasted Cherry Tomato, Cucumber, Green Beans, Sweet Corn, Danish Feta Cheese, Chickpeas, Creamy Dressing', ARRAY['Halaal']::text[], 80.00, 130.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sb_04', 'cat_salad_bar', 'Thai Beef Noodle Salad', 'Marinated Pan-Fried Beef, Rice Noodles, Stir-fried Vegetables, Basil, Coriander, Sweet Soy Ginger Dressing', 'Marinated Pan-Fried Beef, Rice Noodles, Stir-fried Vegetables, Basil, Coriander, Sweet Soy Ginger Dressing', ARRAY['Halaal']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sb_05', 'cat_salad_bar', 'Cajun Chicken & Brown Rice Salad', 'Cherry tomatoes, Cucumber, Lettuce, Chopped Herbs, White Beans, Parsley Lemon Dressing', 'Cherry tomatoes, Cucumber, Lettuce, Chopped Herbs, White Beans, Parsley Lemon Dressing', ARRAY['Halaal', 'Gluten-Free']::text[], 80.00, 130.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sb_06', 'cat_salad_bar', 'Roasted veg and couscous salad', 'Roasted Seasonal Vegetables, Wholewheat Couscous, Robiola Cheese, Orange Honey Balsamic Dressing', 'Roasted Seasonal Vegetables, Wholewheat Couscous, Robiola Cheese, Orange Honey Balsamic Dressing', ARRAY['Vegetarian']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_pb_01', 'cat_poke_bowl', 'Salmon', 'Japanese Rice, Raw Salmon, Edamame Beans, Shredded Cabbage, Julienne Carrots, Cucumber, Green Beans, Cherry Tomatoes, Spring Onion, Sweet Wasabi Dressing', 'Japanese Rice, Raw Salmon, Edamame Beans, Shredded Cabbage, Julienne Carrots, Cucumber, Green Beans, Cherry Tomatoes, Spring Onion, Sweet Wasabi Dressing', ARRAY['Gluten-Free']::text[], 140.00, 280.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_pb_02', 'cat_poke_bowl', 'Chicken Teriyaki', 'Japanese Rice, Teriyaki Chicken, Shredded Cabbage, Cucumber, Edamame Beans, Julienne Carrots, Cherry Tomatoes, Boiled Egg, Teriyaki Dressing', 'Japanese Rice, Teriyaki Chicken, Shredded Cabbage, Cucumber, Edamame Beans, Julienne Carrots, Cherry Tomatoes, Boiled Egg, Teriyaki Dressing', ARRAY['Halaal']::text[], 80.00, 160.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_pb_03', 'cat_poke_bowl', 'Tinned Tuna', 'Japanese Rice, Tinned Tuna, Edamame Beans, Shredded Cabbage, Julienne Carrots, Cucumber, Green Beans, Cherry Tomatoes, Spring Onion, Creamy Soy Dressing', 'Japanese Rice, Tinned Tuna, Edamame Beans, Shredded Cabbage, Julienne Carrots, Cucumber, Green Beans, Cherry Tomatoes, Spring Onion, Creamy Soy Dressing', ARRAY['Halaal']::text[], 80.00, 130.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_pb_04', 'cat_poke_bowl', 'High Protein', 'Grilled Chicken Breast, Boiled Egg, Steamed Broccoli, Green Salad, Beans, Lentils, Light Dressing', 'Grilled Chicken Breast, Boiled Egg, Steamed Broccoli, Green Salad, Beans, Lentils, Light Dressing', ARRAY['Halaal', 'Low Carb']::text[], 80.00, 160.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sf_01', 'cat_stir_fry', 'Beef Stir-Fry', 'Asian Beef Stir-Fry tossed with Rice or Noodles', 'Asian Beef Stir-Fry tossed with Rice or Noodles', ARRAY['Halaal']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sf_02', 'cat_stir_fry', 'Chicken Stir-Fry', 'Asian Chicken Stir-Fry tossed with Rice or Noodles', 'Asian Chicken Stir-Fry tossed with Rice or Noodles', ARRAY['Halaal']::text[], 80.00, 130.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sf_03', 'cat_stir_fry', 'Vegetarian Stir-Fry', 'Vegetable and Tofu Stir-Fry tossed with Rice or Noodles', 'Vegetable and Tofu Stir-Fry tossed with Rice or Noodles', ARRAY['Vegetarian']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_wr_01', 'cat_wraps', 'Middle Eastern', 'Chicken, Humus, Herb salad, Tahini, Lentils', 'Chicken, Humus, Herb salad, Tahini, Lentils', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_wr_02', 'cat_wraps', 'Mexican Grilled Chicken', 'Grilled Chicken, Honey Mustard Aioli, Lettuce, Cucumber, Spring onion, Spicy Beans', 'Grilled Chicken, Honey Mustard Aioli, Lettuce, Cucumber, Spring onion, Spicy Beans', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_wr_03', 'cat_wraps', 'BBQ Beef Wrap', 'BBQ Beef Strips, Roasted Garlic Aioli, Gherkins, Coleslaw, Roasted Sweet Potato', 'BBQ Beef Strips, Roasted Garlic Aioli, Gherkins, Coleslaw, Roasted Sweet Potato', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_wr_04', 'cat_wraps', 'Salmon Wholewheat Wrap', 'Smoked Salmon, Cream Cheese, Onion, Capers, Herb Salad', 'Smoked Salmon, Cream Cheese, Onion, Capers, Herb Salad', '{}'::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_wr_05', 'cat_wraps', 'Halloumi Wrap', 'Halloumi, Roasted Vegetables, Herbs, Honey Mustard Aioli, Spicy Beans', 'Halloumi, Roasted Vegetables, Herbs, Honey Mustard Aioli, Spicy Beans', ARRAY['Vegetarian']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_01', 'cat_sandwiches', 'Grilled Chicken', 'Grilled Chicken, Honey Mustard Aioli, Lettuce, Cucumber, Spring onion', 'Grilled Chicken, Honey Mustard Aioli, Lettuce, Cucumber, Spring onion', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_02', 'cat_sandwiches', 'Egg Mayonnaise', 'Egg Mayonnaise, Lettuce, Gherkins, Roasted Peppers', 'Egg Mayonnaise, Lettuce, Gherkins, Roasted Peppers', ARRAY['Vegetarian']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_03', 'cat_sandwiches', 'Roast Beef', 'Roast Beef, Roasted Garlic Aioli, Tomato Jam, Rocket', 'Roast Beef, Roasted Garlic Aioli, Tomato Jam, Rocket', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_04', 'cat_sandwiches', 'Napoli', 'Napoli Salami, Sweet Provolone, Grilled Marinaded Vegetables', 'Napoli Salami, Sweet Provolone, Grilled Marinaded Vegetables', '{}'::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_05', 'cat_sandwiches', 'Wafer Thin Chicken Roll', 'Wafer thin Chicken Roll, Aioli, Cheddar Cheese, Sundried Tomato, Salad', 'Wafer thin Chicken Roll, Aioli, Cheddar Cheese, Sundried Tomato, Salad', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_06', 'cat_sandwiches', 'Goat Cheese', 'Goat Cheese, Tomato, Parsley Pesto, Cucumber', 'Goat Cheese, Tomato, Parsley Pesto, Cucumber', ARRAY['Vegetarian']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_07', 'cat_sandwiches', 'Middle Eastern', 'Chicken, Tahini butter, humus, grilled veg, herb salad', 'Chicken, Tahini butter, humus, grilled veg, herb salad', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_08', 'cat_sandwiches', 'Jersey Milk Lamb Prosciutto', 'Jersey Milk Cheese, Lamb Prosciutto, Wild Rocket, Mature Balsamic Drizzle', 'Jersey Milk Cheese, Lamb Prosciutto, Wild Rocket, Mature Balsamic Drizzle', ARRAY['Halaal']::text[], 90.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_09', 'cat_sandwiches', 'Chicken Mayonnaise', 'Chicken Mayonnaise, Seasoning', 'Chicken Mayonnaise, Seasoning', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_10', 'cat_sandwiches', 'Macon, Egg, Cheese & Tomato', 'Macon, Egg, Cheese, Tomato', 'Macon, Egg, Cheese, Tomato', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_11', 'cat_sandwiches', 'Macon, Cheese and Tomato', 'Macon, Cheese, Tomato', 'Macon, Cheese, Tomato', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sw_12', 'cat_sandwiches', 'Cheese and Tomato', 'Cheese, Tomato', 'Cheese, Tomato', ARRAY['Vegetarian']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_hd_01', 'cat_hot_dogs', 'Mexican Beef Hot Dog', 'Chorizo Beef Hot Dog, Mexican Salsa, Chimichurri Sauce, Cheese', 'Chorizo Beef Hot Dog, Mexican Salsa, Chimichurri Sauce, Cheese', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_hd_02', 'cat_hot_dogs', 'Beef Hot Dog', 'Beef Hot Dog, Honey Mustard Aioli, Fried Onion, Tomato Sauce', 'Beef Hot Dog, Honey Mustard Aioli, Fried Onion, Tomato Sauce', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_hd_03', 'cat_hot_dogs', 'French Beef Hot Dog', 'Beef Hot Dog, Aioli, Mustard, Homemade pickled Gherkins, Baguette', 'Beef Hot Dog, Aioli, Mustard, Homemade pickled Gherkins, Baguette', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_bb_01', 'cat_burger_bar', 'Classic Burger', '150g Beef Patty or 150g Grilled Chicken Fillet Burger or Halloumi, Aioli Special Sauce, Sliced Tomato, Gherkins, Lettuce', '150g Beef Patty or 150g Grilled Chicken Fillet Burger or Halloumi, Aioli Special Sauce, Sliced Tomato, Gherkins, Lettuce', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_bb_02', 'cat_burger_bar', 'Cheese Burger', '150g Beef Patty or 150g Grilled Chicken Fillet Burger or Halloumi, Cheese, Aioli Special Sauce, Sliced Tomato, Gherkins, Lettuce', '150g Beef Patty or 150g Grilled Chicken Fillet Burger or Halloumi, Cheese, Aioli Special Sauce, Sliced Tomato, Gherkins, Lettuce', ARRAY['Halaal']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ss_01', 'cat_sides_sauces', 'Cheese Sauce', 'Rich creamy cheddar cheese sauce', 'Rich creamy cheddar cheese sauce', ARRAY['Vegetarian']::text[], 35.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ss_02', 'cat_sides_sauces', 'Cheesy Jalapeno Sauce', 'Spicy cheesy jalapeno dipping sauce', 'Spicy cheesy jalapeno dipping sauce', ARRAY['Vegetarian']::text[], 35.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ss_03', 'cat_sides_sauces', 'Mushroom Sauce', 'Creamy sauteed mushroom herb sauce', 'Creamy sauteed mushroom herb sauce', ARRAY['Vegetarian']::text[], 35.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ss_04', 'cat_sides_sauces', 'Potato Wedges', 'Crispy roasted potato wedges with rosemary salt', 'Crispy roasted potato wedges with rosemary salt', ARRAY['Vegetarian']::text[], 35.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ss_05', 'cat_sides_sauces', 'Sweet Potato Wedges', 'Oven-baked sweet potato wedges', 'Oven-baked sweet potato wedges', ARRAY['Vegetarian', 'Gluten-Free']::text[], 35.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ss_06', 'cat_sides_sauces', 'Asian Slaw', 'Crisp shredded cabbage, carrot, and sesame ginger dressing', 'Crisp shredded cabbage, carrot, and sesame ginger dressing', ARRAY['Vegetarian', 'Vegan']::text[], 20.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ss_07', 'cat_sides_sauces', 'Coleslaw', 'Fresh red and white cabbage in creamy home dressing', 'Fresh red and white cabbage in creamy home dressing', ARRAY['Vegetarian']::text[], 20.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ss_08', 'cat_sides_sauces', 'Village Greek Salad', 'Tomato, cucumber, olives, and Danish feta', 'Tomato, cucumber, olives, and Danish feta', ARRAY['Vegetarian']::text[], 25.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ss_09', 'cat_sides_sauces', 'Green Salad', 'Crisp lettuce, cucumber ribbons, and light herb dressing', 'Crisp lettuce, cucumber ribbons, and light herb dressing', ARRAY['Vegetarian', 'Vegan', 'Gluten-Free']::text[], 20.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_ss_10', 'cat_sides_sauces', 'Potato Salad', 'Diced baby potatoes in home dressing', 'Diced baby potatoes in home dressing', ARRAY['Vegetarian']::text[], 25.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_fm_01', 'cat_fitness_meals', 'Grilled Chicken Fillet served with Sweet Potato and Broccoli', 'Grilled Chicken Fillet, Sweet Potato, Broccoli', 'Grilled Chicken Fillet, Sweet Potato, Broccoli', ARRAY['Halaal', 'Gluten-Free', 'Low Carb']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_fm_02', 'cat_fitness_meals', 'Grilled Chicken Fillet served with Brown Rice and Broccoli', 'Grilled Chicken Fillet, Brown Rice, Broccoli', 'Grilled Chicken Fillet, Brown Rice, Broccoli', ARRAY['Halaal', 'Gluten-Free']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_fm_03', 'cat_fitness_meals', 'Grilled Chicken Fillet served with Broccoli and Seasonal Vegetables', 'Grilled Chicken Fillet, Broccoli, Seasonal Vegetables', 'Grilled Chicken Fillet, Broccoli, Seasonal Vegetables', ARRAY['Halaal', 'Gluten-Free', 'Low Carb']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_fm_04', 'cat_fitness_meals', 'Grilled Beef Fillet served with Sweet Potato and Broccoli', 'Grilled Beef Fillet, Sweet Potato, Broccoli', 'Grilled Beef Fillet, Sweet Potato, Broccoli', ARRAY['Halaal', 'Gluten-Free', 'Low Carb']::text[], 130.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_fm_05', 'cat_fitness_meals', 'Grilled Beef Fillet served with Brown Rice and Broccoli', 'Grilled Beef Fillet, Brown Rice, Broccoli', 'Grilled Beef Fillet, Brown Rice, Broccoli', ARRAY['Halaal', 'Gluten-Free']::text[], 130.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_fm_06', 'cat_fitness_meals', 'Grilled Beef Fillet served with Broccoli and Seasonal Vegetables', 'Grilled Beef Fillet, Broccoli, Seasonal Vegetables', 'Grilled Beef Fillet, Broccoli, Seasonal Vegetables', ARRAY['Halaal', 'Gluten-Free', 'Low Carb']::text[], 130.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sp_01', 'cat_soups', 'Ginger & Honey Butternut Soup', 'Slow-roasted butternut, fresh ginger, golden honey, vegetable stock, cream', 'Slow-roasted butternut, fresh ginger, golden honey, vegetable stock, cream', ARRAY['Vegetarian', 'Gluten-Free']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sp_02', 'cat_soups', 'Pea, Tomato & Lentil Soup', 'Garden green peas, crushed plum tomatoes, brown lentils, fragrant herbs', 'Garden green peas, crushed plum tomatoes, brown lentils, fragrant herbs', ARRAY['Vegan', 'Vegetarian', 'Gluten-Free']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_sp_03', 'cat_soups', 'Barley and Vegetable Soup', 'Pearl barley, root vegetables, celery, leeks, aromatic herb broth', 'Pearl barley, root vegetables, celery, leeks, aromatic herb broth', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_rb_01', 'cat_ramen_bowls', 'Pulled Chicken', 'Pulled Chicken, Noodles, Vegetables, Chicken Broth, Chilli Oil on the side', 'Pulled Chicken, Noodles, Vegetables, Chicken Broth, Chilli Oil on the side', ARRAY['Halaal']::text[], 80.00, 160.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_rb_02', 'cat_ramen_bowls', 'Slow Cooked Brisket', 'Slow Cooked Brisket, Noodles, Vegetables, Marrow Bone Broth, Chilli Oil on the side', 'Slow Cooked Brisket, Noodles, Vegetables, Marrow Bone Broth, Chilli Oil on the side', ARRAY['Halaal']::text[], 80.00, 160.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_rb_03', 'cat_ramen_bowls', 'Tofu and Vegetable', 'Tofu, Noodles, Vegetables, Vegetable Broth, Chilli Oil on the side', 'Tofu, Noodles, Vegetables, Vegetable Broth, Chilli Oil on the side', ARRAY['Vegetarian', 'Vegan']::text[], 80.00, 160.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_01', 'cat_vegan_meals', 'Roasted Butternut Salad', 'Roasted Butternut, Sundry Tomato, Roasted Cashew Nuts, Rocket, Quinoa Sprinkles, Basil, Maple Dressing', 'Roasted Butternut, Sundry Tomato, Roasted Cashew Nuts, Rocket, Quinoa Sprinkles, Basil, Maple Dressing', ARRAY['Vegan', 'Vegetarian', 'Gluten-Free']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_02', 'cat_vegan_meals', 'Roasted Vegetable and Couscous Salad', 'Roasted Seasonal Vegetables, Wholewheat Couscous, Orange Honey Balsamic Dressing', 'Roasted Seasonal Vegetables, Wholewheat Couscous, Orange Honey Balsamic Dressing', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_03', 'cat_vegan_meals', 'Green Salad', 'Mixed fresh garden greens, cucumber ribbons, cherry tomatoes, house vinaigrette', 'Mixed fresh garden greens, cucumber ribbons, cherry tomatoes, house vinaigrette', ARRAY['Vegan', 'Vegetarian', 'Gluten-Free']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_04', 'cat_vegan_meals', 'Potato Salad tossed in a Vinaigrette Dressing', 'Baby potatoes, fresh chopped chives, tangy French vinaigrette dressing', 'Baby potatoes, fresh chopped chives, tangy French vinaigrette dressing', ARRAY['Vegan', 'Vegetarian', 'Gluten-Free']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_05', 'cat_vegan_meals', 'Spaghetti ala Courgette Pasta', 'Spaghetti aglio e olio Courgette, Chilli Flakes', 'Spaghetti aglio e olio Courgette, Chilli Flakes', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_06', 'cat_vegan_meals', 'Penne Arrabbiata Pasta', 'Spicy Italian pasta dish', 'Spicy Italian pasta dish', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_07', 'cat_vegan_meals', 'Roasted Vegetable Penne', 'Penne Pasta, Roasted vegetables, Napolitana Sauce', 'Penne Pasta, Roasted vegetables, Napolitana Sauce', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, 130.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_08', 'cat_vegan_meals', 'Butternut Napolitana Ravioli', 'Butternut Ravioli, Tomato-based Sauce, Herbs, Onions, Garlic', 'Butternut Ravioli, Tomato-based Sauce, Herbs, Onions, Garlic', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_09', 'cat_vegan_meals', 'Aubergine and Courgette Lasagne', 'Aubergine, Courgette, Tomato-based sauce, Pasta Sheets', 'Aubergine, Courgette, Tomato-based sauce, Pasta Sheets', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, 140.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_10', 'cat_vegan_meals', 'Vegetarian Stir-Fry', 'Vegetable and Tofu Stir-Fry, Rice Noodles', 'Vegetable and Tofu Stir-Fry, Rice Noodles', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, 120.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_11', 'cat_vegan_meals', 'Mediterranean Poke Bowl', 'Humus, Whole Chickpeas, Cucumber, Cherry Tomatoes, Tahini, Pita Bread', 'Humus, Whole Chickpeas, Cucumber, Cherry Tomatoes, Tahini, Pita Bread', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, 130.00, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_12', 'cat_vegan_meals', 'Mediterranean Vegan Sandwich', 'Tomato, Basil, Cucumber, Roasted Peppers', 'Tomato, Basil, Cucumber, Roasted Peppers', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;
INSERT INTO public.menu_items (id, category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
VALUES ('item_vm_13', 'cat_vegan_meals', 'Humus & Roasted Vegetable Vegan Sandwich', 'Humus, Roasted Vegetables, Cherry Tomato', 'Humus, Roasted Vegetables, Cherry Tomato', ARRAY['Vegan', 'Vegetarian']::text[], 80.00, NULL, 'standard', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, ingredients = EXCLUDED.ingredients, dietary_tags = EXCLUDED.dietary_tags, price_regular = EXCLUDED.price_regular, price_large = EXCLUDED.price_large;

-- ---------------------------------------------------------------------
-- 12. SEED DATA: 8-WEEK CHEF'S CHOICE ROTATION & 40 DAILY RECIPES
-- ---------------------------------------------------------------------
INSERT INTO public.cycle_rotations (week_number, title, description, is_active_now, is_advance_locked)
VALUES (1, 'Week 1 Chef Rotation', 'Curated South African gourmet daily specials', true, false)
ON CONFLICT (week_number) DO UPDATE SET title = EXCLUDED.title, is_active_now = EXCLUDED.is_active_now;
INSERT INTO public.cycle_rotations (week_number, title, description, is_active_now, is_advance_locked)
VALUES (2, 'Week 2 Chef Rotation', 'Curated South African gourmet daily specials', false, false)
ON CONFLICT (week_number) DO UPDATE SET title = EXCLUDED.title, is_active_now = EXCLUDED.is_active_now;
INSERT INTO public.cycle_rotations (week_number, title, description, is_active_now, is_advance_locked)
VALUES (3, 'Week 3 Chef Rotation', 'Curated South African gourmet daily specials', false, false)
ON CONFLICT (week_number) DO UPDATE SET title = EXCLUDED.title, is_active_now = EXCLUDED.is_active_now;
INSERT INTO public.cycle_rotations (week_number, title, description, is_active_now, is_advance_locked)
VALUES (4, 'Week 4 Chef Rotation', 'Curated South African gourmet daily specials', false, false)
ON CONFLICT (week_number) DO UPDATE SET title = EXCLUDED.title, is_active_now = EXCLUDED.is_active_now;
INSERT INTO public.cycle_rotations (week_number, title, description, is_active_now, is_advance_locked)
VALUES (5, 'Week 5 Chef Rotation', 'Curated South African gourmet daily specials', false, false)
ON CONFLICT (week_number) DO UPDATE SET title = EXCLUDED.title, is_active_now = EXCLUDED.is_active_now;
INSERT INTO public.cycle_rotations (week_number, title, description, is_active_now, is_advance_locked)
VALUES (6, 'Week 6 Chef Rotation', 'Curated South African gourmet daily specials', false, false)
ON CONFLICT (week_number) DO UPDATE SET title = EXCLUDED.title, is_active_now = EXCLUDED.is_active_now;
INSERT INTO public.cycle_rotations (week_number, title, description, is_active_now, is_advance_locked)
VALUES (7, 'Week 7 Chef Rotation', 'Curated South African gourmet daily specials', false, false)
ON CONFLICT (week_number) DO UPDATE SET title = EXCLUDED.title, is_active_now = EXCLUDED.is_active_now;
INSERT INTO public.cycle_rotations (week_number, title, description, is_active_now, is_advance_locked)
VALUES (8, 'Week 8 Chef Rotation', 'Curated South African gourmet daily specials', false, false)
ON CONFLICT (week_number) DO UPDATE SET title = EXCLUDED.title, is_active_now = EXCLUDED.is_active_now;

INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (1, 'Monday', 'Roast chicken, roast potatoes, seasonal vegetables and chicken gravy', 'Aubergine, lentil and tomato moussaka', 'Lemon & herb chicken breast with steamed greens and quinoa', 'Butter Chicken Curry with fragrant basmati rice and sambals', 'Pastrami, Emmental cheese and whole-grain mustard panini')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (1, 'Tuesday', 'Traditional Bobotie with yellow rice and fruit chutney', 'Cape Malay Lentil Bobotie with yellow rice', 'Grilled linefish fillet with asparagus and crushed baby potatoes', 'Tender Lamb Rogan Josh with basmati rice', 'Smoked chicken, avocado and coriander wrap')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (1, 'Wednesday', 'Classic Cottage Pie with rich beef mince and buttery mash', 'Vegetable Shepherds Pie with sweet potato mash', 'Poached salmon fillet with roasted Mediterranean vegetables', 'Creamy Chicken Korma with turmeric rice', 'Roast beef, caramelized onion and wild rocket focaccia')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (1, 'Thursday', 'Grilled Sirloin Steak with roasted garlic wedges and mushroom sauce', 'Grilled Portobello Mushroom Steak with parmesan polenta', 'Cajun grilled chicken with brown rice and broccoli spears', 'Durban Beef Curry with spiced potatoes and roti', 'Caprese: buffalo mozzarella, plum tomato and pesto baguette')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (1, 'Friday', 'Crispy Hake Fillet with rustic tartar sauce, chips and mint peas', 'Golden Halloumi Burger with avo and sweet potato fries', 'Grilled hake with mixed seasonal garden salad', 'Prawn and coconut curry with jasmine rice', 'Club sandwich: grilled chicken, crispy macon, egg and aioli')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (2, 'Monday', 'Slow-cooked Beef Bourguignon with silky potato purée', 'Wild Mushroom and Thyme Risotto with parmesan shavings', 'Grilled chicken breast with roasted sweet potato & kale', 'Thai Green Chicken Curry with jasmine rice', 'Turkey, brie and cranberry toasted sourdough')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (2, 'Tuesday', 'Chicken Marsala with penne pasta and green beans', 'Creamy Spinach and Ricotta Cannelloni', 'Seared tuna steak with edamame bean and cucumber salad', 'Spicy Madras Beef Curry with basmati rice', 'Prosciutto crudo, roasted peppers and bocconcini panini')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (2, 'Wednesday', 'Traditional South African Lamb Potjie with steamed bread', 'Hearty Chickpea and Sweet Potato Potjie', 'Lemon pepper chicken breast with broccoli and wild rice', 'Rich Chicken Tikka Masala with garlic naan', 'Grilled vegetable and hummus wholewheat wrap')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (2, 'Thursday', 'Moroccan Spiced Lamb Tagine with apricot couscous', 'Moroccan Butternut and Chickpea Tagine with almonds', 'Pan-seared sea bass with wilted spinach and baby carrots', 'Creamy Paneer Makhani with cumin basmati rice', 'Smoked ham, gruyère and Dijon mustard croissant')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (2, 'Friday', 'Gourmet Homemade Wagyu Beef Burger with onion marmalade', 'Black Bean and Quinoa Burger with avocado salsa', 'Grilled lemon chicken with quinoa avocado bowl', 'Cape Malay Fish Curry with yellow rice', 'Classic tuna melt with mature cheddar on sourdough')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (3, 'Monday', 'Roast Pork Loin with crackling, apple compote and roast potatoes', 'Butternut Squash and Sage Gnocchi with burnt butter', 'Herb crusted chicken with steamed asparagus and bulgur', 'Creamy Chicken Pasanda with pilau rice', 'Roast chicken, sun-dried tomato and aioli wrap')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (3, 'Tuesday', 'Classic Beef Lasagne with side green salad', 'Spinach, Leek and Feta Spanakopita with Greek salad', 'Grilled sirloin slices with rocket and parmesan salad', 'Tender Lamb Vindaloo with steamed basmati', 'Egg mayonnaise and cress brioche roll')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (3, 'Wednesday', 'Chicken and Mushroom Pie with butter puff pastry and peas', 'Creamy Leek and Mushroom Pot Pie', 'Steamed salmon with ginger, soy and asian greens', 'North Indian Rogan Josh with spiced basmati', 'Pastrami and dill gherkin on Jewish rye bread')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (3, 'Thursday', 'Rosemary Roasted Chicken with roasted root vegetables', 'Stuffed Butternut with cranberries, feta and toasted seeds', 'Grilled chicken fillet with cauli-mash and greens', 'Prawn Coconut Curry with fragrant basmati', 'Chicken Caesar wrap with crispy macon bits')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (3, 'Friday', 'Beer Battered Hake and Chips with homemade tartar sauce', 'Crispy Falafel Platter with tahini and warm pita', 'Poached cod with roasted cherry tomatoes and beans', 'Yellow Dhal Curry with turmeric rice and poppadoms', 'Artisanal cheese and charcuterie baguette')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (4, 'Monday', 'Traditional Shepherds Pie with garden peas and carrot batons', 'Lentil and Mushroom Shepherds Pie with sweet potato top', 'Pan-roasted chicken with braised fennel and baby spinach', 'Butter Chicken with basmati rice and coriander naan', 'Coronation chicken and rocket multigrain baguette')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (4, 'Tuesday', 'Grilled Lemon & Rosemary Chicken Supreme with potato wedges', 'Roasted Vegetable Lasagne with creamy béchamel', 'Char-grilled flank steak with chimichurri and salad', 'Spicy Beef Vindaloo with cumin rice', 'Roast beef and horseradish sauce panini')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (4, 'Wednesday', 'Slow-braised Oxtail with butter beans and stamp mielies', 'Rich Aubergine Parmigiana with basil and mozzarella', 'Grilled chicken with broccoli florets and brown rice', 'Chicken Jalfrezi with fragrant basmati rice', 'Smoked salmon, capers and cream cheese bagel')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (4, 'Thursday', 'Traditional Cape Malay Bobotie with yellow raisin rice', 'Cape Malay Vegetable and Lentil Curry with sambals', 'Pan-fried trout with lemon almond butter and green beans', 'Lamb Korma with cashew nut sauce and basmati', 'Grilled chicken club with macon and tomato on ciabatta')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (4, 'Friday', 'Crispy Fish & Chips with mushy peas and lemon wedges', 'Halloumi and Roasted Veggie Pita with tzatziki', 'Grilled chicken breast with vibrant Mediterranean salad', 'Durban Fish Curry with steamed basmati and atchar', 'Roast turkey and Emmental toasted sourdough')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (5, 'Monday', 'Classic Beef Stifado (Greek Beef Stew) with egg noodles', 'Greek Briam (Roasted Summer Vegetables) with feta', 'Grilled chicken breast with steamed tenderstem broccoli', 'Chicken Curry with coconut cream and basmati rice', 'Bresaola, parmesan shavings and truffle aioli panini')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (5, 'Tuesday', 'Roast Chicken with savoury stuffing and thyme gravy', 'Wild Mushroom and Truffle Tagliatelle', 'Grilled linefish with garden herb quinoa salad', 'Beef Madras with basmati rice and sambals', 'Chicken, avocado and herb mayo seeded wrap')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (5, 'Wednesday', 'Steak and Guinness Pie with creamy mash and baby peas', 'Roasted Sweet Potato and Black Bean Enchiladas', 'Lemon thyme grilled chicken with cauli-rice', 'Lamb Biryani with raita and crispy onions', 'Pastrami, sauerkraut and Swiss cheese on sourdough')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (5, 'Thursday', 'BBQ Glazed Pork Belly Ribs with sweetcorn mash and slaw', 'Barbecue Glazed Tempeh with charred corn salad', 'Pan-seared cod with ratatouille and steamed greens', 'Chicken Tikka Masala with turmeric rice and roti', 'Roast beef, English mustard and watercress baguette')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (5, 'Friday', 'Fresh Pan-fried Hake with hand-cut chips and salad', 'Vegetarian Burger with grilled halloumi and pesto', 'Grilled chicken with avocado chop salad', 'Prawn Malabar Curry with basmati rice', 'Gourmet BLT: crispy macon, lettuce, heirloom tomato, aioli')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (6, 'Monday', 'Italian Chicken Cacciatore with penne and parmesan', 'Creamy Spinach and Mushroom Crêpes with parmesan', 'Grilled chicken breast with asparagus and crushed potatoes', 'Traditional Lamb Curry with yellow rice', 'Smoked chicken and mango chutney wrap')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (6, 'Tuesday', 'Traditional Beef Cottage Pie with cheddar crust', 'Vegetable and Lentil Cottage Pie with crispy potato top', 'Grilled salmon with shaved fennel and citrus salad', 'Butter Chicken Curry with garlic naan', 'Prosciutto and ripe fig jam ciabatta')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (6, 'Wednesday', 'Rosemary Roast Chicken with pumpkin wedges and gravy', 'Roasted Butternut and Goat Cheese Tart with salad', 'Lemon herb chicken fillet with steamed greens and quinoa', 'Spicy Beef Keema with pea pilau and roti', 'Rare roast beef and pickled red onion focaccia')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (6, 'Thursday', 'Braised Beef Short Ribs with polenta and glazed carrots', 'Porcini and Wild Mushroom Risotto with truffle oil', 'Seared tuna fillet with sesame Asian green salad', 'Chicken Korma with flaked almonds and basmati', 'Turkey, brie and sweet chilli panini')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (6, 'Friday', 'Crispy Calamari and Hake Combo with rustic chips and aioli', 'Falafel Bowl with hummus, tabbouleh and warm flatbread', 'Grilled hake with baby spinach and lemon olive oil', 'Goan Fish Curry with steamed fragrant rice', 'Classic chicken and macon club on toasted bloomer')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (7, 'Monday', 'Classic Lamb Shepherds Pie with garden vegetables', 'Sweet Potato and Puy Lentil Moussaka', 'Grilled chicken with broccoli, almonds and brown rice', 'North Indian Butter Chicken with basmati rice', 'Pastrami, gherkin relish and smoked gouda baguette')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (7, 'Tuesday', 'Pork Escalopes in Sage Butter with roasted potatoes', 'Aubergine Steaks with tomato relish and feta crumble', 'Grilled trout with cucumber mint salad and new potatoes', 'Durban Mutton Curry with basmati and sambals', 'Roast chicken, avocado and ranch wrap')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (7, 'Wednesday', 'Classic Chicken Marsala with fettuccine pasta', 'Stuffed Bell Peppers with spicy quinoa and black beans', 'Herb chicken breast with roasted Mediterranean vegetables', 'Creamy Paneer Tikka Masala with jeera rice', 'Smoked ham, mature cheddar and pickle on bloomer')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (7, 'Thursday', 'Slow-cooked Beef Goulash with caraway potatoes', 'Wild Mushroom and Lentil Stroganoff with rice', 'Pan-roasted linefish with steamed asparagus and lemon', 'Spicy Chicken Vindaloo with fragrant basmati', 'Rare beef, caramelized shallots and blue cheese panini')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (7, 'Friday', 'Golden Crumbed Hake with chips, lemon and tartar sauce', 'Crispy Halloumi Fingers with Greek salad and tzatziki', 'Grilled chicken breast with crisp garden salad', 'Prawn and Calamari Curry with fragrant basmati', 'Egg mayonnaise and smoked macon toasted sandwich')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (8, 'Monday', 'Roast Chicken with crispy skin, baby potatoes and gravy', 'Creamy Butternut, Spinach and Ricotta Cannelloni', 'Grilled lemon chicken with steamed greens and wild rice', 'Tender Lamb Rogan Josh with saffron basmati', 'Pastrami, dijonnaise and crisp lettuce on rye')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (8, 'Tuesday', 'Traditional South African Bobotie with yellow rice and raisins', 'Lentil and Vegetable Bobotie with fruit chutney', 'Grilled salmon steak with asparagus and baby carrots', 'Creamy Chicken Korma with fragrant basmati', 'Roast chicken, macon and avocado seeded wrap')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (8, 'Wednesday', 'Classic Cottage Pie with rich minced beef and mash', 'Vegetable Shepherds Pie with sweet potato mash', 'Poached linefish with steamed broccoli and lemon butter', 'Beef Madras with basmati rice and poppadoms', 'Prosciutto, bocconcini and basil pesto baguette')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (8, 'Thursday', 'Grilled Sirloin Steak with mushroom pepper sauce and wedges', 'Grilled Portobello Mushroom Steaks with parmesan polenta', 'Cajun grilled chicken fillet with quinoa and salad', 'Butter Chicken Curry with garlic naan bread', 'Roast beef, rocket and horseradish mayo focaccia')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;
INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
VALUES (8, 'Friday', 'Crispy Golden Hake with rustic hand-cut chips and salad', 'Gourmet Veggie Burger with avocado and sweet potato wedges', 'Grilled hake fillet with fresh seasonal greens', 'Cape Malay Prawn Curry with jasmine rice', 'Artisanal BLT with free-range macon and aioli')
ON CONFLICT (week_number, day_name) DO UPDATE SET main_meal = EXCLUDED.main_meal, vegetarian_meal = EXCLUDED.vegetarian_meal, healthy_meal = EXCLUDED.healthy_meal, curry_of_the_day = EXCLUDED.curry_of_the_day, gourmet_sandwich = EXCLUDED.gourmet_sandwich;

-- ---------------------------------------------------------------------
-- 13. SEED DATA: OCTOBER 2026 REALISTIC ORDERS (Matching Export Docs)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_ecogra_id UUID;
  v_rcl_id UUID;
  v_tata_id UUID;
  v_ahmed_uid UUID := 'a0000000-0000-0000-0000-000000000002'::uuid;
  v_anele_uid UUID := 'a0000000-0000-0000-0000-000000000003'::uuid;
  v_tamryn_uid UUID := 'a0000000-0000-0000-0000-000000000004'::uuid;
  v_order_id UUID;
BEGIN
  SELECT id INTO v_ecogra_id FROM public.companies WHERE name = 'eCOGRA' LIMIT 1;
  SELECT id INTO v_rcl_id FROM public.companies WHERE name = 'RCL Foods' LIMIT 1;
  SELECT id INTO v_tata_id FROM public.companies WHERE name = 'TATA Africa Holdings' LIMIT 1;

  -- Order 1: eCOGRA - Delivered earlier in October
  v_order_id := 'b0000000-0000-0000-0000-000000000001'::uuid;
  INSERT INTO public.orders (
    id, order_number, user_id, company_id, status, stage, target_delivery_date, delivery_date_formatted,
    delivery_slot, delivery_floor, company_location, item_subtotal, discount_type, discount_value, discount_zar,
    delivery_fee, vat_amount, total_amount, payment_method, payment_reference, tax_invoice_number, created_at
  ) VALUES (
    v_order_id, 'ORD-2026-1014-ECO', v_ahmed_uid, v_ecogra_id, 'delivered', 4, '2026-10-14', 'Wednesday, 14 October 2026',
    '12:00 PM Sharp', 'Floor 2 (IT & Compliance Pantry)', 'eCOGRA Rosebank Hub', 220.00, 'percentage', 10.0, 22.00,
    100.00, 44.70, 342.70, 'Instant EFT', 'EFT-PAY-98214-ECO', 'INV-2026-OCT-014', '2026-10-12 08:30:00+02'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.order_items (order_id, menu_item_id, dish_name, size, quantity, unit_price, total_price, selected_add_ons, allergy_notes)
  VALUES
    (v_order_id, 'item_ci_01', 'Chicken Aglio e Olio Penne', 'standard', 1, 80.00, 80.00, '[{"name": "Extra Parmesan Cheese", "price": 25.0}]'::jsonb, 'No extra garlic'),
    (v_order_id, 'item_pb_01', 'Salmon Poke Bowl', 'standard', 1, 140.00, 140.00, '[]'::jsonb, NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.order_ratings (order_id, user_id, rating, feedback)
  VALUES (v_order_id, v_ahmed_uid, 5, 'Superb pasta and poke bowl! Arrived right at 12:00 PM.')
  ON CONFLICT DO NOTHING;

  -- Order 2: RCL Foods (Matches YKC_Individual_Delivery_Notes_BATCH_RCL.pdf)
  v_order_id := 'b0000000-0000-0000-0000-000000000002'::uuid;
  INSERT INTO public.orders (
    id, order_number, user_id, company_id, status, stage, target_delivery_date, delivery_date_formatted,
    delivery_slot, delivery_floor, company_location, item_subtotal, discount_type, discount_value, discount_zar,
    delivery_fee, vat_amount, total_amount, payment_method, payment_reference, tax_invoice_number, created_at
  ) VALUES (
    v_order_id, 'ORD-2026-1021-RCL', v_anele_uid, v_rcl_id, 'delivered', 4, '2026-10-21', 'Wednesday, 21 October 2026',
    '12:00 PM Sharp', 'Floor 1 (Corporate Canteen Pantry)', 'RCL Foods Dunkeld HQ', 260.00, 'percentage', 12.0, 31.20,
    100.00, 49.32, 378.12, 'Instant EFT', 'EFT-PAY-55102-RCL', 'INV-2026-OCT-021', '2026-10-19 08:45:00+02'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.order_items (order_id, menu_item_id, dish_name, size, quantity, unit_price, total_price, selected_add_ons, allergy_notes)
  VALUES
    (v_order_id, 'item_ci_15', 'Beef Lasagne', 'standard', 1, 80.00, 80.00, '[]'::jsonb, NULL),
    (v_order_id, 'item_fm_04', 'Grilled Beef Fillet served with Sweet Potato and Broccoli', 'standard', 1, 130.00, 130.00, '[]'::jsonb, 'Gluten free preparation'),
    (v_order_id, 'item_ss_01', 'Cheese Sauce', 'standard', 1, 35.00, 35.00, '[]'::jsonb, NULL)
  ON CONFLICT DO NOTHING;

  -- Order 3: TATA Africa Holdings - Scheduled for upcoming delivery
  v_order_id := 'b0000000-0000-0000-0000-000000000003'::uuid;
  INSERT INTO public.orders (
    id, order_number, user_id, company_id, status, stage, target_delivery_date, delivery_date_formatted,
    delivery_slot, delivery_floor, company_location, item_subtotal, discount_type, discount_value, discount_zar,
    delivery_fee, vat_amount, total_amount, payment_method, payment_reference, tax_invoice_number, created_at
  ) VALUES (
    v_order_id, 'ORD-2026-1028-TAT', v_tamryn_uid, v_tata_id, 'paid_scheduled', 1, '2026-10-28', 'Wednesday, 28 October 2026',
    '12:00 PM Sharp', 'Tower B, Floor 4 (Holding Operations Staging)', 'TATA Sandton Towers', 240.00, 'percentage', 10.0, 24.00,
    100.00, 47.40, 363.40, 'Instant EFT', 'EFT-PAY-77319-TAT', 'INV-2026-OCT-028', '2026-10-25 10:15:00+02'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.order_items (order_id, menu_item_id, dish_name, size, quantity, unit_price, total_price, selected_add_ons, allergy_notes)
  VALUES
    (v_order_id, 'item_ci_08', 'Chicken Alfredo Linguini Pasta', 'standard', 1, 80.00, 80.00, '[{"name": "Extra Parmesan Cheese", "price": 25.0}]'::jsonb, NULL),
    (v_order_id, 'item_bb_02', 'Cheese Burger', 'standard', 2, 80.00, 160.00, '[{"name": "Potato Wedges", "price": 35.0}]'::jsonb, 'Extra napkins please')
  ON CONFLICT DO NOTHING;
END$$;

-- =====================================================================
-- END OF COMPLETE PRODUCTION DATABASE SCHEMA V1
-- =====================================================================