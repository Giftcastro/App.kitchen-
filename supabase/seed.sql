-- Structural bootstrap data only (safe to guess/derive from the existing
-- app code). Menu catalog content is imported separately via
-- supabase/seed/import-menu.mjs since it's a few hundred rows sourced
-- directly from src/data/*.json, not something to hand-transcribe here.
-- Company records (real names/domains/subsidies) are a business decision —
-- add those through the admin UI once it exists, not seeded with guesses.

insert into pricing_config (key, value_cents) values
  ('cycle_item_price', 8000) -- R80, matches the app's CYCLE_ITEM_PRICE constant
on conflict (key) do nothing;

insert into cycle_rotation_config (id, anchor_monday, week_offset) values
  (true, '2026-09-07', 0) -- Week 1's Monday, matches CYCLE_ANCHOR_MONDAY
on conflict (id) do nothing;
