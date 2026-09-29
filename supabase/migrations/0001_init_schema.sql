-- KitchenCo backend — initial schema
-- Money is always integer cents (_cents suffix) to avoid float rounding on currency.

create type user_role as enum ('customer', 'admin');
create type account_type as enum ('individual', 'company');
create type menu_item_source as enum ('static', 'cycle');
create type weekday as enum ('mon', 'tue', 'wed', 'thu', 'fri');
create type meal_slot as enum ('main', 'vegetarian', 'healthy', 'curry', 'gourmet_sandwich');
create type order_status as enum ('pending', 'preparing', 'on_the_way', 'delivered', 'cancelled');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type dispute_status as enum ('investigating', 'refunded', 'resolved');
create type card_type as enum ('visa', 'mastercard', 'amex', 'other');

-- ── Companies & addresses ────────────────────────────────────────────────

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meal_subsidy_cents integer check (meal_subsidy_cents >= 0),
  created_at timestamptz not null default now()
);

-- Separate table (not an array on companies) so signup/login can do an
-- indexed `where domain = $1` lookup, re-checked on every login.
create table company_domains (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  domain text not null unique check (domain = lower(domain)),
  created_at timestamptz not null default now()
);

create table company_addresses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  label text,
  street text not null,
  unit text,
  suburb text not null,
  city text not null,
  code text not null,
  instructions text,
  distance_km numeric(6, 2) check (distance_km >= 0),
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Profiles & personal addresses ────────────────────────────────────────

-- 1:1 with auth.users. role/account_type/company_id are the authorization
-- boundary — see 0002_rls_policies.sql for the trigger that stops a user
-- from editing these on their own row.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  role user_role not null default 'customer',
  account_type account_type not null default 'individual',
  company_id uuid references companies(id),
  company_address_id uuid references company_addresses(id),
  created_at timestamptz not null default now()
);

-- Individual users only; company users use company_addresses via
-- profiles.company_address_id instead.
create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text,
  street text not null,
  suburb text not null,
  city text not null,
  code text not null,
  distance_km numeric(6, 2) check (distance_km >= 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Menu ──────────────────────────────────────────────────────────────────

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  icon text,
  created_at timestamptz not null default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  tags text[] not null default '{}',
  active boolean not null default true,
  source menu_item_source not null default 'static',
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

create table menu_item_sizes (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  label text not null,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now(),
  unique (menu_item_id, label)
);

create table menu_item_addons (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references menu_categories(id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

-- No per-row price: cycle-menu items are flat-priced via pricing_config
-- ('cycle_item_price'), matching the current app's CYCLE_ITEM_PRICE constant.
create table cycle_menu_slots (
  id uuid primary key default gen_random_uuid(),
  week_number smallint not null check (week_number between 1 and 8),
  day_of_week weekday not null,
  slot meal_slot not null,
  item_name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (week_number, day_of_week, slot)
);

-- Singleton row: the `id boolean primary key default true check (id)` trick
-- makes a second row impossible. Mirrors the app's anchor-Monday + admin
-- week-offset rotation logic exactly.
create table cycle_rotation_config (
  id boolean primary key default true check (id),
  anchor_monday date not null,
  week_offset integer not null default 0
);

-- Small tunables editable without a redeploy, e.g. key='cycle_item_price'.
create table pricing_config (
  key text primary key,
  value_cents integer not null
);

-- Nullable targeting fields = global scope, matching the current app's
-- mutually-exclusive-ish discount targeting (company / category / item).
create table discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percentage numeric(5, 2) not null check (percentage > 0 and percentage <= 100),
  active boolean not null default true,
  expires_at timestamptz,
  company_id uuid references companies(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete cascade,
  item_id uuid references menu_items(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── Orders ────────────────────────────────────────────────────────────────

create sequence invoice_number_seq start 1;
create sequence dispute_ticket_seq start 1;

create table orders (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  user_id uuid not null references profiles(id),
  company_id uuid references companies(id),
  delivery_date date not null,
  delivery_address_snapshot jsonb not null,
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_id uuid references discounts(id),
  discount_amount_cents integer not null default 0 check (discount_amount_cents >= 0),
  subsidy_amount_cents integer not null default 0 check (subsidy_amount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  status order_status not null default 'pending',
  payment_status payment_status not null default 'pending',
  payment_reference text,
  notes text,
  -- What update_order_status() groups sibling orders on: one status per
  -- company + delivery-day, the app's real corporate batching rule.
  -- Built from extract()+lpad() rather than delivery_date::text — casting a
  -- date to text depends on the session's DateStyle setting, which Postgres
  -- correctly refuses to allow inside a generated column.
  batch_key text generated always as (
    coalesce(company_id::text, '') || ':' ||
    lpad(extract(year from delivery_date)::text, 4, '0') || '-' ||
    lpad(extract(month from delivery_date)::text, 2, '0') || '-' ||
    lpad(extract(day from delivery_date)::text, 2, '0')
  ) stored,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  quantity integer not null check (quantity > 0),
  size_label text,
  -- Allergies / special requests — the chef production sheet needs this verbatim.
  notes text,
  delivery_date date not null,
  created_at timestamptz not null default now()
);

create table order_ratings (
  order_id uuid primary key references orders(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  feedback text,
  submitted_at timestamptz not null default now()
);

create table order_disputes (
  order_id uuid primary key references orders(id) on delete cascade,
  reported_at timestamptz not null default now(),
  reason text,
  ticket_ref text not null unique,
  status dispute_status not null default 'investigating'
);

-- Last-4 only, ever — the real PAN never touches this database.
create table saved_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  cardholder_name text not null,
  last4 char(4) not null,
  card_type card_type not null default 'other',
  expiry_date text not null,
  created_at timestamptz not null default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  company_id uuid references companies(id) on delete cascade, -- null = broadcast to everyone
  sent_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create table push_tokens (
  user_id uuid not null references profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_push_token)
);

-- ── Indexes ───────────────────────────────────────────────────────────────

create index orders_batch_key_idx on orders (batch_key);
create index orders_user_id_created_at_idx on orders (user_id, created_at desc);
create index orders_delivery_date_status_idx on orders (delivery_date, status); -- chef production-sheet query
create index order_items_order_id_idx on order_items (order_id);
create index menu_items_category_active_idx on menu_items (category_id, active);
create index addresses_user_id_idx on addresses (user_id);
create index company_addresses_company_id_idx on company_addresses (company_id);
