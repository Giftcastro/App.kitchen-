-- Parity with the YourKitchenCo .NET MAUI app (qwertystig/KitchenCO main),
-- which the React Native app now mirrors screen for screen. Adds the fields
-- those screens read and write that the schema didn't have yet:
--
--   companies     billing_email, is_active, discount_type/discount_value
--                 (Admin > Companies > Edit / Toggle Active / Financials)
--   profiles      is_active (Admin > Users > Suspend), delivery_floor
--                 (Profile > Delivery Floor), and a 'kitchen_staff' role
--   menu_items    ingredients (Admin > Menu Catalog > Add/Edit Item)
--   order_items   allergy_notes (Product > "Allergy Notes (Chef Alert)")
--   announcements target_audience, recipient_count (Admin > Notifications)
--
-- Self-contained on purpose: it also (re)creates list_delivery_locations
-- from 0007, so running 0008 alone on a project that never got 0007 still
-- leaves Register's company/location pickers working.

-- ── Roles ────────────────────────────────────────────────────────────────
-- Not referenced anywhere else in this file: a freshly added enum value
-- can't be used in the same transaction that adds it.
alter type user_role add value if not exists 'kitchen_staff';

-- ── Columns ──────────────────────────────────────────────────────────────

alter table companies
  add column if not exists billing_email text,
  add column if not exists is_active boolean not null default true,
  add column if not exists discount_type text not null default 'none'
    check (discount_type in ('none', 'percentage', 'fixed')),
  add column if not exists discount_value numeric(10, 2) not null default 0
    check (discount_value >= 0);

alter table profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists delivery_floor text;

alter table menu_items
  add column if not exists ingredients text;

alter table order_items
  add column if not exists allergy_notes text;

alter table announcements
  add column if not exists target_audience text not null default 'All Users',
  add column if not exists recipient_count integer not null default 0;

-- ── Suspension can't be self-reversed ───────────────────────────────────
-- Same guard as 0004, plus is_active: a suspended customer could otherwise
-- just update their own row back to active (profiles_update_own_or_admin
-- lets them write their own row, which delivery_floor needs).

create or replace function guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not is_admin()
     and not (current_setting('kitchenco.allow_company_link', true) = 'on')
  then
    if new.role is distinct from old.role
      or new.company_id is distinct from old.company_id
      or new.company_address_id is distinct from old.company_address_id
      or new.account_type is distinct from old.account_type
      or new.is_active is distinct from old.is_active
    then
      raise exception 'not authorized to change role/company fields';
    end if;
  end if;
  return new;
end;
$$;

-- ── Admin resolves disputes (Reports > Disputed Orders > Update Status) ─

drop policy if exists "order_disputes_update_admin" on order_disputes;
create policy "order_disputes_update_admin" on order_disputes
  for update using (is_admin()) with check (is_admin());

-- ── Ratings: re-rate, or tap the same star again to clear ───────────────
-- MAUI's Order History lets a customer change a rating, and tapping the
-- current star clears it (rating 0). The 0003 version refused a second
-- rating outright. Past-delivery-date orders count as rateable even if an
-- admin never flipped the status to delivered, since Order History is
-- defined by delivery date.

create or replace function submit_order_rating(p_order_id uuid, p_rating smallint, p_feedback text default null)
returns order_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_result order_ratings;
begin
  select * into v_order from orders where id = p_order_id and user_id = auth.uid();
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'delivered' and v_order.delivery_date >= current_date then
    raise exception 'ORDER_NOT_DELIVERED';
  end if;

  if p_rating = 0 then
    delete from order_ratings where order_id = p_order_id;
    return null;
  end if;

  insert into order_ratings (order_id, rating, feedback)
  values (p_order_id, p_rating, p_feedback)
  on conflict (order_id) do update
    set rating = excluded.rating,
        feedback = coalesce(excluded.feedback, order_ratings.feedback),
        submitted_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

-- ── place_order: allergy notes, company discount, suspended accounts ─────
-- Identical to 0003 except:
--   * refuses a suspended account (ACCOUNT_SUSPENDED)
--   * stores each line's allergy_notes
--   * applies the company's own discount (percentage, or a fixed Rand amount
--     per cart line) after the meal subsidy, as MAUI's checkout does, and
--     folds it into discount_amount_cents alongside any discount code.

create or replace function place_order(
  p_cart jsonb,
  p_address_id uuid,
  p_payment_reference text default null
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
  v_company companies;
  v_item jsonb;
  v_addon jsonb;
  v_menu_item menu_items;
  v_unit_price_cents integer;
  v_resolved_items jsonb := '[]'::jsonb;
  v_subtotal_cents integer := 0;
  v_distance_km numeric;
  v_delivery_fee_cents integer;
  v_discount discounts;
  v_discount_amount_cents integer := 0;
  v_company_discount_cents integer := 0;
  v_subsidy_amount_cents integer := 0;
  v_remaining_cents integer;
  v_total_cents integer;
  v_total_quantity integer := 0;
  v_line_count integer := 0;
  v_order_id uuid;
  v_order orders;
  v_invoice_number text;
  v_min_delivery_date date;
begin
  select * into v_profile from profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_profile.is_active = false then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if p_cart is null or jsonb_array_length(p_cart) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  select distance_km into v_distance_km from addresses where id = p_address_id and user_id = auth.uid();
  if not found then
    select distance_km into v_distance_km from company_addresses where id = p_address_id and company_id = v_profile.company_id;
    if not found then
      raise exception 'ADDRESS_NOT_FOUND';
    end if;
  end if;

  v_delivery_fee_cents := calculate_delivery_fee_cents(v_distance_km);
  if v_delivery_fee_cents is null then
    raise exception 'UNDELIVERABLE_DISTANCE';
  end if;

  v_min_delivery_date := earliest_orderable_date(now());

  for v_item in select * from jsonb_array_elements(p_cart)
  loop
    if (v_item->>'delivery_date')::date < v_min_delivery_date
       or extract(isodow from (v_item->>'delivery_date')::date) in (6, 7)
    then
      raise exception 'CUTOFF_PASSED';
    end if;

    if v_item->>'source' = 'cycle' then
      if not exists (
        select 1 from cycle_menu_slots
        where week_number = (v_item->>'cycle_week_number')::smallint
          and day_of_week = (v_item->>'cycle_day_of_week')::weekday
          and slot = (v_item->>'cycle_slot')::meal_slot
      ) then
        raise exception 'INVALID_MENU_ITEM';
      end if;
      select value_cents into v_unit_price_cents from pricing_config where key = 'cycle_item_price';
      v_menu_item := null;
    else
      select * into v_menu_item from menu_items where id = (v_item->>'menu_item_id')::uuid and active = true;
      if not found then
        raise exception 'MENU_ITEM_INACTIVE';
      end if;
      select price_cents into v_unit_price_cents
      from menu_item_sizes
      where menu_item_id = v_menu_item.id and label = (v_item->>'size_label');
      if not found then
        raise exception 'INVALID_MENU_ITEM';
      end if;
    end if;

    if v_item ? 'addons' then
      for v_addon in select * from jsonb_array_elements(v_item->'addons')
      loop
        declare v_addon_price integer;
        begin
          select price_cents into v_addon_price
          from menu_item_addons
          where category_id = v_menu_item.category_id and name = (v_addon->>'name');
          if not found then
            raise exception 'INVALID_ADDON';
          end if;
          v_unit_price_cents := v_unit_price_cents + v_addon_price;
        end;
      end loop;
    end if;

    v_subtotal_cents := v_subtotal_cents + v_unit_price_cents * (v_item->>'quantity')::integer;
    v_total_quantity := v_total_quantity + (v_item->>'quantity')::integer;
    v_line_count := v_line_count + 1;

    v_resolved_items := v_resolved_items || jsonb_build_object(
      'menu_item_id', v_item->>'menu_item_id',
      'name', v_item->>'name',
      'price_cents', v_unit_price_cents,
      'quantity', (v_item->>'quantity')::integer,
      'size_label', v_item->>'size_label',
      'notes', v_item->>'notes',
      'allergy_notes', v_item->>'allergy_notes',
      'delivery_date', v_item->>'delivery_date'
    );
  end loop;

  select d.* into v_discount
  from discounts d
  where d.active = true
    and (d.expires_at is null or d.expires_at > now())
    and (d.company_id is null or d.company_id = v_profile.company_id)
    and (
      (d.category_id is null and d.item_id is null)
      or exists (
        select 1 from jsonb_array_elements(p_cart) ci
        where ci->>'source' = 'static'
          and (
            d.item_id = (ci->>'menu_item_id')::uuid
            or d.category_id = (select category_id from menu_items where id = (ci->>'menu_item_id')::uuid)
          )
      )
    )
  order by d.percentage desc
  limit 1;

  if v_discount.id is not null then
    v_discount_amount_cents := round(v_subtotal_cents * v_discount.percentage / 100.0);
  end if;

  if v_profile.account_type = 'company' and v_profile.company_id is not null then
    select * into v_company from companies where id = v_profile.company_id;

    v_subsidy_amount_cents := least(
      coalesce(v_company.meal_subsidy_cents, 0) * v_total_quantity,
      v_subtotal_cents - v_discount_amount_cents
    );

    v_remaining_cents := greatest(v_subtotal_cents - v_discount_amount_cents - v_subsidy_amount_cents, 0);
    if v_company.discount_type = 'percentage' then
      v_company_discount_cents := round(v_remaining_cents * least(v_company.discount_value, 100) / 100.0);
    elsif v_company.discount_type = 'fixed' then
      v_company_discount_cents := least(round(v_company.discount_value * 100) * v_line_count, v_remaining_cents);
    end if;
    v_discount_amount_cents := v_discount_amount_cents + v_company_discount_cents;
  end if;

  v_total_cents := greatest(v_subtotal_cents - v_discount_amount_cents - v_subsidy_amount_cents, 0) + v_delivery_fee_cents;
  v_invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('invoice_number_seq')::text, 5, '0');

  insert into orders (
    invoice_number, user_id, company_id, delivery_date, delivery_address_snapshot,
    delivery_fee_cents, subtotal_cents, discount_id, discount_amount_cents,
    subsidy_amount_cents, total_cents, payment_reference
  )
  values (
    v_invoice_number, auth.uid(), v_profile.company_id,
    (select min((ci->>'delivery_date')::date) from jsonb_array_elements(p_cart) ci),
    jsonb_build_object('address_id', p_address_id),
    v_delivery_fee_cents, v_subtotal_cents, v_discount.id, v_discount_amount_cents,
    v_subsidy_amount_cents, v_total_cents, p_payment_reference
  )
  returning id into v_order_id;

  insert into order_items (order_id, menu_item_id, name, price_cents, quantity, size_label, notes, allergy_notes, delivery_date)
  select
    v_order_id,
    nullif(ri->>'menu_item_id', '')::uuid,
    ri->>'name',
    (ri->>'price_cents')::integer,
    (ri->>'quantity')::integer,
    ri->>'size_label',
    ri->>'notes',
    nullif(ri->>'allergy_notes', ''),
    (ri->>'delivery_date')::date
  from jsonb_array_elements(v_resolved_items) ri;

  select * into v_order from orders where id = v_order_id;
  return v_order;
end;
$$;

-- ── Register's company + location pickers (pre-auth) ────────────────────
-- 0007's list_delivery_locations plus company_id, so Register can group the
-- location picker under the picked company. Suspended companies are left
-- out. meal_subsidy_cents stays private, same as 0007.

drop function if exists list_delivery_locations();

create function list_delivery_locations()
returns table (
  address_id uuid,
  company_id uuid,
  company_name text,
  label text,
  street text,
  unit text,
  suburb text,
  city text,
  code text,
  distance_km numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, c.id, c.name, a.label, a.street, a.unit, a.suburb, a.city, a.code, a.distance_km
  from company_addresses a
  join companies c on c.id = a.company_id
  where c.is_active
  order by c.name, a.sort_order;
$$;

grant execute on function list_delivery_locations() to anon, authenticated;
grant execute on function submit_order_rating(uuid, smallint, text) to authenticated;
grant execute on function place_order(jsonb, uuid, text) to authenticated;
