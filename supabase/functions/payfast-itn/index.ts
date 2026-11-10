// Receives PayFast's server-to-server notification. This is the only code path
// that can mark an order paid. PayFast sends no JWT, so verify_jwt is off in
// supabase/config.toml and every request is proven genuine here instead.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseForm, payfastHost, verifySignature } from '../_shared/payfast.ts';
import { isMailConfigured, sendMail } from '../_shared/mail.ts';

const text = (body: string, status = 200) => new Response(body, { status });

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Sends the customer's receipt and the billing copy. A mail failure must never
// make PayFast resend a payment that is already recorded.
// deno-lint-ignore no-explicit-any
async function sendPaymentConfirmations(db: any, intentId: string, pfPaymentId: string) {
  if (!isMailConfigured()) {
    console.error('Payment confirmation not sent: email is not configured');
    return;
  }
  try {
    const [{ data: intent }, { data: orders }, { data: settings }] = await Promise.all([
      db.from('payment_intents').select('user_id, amount').eq('id', intentId).maybeSingle(),
      db
        .from('orders')
        .select('order_number, tax_invoice_number, delivery_date_formatted, company_name_snapshot, total_amount')
        .eq('payment_intent_id', intentId)
        .order('target_delivery_date'),
      db.from('platform_settings').select('setting_value').eq('setting_key', 'email_routing_directory').maybeSingle(),
    ]);
    const { data: customer } = await db.from('profiles').select('full_name, email').eq('id', intent?.user_id).maybeSingle();
    const directory = settings?.setting_value ?? {};
    const amount = `R ${Number(intent?.amount ?? 0).toFixed(2)}`;
    const rows = (orders ?? [])
      .map(
        // deno-lint-ignore no-explicit-any
        (o: any) =>
          `<tr><td>${esc(o.order_number)}</td><td>${esc(o.tax_invoice_number)}</td><td>${esc(o.delivery_date_formatted)}</td><td>R ${Number(o.total_amount).toFixed(2)}</td></tr>`
      )
      .join('');
    const details = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
<tr><th align="left">Order</th><th align="left">Invoice</th><th align="left">Delivery</th><th align="left">Amount</th></tr>${rows}</table>
<p><b>Total paid: ${amount}</b><br>PayFast reference: ${esc(pfPaymentId)}</p>`;

    if (customer?.email) {
      await sendMail({
        to: customer.email,
        replyTo: directory.helpSupport,
        subject: `Your Kitchen Co. payment confirmed: ${amount}`,
        html: `<p>Hi ${esc(customer.full_name ?? 'there')},</p><p>Thank you. Your payment has been received and your lunch is scheduled.</p>${details}`,
      });
    }
    if (directory.billingInvoices) {
      await sendMail({
        to: directory.billingInvoices,
        subject: `Payment received: ${amount} (${esc(pfPaymentId)})`,
        html: `<p>Customer: ${esc(customer?.full_name)} (${esc(customer?.email)})<br>Company: ${esc(orders?.[0]?.company_name_snapshot)}</p>${details}`,
      });
    }
  } catch (e) {
    console.error('Payment confirmation failed', e instanceof Error ? e.name : 'unknown');
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return text('Method not allowed', 405);

  const raw = await req.text();
  let pairs;
  try {
    pairs = parseForm(raw);
  } catch {
    return text('Bad request', 400);
  }
  const data = Object.fromEntries(pairs);
  const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') ?? '';
  const sandbox = Deno.env.get('PAYFAST_SANDBOX') !== 'false';

  // Check 1: the signature was made with our shared passphrase.
  if (!verifySignature(pairs, passphrase)) {
    console.error('ITN rejected: bad signature');
    return text('Invalid signature', 400);
  }

  // Check 2: the notification is for this merchant account.
  if (data.merchant_id !== Deno.env.get('PAYFAST_MERCHANT_ID')) {
    console.error('ITN rejected: merchant mismatch');
    return text('Invalid merchant', 400);
  }

  // Check 3: the request came from one of PayFast's published hosts.
  const hosts = sandbox
    ? ['sandbox.payfast.co.za']
    : ['www.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'];
  const caller = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const allowed = (await Promise.all(hosts.map((h) => Deno.resolveDns(h, 'A').catch(() => [] as string[])))).flat();
  if (!caller || !allowed.includes(caller)) {
    console.error('ITN rejected: unexpected source address');
    return text('Invalid source', 400);
  }

  // Check 4: PayFast itself confirms it sent this exact notification.
  const validation = await fetch(`https://${payfastHost(sandbox)}/eng/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: raw,
  });
  if ((await validation.text()).trim() !== 'VALID') {
    console.error('ITN rejected: PayFast did not validate it');
    return text('Not validated', 400);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Check 5: the database compares the amount with the one it calculated.
  const { data: outcome, error } = await supabase.rpc('confirm_payfast_payment', {
    p_intent: data.m_payment_id,
    p_pf_payment_id: data.pf_payment_id,
    p_amount: Number(data.amount_gross),
    p_status: data.payment_status,
    p_raw: data,
  });

  if (error) {
    // A non-200 response makes PayFast retry later.
    console.error('confirm_payfast_payment failed', error.code);
    return text('Retry', 500);
  }

  console.log('ITN processed', outcome);
  // Only a first successful confirmation sends mail; PayFast's repeats return already_paid.
  if (outcome === 'paid') await sendPaymentConfirmations(supabase, data.m_payment_id, data.pf_payment_id);
  return text('OK');
});
