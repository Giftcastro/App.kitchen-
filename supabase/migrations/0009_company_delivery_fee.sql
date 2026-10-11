-- Per-company delivery fee (MAUI rebrand branch: Admin > Companies >
-- "Delivery"). A company's orders are charged by the existing distance-tier
-- table (default), a flat fee the admin sets, or nothing at all.
--
-- place_order applies the same rule the Cart screen shows (see
-- src/services/pricing.ts), so the amount the customer approves is the
-- amount charged. Identical to 0008's place_order apart from the delivery
-- block: a company's flat/free setting wins, and only the distance mode
-- still needs a surveyed distance_km.

alter table companies
  add column if not exists delivery_fee_mode text not null default 'distance'
    check (delivery_fee_mode in ('distance', 'flat', 'free')),
  add column if not exists flat_delivery_fee numeric(10, 2) not null default 0
    check (flat_delivery_fee >= 0);

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

  -- The company's own delivery setting wins (Admin > Companies > Delivery);
  -- only the default 'distance' mode needs a surveyed distance.
  if v_profile.account_type = 'company' and v_profile.company_id is not null then
    select * into v_company from companies where id = v_profile.company_id;
  end if;
  if v_company.delivery_fee_mode = 'free' then
    v_delivery_fee_cents := 0;
  elsif v_company.delivery_fee_mode = 'flat' then
    v_delivery_fee_cents := greatest(round(coalesce(v_company.flat_delivery_fee, 0) * 100), 0);
  else
    v_delivery_fee_cents := calculate_delivery_fee_cents(v_distance_km);
    if v_delivery_fee_cents is null then
      raise exception 'UNDELIVERABLE_DISTANCE';
    end if;
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

grant execute on function place_order(jsonb, uuid, text) to authenticated;
