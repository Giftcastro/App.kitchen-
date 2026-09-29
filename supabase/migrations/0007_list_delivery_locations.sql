-- Client review, Sep 2026: individuals no longer type their own delivery
-- address at signup ("we don't want individuals at this stage setting their
-- addresses and we don't have control to where deliveries will take place").
-- They instead pick from the businesses/delivery addresses the client
-- registers — the same company_addresses rows already used for corporate
-- employees — via a dropdown. company_addresses itself stays admin/own-company
-- only (company_addresses_read_own_or_admin, 0002); this is a separate,
-- narrower read that exposes just enough to populate that dropdown for
-- anyone, signed in or not, mirroring how company_domains is already public
-- for the same pre-auth-preview reason. meal_subsidy_cents is deliberately
-- left out — that stays company-employee-only information.

create function list_delivery_locations()
returns table (
  address_id uuid,
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
  select a.id, c.name, a.label, a.street, a.unit, a.suburb, a.city, a.code, a.distance_km
  from company_addresses a
  join companies c on c.id = a.company_id
  order by c.name, a.sort_order;
$$;

grant execute on function list_delivery_locations() to anon, authenticated;
