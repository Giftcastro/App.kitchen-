-- One order per delivery day.
--
-- A basket can hold dishes for several days ("Order for a different day").
-- place_order stamps a single delivery_date on the order — the earliest in
-- the basket — so a Wednesday + Monday basket became one Wednesday order:
-- Track Orders, the kitchen production sheets and the company+day status
-- batch all filed Monday's dish under Wednesday.
--
-- place_orders splits the basket by delivery_date and places each day
-- through place_order, so every order carries its own date and its own
-- delivery fee (one delivery per day), priced by the same rules
-- src/services/pricing.ts quotes per day. It runs as one statement, so a
-- rejected day (cutoff, inactive dish, ...) places nothing at all.

create or replace function place_orders(
  p_cart jsonb,
  p_address_id uuid,
  p_payment_reference text default null
)
returns setof orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
begin
  if p_cart is null or jsonb_array_length(p_cart) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  for v_day in
    select distinct (ci->>'delivery_date')::date from jsonb_array_elements(p_cart) ci order by 1
  loop
    return next place_order(
      (select jsonb_agg(ci) from jsonb_array_elements(p_cart) ci where (ci->>'delivery_date')::date = v_day),
      p_address_id,
      p_payment_reference
    );
  end loop;
end;
$$;

grant execute on function place_orders(jsonb, uuid, text) to authenticated;
