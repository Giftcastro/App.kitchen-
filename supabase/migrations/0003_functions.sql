-- KitchenCo backend — RPCs. Everything that touches money, cutoff rules, or
-- cross-row batch state lives here as security definer functions, never as
-- direct table writes, so the client's numbers are never trusted.

-- ── Delivery fee bands (distance manually entered per address, no routing) ──

create function calculate_delivery_fee_cents(p_distance_km numeric)
returns integer
language sql
immutable
as $$
  select case
    when p_distance_km is null then null
    when p_distance_km <= 15 then 10000
    when p_distance_km <= 20 then 14000
    when p_distance_km <= 30 then 20000
    when p_distance_km <= 50 then 35000
    else null -- beyond 50km: not deliverable
  end;
$$;

-- ── Cutoff / lead-time ────────────────────────────────────────────────────
-- Business hours Mon-Fri 08:00-17:00 SAST, daily cutoff 09:00. Lead time is
-- 2 business days, or 3 if placed at/after the 9AM cutoff. Weekend orders
-- don't start counting until the next Monday. Mirrors the app's
-- getUpcomingOrderableWeekdays/rollForwardToWeekday logic exactly.

create function earliest_orderable_date(p_as_of timestamptz)
returns date
language plpgsql
stable
as $$
declare
  v_local timestamptz := p_as_of at time zone 'Africa/Johannesburg';
  v_date date := v_local::date;
  v_dow int := extract(isodow from v_local); -- 1=Mon .. 7=Sun
  v_lead_days int;
  v_cursor date;
  v_counted int := 0;
begin
  if v_dow in (6, 7) then
    v_date := v_date + (8 - v_dow); -- roll forward to next Monday
    v_lead_days := 2;
  elsif v_local::time >= time '09:00' then
    v_lead_days := 3;
  else
    v_lead_days := 2;
  end if;

  v_cursor := v_date;
  while v_counted < v_lead_days loop
    v_cursor := v_cursor + 1;
    if extract(isodow from v_cursor) not in (6, 7) then
      v_counted := v_counted + 1;
    end if;
  end loop;

  return v_cursor;
end;
$$;

-- ── resolve_company_for_email ────────────────────────────────────────────
-- Called at signup and re-checked on every login: a company registered
-- after a user's original signup should retroactively link them. Callable
-- pre-profile (returns company + its addresses) and, when authenticated,
-- also updates the caller's own profile linkage.

create function resolve_company_for_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text := lower(split_part(p_email, '@', 2));
  v_company companies;
  v_addresses jsonb;
begin
  select c.* into v_company
  from company_domains d
  join companies c on c.id = d.company_id
  where d.domain = v_domain
  limit 1;

  if v_company.id is null then
    if auth.uid() is not null then
      perform set_config('kitchenco.allow_company_link', 'on', true);
      update profiles set account_type = 'individual', company_id = null, company_address_id = null
      where id = auth.uid() and account_type = 'company';
    end if;
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.sort_order), '[]'::jsonb) into v_addresses
  from company_addresses a where a.company_id = v_company.id;

  if auth.uid() is not null then
    perform set_config('kitchenco.allow_company_link', 'on', true);
    update profiles
    set account_type = 'company',
        company_id = v_company.id,
        company_address_id = coalesce(
          company_address_id,
          (select id from company_addresses where company_id = v_company.id order by sort_order limit 1)
        )
    where id = auth.uid();
  end if;

  return jsonb_build_object(
    'company_id', v_company.id,
    'company_name', v_company.name,
    'meal_subsidy_cents', v_company.meal_subsidy_cents,
    'addresses', v_addresses
  );
end;
$$;

-- ── place_order ───────────────────────────────────────────────────────────
-- Re-validates and re-computes everything server-side: cutoff/lead-time,
-- per-item price from the catalog (never the client's number), delivery
-- fee from the stored distance_km, best applicable discount, and company
-- meal subsidy. Inserts orders + order_items atomically and mints a real
-- invoice number.

create function place_order(
  p_cart jsonb,             -- [{source, menu_item_id?, size_label?, cycle_week_number?, cycle_day_of_week?, cycle_slot?, name, quantity, notes?, delivery_date, addons?: [{name}]}]
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
  v_subsidy_amount_cents integer := 0;
  v_total_cents integer;
  v_total_quantity integer := 0;
  v_order_id uuid;
  v_order orders;
  v_invoice_number text;
  v_min_delivery_date date;
begin
  select * into v_profile from profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'NOT_AUTHENTICATED';
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

    v_resolved_items := v_resolved_items || jsonb_build_object(
      'menu_item_id', v_item->>'menu_item_id',
      'name', v_item->>'name',
      'price_cents', v_unit_price_cents,
      'quantity', (v_item->>'quantity')::integer,
      'size_label', v_item->>'size_label',
      'notes', v_item->>'notes',
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
    select least(
      coalesce(c.meal_subsidy_cents, 0) * v_total_quantity,
      v_subtotal_cents - v_discount_amount_cents
    ) into v_subsidy_amount_cents
    from companies c where c.id = v_profile.company_id;
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

  insert into order_items (order_id, menu_item_id, name, price_cents, quantity, size_label, notes, delivery_date)
  select
    v_order_id,
    nullif(ri->>'menu_item_id', '')::uuid,
    ri->>'name',
    (ri->>'price_cents')::integer,
    (ri->>'quantity')::integer,
    ri->>'size_label',
    ri->>'notes',
    (ri->>'delivery_date')::date
  from jsonb_array_elements(v_resolved_items) ri;

  select * into v_order from orders where id = v_order_id;
  return v_order;
end;
$$;

-- ── update_order_status ──────────────────────────────────────────────────
-- Admin-only. Propagates to every non-cancelled order sharing the same
-- batch_key (company + delivery-day) in one statement — the real corporate
-- batching rule, enforced here so it can't be bypassed by a direct write.

create function update_order_status(p_order_id uuid, p_new_status order_status)
returns setof orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_key text;
begin
  if not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select batch_key into v_batch_key from orders where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  return query
  update orders
  set status = p_new_status
  where batch_key = v_batch_key and status <> 'cancelled'
  returning *;
end;
$$;

-- ── submit_order_rating ───────────────────────────────────────────────────

create function submit_order_rating(p_order_id uuid, p_rating smallint, p_feedback text default null)
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
  if v_order.status <> 'delivered' then
    raise exception 'ORDER_NOT_DELIVERED';
  end if;
  if exists (select 1 from order_ratings where order_id = p_order_id) then
    raise exception 'ALREADY_RATED';
  end if;

  insert into order_ratings (order_id, rating, feedback)
  values (p_order_id, p_rating, p_feedback)
  returning * into v_result;

  return v_result;
end;
$$;

-- ── report_order_dispute ──────────────────────────────────────────────────

create function report_order_dispute(p_order_id uuid, p_reason text default null)
returns order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result order_disputes;
begin
  if not exists (select 1 from orders where id = p_order_id and user_id = auth.uid()) then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if exists (select 1 from order_disputes where order_id = p_order_id) then
    raise exception 'ALREADY_DISPUTED';
  end if;

  insert into order_disputes (order_id, reason, ticket_ref)
  values (p_order_id, p_reason, 'TCK-' || lpad(nextval('dispute_ticket_seq')::text, 5, '0'))
  returning * into v_result;

  return v_result;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default; these are explicit for clarity
-- and so a future `revoke execute on all functions from public` (a sensible
-- hardening step) doesn't silently break the app.

grant execute on function resolve_company_for_email(text) to anon, authenticated;
grant execute on function place_order(jsonb, uuid, text) to authenticated;
grant execute on function update_order_status(uuid, order_status) to authenticated;
grant execute on function submit_order_rating(uuid, smallint, text) to authenticated;
grant execute on function report_order_dispute(uuid, text) to authenticated;
