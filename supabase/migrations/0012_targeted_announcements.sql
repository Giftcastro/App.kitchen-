-- Admin > Notifications that actually reach people, plus company / one-person targeting.
--
-- Before this, "Send Push Broadcast" only logged a row in announcements and
-- counted heads client-side: nothing delivered it and no customer screen read
-- it. Now send_announcement() resolves the audience on the server and writes
-- one announcement_recipients row per person. Each person's in-app inbox
-- (Profile > Messages) is just their own recipient rows, with read_at for the
-- unread badge. A push sender can later fan out over the same rows.
--
-- Audiences: 'All Users', 'All Customers', 'Kitchen Staff',
-- 'Active Order Holders' (an upcoming, non-cancelled order), 'Company'
-- (p_company_id) and 'Person' (p_user_id). Suspended accounts are skipped.

alter table announcements
  add column if not exists user_id uuid references profiles(id) on delete set null;

create table if not exists announcement_recipients (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  read_at timestamptz,
  primary key (announcement_id, user_id)
);
create index if not exists announcement_recipients_user_idx on announcement_recipients (user_id, read_at);

alter table announcement_recipients enable row level security;

drop policy if exists "announcement_recipients_read_own_or_admin" on announcement_recipients;
create policy "announcement_recipients_read_own_or_admin" on announcement_recipients for select using (
  user_id = auth.uid() or is_admin()
);
-- No direct writes: send_announcement() fills it, mark_announcements_read() stamps it.

-- A message is visible to the people it was sent to (and admins), no longer to
-- everyone just because company_id is null — a Kitchen Staff notice stays with staff.
drop policy if exists "announcements_read_own_company_or_broadcast_or_admin" on announcements;
drop policy if exists "announcements_read_recipient_or_admin" on announcements;
create policy "announcements_read_recipient_or_admin" on announcements for select using (
  is_admin() or exists (
    select 1 from announcement_recipients r where r.announcement_id = announcements.id and r.user_id = auth.uid()
  )
);

create or replace function send_announcement(
  p_title text,
  p_body text,
  p_audience text,
  p_company_id uuid default null,
  p_user_id uuid default null
)
returns announcements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := p_audience;
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
  v_row announcements;
  v_count integer;
begin
  if not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'Please provide both a title and message body.';
  end if;

  if p_audience = 'Company' then
    select 'Company: ' || name into v_label from companies where id = p_company_id;
    if not found then
      raise exception 'That company no longer exists.';
    end if;
  elsif p_audience = 'Person' then
    select 'Person: ' || coalesce(nullif(trim(name), ''), email) into v_label from profiles where id = p_user_id;
    if not found then
      raise exception 'That person no longer exists.';
    end if;
  elsif p_audience not in ('All Users', 'All Customers', 'Kitchen Staff', 'Active Order Holders') then
    raise exception 'Unknown audience: %', p_audience;
  end if;

  insert into announcements (title, body, company_id, user_id, target_audience, created_by)
  values (
    trim(p_title),
    trim(p_body),
    case when p_audience = 'Company' then p_company_id end,
    case when p_audience = 'Person' then p_user_id end,
    v_label,
    auth.uid()
  )
  returning * into v_row;

  insert into announcement_recipients (announcement_id, user_id)
  select v_row.id, p.id
  from profiles p
  where p.is_active
    and case p_audience
      when 'All Users' then true
      when 'All Customers' then p.role = 'customer'
      when 'Kitchen Staff' then p.role = 'kitchen_staff'
      when 'Active Order Holders' then exists (
        select 1 from orders o where o.user_id = p.id and o.delivery_date >= v_today and o.status <> 'cancelled'
      )
      when 'Company' then p.company_id = p_company_id
      when 'Person' then p.id = p_user_id
      else false
    end;
  get diagnostics v_count = row_count;

  update announcements set recipient_count = v_count where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;

-- Opening Profile > Messages marks everything there as read.
create or replace function mark_announcements_read()
returns void
language sql
security definer
set search_path = public
as $$
  update announcement_recipients set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

grant execute on function send_announcement(text, text, text, uuid, uuid) to authenticated;
grant execute on function mark_announcements_read() to authenticated;
