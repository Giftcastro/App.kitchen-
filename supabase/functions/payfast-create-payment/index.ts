// Creates pending orders through create_checkout() and returns a signed PayFast URL.
// The caller's JWT is forwarded, so the database sees the real customer.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildQuery, payfastHost, Pair, signPairs } from '../_shared/payfast.ts';

// Set ALLOWED_ORIGIN when the web app has a real domain.
const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID');
  const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY');
  const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') ?? '';
  const sandbox = Deno.env.get('PAYFAST_SANDBOX') !== 'false';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  if (!merchantId || !merchantKey) return json({ error: 'Payments are not configured' }, 503);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sign in to place an order' }, 401);

  let cart: unknown;
  try {
    cart = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('create_checkout', { p_cart: cart });
  if (error) {
    // 22023 and 42501 carry messages written for customers; anything else stays private.
    const safe = error.code === '22023' || error.code === '42501' || error.code === 'P0001';
    console.error('create_checkout failed', error.code);
    return json({ error: safe ? error.message : 'Unable to start checkout' }, 400);
  }

  const amount = Number(data.amount).toFixed(2);
  const pairs: Pair[] = [
    ['merchant_id', merchantId],
    ['merchant_key', merchantKey],
    ['return_url', `${supabaseUrl}/functions/v1/payfast-return?result=success`],
    ['cancel_url', `${supabaseUrl}/functions/v1/payfast-return?result=cancel`],
    ['notify_url', `${supabaseUrl}/functions/v1/payfast-itn`],
    ['email_address', data.email ?? ''],
    ['m_payment_id', data.intentId],
    ['amount', amount],
    ['item_name', 'Your Kitchen Co. lunch order'],
  ];
  const signature = signPairs(pairs, passphrase);
  const redirectUrl = `https://${payfastHost(sandbox)}/eng/process?${buildQuery(pairs)}&signature=${signature}`;

  return json({ intentId: data.intentId, amount: Number(amount), orderNumbers: data.orderNumbers, redirectUrl });
});
