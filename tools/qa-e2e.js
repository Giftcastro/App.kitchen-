const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra: extra || '' });
  console.log(`[qa] ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' :: ' + extra : ''}`);
}
function log(...a) { console.log('[qa]', ...a); }

async function typeIntoPlaceholder(page, placeholder, value) {
  return page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === ph);
    if (!input) throw new Error('input not found: ' + ph);
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, placeholder, value);
}

async function clickByText(page, text, { partial = false } = {}) {
  // RN-web renders touchables as plain divs (no role="button"). Clicking the
  // element that holds the matching text still bubbles up through React's
  // delegated handler to the nearest touchable, so we click it directly.
  return page.evaluate((t, opt) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const clicked = new Set();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const txt = (node.textContent || '').trim();
      if (!txt) continue;
      const match = opt.partial ? txt.includes(t) : txt === t;
      if (!match) continue;
      let el = node.parentElement;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // skip hidden nodes
      if (!clicked.has(el)) { el.click(); clicked.add(el); }
    }
    return clicked.size > 0;
  }, text, { partial });
}

async function clickHeaderCart(page) {
  // The header cart button contains the item-count badge: a small numeric text
  // node near the top-right of the viewport. Clicking the element that holds it
  // bubbles to the cart touchable.
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const targets = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const txt = (node.textContent || '').trim();
      if (!/^\d+$/.test(txt)) continue;
      const el = node.parentElement;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.y < 160 && r.x > window.innerWidth - 160) targets.push(el);
    }
    if (targets[0]) { targets[0].click(); return true; }
    return false;
  });
}

async function clickTab(page, label) {
  // Tab bar labels are leaf text nodes; clicking one bubbles to the tab item.
  return clickByText(page, label, { partial: true });
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText || '');
}

async function countInText(page, needle) {
  return (await bodyText(page)).includes(needle);
}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => log('PAGEERROR:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE-ERR:', m.text().slice(0, 300)); });

  await page.setViewport({ width: 390, height: 844 });

  /* ---------- 1. Sign in ---------- */
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(4000);

  const loginVisible = await (async () => {
    const t = await bodyText(page);
    return t.includes('Sign In') || t.includes('Log in') || t.includes('Welcome');
  })();
  check('login screen rendered', loginVisible);

  await typeIntoPlaceholder(page, 'name@company.com', 'customer@example.com');
  await typeIntoPlaceholder(page, 'Your password', 'password123');
  await sleep(300);
  await page.focus('input[placeholder="Your password"]');
  await page.keyboard.press('Enter');
  await sleep(6000);

  const onMenu = await countInText(page, 'Main Menu');
  check('signed in and Menu visible', onMenu);

  /* ---------- 2. Add item to cart via quick add + modal ---------- */
  const clickedPlus = await clickByText(page, '+', { leaf: true });
  check('quick add (+) clicked', clickedPlus);
  await sleep(1500);

  const modalOpen = await countInText(page, 'Add to Cart');
  check('item modal opened', modalOpen);
  await sleep(300);
  const added = await clickByText(page, 'Add to Cart');
  check('modal Add to Cart clicked', added);
  await sleep(1500);

  // Cart badge on header should show a count
  const badgeCount = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div,span')).find((e) => {
      const t = (e.textContent || '').trim();
      return /^\d+$/.test(t) && e.childElementCount === 0;
    });
    return el ? el.textContent.trim() : null;
  });
  check('cart badge shows count', badgeCount != null && badgeCount.length > 0, 'badge=' + badgeCount);

  /* ---------- 3. Open cart ---------- */
  const cartOpened = await clickHeaderCart(page);
  check('cart opened', cartOpened);
  await sleep(2500);

  const cartText = await bodyText(page);
  check('cart shows checkout button', cartText.includes('Checkout'));
  check('cart shows total', /R\s?\d+\.\d{2}/.test(cartText), (cartText.match(/R\s?\d+\.\d{2}/g) || []).slice(-1)[0]);
/* ---------- 4. Checkout -> PayFast card form ---------- */
  await clickByText(page, 'Checkout', { partial: true, leaf: false });
  await sleep(2500);
  const cardFormVisible = await countInText(page, 'Payment Details');
  check('payfast card form visible', cardFormVisible);
  await page.screenshot({ path: 'qa-payfast-form.png' });

  /* ---------- 5. Form validation (empty submit) ---------- */
  await clickByText(page, 'Pay R', { partial: true });
  await sleep(1500);
  const valText = await bodyText(page);
  check('card form validates empty fields',
    valText.includes('Cardholder name is required') &&
    valText.includes('16-digit card number') &&
    valText.includes('MM/YY') &&
    valText.includes('CVV'),
    (valText.match(/(Cardholder name is required|16-digit card number|valid expiry|valid CVV)/g) || []).join(', ')
  );

  /* ---------- 6. Fill card and submit ---------- */
  await typeIntoPlaceholder(page, 'John Doe', 'QA Test User');
  await typeIntoPlaceholder(page, '1234 5678 9012 3456', '4111 1111 1111 1111');
  await typeIntoPlaceholder(page, 'MM/YY', '12/28');
  await typeIntoPlaceholder(page, '123', '123');
  await sleep(300);
  await clickByText(page, 'Pay R', { partial: true });
  await sleep(3000);

  const processingVisible = await countInText(page, 'Processing Payment');
  check('processing payment screen shown', processingVisible);
  const fallbackVisible = await countInText(page, 'Sandbox Redirect');
  check('web sandbox fallback panel shown', fallbackVisible);
  await page.screenshot({ path: 'qa-payfast-processing.png' });

  /* ---------- 7. Simulate successful return from PayFast (web fallback) ---------- */
  const clickedSuccess = await clickByText(page, 'Simulate Payment Success', { partial: true });
  check('simulate payment success clicked', clickedSuccess);
  await sleep(5000);

  const successText = await bodyText(page);
  const successVisible = successText.includes('Payment Successful!');
  check('payment success screen shown', successVisible);

  if (successVisible) {
    check('success shows total', /R\s?\d+\.\d{2}/.test(successText), (successText.match(/R\s?\d+\.\d{2}/g) || []).slice(-1)[0] || '');
    check('email confirmation card', successText.includes('Email Confirmation Sent'));
    await page.screenshot({ path: 'qa-payfast-success.png' });

    /* ---------- 8. View My Orders ---------- */
    await clickByText(page, 'View My Orders', { partial: true });
    await sleep(3000);
    const activityText = await bodyText(page);
    check('order appears in Past Orders', activityText.includes('Past Orders'));
    await page.screenshot({ path: 'qa-activity.png' });

    /* ---------- 9. Tracker ---------- */
    await clickTab(page, 'Orders');
    await sleep(2500);
    const trackText = await bodyText(page);
    check('tracker shows order', trackText.includes('Order Status') && /(Preparing|Prepared|Ready|Delivered|cooking|delivery|Order\s*#?)/i.test(trackText));
    await page.screenshot({ path: 'qa-tracker.png' });
  }

  await browser.close();

  const fails = results.filter((r) => !r.ok);
  console.log('\n[qa] ===== SUMMARY ====');
  results.forEach((r) => console.log(`[qa] ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log(`[qa] total=${results.length} passed=${results.length - fails.length} failed=${fails.length}`);
  process.exit(fails.length > 0 ? 1 : 0);
})().catch((e) => { console.error('[qa] FATAL:', e.message); process.exit(2); });