-- =====================================================================
-- YOUR KITCHEN CO. (YKC) — MIGRATION V5 (SAFE & IDEMPOTENT)
-- Adds extended Corporate Partner fields (billing_email, meal_subsidy_amount,
-- delivery_fee_mode, flat_fee_amount), multi-location defaults, and
-- platform_settings for the Editable Official YKC Email Routing Directory.
-- =====================================================================

-- 1. Extend public.companies for customizable Flat Fee, Meal Subsidy & Billing Email
ALTER TABLE public.companies
  ALTER COLUMN street_address SET DEFAULT 'Corporate Campus',
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS meal_subsidy_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS delivery_fee_mode TEXT NOT NULL DEFAULT 'distance',
  ADD COLUMN IF NOT EXISTS flat_fee_amount NUMERIC(10, 2) NOT NULL DEFAULT 20.00;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'companies_delivery_fee_mode_check'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_delivery_fee_mode_check
      CHECK (delivery_fee_mode IN ('free', 'flat', 'distance'));
  END IF;
END$$;

-- Production was created with differently named columns: carry their values across.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'flat_fee_zar') THEN
    UPDATE public.companies SET flat_fee_amount = COALESCE(flat_fee_zar, flat_fee_amount);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'meal_subsidy_zar') THEN
    UPDATE public.companies SET meal_subsidy_amount = COALESCE(meal_subsidy_zar, meal_subsidy_amount);
  END IF;
END$$;

-- 2. Ensure public.delivery_locations has safe defaults for multi-location enrollment
ALTER TABLE public.delivery_locations
  ALTER COLUMN building_name SET DEFAULT 'Main Office',
  ALTER COLUMN street_address SET DEFAULT 'Corporate Campus';

-- 3. Create public.platform_settings for Editable Official YKC Email Routing Directory
CREATE TABLE IF NOT EXISTS public.platform_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS & allow authenticated/admin read-write for platform_settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_settings' AND policyname = 'Allow public read platform_settings'
  ) THEN
    CREATE POLICY "Allow public read platform_settings"
      ON public.platform_settings FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_settings' AND policyname = 'Allow admin write platform_settings'
  ) THEN
    CREATE POLICY "Allow admin write platform_settings"
      ON public.platform_settings FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END$$;

-- Seed default Official YKC Email Routing Directory if not present
INSERT INTO public.platform_settings (setting_key, setting_value)
VALUES (
  'email_routing_directory',
  '{
    "helpSupport": "iwantykc@csggroup.co.za",
    "billingInvoices": "iwantykc@csggroup.co.za",
    "kitchen": "iwantykc@csggroup.co.za",
    "appSender": "iwantykc@csggroup.co.za",
    "adminBackup": "iwantykc@csggroup.co.za",
    "platformMaster": "techykc@csggroup.co.za"
  }'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;
