// Sends the browser back to the app after PayFast. It proves nothing about
// payment: only payfast-itn can mark an order paid. The destination is fixed.
Deno.serve((req) => {
  const result = new URL(req.url).searchParams.get('result');
  const target = result === 'success' ? 'kitchenco://payment-success' : 'kitchenco://payment-cancel';
  return new Response(null, { status: 302, headers: { Location: target } });
});
