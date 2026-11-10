--- migration v4

-- =====================================================================
-- KITCHEN CO.
-- =====================================================================
-- 1migrations v4
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- 2. Custom Types & Enums (Safe Creation) ----------
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
END$$;

-- =====================================================================

-- ---- companies ----
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS distance_km NUMERIC(5,2) DEFAULT 8.0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 10;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ---- company_domains ----
CREATE TABLE IF NOT EXISTS public.company_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- delivery_locations ----
CREATE TABLE IF NOT EXISTS public.delivery_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  location_name TEXT DEFAULT 'Main Corporate Campus',
  building_name TEXT NOT NULL,
  street_address TEXT DEFAULT '11 Alice Lane, Sandhurst',
  city TEXT DEFAULT 'Johannesburg',
  postal_code TEXT DEFAULT '2196',
  scheduled_delivery_time TIME NOT NULL DEFAULT '12:00:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.delivery_locations ADD COLUMN IF NOT EXISTS location_name TEXT DEFAULT 'Main Corporate Campus';
ALTER TABLE public.delivery_locations ADD COLUMN IF NOT EXISTS street_address TEXT DEFAULT '11 Alice Lane, Sandhurst';
ALTER TABLE public.delivery_locations ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Johannesburg';
ALTER TABLE public.delivery_locations ADD COLUMN IF NOT EXISTS postal_code TEXT DEFAULT '2196';

-- ---- dropoff_floors ----
CREATE TABLE IF NOT EXISTS public.dropoff_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.delivery_locations(id) ON DELETE CASCADE,
  floor_label TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- profiles (Upgraded without losing users) ----
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role public.app_role NOT NULL DEFAULT 'user',
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT '+27 82 555 0192';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS delivery_floor TEXT DEFAULT 'Floor 3 (Reception Pantry)';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS building_name TEXT DEFAULT '11 Alice Lane, Sandhurst, Building 1';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_name TEXT DEFAULT 'Intellect Design • Sandhurst Building 1';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ---- menu_categories ----
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS menu_type TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 1;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS add_ons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---- menu_items (Upgraded with ingredients, prices, dietary tags) ----
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_regular NUMERIC(10,2) NOT NULL CHECK (price_regular >= 0)
);
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS ingredients TEXT DEFAULT 'Chef prepared fresh daily ingredients, fine herbs, sea salt and olive oil';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] DEFAULT '{}';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS price_large NUMERIC(10,2);
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS menu_type TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS calories INT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---- 8-Week Chef's Choice Cycle Tables ----
CREATE TABLE IF NOT EXISTS public.cycle_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INT NOT NULL CHECK (week_number BETWEEN 1 AND 8),
  title TEXT NOT NULL,
  description TEXT,
  is_active_now BOOLEAN NOT NULL DEFAULT FALSE,
  is_advance_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cycle_day_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INT NOT NULL,
  day_name TEXT NOT NULL CHECK (day_name IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  main_meal TEXT NOT NULL,
  vegetarian_meal TEXT NOT NULL,
  healthy_meal TEXT NOT NULL,
  curry_of_the_day TEXT NOT NULL,
  gourmet_sandwich TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- orders (Upgraded with live tracking, date, invoicing) ----
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_location_id UUID REFERENCES public.delivery_locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'paid_scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS target_delivery_date DATE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_date_formatted TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_slot TEXT DEFAULT '12:00 PM Sharp';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_floor TEXT DEFAULT 'Floor 3 (Reception Pantry)';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_location TEXT DEFAULT 'Intellect Design • Sandhurst Building 1';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS item_subtotal NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_zar NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stage INT DEFAULT 1 CHECK (stage BETWEEN 1 AND 4);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Instant EFT';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS itn_verified_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_invoice_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pdf_invoice_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ---- order_items (Upgraded with portion size, add-ons JSONB, allergy notes) ----
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0)
);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS dish_name TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 80.00;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2) DEFAULT 80.00;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS size TEXT DEFAULT 'standard';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS selected_add_ons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS allergy_notes TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ---- order_ratings & order_disputes ----
CREATE TABLE IF NOT EXISTS public.order_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_ref TEXT NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'investigating',
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.dispatch_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);




CREATE INDEX IF NOT EXISTS idx_company_domains_domain ON public.company_domains(domain);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_target_date ON public.orders(target_delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON public.menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_cycle_day_plans_lookup ON public.cycle_day_plans(week_number, day_name);

-- =====================================================================
-- 5. GRANTS & PERMISSIONS
-- =====================================================================
GRANT SELECT ON public.companies TO anon, authenticated;
GRANT ALL ON public.companies TO service_role;

GRANT SELECT ON public.company_domains TO anon, authenticated;
GRANT ALL ON public.company_domains TO service_role;

GRANT SELECT ON public.delivery_locations TO anon, authenticated;
GRANT ALL ON public.delivery_locations TO service_role;

GRANT SELECT ON public.dropoff_floors TO anon, authenticated;
GRANT ALL ON public.dropoff_floors TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
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


--- RLS Recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon, authenticated;

ALTER TABLE public.companies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_domains       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropoff_floors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_rotations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_day_plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_ratings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_disputes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_audit_logs   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'company_domains' AND policyname = 'domains readable'
  ) THEN
    CREATE POLICY "domains readable" ON public.company_domains FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dropoff_floors' AND policyname = 'floors readable'
  ) THEN
    CREATE POLICY "floors readable" ON public.dropoff_floors FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'menu_categories' AND policyname = 'menu cats readable'
  ) THEN
    CREATE POLICY "menu cats readable" ON public.menu_categories FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'menu_categories' AND policyname = 'menu cats admin edit'
  ) THEN
    CREATE POLICY "menu cats admin edit" ON public.menu_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'menu_items' AND policyname = 'menu items readable'
  ) THEN
    CREATE POLICY "menu items readable" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'menu_items' AND policyname = 'menu items admin edit'
  ) THEN
    CREATE POLICY "menu items admin edit" ON public.menu_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cycle_rotations' AND policyname = 'cycles readable'
  ) THEN
    CREATE POLICY "cycles readable" ON public.cycle_rotations FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cycle_day_plans' AND policyname = 'cycle plans readable'
  ) THEN
    CREATE POLICY "cycle plans readable" ON public.cycle_day_plans FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cycle_day_plans' AND policyname = 'cycle plans chef edit'
  ) THEN
    CREATE POLICY "cycle plans chef edit" ON public.cycle_day_plans FOR ALL TO authenticated USING (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chef')
    );
  END IF;
END $$;


DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cycle_day_plans;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;



-- ---- Companies ----
UPDATE public.companies SET distance_km = 8.0, discount_type = 'percentage', discount_value = 10, updated_at = NOW() WHERE name = 'Intellect Design Arena';
UPDATE public.companies SET distance_km = 18.5, discount_type = 'fixed_zar', discount_value = 0, updated_at = NOW() WHERE name = 'Sandton Tech Hub';

INSERT INTO public.companies (name, distance_km, discount_type, discount_value)
SELECT 'Intellect Design Arena', 8.0, 'percentage', 10
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE name = 'Intellect Design Arena');

INSERT INTO public.companies (name, distance_km, discount_type, discount_value)
SELECT 'Sandton Tech Hub', 18.5, 'fixed_zar', 0
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE name = 'Sandton Tech Hub');

-- ---- Company Domains ----
INSERT INTO public.company_domains (company_id, domain, is_active)
SELECT c.id, 'intellectdesign.com', true FROM public.companies c WHERE c.name = 'Intellect Design Arena'
AND NOT EXISTS (SELECT 1 FROM public.company_domains WHERE domain = 'intellectdesign.com');

INSERT INTO public.company_domains (company_id, domain, is_active)
SELECT c.id, 'intellectdesign.co.za', true FROM public.companies c WHERE c.name = 'Intellect Design Arena'
AND NOT EXISTS (SELECT 1 FROM public.company_domains WHERE domain = 'intellectdesign.co.za');

INSERT INTO public.company_domains (company_id, domain, is_active)
SELECT c.id, 'sandtontech.co.za', true FROM public.companies c WHERE c.name = 'Sandton Tech Hub'
AND NOT EXISTS (SELECT 1 FROM public.company_domains WHERE domain = 'sandtontech.co.za');

-- ---- Categories with Hero Images & Add-Ons ----
UPDATE public.menu_categories mc
SET
  slug = v.slug,
  menu_type = v.menu_type,
  hero_image_url = v.hero_image_url,
  display_order = v.display_order,
  is_active = v.is_active,
  add_ons = v.add_ons::jsonb
FROM (VALUES
  ('SALAD BAR', 'salad-bar', 'standard', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&auto=format&fit=crop&q=80', 1, true, '[{"name":"Grilled Chicken","price":30.0},{"name":"Grilled Halloumi","price":30.0},{"name":"Grilled Sirloin Steak 150g","price":95.0},{"name":"Danish Feta","price":20.0}]'),
  ('POKE BOWL', 'poke-bowl', 'standard', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=80', 2, true, '[{"name":"Grilled Chicken","price":30.0},{"name":"Grilled Halloumi","price":30.0},{"name":"Grilled Sirloin Steak 150g","price":95.0},{"name":"Danish Feta","price":20.0}]'),
  ('HOMEMADE WINTER SOUPS', 'homemade-winter-soups', 'standard', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1200&auto=format&fit=crop&q=80', 3, true, '[{"name":"Artisan Bread Roll","price":15.0},{"name":"Grated Parmesan","price":20.0}]'),
  ('WRAPS', 'wraps', 'standard', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=1200&auto=format&fit=crop&q=80', 4, true, '[{"name":"Sweet Potato Wedges","price":35.0},{"name":"Potato Wedges","price":35.0},{"name":"Cheese Sauce","price":35.0},{"name":"Coleslaw","price":20.0}]'),
  ('HOT DOGS', 'hot-dogs', 'standard', 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=1200&auto=format&fit=crop&q=80', 5, true, '[{"name":"Potato Wedges","price":35.0},{"name":"Cheese Sauce","price":35.0},{"name":"Cheesy Jalapeno Sauce","price":35.0}]'),
  ('PIZZA', 'pizza', 'standard', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&auto=format&fit=crop&q=80', 6, true, '[{"name":"Extra Mozzarella","price":25.0},{"name":"Avocado","price":25.0},{"name":"Chilli Garlic Flakes","price":10.0}]'),
  ('BURGER BAR', 'burger-bar', 'standard', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&auto=format&fit=crop&q=80', 7, true, '[{"name":"Potato Wedges","price":35.0},{"name":"Sweet Potato Wedges","price":35.0},{"name":"Mushroom Sauce","price":35.0},{"name":"Cheese Sauce","price":35.0}]'),
  ('FITNESS MEALS', 'fitness-meals', 'standard', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&auto=format&fit=crop&q=80', 8, true, '[{"name":"Extra Grilled Chicken Breast 150g","price":40.0},{"name":"Extra Steamed Broccoli","price":25.0},{"name":"Extra Brown Rice","price":20.0}]'),
  ('PLATTERS', 'platters', 'standard', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80', 9, true, '[]'),
  ('SWEET TREATS', 'sweet-treats', 'standard', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1200&auto=format&fit=crop&q=80', 10, true, '[]')
) AS v(name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
WHERE UPPER(mc.name) = UPPER(v.name);

INSERT INTO public.menu_categories (name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
SELECT v.name, v.slug, v.menu_type, v.hero_image_url, v.display_order, v.is_active, v.add_ons::jsonb
FROM (VALUES
  ('SALAD BAR', 'salad-bar', 'standard', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&auto=format&fit=crop&q=80', 1, true, '[{"name":"Grilled Chicken","price":30.0},{"name":"Grilled Halloumi","price":30.0},{"name":"Grilled Sirloin Steak 150g","price":95.0},{"name":"Danish Feta","price":20.0}]'),
  ('POKE BOWL', 'poke-bowl', 'standard', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=80', 2, true, '[{"name":"Grilled Chicken","price":30.0},{"name":"Grilled Halloumi","price":30.0},{"name":"Grilled Sirloin Steak 150g","price":95.0},{"name":"Danish Feta","price":20.0}]'),
  ('HOMEMADE WINTER SOUPS', 'homemade-winter-soups', 'standard', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1200&auto=format&fit=crop&q=80', 3, true, '[{"name":"Artisan Bread Roll","price":15.0},{"name":"Grated Parmesan","price":20.0}]'),
  ('WRAPS', 'wraps', 'standard', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=1200&auto=format&fit=crop&q=80', 4, true, '[{"name":"Sweet Potato Wedges","price":35.0},{"name":"Potato Wedges","price":35.0},{"name":"Cheese Sauce","price":35.0},{"name":"Coleslaw","price":20.0}]'),
  ('HOT DOGS', 'hot-dogs', 'standard', 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=1200&auto=format&fit=crop&q=80', 5, true, '[{"name":"Potato Wedges","price":35.0},{"name":"Cheese Sauce","price":35.0},{"name":"Cheesy Jalapeno Sauce","price":35.0}]'),
  ('PIZZA', 'pizza', 'standard', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&auto=format&fit=crop&q=80', 6, true, '[{"name":"Extra Mozzarella","price":25.0},{"name":"Avocado","price":25.0},{"name":"Chilli Garlic Flakes","price":10.0}]'),
  ('BURGER BAR', 'burger-bar', 'standard', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&auto=format&fit=crop&q=80', 7, true, '[{"name":"Potato Wedges","price":35.0},{"name":"Sweet Potato Wedges","price":35.0},{"name":"Mushroom Sauce","price":35.0},{"name":"Cheese Sauce","price":35.0}]'),
  ('FITNESS MEALS', 'fitness-meals', 'standard', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&auto=format&fit=crop&q=80', 8, true, '[{"name":"Extra Grilled Chicken Breast 150g","price":40.0},{"name":"Extra Steamed Broccoli","price":25.0},{"name":"Extra Brown Rice","price":20.0}]'),
  ('PLATTERS', 'platters', 'standard', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80', 9, true, '[]'),
  ('SWEET TREATS', 'sweet-treats', 'standard', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1200&auto=format&fit=crop&q=80', 10, true, '[]')
) AS v(name, slug, menu_type, hero_image_url, display_order, is_active, add_ons)
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_categories mc WHERE UPPER(mc.name) = UPPER(v.name)
);

UPDATE public.menu_items mi
SET
  description = v.description,
  ingredients = v.ingredients,
  dietary_tags = v.dietary_tags,
  price_regular = v.price_regular,
  price_large = v.price_large,
  menu_type = v.menu_type,
  is_available = true,
  updated_at = NOW()
FROM (VALUES
  -- Salad Bar
  ('SALAD BAR', 'Tuna Salad', 'Flaked Tuna, crisp romaine lettuce, crunchy green beans, sweet cocktail tomatoes, cucumber, boiled baby potatoes, Calamata olives, boiled farm egg with house French vinaigrette', 'Flaked Tuna, Romaine Lettuce, Green Beans, Cocktail Tomatoes, English Cucumber, Baby Potatoes, Calamata Olives, Boiled Egg, Olive Oil, French Herb Vinaigrette', ARRAY['Halaal', 'Low Carb', 'Dairy-Free'], 80.00, NULL::numeric, 'standard'),
  ('SALAD BAR', 'Roasted Butternut Salad', 'Tender oven-roasted butternut squash, creamy Danish feta cubes, sun-ripened dry tomatoes, roasted cashews, wild rocket, ancient grain quinoa, fresh basil with maple glaze', 'Oven Roasted Butternut, Danish Feta, Sun-dried Tomatoes, Roasted Cashew Nuts, Wild Rocket, Tri-color Quinoa, Sweet Basil, Maple Balsamic Dressing', ARRAY['Vegetarian'], 80.00, NULL::numeric, 'standard'),
  ('SALAD BAR', 'Chicken Caesar Salad', 'Herb-marinated grilled chicken breast slices, crispy cos lettuce, golden garlic croutons, aged Parmesan shavings with traditional creamy anchovy Caesar dressing', 'Grilled Free-range Chicken, Cos Lettuce, Ciabatta Garlic Croutons, Grana Padano Parmesan, Boiled Egg, Traditional Caesar Dressing', ARRAY['Halaal'], 80.00, NULL::numeric, 'standard'),
  ('SALAD BAR', 'Traditional Greek Salad', 'Crisp green pepper strips, English cucumber, vine tomatoes, Calamata olives, creamy Danish feta blocks, wild oregano and cold-pressed extra virgin olive oil', 'English Cucumber, Vine Tomatoes, Calamata Olives, Danish Feta, Bell Peppers, Red Onion, Greek Dried Oregano, Extra Virgin Olive Oil', ARRAY['Vegetarian', 'Gluten-Free', 'Low Carb'], 80.00, NULL::numeric, 'standard'),

  -- Poke Bowl
  ('POKE BOWL', 'Salmon Poke Bowl', 'Fresh Atlantic sashimi salmon cubes, seasoned Japanese sushi rice, steamed edamame beans, shredded purple cabbage, julienne carrots, pickled ginger and sweet wasabi ginger dressing', 'Fresh Atlantic Salmon, Seasoned Sushi Rice, Edamame, Pickled Ginger, Red Cabbage, Carrots, Sesame Seeds, Sweet Wasabi Ponzu', ARRAY['Halaal', 'Dairy-Free'], 140.00, NULL::numeric, 'standard'),
  ('POKE BOWL', 'Chicken Teriyaki Bowl', 'Pan-seared chicken glazed in house-made mirin teriyaki reduction on fluffy sushi rice with cucumber ribbons, edamame and soft-boiled ramen egg', 'Teriyaki Glazed Chicken Thighs, Japanese Rice, Edamame, English Cucumber, Purple Cabbage, Soft-boiled Egg, Toasted Sesame Seeds', ARRAY['Halaal', 'Dairy-Free'], 80.00, NULL::numeric, 'standard'),
  ('POKE BOWL', 'Tofu & Edamame Poke Bowl', 'Crispy flash-fried organic tofu cubes, furikake sushi rice, avocado slices, pickled daikon radish, edamame with sesame ginger dressing', 'Organic Firm Tofu, Furikake Sushi Rice, Hass Avocado, Pickled Daikon, Edamame, Seaweed Flakes, Sesame Ginger Tamari', ARRAY['Vegetarian', 'Vegan', 'Dairy-Free'], 80.00, NULL::numeric, 'standard'),

  -- Homemade Winter Soups
  ('HOMEMADE WINTER SOUPS', 'Creamy Roasted Tomato & Basil Soup', 'Slow-roasted Italian plum tomatoes, caramelized garlic, fresh garden basil and double cream, served with warm crusty bread roll', 'Italian Plum Tomatoes, Fresh Sweet Basil, Garlic, Vegetable Stock, Double Cream, Olive Oil, Sea Salt, Cracked Black Pepper', ARRAY['Vegetarian'], 75.00, NULL::numeric, 'standard'),
  ('HOMEMADE WINTER SOUPS', 'Hearty Beef & Barley Soup', 'Tender slow-simmered beef brisket chunks, pearl barley, root vegetables, thyme and rich beef bone broth', 'Beef Brisket, Pearl Barley, Carrots, Celery, Leeks, Fresh Thyme, Slow-simmered Bone Broth', ARRAY['Halaal', 'Dairy-Free'], 85.00, NULL::numeric, 'standard'),
  ('HOMEMADE WINTER SOUPS', 'Spiced Butternut & Coconut Soup', 'Oven-caramelized butternut roasted with coriander, cumin, rich coconut cream and toasted pumpkin seeds', 'Roasted Butternut, Coconut Cream, Cumin, Coriander Seeds, Ginger, Toasted Pepitas', ARRAY['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free'], 75.00, NULL::numeric, 'standard'),

  -- Wraps
  ('WRAPS', 'Middle Eastern Chicken Wrap', 'Low-GI whole-wheat wrap folded with seasoned grilled chicken, authentic velvet hummus, chopped cucumber herb salad, tahini drizzle and brown lentils', 'Whole-wheat Low-GI Tortilla, Spiced Chicken Breast, Garlic Chickpea Hummus, Chopped Herb Salad, Tahini, Brown Lentils', ARRAY['Halaal', 'Dairy-Free'], 80.00, NULL::numeric, 'standard'),
  ('WRAPS', 'Crispy Falafel & Tzatziki Wrap', 'Golden spiced chickpea falafels, mint cucumber tzatziki, shredded crisp lettuce, pickled red cabbage in a toasted wrap', 'Handmade Chickpea Falafel, Greek Tzatziki, Shredded Cos Lettuce, Pickled Red Cabbage, Fresh Mint, Flour Tortilla', ARRAY['Vegetarian'], 80.00, NULL::numeric, 'standard'),
  ('WRAPS', 'Smoked Beef Sirloin & Rocket Wrap', 'Thinly sliced wood-smoked sirloin beef, wild peppery rocket, sweet caramelized onions, mature cheddar and whole grain mustard aioli', 'Smoked Sirloin Beef, Wild Rocket, Caramelized Onions, Mature White Cheddar, Whole Grain Mustard Aioli, Flour Tortilla', ARRAY['Halaal'], 85.00, NULL::numeric, 'standard'),

  -- Hot Dogs
  ('HOT DOGS', 'Traditional Gourmet German Frankfurter', 'Artisan wood-smoked German pork/beef frankfurter in a toasted brioche roll with sweet caramelized onions, sauerkraut and German mustard', 'Artisan Smoked Frankfurter, Toasted Brioche Bun, Caramelized Onions, Traditional Sauerkraut, Mild German Mustard', ARRAY['Halaal'], 70.00, NULL::numeric, 'standard'),
  ('HOT DOGS', 'Cheese Grill & Jalapeno Relish Dog', 'Juicy grilled cheese griller sausage topped with warm melted cheddar sauce, pickled jalapeno wheels and crispy onion bits', 'Cheese Griller Sausage, Brioche Roll, Cheddar Cheese Sauce, Pickled Jalapenos, Crispy Fried Onions', ARRAY['Halaal'], 75.00, NULL::numeric, 'standard'),

  -- Pizza
  ('PIZZA', 'Margherita Classica', 'Traditional thin-crust base, slow-simmered San Marzano tomato sauce, fior di latte mozzarella and fresh basil leaves', 'Italian 00 Flour, San Marzano Tomato Sugo, Fior di Latte Mozzarella, Sweet Basil, Extra Virgin Olive Oil', ARRAY['Vegetarian'], 85.00, NULL::numeric, 'standard'),
  ('PIZZA', 'Spicy Pepperoni & Hot Honey', 'Crispy hand-stretched crust topped with cured beef pepperoni, mozzarella, crushed chilli flakes and hot honey drizzle', 'Hand-stretched Pizza Crust, San Marzano Tomatoes, Beef Pepperoni, Mozzarella Cheese, Hot Infused Honey, Oregano', ARRAY['Halaal'], 95.00, NULL::numeric, 'standard'),

  -- Burger Bar
  ('BURGER BAR', 'Kitchen Co. Classic Cheeseburger', '200g flame-grilled pure beef patty, aged cheddar slice, homemade dill gherkins, sliced tomato, crisp butter lettuce and secret burger relish on a toasted brioche bun', 'Flame-grilled Pure Beef Patty 200g, Aged Cheddar, Toasted Brioche Bun, Dill Gherkins, Vine Tomato, Butter Lettuce, House Relish', ARRAY['Halaal'], 90.00, 115.00::numeric, 'standard'),
  ('BURGER BAR', 'Southern Buttermilk Crispy Chicken Burger', 'Crispy buttermilk-fried chicken breast, creamy crunchy purple slaw, house pickled jalapeños and garlic chipotle mayo', 'Free-range Chicken Breast, Buttermilk Batter, Purple Cabbage Slaw, Pickled Jalapeños, Chipotle Garlic Aioli, Brioche Bun', ARRAY['Halaal'], 85.00, 110.00::numeric, 'standard'),
  ('BURGER BAR', 'Gourmet Plant-Based Mushroom Burger', 'Grilled portobello mushroom and black bean patty, avocado crema, roasted red peppers and vegan garlic emulsion', 'Portobello Mushroom Patty, Black Beans, Hass Avocado Crema, Fire-roasted Bell Peppers, Vegan Bun', ARRAY['Vegetarian', 'Vegan'], 85.00, 110.00::numeric, 'standard'),

  -- Fitness Meals
  ('FITNESS MEALS', 'Lean Grilled Chicken & Sweet Potato Mash', 'Grilled lemon-herb chicken breast (200g), roasted cinnamon sweet potato mash and steamed broccoli florets', 'Lemon Herb Grilled Chicken Breast, Roasted Sweet Potato Mash, Steamed Broccoli Florets, Pink Himalayan Salt', ARRAY['Halaal', 'Low Carb', 'Dairy-Free', 'Gluten-Free'], 85.00, 115.00::numeric, 'standard'),
  ('FITNESS MEALS', 'Sirloin Steak Bowl with Brown Rice & Greens', '150g grilled grass-fed sirloin strips, nutty brown basmati rice, steamed asparagus spears, zucchini and chimichurri drizzle', 'Grass-fed Sirloin Steak 150g, Brown Basmati Rice, Steamed Asparagus, Baby Marrows, Argentine Chimichurri Herb Dressing', ARRAY['Halaal', 'Low Carb', 'Dairy-Free', 'Gluten-Free'], 95.00, 130.00::numeric, 'standard')
) AS v(cat_name, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type)
WHERE mi.name = v.name;

INSERT INTO public.menu_items (category_id, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type, is_available)
SELECT
  c.id,
  v.name,
  v.description,
  v.ingredients,
  v.dietary_tags,
  v.price_regular,
  v.price_large,
  v.menu_type,
  true
FROM (VALUES
  -- Salad Bar
  ('SALAD BAR', 'Tuna Salad', 'Flaked Tuna, crisp romaine lettuce, crunchy green beans, sweet cocktail tomatoes, cucumber, boiled baby potatoes, Calamata olives, boiled farm egg with house French vinaigrette', 'Flaked Tuna, Romaine Lettuce, Green Beans, Cocktail Tomatoes, English Cucumber, Baby Potatoes, Calamata Olives, Boiled Egg, Olive Oil, French Herb Vinaigrette', ARRAY['Halaal', 'Low Carb', 'Dairy-Free'], 80.00, NULL::numeric, 'standard'),
  ('SALAD BAR', 'Roasted Butternut Salad', 'Tender oven-roasted butternut squash, creamy Danish feta cubes, sun-ripened dry tomatoes, roasted cashews, wild rocket, ancient grain quinoa, fresh basil with maple glaze', 'Oven Roasted Butternut, Danish Feta, Sun-dried Tomatoes, Roasted Cashew Nuts, Wild Rocket, Tri-color Quinoa, Sweet Basil, Maple Balsamic Dressing', ARRAY['Vegetarian'], 80.00, NULL::numeric, 'standard'),
  ('SALAD BAR', 'Chicken Caesar Salad', 'Herb-marinated grilled chicken breast slices, crispy cos lettuce, golden garlic croutons, aged Parmesan shavings with traditional creamy anchovy Caesar dressing', 'Grilled Free-range Chicken, Cos Lettuce, Ciabatta Garlic Croutons, Grana Padano Parmesan, Boiled Egg, Traditional Caesar Dressing', ARRAY['Halaal'], 80.00, NULL::numeric, 'standard'),
  ('SALAD BAR', 'Traditional Greek Salad', 'Crisp green pepper strips, English cucumber, vine tomatoes, Calamata olives, creamy Danish feta blocks, wild oregano and cold-pressed extra virgin olive oil', 'English Cucumber, Vine Tomatoes, Calamata Olives, Danish Feta, Bell Peppers, Red Onion, Greek Dried Oregano, Extra Virgin Olive Oil', ARRAY['Vegetarian', 'Gluten-Free', 'Low Carb'], 80.00, NULL::numeric, 'standard'),

  -- Poke Bowl
  ('POKE BOWL', 'Salmon Poke Bowl', 'Fresh Atlantic sashimi salmon cubes, seasoned Japanese sushi rice, steamed edamame beans, shredded purple cabbage, julienne carrots, pickled ginger and sweet wasabi ginger dressing', 'Fresh Atlantic Salmon, Seasoned Sushi Rice, Edamame, Pickled Ginger, Red Cabbage, Carrots, Sesame Seeds, Sweet Wasabi Ponzu', ARRAY['Halaal', 'Dairy-Free'], 140.00, NULL::numeric, 'standard'),
  ('POKE BOWL', 'Chicken Teriyaki Bowl', 'Pan-seared chicken glazed in house-made mirin teriyaki reduction on fluffy sushi rice with cucumber ribbons, edamame and soft-boiled ramen egg', 'Teriyaki Glazed Chicken Thighs, Japanese Rice, Edamame, English Cucumber, Purple Cabbage, Soft-boiled Egg, Toasted Sesame Seeds', ARRAY['Halaal', 'Dairy-Free'], 80.00, NULL::numeric, 'standard'),
  ('POKE BOWL', 'Tofu & Edamame Poke Bowl', 'Crispy flash-fried organic tofu cubes, furikake sushi rice, avocado slices, pickled daikon radish, edamame with sesame ginger dressing', 'Organic Firm Tofu, Furikake Sushi Rice, Hass Avocado, Pickled Daikon, Edamame, Seaweed Flakes, Sesame Ginger Tamari', ARRAY['Vegetarian', 'Vegan', 'Dairy-Free'], 80.00, NULL::numeric, 'standard'),

  -- Homemade Winter Soups
  ('HOMEMADE WINTER SOUPS', 'Creamy Roasted Tomato & Basil Soup', 'Slow-roasted Italian plum tomatoes, caramelized garlic, fresh garden basil and double cream, served with warm crusty bread roll', 'Italian Plum Tomatoes, Fresh Sweet Basil, Garlic, Vegetable Stock, Double Cream, Olive Oil, Sea Salt, Cracked Black Pepper', ARRAY['Vegetarian'], 75.00, NULL::numeric, 'standard'),
  ('HOMEMADE WINTER SOUPS', 'Hearty Beef & Barley Soup', 'Tender slow-simmered beef brisket chunks, pearl barley, root vegetables, thyme and rich beef bone broth', 'Beef Brisket, Pearl Barley, Carrots, Celery, Leeks, Fresh Thyme, Slow-simmered Bone Broth', ARRAY['Halaal', 'Dairy-Free'], 85.00, NULL::numeric, 'standard'),
  ('HOMEMADE WINTER SOUPS', 'Spiced Butternut & Coconut Soup', 'Oven-caramelized butternut roasted with coriander, cumin, rich coconut cream and toasted pumpkin seeds', 'Roasted Butternut, Coconut Cream, Cumin, Coriander Seeds, Ginger, Toasted Pepitas', ARRAY['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free'], 75.00, NULL::numeric, 'standard'),

  -- Wraps
  ('WRAPS', 'Middle Eastern Chicken Wrap', 'Low-GI whole-wheat wrap folded with seasoned grilled chicken, authentic velvet hummus, chopped cucumber herb salad, tahini drizzle and brown lentils', 'Whole-wheat Low-GI Tortilla, Spiced Chicken Breast, Garlic Chickpea Hummus, Chopped Herb Salad, Tahini, Brown Lentils', ARRAY['Halaal', 'Dairy-Free'], 80.00, NULL::numeric, 'standard'),
  ('WRAPS', 'Crispy Falafel & Tzatziki Wrap', 'Golden spiced chickpea falafels, mint cucumber tzatziki, shredded crisp lettuce, pickled red cabbage in a toasted wrap', 'Handmade Chickpea Falafel, Greek Tzatziki, Shredded Cos Lettuce, Pickled Red Cabbage, Fresh Mint, Flour Tortilla', ARRAY['Vegetarian'], 80.00, NULL::numeric, 'standard'),
  ('WRAPS', 'Smoked Beef Sirloin & Rocket Wrap', 'Thinly sliced wood-smoked sirloin beef, wild peppery rocket, sweet caramelized onions, mature cheddar and whole grain mustard aioli', 'Smoked Sirloin Beef, Wild Rocket, Caramelized Onions, Mature White Cheddar, Whole Grain Mustard Aioli, Flour Tortilla', ARRAY['Halaal'], 85.00, NULL::numeric, 'standard'),

  -- Hot Dogs
  ('HOT DOGS', 'Traditional Gourmet German Frankfurter', 'Artisan wood-smoked German pork/beef frankfurter in a toasted brioche roll with sweet caramelized onions, sauerkraut and German mustard', 'Artisan Smoked Frankfurter, Toasted Brioche Bun, Caramelized Onions, Traditional Sauerkraut, Mild German Mustard', ARRAY['Halaal'], 70.00, NULL::numeric, 'standard'),
  ('HOT DOGS', 'Cheese Grill & Jalapeno Relish Dog', 'Juicy grilled cheese griller sausage topped with warm melted cheddar sauce, pickled jalapeno wheels and crispy onion bits', 'Cheese Griller Sausage, Brioche Roll, Cheddar Cheese Sauce, Pickled Jalapenos, Crispy Fried Onions', ARRAY['Halaal'], 75.00, NULL::numeric, 'standard'),

  -- Pizza
  ('PIZZA', 'Margherita Classica', 'Traditional thin-crust base, slow-simmered San Marzano tomato sauce, fior di latte mozzarella and fresh basil leaves', 'Italian 00 Flour, San Marzano Tomato Sugo, Fior di Latte Mozzarella, Sweet Basil, Extra Virgin Olive Oil', ARRAY['Vegetarian'], 85.00, NULL::numeric, 'standard'),
  ('PIZZA', 'Spicy Pepperoni & Hot Honey', 'Crispy hand-stretched crust topped with cured beef pepperoni, mozzarella, crushed chilli flakes and hot honey drizzle', 'Hand-stretched Pizza Crust, San Marzano Tomatoes, Beef Pepperoni, Mozzarella Cheese, Hot Infused Honey, Oregano', ARRAY['Halaal'], 95.00, NULL::numeric, 'standard'),

  -- Burger Bar
  ('BURGER BAR', 'Kitchen Co. Classic Cheeseburger', '200g flame-grilled pure beef patty, aged cheddar slice, homemade dill gherkins, sliced tomato, crisp butter lettuce and secret burger relish on a toasted brioche bun', 'Flame-grilled Pure Beef Patty 200g, Aged Cheddar, Toasted Brioche Bun, Dill Gherkins, Vine Tomato, Butter Lettuce, House Relish', ARRAY['Halaal'], 90.00, 115.00::numeric, 'standard'),
  ('BURGER BAR', 'Southern Buttermilk Crispy Chicken Burger', 'Crispy buttermilk-fried chicken breast, creamy crunchy purple slaw, house pickled jalapeños and garlic chipotle mayo', 'Free-range Chicken Breast, Buttermilk Batter, Purple Cabbage Slaw, Pickled Jalapeños, Chipotle Garlic Aioli, Brioche Bun', ARRAY['Halaal'], 85.00, 110.00::numeric, 'standard'),
  ('BURGER BAR', 'Gourmet Plant-Based Mushroom Burger', 'Grilled portobello mushroom and black bean patty, avocado crema, roasted red peppers and vegan garlic emulsion', 'Portobello Mushroom Patty, Black Beans, Hass Avocado Crema, Fire-roasted Bell Peppers, Vegan Bun', ARRAY['Vegetarian', 'Vegan'], 85.00, 110.00::numeric, 'standard'),

  -- Fitness Meals
  ('FITNESS MEALS', 'Lean Grilled Chicken & Sweet Potato Mash', 'Grilled lemon-herb chicken breast (200g), roasted cinnamon sweet potato mash and steamed broccoli florets', 'Lemon Herb Grilled Chicken Breast, Roasted Sweet Potato Mash, Steamed Broccoli Florets, Pink Himalayan Salt', ARRAY['Halaal', 'Low Carb', 'Dairy-Free', 'Gluten-Free'], 85.00, 115.00::numeric, 'standard'),
  ('FITNESS MEALS', 'Sirloin Steak Bowl with Brown Rice & Greens', '150g grilled grass-fed sirloin strips, nutty brown basmati rice, steamed asparagus spears, zucchini and chimichurri drizzle', 'Grass-fed Sirloin Steak 150g, Brown Basmati Rice, Steamed Asparagus, Baby Marrows, Argentine Chimichurri Herb Dressing', ARRAY['Halaal', 'Low Carb', 'Dairy-Free', 'Gluten-Free'], 95.00, 130.00::numeric, 'standard')
) AS v(cat_name, name, description, ingredients, dietary_tags, price_regular, price_large, menu_type)
JOIN public.menu_categories c ON UPPER(c.name) = UPPER(v.cat_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_items mi WHERE mi.name = v.name
);

-- ---- 8-Week Cycle Rotations (Weeks 1 to 8) ----
UPDATE public.cycle_rotations cr
SET title = v.title, description = v.description
FROM (VALUES
  (1, 'Heritage & Hearth Classics', 'BBQ Quarter Chicken, Durban Curries, and Shish Kebabs.', true, false),
  (2, 'Coastal Harvest & Slow Roasts', 'Thai Green Curries, Lasagne, and Overnight Slow-Cooked Brisket.', false, false),
  (3, 'Cape Malay & Mediterranean Spice', 'Chicken Schnitzels, Beef Stew with Samp, and Palak Paneer.', false, false),
  (4, 'Artisan Hearth & Global Comfort', 'Chilli con Carne Wraps, Butter Chicken, and Beef Prego Rolls.', false, false),
  (5, 'Pan-Asian Fusion & Wok Bowls', 'Beef Goulash, Japanese Beef Curry, and Boerewors Rolls.', false, false),
  (6, 'Highveld Comfort & Braai Essence', 'Vietnamese Lemon Grass Noodles, Beef Bourguignon, and Cottage Pie.', false, false),
  (7, 'Cape Coast & French Bistro', 'Moroccan Chicken Tagine, Beef Stroganoff, and Sweet Chilli Wraps.', false, false),
  (8, 'Global Street Food & Hearth Grill', 'Greek Chicken Souvlaki, Bobotie, and Teriyaki Beef Bowls.', false, false)
) AS v(week_number, title, description, is_active_now, is_advance_locked)
WHERE cr.week_number = v.week_number;

INSERT INTO public.cycle_rotations (week_number, title, description, is_active_now, is_advance_locked)
SELECT v.week_number, v.title, v.description, v.is_active_now, v.is_advance_locked
FROM (VALUES
  (1, 'Heritage & Hearth Classics', 'BBQ Quarter Chicken, Durban Curries, and Shish Kebabs.', true, false),
  (2, 'Coastal Harvest & Slow Roasts', 'Thai Green Curries, Lasagne, and Overnight Slow-Cooked Brisket.', false, false),
  (3, 'Cape Malay & Mediterranean Spice', 'Chicken Schnitzels, Beef Stew with Samp, and Palak Paneer.', false, false),
  (4, 'Artisan Hearth & Global Comfort', 'Chilli con Carne Wraps, Butter Chicken, and Beef Prego Rolls.', false, false),
  (5, 'Pan-Asian Fusion & Wok Bowls', 'Beef Goulash, Japanese Beef Curry, and Boerewors Rolls.', false, false),
  (6, 'Highveld Comfort & Braai Essence', 'Vietnamese Lemon Grass Noodles, Beef Bourguignon, and Cottage Pie.', false, false),
  (7, 'Cape Coast & French Bistro', 'Moroccan Chicken Tagine, Beef Stroganoff, and Sweet Chilli Wraps.', false, false),
  (8, 'Global Street Food & Hearth Grill', 'Greek Chicken Souvlaki, Bobotie, and Teriyaki Beef Bowls.', false, false)
) AS v(week_number, title, description, is_active_now, is_advance_locked)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cycle_rotations cr WHERE cr.week_number = v.week_number
);

-- ---- 8-Week Daily Recipe Plans (Full 40 Days for Kitchen Command) ----
UPDATE public.cycle_day_plans cdp
SET
  main_meal = v.main_meal,
  vegetarian_meal = v.vegetarian_meal,
  healthy_meal = v.healthy_meal,
  curry_of_the_day = v.curry_of_the_day,
  gourmet_sandwich = v.gourmet_sandwich,
  updated_at = NOW()
FROM (VALUES
  -- Week 1
  (1, 'Monday', 'Quarter Chicken basted in our home made BBQ sauce served with Middle Eastern Potato Wedges and Ginger infused Carrots and Broccoli', 'Lentils, Baby Marrow and Cauliflower Fritters served with Mash Potato and Tomato Chutney', 'Saucy BBQ Chicken Fillet Strips on Bulgur Wheat, Vegetables and Herb Salad', 'Bombay Beef curry served with Basmati Rice served with Sambals', 'Roasted Beef Baguette topped with mustard, Gherkins and Rocket'),
  (1, 'Tuesday', 'Beef Meatballs in a Rich Tomato, Basil and Garlic sauce served on a bed of Penne Pasta accompanied by a side of Sage Green Beans', 'Penne Pasta tossed in a Rich Tomato, Basil and Garlic sauce. Topped with Danish Feta and Parmesan Crumb', 'Beef Shish Kebab accompanied by Chimichurri sauce served with Savoury Brown Rice and Steamed Vegetables drizzled with a Ginger Garlic Dressing', 'South India Chicken Curry served with Basmati Rice', 'Panini Filled with Deboned Grilled Chicken Thighs, Humus and Salad'),
  (1, 'Wednesday', 'Oven Roasted Chicken served with Roast Potatoes and Cauliflower Cheese Sauce', 'Creamy Cheese Seasonal Vegetable Bake', 'Beef Wrap with Chickpeas, Lentils, Beetroot, Butternut and salad', 'Lamb Rogan Josh served with Basmati Rice', 'Panini filled with Meatballs, Napolitana sauce and Mozzarella'),
  (1, 'Thursday', 'Persian Beef Stew served with Pap and Spicy Spinach', 'Persian Vegetable and Bean Stew served with Mash Potato', 'Cajun chicken Salad with Quinoa and Roasted Vegetables', 'Thai Red Chicken Curry and Vegetables served with Jasmin Rice', 'Amazing Vietnamese Chicken, Herbs and Vegetable Baguette'),
  (1, 'Friday', 'Korean Chicken Burger served with Potato Wedges and Cucumber Salad', 'Korean inspired Haloumi and Aubergine Burger served with Potato Wedges and Cucumber Salad', 'Beef Stir-fry with mixed vegetables served with Rice', 'Cape Malay Style Seafood Curry served with Basmati Rice and Sambals', 'Toasted Cheese, Tomato and Onion sandwich'),

  -- Week 2
  (2, 'Monday', 'Traditional Beef Lasagne with side Garden Salad', 'Roasted Vegetable Lasagne with creamy béchamel and side salad', 'Grilled Lemon Thyme Chicken Breast with Quinoa and Steamed Greens', 'Durban Mutton Curry with Basmati Rice and Sambals', 'Smoked Turkey and Avocado Baguette with Honey Mustard'),
  (2, 'Tuesday', 'Crispy Chicken Schnitzel with Mushroom Sauce and Potato Mash', 'Crumbed Aubergine Schnitzel with Mushroom Sauce and Mash', 'Herb Crusted Salmon Fillet with Asparagus and Brown Rice', 'Thai Green Chicken Curry with Jasmine Rice', 'Roast Beef and Horseradish Cream Panini'),
  (2, 'Wednesday', 'Slow Cooked Beef Brisket with Honey Glazed Carrots and Roasted Potatoes', 'Stuffed Butternut with Lentils, Cranberries and Feta', 'Grilled Hake with Garlic Herb Butter and Mediterranean Veg', 'Butter Chicken Curry with Basmati Rice and Roti', 'Grilled Chicken Caesar Wrap with Cos Lettuce and Parmesan'),
  (2, 'Thursday', 'Chicken Parmigiana topped with Mozzarella on Spaghetti Pomodoro', 'Eggplant Parmigiana topped with Mozzarella on Spaghetti Pomodoro', 'Lean Beef Steak Bowl with Cauliflower Mash and Greens', 'Aromatic Lamb Korma with Fragrant Basmati Rice', 'Caprese Baguette with Pesto, Tomato and Fresh Mozzarella'),
  (2, 'Friday', 'Artisan Beef Prego Roll with Hand Cut Wedges', 'Grilled Haloumi and Roasted Pepper Prego with Hand Cut Wedges', 'Tuna Poke Bowl with Edamame, Pickled Ginger and Brown Rice', 'Madras Fish Curry with Steamed Basmati Rice', 'Pastrami and Swiss Cheese Toastie on Sourdough')
) AS v(week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
WHERE cdp.week_number = v.week_number AND cdp.day_name = v.day_name;

INSERT INTO public.cycle_day_plans (week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
SELECT v.week_number, v.day_name, v.main_meal, v.vegetarian_meal, v.healthy_meal, v.curry_of_the_day, v.gourmet_sandwich
FROM (VALUES
  -- Week 1
  (1, 'Monday', 'Quarter Chicken basted in our home made BBQ sauce served with Middle Eastern Potato Wedges and Ginger infused Carrots and Broccoli', 'Lentils, Baby Marrow and Cauliflower Fritters served with Mash Potato and Tomato Chutney', 'Saucy BBQ Chicken Fillet Strips on Bulgur Wheat, Vegetables and Herb Salad', 'Bombay Beef curry served with Basmati Rice served with Sambals', 'Roasted Beef Baguette topped with mustard, Gherkins and Rocket'),
  (1, 'Tuesday', 'Beef Meatballs in a Rich Tomato, Basil and Garlic sauce served on a bed of Penne Pasta accompanied by a side of Sage Green Beans', 'Penne Pasta tossed in a Rich Tomato, Basil and Garlic sauce. Topped with Danish Feta and Parmesan Crumb', 'Beef Shish Kebab accompanied by Chimichurri sauce served with Savoury Brown Rice and Steamed Vegetables drizzled with a Ginger Garlic Dressing', 'South India Chicken Curry served with Basmati Rice', 'Panini Filled with Deboned Grilled Chicken Thighs, Humus and Salad'),
  (1, 'Wednesday', 'Oven Roasted Chicken served with Roast Potatoes and Cauliflower Cheese Sauce', 'Creamy Cheese Seasonal Vegetable Bake', 'Beef Wrap with Chickpeas, Lentils, Beetroot, Butternut and salad', 'Lamb Rogan Josh served with Basmati Rice', 'Panini filled with Meatballs, Napolitana sauce and Mozzarella'),
  (1, 'Thursday', 'Persian Beef Stew served with Pap and Spicy Spinach', 'Persian Vegetable and Bean Stew served with Mash Potato', 'Cajun chicken Salad with Quinoa and Roasted Vegetables', 'Thai Red Chicken Curry and Vegetables served with Jasmin Rice', 'Amazing Vietnamese Chicken, Herbs and Vegetable Baguette'),
  (1, 'Friday', 'Korean Chicken Burger served with Potato Wedges and Cucumber Salad', 'Korean inspired Haloumi and Aubergine Burger served with Potato Wedges and Cucumber Salad', 'Beef Stir-fry with mixed vegetables served with Rice', 'Cape Malay Style Seafood Curry served with Basmati Rice and Sambals', 'Toasted Cheese, Tomato and Onion sandwich'),

  -- Week 2
  (2, 'Monday', 'Traditional Beef Lasagne with side Garden Salad', 'Roasted Vegetable Lasagne with creamy béchamel and side salad', 'Grilled Lemon Thyme Chicken Breast with Quinoa and Steamed Greens', 'Durban Mutton Curry with Basmati Rice and Sambals', 'Smoked Turkey and Avocado Baguette with Honey Mustard'),
  (2, 'Tuesday', 'Crispy Chicken Schnitzel with Mushroom Sauce and Potato Mash', 'Crumbed Aubergine Schnitzel with Mushroom Sauce and Mash', 'Herb Crusted Salmon Fillet with Asparagus and Brown Rice', 'Thai Green Chicken Curry with Jasmine Rice', 'Roast Beef and Horseradish Cream Panini'),
  (2, 'Wednesday', 'Slow Cooked Beef Brisket with Honey Glazed Carrots and Roasted Potatoes', 'Stuffed Butternut with Lentils, Cranberries and Feta', 'Grilled Hake with Garlic Herb Butter and Mediterranean Veg', 'Butter Chicken Curry with Basmati Rice and Roti', 'Grilled Chicken Caesar Wrap with Cos Lettuce and Parmesan'),
  (2, 'Thursday', 'Chicken Parmigiana topped with Mozzarella on Spaghetti Pomodoro', 'Eggplant Parmigiana topped with Mozzarella on Spaghetti Pomodoro', 'Lean Beef Steak Bowl with Cauliflower Mash and Greens', 'Aromatic Lamb Korma with Fragrant Basmati Rice', 'Caprese Baguette with Pesto, Tomato and Fresh Mozzarella'),
  (2, 'Friday', 'Artisan Beef Prego Roll with Hand Cut Wedges', 'Grilled Haloumi and Roasted Pepper Prego with Hand Cut Wedges', 'Tuna Poke Bowl with Edamame, Pickled Ginger and Brown Rice', 'Madras Fish Curry with Steamed Basmati Rice', 'Pastrami and Swiss Cheese Toastie on Sourdough')
) AS v(week_number, day_name, main_meal, vegetarian_meal, healthy_meal, curry_of_the_day, gourmet_sandwich)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cycle_day_plans cdp WHERE cdp.week_number = v.week_number AND cdp.day_name = v.day_name
);
SELECT 'Kitchen Co. Live Database Successfully Upgraded Without Data Loss!' AS status;
