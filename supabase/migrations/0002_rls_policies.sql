-- KitchenCo backend — profile provisioning, RLS helper functions, and policies.

-- ── Auto-provision a profile row when Supabase Auth creates a user ─────────
-- Role/account_type start at their column defaults (customer/individual).
-- Company linkage happens afterwards via resolve_company_for_email() (0003),
-- called by the app right after sign-up/sign-in.

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── RLS helper functions ────────────────────────────────────────────────────
-- security definer + a fixed search_path so these can't be tricked into
-- reading the wrong table, and so RLS policies that call them don't
-- themselves recurse into RLS on `profiles`.

create function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create function current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from profiles where id = auth.uid();
$$;

-- ── Prevent self-service privilege escalation on profiles ──────────────────
-- RLS lets a user UPDATE their own profile row (name, etc.); this trigger
-- stops that same policy from being used to grant yourself admin or attach
-- yourself to a company you don't belong to. Only an existing admin, or the
-- resolve_company_for_email() RPC (security definer), may change these.

create function guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() and not (current_setting('kitchenco.allow_company_link', true) = 'on') then
    if new.role is distinct from old.role
      or new.company_id is distinct from old.company_id
      or new.company_address_id is distinct from old.company_address_id
      or new.account_type is distinct from old.account_type
    then
      raise exception 'not authorized to change role/company fields';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privilege_columns
  before update on profiles
  for each row execute function guard_profile_privilege_columns();

-- ── Enable RLS everywhere ────────────────────────────────────────────────────

alter table companies enable row level security;
alter table company_domains enable row level security;
alter table company_addresses enable row level security;
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table menu_item_sizes enable row level security;
alter table menu_item_addons enable row level security;
alter table cycle_menu_slots enable row level security;
alter table cycle_rotation_config enable row level security;
alter table pricing_config enable row level security;
alter table discounts enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_ratings enable row level security;
alter table order_disputes enable row level security;
alter table saved_cards enable row level security;
alter table announcements enable row level security;
alter table push_tokens enable row level security;

-- ── Menu & config: public read, admin write ─────────────────────────────────
-- Public/anon read is intentional — customers browse the menu before signing up.

create policy "menu_categories_read_all" on menu_categories for select using (true);
create policy "menu_categories_write_admin" on menu_categories for all using (is_admin()) with check (is_admin());

create policy "menu_items_read_all" on menu_items for select using (true);
create policy "menu_items_write_admin" on menu_items for all using (is_admin()) with check (is_admin());

create policy "menu_item_sizes_read_all" on menu_item_sizes for select using (true);
create policy "menu_item_sizes_write_admin" on menu_item_sizes for all using (is_admin()) with check (is_admin());

create policy "menu_item_addons_read_all" on menu_item_addons for select using (true);
create policy "menu_item_addons_write_admin" on menu_item_addons for all using (is_admin()) with check (is_admin());

create policy "cycle_menu_slots_read_all" on cycle_menu_slots for select using (true);
create policy "cycle_menu_slots_write_admin" on cycle_menu_slots for all using (is_admin()) with check (is_admin());

create policy "cycle_rotation_config_read_all" on cycle_rotation_config for select using (true);
create policy "cycle_rotation_config_write_admin" on cycle_rotation_config for all using (is_admin()) with check (is_admin());

create policy "pricing_config_read_all" on pricing_config for select using (true);
create policy "pricing_config_write_admin" on pricing_config for all using (is_admin()) with check (is_admin());

create policy "discounts_read_active_or_admin" on discounts for select using (active = true or is_admin());
create policy "discounts_write_admin" on discounts for all using (is_admin()) with check (is_admin());

-- ── Companies & addresses ────────────────────────────────────────────────────
-- company_domains stays public (name/id-free — just domain -> company_id) so
-- signup can check "does my email domain belong to a company" pre-auth.

create policy "company_domains_read_all" on company_domains for select using (true);
create policy "company_domains_write_admin" on company_domains for all using (is_admin()) with check (is_admin());

-- Full company rows (incl. meal_subsidy_cents) are only visible to that
-- company's own members and admins — not public, unlike company_domains.
create policy "companies_read_own_or_admin" on companies for select using (id = current_company_id() or is_admin());
create policy "companies_write_admin" on companies for all using (is_admin()) with check (is_admin());

create policy "company_addresses_read_own_or_admin" on company_addresses for select using (company_id = current_company_id() or is_admin());
create policy "company_addresses_write_admin" on company_addresses for all using (is_admin()) with check (is_admin());

-- ── Profiles ─────────────────────────────────────────────────────────────────

create policy "profiles_read_own_or_admin" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles_update_own_or_admin" on profiles for update using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());
create policy "profiles_write_admin_insert" on profiles for insert with check (is_admin());
-- (row creation for new users happens via handle_new_user(), which runs as
-- security definer and so bypasses RLS — this insert policy only covers an
-- admin manually creating a profile.)

-- ── Personal addresses ───────────────────────────────────────────────────────

create policy "addresses_own_rows" on addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Orders — read own rows; all writes go through RPCs (0003), never direct ─

create policy "orders_read_own_or_admin" on orders for select using (user_id = auth.uid() or is_admin());
create policy "order_items_read_own_or_admin" on order_items for select using (
  exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin()))
);
create policy "order_ratings_read_own_or_admin" on order_ratings for select using (
  exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin()))
);
create policy "order_disputes_read_own_or_admin" on order_disputes for select using (
  exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin()))
);
-- No insert/update/delete policies on orders, order_items, order_ratings,
-- order_disputes for authenticated/anon roles: RLS defaults to deny, so the
-- only way to write these tables is through the security definer RPCs.

-- ── Saved cards ──────────────────────────────────────────────────────────────

create policy "saved_cards_own_rows" on saved_cards for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Announcements ────────────────────────────────────────────────────────────

create policy "announcements_read_own_company_or_broadcast_or_admin" on announcements for select using (
  company_id is null or company_id = current_company_id() or is_admin()
);
create policy "announcements_write_admin" on announcements for all using (is_admin()) with check (is_admin());

-- ── Push tokens ──────────────────────────────────────────────────────────────

create policy "push_tokens_own_rows" on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
