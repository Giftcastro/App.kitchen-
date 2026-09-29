-- Fixes a real gap in 0002's privilege-escalation guard: as written, it also
-- blocked promoting the very first admin, since that update has no logged-in
-- end-user session (auth.uid() is null) to satisfy is_admin(). The fix: only
-- enforce the restriction when there IS a logged-in end-user session that
-- isn't an admin. A null auth.uid() means the change is coming from the
-- Supabase dashboard or the service_role key — already-trusted contexts that
-- bypass RLS everywhere else in this schema, so it's consistent to trust
-- them here too.

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
    then
      raise exception 'not authorized to change role/company fields';
    end if;
  end if;
  return new;
end;
$$;
