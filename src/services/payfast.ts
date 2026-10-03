/**
 * PayFast hosted-checkout form. SANDBOX credentials (PayFast's public test
 * merchant) — going live means swapping in the client's real merchant id and
 * key here, switching PROCESS_URL to https://www.payfast.co.za/eng/process,
 * and confirming payment server-side via PayFast's ITN callback before an
 * order is treated as paid.
 */
export const PAYFAST = {
  MERCHANT_ID: '10000100',
  MERCHANT_KEY: '4642db1a3e141',
  PROCESS_URL: 'https://sandbox.payfast.co.za/eng/process',
  RETURN_URL: 'https://www.example.com/payment-success',
  CANCEL_URL: 'https://www.example.com/payment-cancelled',
};

export const newPaymentReference = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A self-submitting page that posts the payment to PayFast. */
export function buildPayFastHtml(amount: number, paymentReference: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: -apple-system, Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
      .loader { border: 4px solid #f3f3f3; border-top: 4px solid #000; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      h2 { font-size: 18px; font-weight: 600; }
    </style>
  </head>
  <body onload="document.forms['payfast_form'].submit();">
    <div><div class="loader"></div><h2>Redirecting to PayFast…</h2></div>
    <form name="payfast_form" action="${PAYFAST.PROCESS_URL}" method="post">
      <input type="hidden" name="merchant_id" value="${PAYFAST.MERCHANT_ID}">
      <input type="hidden" name="merchant_key" value="${PAYFAST.MERCHANT_KEY}">
      <input type="hidden" name="return_url" value="${PAYFAST.RETURN_URL}">
      <input type="hidden" name="cancel_url" value="${PAYFAST.CANCEL_URL}">
      <input type="hidden" name="m_payment_id" value="${escapeHtml(paymentReference)}">
      <input type="hidden" name="amount" value="${amount.toFixed(2)}">
      <input type="hidden" name="item_name" value="Your Kitchen Co. Order">
    </form>
  </body>
</html>`;
}
