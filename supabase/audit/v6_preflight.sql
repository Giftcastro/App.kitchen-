-- YKC V6 PREFLIGHT - READ ONLY. Changes nothing. Review before migrating.

-- A. Accounts that hold staff roles. Anyone you do not recognise may have
--    been granted admin by the old sign-up trigger.
SELECT p.id, p.email, p.role, p.is_suspended, p.created_at,
       u.raw_user_meta_data ->> 'role' AS role_in_signup_metadata
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.role IN ('admin', 'chef')
ORDER BY p.created_at;

-- B. Every policy on the tables this migration touches.
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'orders', 'platform_settings')
ORDER BY tablename, policyname;

-- C. Tables in public with row-level security switched off. Expect no rows.
SELECT c.relname AS table_without_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY c.relname;

-- D. Triggers already on the affected tables.
SELECT event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE (event_object_schema = 'public' AND event_object_table IN ('profiles', 'orders'))
   OR (event_object_schema = 'auth' AND event_object_table = 'users')
ORDER BY event_object_table, trigger_name;

-- E. Orders recorded as paid. None of these has been confirmed by PayFast.
SELECT status, COUNT(*) AS orders, SUM(total_amount) AS total_zar
FROM public.orders
GROUP BY status
ORDER BY status;
