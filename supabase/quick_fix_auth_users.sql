-- =====================================================================
-- KITCHEN CO. V1 — QUICK AUTH FIX FOR SUPABASE GOTRUE (v2.197.0+)
-- Run this in Supabase SQL Editor to enable instant sign-in for all accounts
-- =====================================================================

-- 1. Ensure all string columns in auth.users have empty strings instead of NULL
-- (Prevents GoTrue 500 error: "converting NULL to string is unsupported")
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone = COALESCE(phone, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  is_sso_user = COALESCE(is_sso_user, false),
  is_anonymous = COALESCE(is_anonymous, false),
  email_change_confirm_status = COALESCE(email_change_confirm_status, 0);

-- 2. Ensure auth.identities has valid JSON data with email_verified: true
UPDATE auth.identities i
SET identity_data = jsonb_build_object(
  'sub', u.id::text,
  'email', u.email,
  'email_verified', true,
  'phone_verified', false
)
FROM auth.users u
WHERE i.user_id = u.id;

-- 3. Confirm all pre-seeded user emails so they can sign in immediately with password
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email IN (
  'ingrid@kyc.com',
  'ahmed.maseko@ecogra.org',
  'anele.mthembu@rclfoods.com',
  'tamryn.louw@tataafrica.com',
  'chef@kitchenco.co.za'
);

-- 4. Verify count of active auth users
SELECT id, email, role, email_confirmed_at FROM auth.users;
