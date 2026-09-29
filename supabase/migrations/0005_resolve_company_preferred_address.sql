-- Fixes a real gap: resolve_company_for_email had no way to honor a company
-- employee's own pick when their employer has multiple registered
-- addresses — it always auto-assigned the first one. Adds an optional
-- preferred-address param (only ever passed from the signup flow; regular
-- sign-ins omit it and keep whatever's already on the profile).

drop function if exists resolve_company_for_email(text);

create function resolve_company_for_email(p_email text, p_preferred_address_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text := lower(split_part(p_email, '@', 2));
  v_company companies;
  v_addresses jsonb;
  v_chosen_address_id uuid;
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

  if p_preferred_address_id is not null and exists (
    select 1 from company_addresses where id = p_preferred_address_id and company_id = v_company.id
  ) then
    v_chosen_address_id := p_preferred_address_id;
  end if;

  if auth.uid() is not null then
    perform set_config('kitchenco.allow_company_link', 'on', true);
    update profiles
    set account_type = 'company',
        company_id = v_company.id,
        company_address_id = coalesce(
          v_chosen_address_id,
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

grant execute on function resolve_company_for_email(text, uuid) to anon, authenticated;
