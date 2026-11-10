// Emails the day's Production Sheet and Delivery Notes to the kitchen address,
// every active chef and the dispatch address in Settings. Called at 09:00 SAST by
// pg_cron with a shared key, or by a signed-in admin using the Settings test button.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isMailConfigured, sendMail } from '../_shared/mail.ts';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const table = (headers: string[], rows: unknown[][]) =>
  `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px">
<tr>${headers.map((h) => `<th style="background:#eee;text-align:left">${esc(h)}</th>`).join('')}</tr>
${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('\n')}</table>`;

const page = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="font-family:Arial,sans-serif"><h1 style="font-size:20px">${esc(title)}</h1>${body}</body></html>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // Check 1: the scheduler's private key, or a signed-in admin.
  const secret = req.headers.get('x-cron-secret');
  let allowed = false;
  if (secret) {
    const { data } = await db.rpc('verify_manifest_secret', { p_secret: secret });
    allowed = data === true;
  } else {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: auth } = await db.auth.getUser(token);
    if (auth?.user) {
      const { data: profile } = await db.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
      allowed = profile?.role === 'admin';
    }
  }
  if (!allowed) return json({ error: 'Not allowed' }, 401);

  const record = async (status: string, orders: number, meals: number, date: string, to = '') => {
    await db.from('platform_settings').upsert(
      {
        setting_key: 'manifest_last_run',
        setting_value: { at: new Date().toISOString(), status, orders, meals, date, to },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'setting_key' }
    );
  };

  const today = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: orders, error } = await db
    .from('orders')
    .select('id, order_number, user_id, company_name_snapshot, company_location, delivery_floor, order_items(dish_name, size, quantity, allergy_notes)')
    .eq('target_delivery_date', today)
    .in('status', ['paid_scheduled', 'kitchen_prepping', 'out_for_delivery']);

  if (error) {
    console.error('Manifest query failed', error.code);
    await record('failed: could not read orders', 0, 0, today);
    return json({ error: 'Could not read orders' }, 500);
  }

  const list = orders ?? [];
  if (list.length === 0) {
    await record('no orders today', 0, 0, today);
    return json({ status: 'no orders', date: today });
  }

  const userIds = [...new Set(list.map((o) => o.user_id).filter(Boolean))];
  const { data: people } = await db.from('profiles').select('id, full_name').in('id', userIds);
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const dishes = new Map<string, number>();
  const allergies: unknown[][] = [];
  const sites = new Map<string, { company: string; site: string; floor: string; rows: unknown[][]; meals: number }>();
  let totalMeals = 0;

  for (const order of list) {
    const person = nameOf.get(order.user_id) ?? 'Customer';
    const key = `${order.company_name_snapshot}|${order.company_location}|${order.delivery_floor}`;
    if (!sites.has(key)) {
      sites.set(key, {
        company: order.company_name_snapshot ?? 'Unassigned',
        site: order.company_location ?? '',
        floor: order.delivery_floor ?? '',
        rows: [],
        meals: 0,
      });
    }
    const site = sites.get(key)!;
    for (const item of order.order_items ?? []) {
      const dish = item.size === 'large' ? `${item.dish_name} (Large)` : item.dish_name;
      dishes.set(dish, (dishes.get(dish) ?? 0) + item.quantity);
      totalMeals += item.quantity;
      site.meals += item.quantity;
      site.rows.push([person, order.order_number, `${item.quantity} x ${dish}`, item.allergy_notes ?? '']);
      if (item.allergy_notes) allergies.push([item.quantity, dish, item.allergy_notes, person, site.company]);
    }
  }

  const production = page(
    `Production Sheet: ${today}`,
    `<p><b>${totalMeals} meals, ${list.length} orders.</b></p>
${allergies.length ? `<h2 style="color:#b00020">Allergies: cook first, seal and label separately</h2>${table(['Qty', 'Dish', 'Allergy or note', 'Name', 'Company'], allergies)}` : ''}
<h2>What to cook</h2>
${table(['Dish', 'Qty'], [...dishes.entries()].sort((a, b) => b[1] - a[1]))}`
  );

  const delivery = page(
    `Delivery Notes: ${today}`,
    [...sites.values()]
      .map((s) => `<h2>${esc(s.company)}: ${esc(s.site)}</h2><p>Drop-off: ${esc(s.floor)}. ${s.meals} meals. Deliver by 12:00.</p>${table(['Name', 'Order', 'Meal', 'Allergy or note'], s.rows)}`)
      .join('\n')
  );

  const { data: settings } = await db
    .from('platform_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['dispatch_email', 'email_routing_directory']);
  const setting = (key: string) => settings?.find((s) => s.setting_key === key)?.setting_value;
  const { data: chefs } = await db.from('profiles').select('email').eq('role', 'chef').eq('is_suspended', false);
  const kitchen = (setting('email_routing_directory') as { kitchen?: string })?.kitchen;
  const addresses = [...(chefs ?? []).map((c) => c.email as string), setting('dispatch_email') as string, kitchen]
    .filter((a): a is string => Boolean(a));
  const to = [...new Set(addresses.map((a) => a.trim().toLowerCase()))].join(', ');

  if (!to || !isMailConfigured()) {
    await record('failed: email is not configured', list.length, totalMeals, today);
    return json({ error: 'Email is not configured' }, 503);
  }

  try {
    await sendMail({
      to,
      subject: `YKC kitchen manifest for ${today}: ${totalMeals} meals, ${list.length} orders`,
      html: production + '<hr>' + delivery,
      attachments: [
        { filename: `YKC_Production_Sheet_${today}.html`, content: production, contentType: 'text/html' },
        { filename: `YKC_Delivery_Notes_${today}.html`, content: delivery, contentType: 'text/html' },
      ],
    });
  } catch (e) {
    console.error('Manifest email failed', e instanceof Error ? e.name : 'unknown');
    await record('failed: email could not be sent', list.length, totalMeals, today, to);
    return json({ error: 'Email could not be sent' }, 502);
  }

  await record('sent', list.length, totalMeals, today, to);
  return json({ status: 'sent', date: today, orders: list.length, meals: totalMeals });
});
