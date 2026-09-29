-- addresses_own_rows (0002) only lets the owning customer read/write their
-- own row — admin has no access to individual customers' addresses at all
-- today, unlike company_addresses, which already carries a companion
-- "..._read_own_or_admin" / "..._write_admin" pair for exactly this reason.
--
-- That's a real gap: place_order raises UNDELIVERABLE_DISTANCE for any
-- address whose distance_km is null, and nothing ever sets it — distance is
-- manually surveyed and entered per address, never geocoded (see
-- calculate_delivery_fee_cents in 0003) — so every fresh individual signup
-- is permanently unable to place a real order until an admin can see their
-- address and set one. Mirrors the company_addresses policies exactly.

create policy "addresses_read_own_or_admin" on addresses for select using (user_id = auth.uid() or is_admin());
create policy "addresses_write_admin" on addresses for update using (is_admin()) with check (is_admin());
