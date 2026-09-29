-- KitchenCo presentation demo data.
--
-- Fills a fresh project with realistic-looking activity so every screen has
-- something to show: three corporate clients with delivery points and
-- subsidies, discount codes, a real admin login, ten customer logins, and
-- ~8 weeks of orders (past = delivered/rated/disputed, today = in the kitchen,
-- next few days = pending) for Reports & Analytics to chart.
--
-- ORDER OF OPERATIONS
--   1. migrations 0001–0007
--   2. supabase/seed.sql
--   3. supabase/seed/import-menu.mjs   (orders are built from the real catalog)
--   4. this file — paste into the Supabase dashboard's SQL editor and Run.
--
-- It runs as the postgres role there, so RLS and the profile privilege guard
-- (0004 trusts a null auth.uid()) don't get in the way.
--
-- RE-RUNNABLE: it first deletes everything it owns (the demo accounts below,
-- companies on the demo domains, the demo discount codes, and every order
-- belonging to those accounts), then rebuilds with today as the anchor date.
-- Re-run it the morning of a presentation so "today" lines up.
--
-- NOT FOR PRODUCTION: it deletes and recreates the Ecogra/TATA/RCL company
-- rows. Don't run it on the database you go live on.
--
-- Every demo account's password: KitchenCoDemo1!
--   admin        admin@kitchenco.demo
--   Ecogra       thandiwe@ecogra.org, lerato@ecogra.org, sipho@ecogra.org
--   TATA         raj@tcs.com, priya@tcs.com, kabelo@tcs.com
--   RCL          nomvula@rclfoods.com, pieter@rclfoods.com
--   individuals  john@example.com, jane@example.com, ayesha@example.com, david@example.com

do $$
declare
  c_password constant text := 'KitchenCoDemo1!';
  c_emails constant text[] := array[
    'admin@kitchenco.demo',
    'thandiwe@ecogra.org', 'lerato@ecogra.org', 'sipho@ecogra.org',
    'raj@tcs.com', 'priya@tcs.com', 'kabelo@tcs.com',
    'nomvula@rclfoods.com', 'pieter@rclfoods.com',
    'john@example.com', 'jane@example.com', 'ayesha@example.com', 'david@example.com'
  ];
  c_domains constant text[] := array['ecogra.org', 'tcs.com', 'rclfoods.com'];
  c_codes constant text[] := array['WELCOME10', 'SAVE20', 'ECOGRA15', 'WINTER25'];

  v_ecogra uuid; v_tata uuid; v_rcl uuid;
  v_ecogra_hq uuid; v_ecogra_sandton uuid; v_tata_hq uuid; v_tata_woodmead uuid; v_rcl_hq uuid;
  v_welcome uuid;

  v_user record;
  v_uid uuid;
  v_day date;
  v_order_id uuid;
  v_created timestamptz;
  v_status order_status;
  v_addr company_addresses;
  v_item record;
  v_lines int;
  v_qty int;
  v_note text;
  v_subtotal int;
  v_units int;
  v_discount_id uuid;
  v_discount int;
  v_subsidy int;
  v_fee int;
  v_today date := current_date;
  v_notes constant text[] := array[
    'No onions please', 'Nut allergy — please keep separate', 'Sauce on the side',
    'Extra spicy', 'Gluten free if possible', 'No cheese', 'Halaal please'
  ];
  v_feedback constant text[] := array[
    'Delicious and still hot on arrival!', 'Great portion size, will order again.',
    'Loved it — the team is hooked.', 'Tasty, delivery was right on time.',
    'Really fresh, thank you!', 'Good, but a little salty for me.', NULL, NULL
  ];
begin
  perform setseed(0.42); -- same "random" demo data on every run

  -- ── Wipe previous demo data ─────────────────────────────────────────────
  delete from orders where user_id in (select id from profiles where email = any(c_emails))
     or company_id in (select company_id from company_domains where domain = any(c_domains));
  delete from auth.users where email = any(c_emails); -- cascades profiles, addresses
  delete from discounts where code = any(c_codes);
  update profiles set company_id = null, company_address_id = null, account_type = 'individual'
   where company_id in (select company_id from company_domains where domain = any(c_domains))
      or company_address_id in (select a.id from company_addresses a join company_domains d on d.company_id = a.company_id where d.domain = any(c_domains));
  delete from companies where id in (select company_id from company_domains where domain = any(c_domains));

  -- ── Corporate clients ───────────────────────────────────────────────────
  insert into companies (name, meal_subsidy_cents) values ('Ecogra', 8000) returning id into v_ecogra;
  insert into companies (name, meal_subsidy_cents) values ('TATA', 8500) returning id into v_tata;
  insert into companies (name, meal_subsidy_cents) values ('RCL', 4000) returning id into v_rcl;

  insert into company_domains (company_id, domain) values
    (v_ecogra, 'ecogra.org'), (v_tata, 'tcs.com'), (v_rcl, 'rclfoods.com');

  insert into company_addresses (company_id, label, street, suburb, city, code, distance_km, is_primary, sort_order, instructions)
    values (v_ecogra, 'Head Office', '160 Jan Smuts Ave', 'Rosebank', 'Johannesburg', '2196', 9.5, true, 0, 'Reception on the ground floor')
    returning id into v_ecogra_hq;
  insert into company_addresses (company_id, label, street, suburb, city, code, distance_km, is_primary, sort_order)
    values (v_ecogra, 'Sandton Branch', '1 Sandton Drive', 'Sandton', 'Johannesburg', '2196', 12, false, 1)
    returning id into v_ecogra_sandton;
  insert into company_addresses (company_id, label, street, suburb, city, code, distance_km, is_primary, sort_order, instructions)
    values (v_tata, 'Head Office', '39 Ferguson Road', 'Illovo', 'Johannesburg', '2196', 11, true, 0, 'Deliver to the 3rd floor canteen')
    returning id into v_tata_hq;
  insert into company_addresses (company_id, label, street, suburb, city, code, distance_km, is_primary, sort_order)
    values (v_tata, 'Woodmead Office', '6 Maxwell Drive', 'Woodmead', 'Johannesburg', '2191', 17.5, false, 1)
    returning id into v_tata_woodmead;
  insert into company_addresses (company_id, label, street, suburb, city, code, distance_km, is_primary, sort_order)
    values (v_rcl, 'Head Office', '15 Railey Road', 'Bedfordview', 'Johannesburg', '2007', 22, true, 0)
    returning id into v_rcl_hq;

  -- ── Discounts ───────────────────────────────────────────────────────────
  insert into discounts (code, percentage, active, expires_at) values ('WELCOME10', 10, true, '2026-12-31 23:59+02')
    returning id into v_welcome;
  insert into discounts (code, percentage, active, expires_at) values ('SAVE20', 20, true, '2026-12-31 23:59+02');
  insert into discounts (code, percentage, active, company_id) values ('ECOGRA15', 15, true, v_ecogra);
  insert into discounts (code, percentage, active, expires_at) values ('WINTER25', 25, false, '2026-08-31 23:59+02');

  -- ── Accounts ────────────────────────────────────────────────────────────
  create temp table demo_users (
    email text, name text, role user_role, account_type account_type,
    company_id uuid, address_id uuid, joined date, order_chance numeric
  ) on commit drop;
  insert into demo_users values
    ('admin@kitchenco.demo',   'KitchenCo Admin',   'admin',    'individual', null,     null,              v_today - 120, 0),
    ('thandiwe@ecogra.org',    'Thandiwe Mokoena',  'customer', 'company',    v_ecogra, v_ecogra_hq,       v_today - 95,  0.55),
    ('lerato@ecogra.org',      'Lerato Nkosi',      'customer', 'company',    v_ecogra, v_ecogra_hq,       v_today - 88,  0.45),
    ('sipho@ecogra.org',       'Sipho Dlamini',     'customer', 'company',    v_ecogra, v_ecogra_sandton,  v_today - 60,  0.35),
    ('raj@tcs.com',            'Raj Naidoo',        'customer', 'company',    v_tata,   v_tata_hq,         v_today - 80,  0.5),
    ('priya@tcs.com',          'Priya Pillay',      'customer', 'company',    v_tata,   v_tata_hq,         v_today - 70,  0.4),
    ('kabelo@tcs.com',         'Kabelo Molefe',     'customer', 'company',    v_tata,   v_tata_woodmead,   v_today - 45,  0.3),
    ('nomvula@rclfoods.com',   'Nomvula Dube',      'customer', 'company',    v_rcl,    v_rcl_hq,          v_today - 75,  0.4),
    ('pieter@rclfoods.com',    'Pieter van Wyk',    'customer', 'company',    v_rcl,    v_rcl_hq,          v_today - 40,  0.3),
    -- Individuals pick a registered business as their delivery point
    -- (company_address_id with no company_id — see 0007).
    ('john@example.com',       'John Customer',     'customer', 'individual', null,     v_ecogra_sandton,  v_today - 110, 0.3),
    ('jane@example.com',       'Jane Smith',        'customer', 'individual', null,     v_tata_hq,         v_today - 100, 0.25),
    ('ayesha@example.com',     'Ayesha Patel',      'customer', 'individual', null,     v_ecogra_hq,       v_today - 50,  0.35),
    ('david@example.com',      'David Mahlangu',    'customer', 'individual', null,     v_rcl_hq,          v_today - 30,  0.35);

  for v_user in select * from demo_users loop
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_user.email,
      extensions.crypt(c_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('name', v_user.name),
      v_user.joined, now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', v_user.email, 'email_verified', true),
            'email', now(), v_user.joined, now());
    -- handle_new_user() (0002) already created the profile row.
    update profiles
       set name = v_user.name, role = v_user.role, account_type = v_user.account_type,
           company_id = v_user.company_id, company_address_id = v_user.address_id,
           created_at = v_user.joined
     where id = v_uid;
  end loop;

  -- ── Orders: 8 weeks back, 3 weekdays forward ────────────────────────────
  for v_day in select d::date from generate_series(v_today - 56, v_today + 3, interval '1 day') d
               where extract(isodow from d) < 6 loop
    for v_user in
      select p.id, p.company_id, p.company_address_id, u.order_chance
      from profiles p join demo_users u on u.email = p.email
      where u.order_chance > 0
    loop
      -- Today is busier, so the Chef tab and Due Today have a full queue.
      if random() > least(v_user.order_chance * case when v_day = v_today then 1.8 else 1 end, 0.95) then continue; end if;

      select * into v_addr from company_addresses where id = v_user.company_address_id;
      -- Placed 1–3 days ahead, mid-morning — but never in the future.
      v_created := least(
        (v_day - (1 + floor(random() * 3))::int) + time '08:00' + random() * interval '3 hours',
        now() - random() * interval '2 hours'
      );
      v_status := case
        when v_day < v_today then (case when random() < 0.05 then 'cancelled' else 'delivered' end)::order_status
        when v_day = v_today then 'preparing'
        else 'pending'
      end;

      insert into orders (invoice_number, user_id, company_id, delivery_date, delivery_address_snapshot,
                          subtotal_cents, total_cents, status, payment_status, payment_reference, created_at)
      values (
        'INV-' || to_char(v_created, 'YYYYMMDD') || '-' || lpad(nextval('invoice_number_seq')::text, 5, '0'),
        v_user.id, v_user.company_id, v_day,
        jsonb_build_object('address_id', v_addr.id, 'label', v_addr.label, 'street', v_addr.street,
                           'suburb', v_addr.suburb, 'city', v_addr.city, 'code', v_addr.code),
        0, 0, v_status,
        (case when v_status = 'cancelled' then 'refunded' else 'paid' end)::payment_status,
        'PF-' || upper(substr(md5(random()::text), 1, 10)),
        v_created
      ) returning id into v_order_id;

      -- 1–3 lines from the real catalog; one in five orders adds the day's
      -- cycle-menu special at the flat cycle price.
      v_lines := 1 + floor(random() * 3)::int;
      for v_item in
        select mi.id, mi.name, s.label, s.price_cents
        from menu_items mi
        join lateral (select * from menu_item_sizes s where s.menu_item_id = mi.id and s.price_cents > 0 order by random() limit 1) s on true
        where mi.active and mi.source = 'static'
        order by random() limit v_lines
      loop
        v_qty := case when random() < 0.8 then 1 else 2 end;
        v_note := case when random() < 0.12 then v_notes[1 + floor(random() * array_length(v_notes, 1))::int] end;
        insert into order_items (order_id, menu_item_id, name, price_cents, quantity, size_label, notes, delivery_date, created_at)
        values (v_order_id, v_item.id, v_item.name, v_item.price_cents, v_qty, v_item.label, v_note, v_day, v_created);
      end loop;

      if random() < 0.2 then
        insert into order_items (order_id, name, price_cents, quantity, size_label, delivery_date, created_at)
        select v_order_id, c.item_name,
               coalesce((select value_cents from pricing_config where key = 'cycle_item_price'), 8000),
               1, 'Regular', v_day, v_created
        from cycle_menu_slots c
        where c.day_of_week = (array['mon','tue','wed','thu','fri'])[extract(isodow from v_day)::int]::weekday
        order by random() limit 1;
      end if;
    end loop;
  end loop;

  -- ── Corporate bulk orders: a team lunch per client every other week, plus
  -- one per client today so the Chef tab has big batches to show ──────────
  for v_user in
    select distinct on (p.company_id) p.id, p.company_id, p.company_address_id
    from profiles p join demo_users u on u.email = p.email
    where p.company_id is not null order by p.company_id, u.joined
  loop
    for v_day in select d::date from generate_series(v_today - 42, v_today, interval '14 days') d loop
      if extract(isodow from v_day) > 5 then v_day := v_day - (extract(isodow from v_day)::int - 5); end if;
      select * into v_addr from company_addresses where id = v_user.company_address_id;
      v_created := least((v_day - 3) + time '09:15', now() - interval '1 hour');
      insert into orders (invoice_number, user_id, company_id, delivery_date, delivery_address_snapshot,
                          subtotal_cents, total_cents, status, payment_status, payment_reference, notes, created_at)
      values (
        'INV-' || to_char(v_created, 'YYYYMMDD') || '-' || lpad(nextval('invoice_number_seq')::text, 5, '0'),
        v_user.id, v_user.company_id, v_day,
        jsonb_build_object('address_id', v_addr.id, 'label', v_addr.label, 'street', v_addr.street,
                           'suburb', v_addr.suburb, 'city', v_addr.city, 'code', v_addr.code),
        0, 0, (case when v_day < v_today then 'delivered' else 'preparing' end)::order_status, 'paid',
        'PF-' || upper(substr(md5(random()::text), 1, 10)), 'Team lunch — please label each meal', v_created
      ) returning id into v_order_id;
      insert into order_items (order_id, menu_item_id, name, price_cents, quantity, size_label, delivery_date, created_at)
      select v_order_id, mi.id, mi.name, s.price_cents, 6 + floor(random() * 10)::int, s.label, v_day, v_created
      from menu_items mi
      join lateral (select * from menu_item_sizes s where s.menu_item_id = mi.id and s.price_cents > 0 order by s.price_cents limit 1) s on true
      join menu_categories c on c.id = mi.category_id
      where mi.active and c.name in ('CIAO ITALY', 'STIR FRY', 'WRAPS', 'POKE BOWL')
      order by random() limit 2;
    end loop;
  end loop;

  -- ── Totals: same arithmetic as place_order (0003) ───────────────────────
  for v_order_id, v_subtotal, v_units, v_fee in
    select o.id, sum(i.price_cents * i.quantity)::int, sum(i.quantity)::int,
           coalesce(calculate_delivery_fee_cents(max(a.distance_km)), 0)
    from orders o join order_items i on i.order_id = o.id
    join profiles p on p.id = o.user_id
    left join company_addresses a on a.id = (o.delivery_address_snapshot->>'address_id')::uuid
    where p.email = any(c_emails)
    group by o.id
  loop
    -- One order in eight used WELCOME10.
    v_discount_id := case when random() < 0.125 then v_welcome end;
    v_discount := case when v_discount_id is not null then round(v_subtotal * 0.10) else 0 end;
    -- least() skips NULLs, so an individual (no company) must be zeroed explicitly.
    select case when c.id is null then 0 else least(coalesce(c.meal_subsidy_cents, 0) * v_units, v_subtotal - v_discount) end into v_subsidy
      from orders o left join companies c on c.id = o.company_id where o.id = v_order_id;
    update orders
       set subtotal_cents = v_subtotal, discount_id = v_discount_id, discount_amount_cents = v_discount,
           subsidy_amount_cents = v_subsidy, delivery_fee_cents = v_fee,
           total_cents = greatest(v_subtotal - v_discount - v_subsidy, 0) + v_fee
     where id = v_order_id;
  end loop;

  -- ── Ratings on ~60% of delivered orders, mostly 4–5 stars ───────────────
  insert into order_ratings (order_id, rating, feedback, submitted_at)
  select o.id,
         (array[5,5,5,4,4,4,3,5,4,2])[1 + floor(random() * 10)::int],
         v_feedback[1 + floor(random() * array_length(v_feedback, 1))::int],
         (o.delivery_date + time '14:00') + random() * interval '5 hours'
  from orders o join profiles p on p.id = o.user_id
  where p.email = any(c_emails) and o.status = 'delivered' and o.notes is null and random() < 0.6;

  -- ── A few support tickets in each state ─────────────────────────────────
  insert into order_disputes (order_id, reported_at, reason, ticket_ref, status)
  select t.id, (t.delivery_date + time '15:00'),
         (array['Order never arrived', 'Missing item — no garlic bread', 'Meal arrived cold'])[t.n],
         'TCK-' || lpad(nextval('dispute_ticket_seq')::text, 5, '0'),
         ((array['refunded', 'resolved', 'investigating'])[t.n])::dispute_status
  from (
    -- Numbered outside the LIMIT (row_number() inside it runs first and can exceed 3).
    select l.*, row_number() over (order by l.delivery_date desc) as n from (
    select o.id, o.delivery_date
    from orders o join profiles p on p.id = o.user_id
    where p.email = any(c_emails) and o.status = 'delivered' and o.notes is null
      and not exists (select 1 from order_ratings r where r.order_id = o.id)
      and o.delivery_date >= v_today - 14
    order by o.delivery_date desc
    limit 3
    ) l
  ) t;
  update orders set payment_status = 'refunded'
   where id in (select order_id from order_disputes where status = 'refunded'
                and order_id in (select o.id from orders o join profiles p on p.id = o.user_id where p.email = any(c_emails)));

  -- ── Announcements (stored for when the app reads them from the DB) ──────
  delete from announcements where title in ('New winter soups are here', 'Ecogra: Friday team lunch');
  insert into announcements (title, body, company_id, sent_at) values
    ('New winter soups are here', 'Ginger & Honey Butternut and Pea, Tomato & Lentil — now on the menu.', null, now() - interval '2 days'),
    ('Ecogra: Friday team lunch', 'Orders for Friday''s team lunch close Thursday at 14:00.', v_ecogra, now() - interval '1 day');

  raise notice 'Demo data loaded: % orders, % ratings, % disputes',
    (select count(*) from orders o join profiles p on p.id = o.user_id where p.email = any(c_emails)),
    (select count(*) from order_ratings r join orders o on o.id = r.order_id join profiles p on p.id = o.user_id where p.email = any(c_emails)),
    (select count(*) from order_disputes d join orders o on o.id = d.order_id join profiles p on p.id = o.user_id where p.email = any(c_emails));
end;
$$;
