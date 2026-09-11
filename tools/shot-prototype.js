// Captures every screen of the current Kitchen Co. build for the client
// prototype PDF (see build-prototype.js). Replaces the Sep-5 shot-all.js,
// which predates the delivery-day gate, the Orders merge, the Analytics tab
// and the Companies redesign.
//
// Recipe notes that each cost a run before (see the web-driver memory):
//   - react-native-web ignores synthetic el.click() on pressables — click the
//     element's centre with page.mouse instead.
//   - Ionicons glyphs sit in the private-use area, so tab labels read as
//     "\uF5DDOrders" — strip [\uE000-\uF8FF] before matching text.
//   - Never goto() after signing in: a reload wipes the in-memory session.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:8081';
const OUT = path.join(__dirname, 'shots-prototype');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[shot]', ...a);

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  log('saved', name);
}

async function typeIntoPlaceholder(page, placeholder, value) {
  return page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input,textarea'))
      .find((i) => i.placeholder === ph);
    if (!input) return false;
    const proto = input.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, placeholder, value);
}

// Real mouse click at the element's centre — RN-Web's responder system ignores
// synthetic .click() on pressables.
async function clickBox(page, box, wait) {
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  await sleep(wait == null ? 1400 : wait);
  return true;
}

async function boxForLabel(page, label, { prefix = false } = {}) {
  return page.evaluate((l, pre) => {
    const els = Array.from(document.querySelectorAll('[aria-label]'));
    const el = els.find((e) => {
      const a = e.getAttribute('aria-label') || '';
      return pre ? a.startsWith(l) : a === l;
    });
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label, prefix);
}

async function clickLabel(page, label, wait, opts) {
  const box = await boxForLabel(page, label, opts);
  if (!box) { log('MISSING aria-label:', label); return false; }
  return clickBox(page, box, wait);
}

// Clicks the deepest element whose PUA-stripped text matches, walking up to a
// tappable ancestor.
async function clickText(page, text, wait, { exact = true } = {}) {
  const box = await page.evaluate((t, ex) => {
    const clean = (s) => (s || '').replace(/[\uE000-\uF8FF]/g, '').trim();
    const hits = Array.from(document.querySelectorAll('div,span,button,a'))
      .filter((e) => {
        const tx = clean(e.textContent);
        return ex ? tx === t : tx.includes(t);
      })
      .filter((e) => e.getBoundingClientRect().width > 0);
    if (!hits.length) return null;
    hits.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    let el = hits[0];
    for (let i = 0; i < 6 && el; i++) {
      const r = el.getBoundingClientRect();
      if (r.width > 24 && r.height > 18) {
        el.scrollIntoView({ block: 'center' });
        const rr = el.getBoundingClientRect();
        return { x: rr.x + rr.width / 2, y: rr.y + rr.height / 2 };
      }
      el = el.parentElement;
    }
    return null;
  }, text, exact);
  if (!box) { log('MISSING text:', text); return false; }
  return clickBox(page, box, wait);
}

async function scrollBy(page, dy) {
  await page.evaluate((d) => {
    // The scrolling node is whichever RN ScrollView actually overflows.
    const nodes = Array.from(document.querySelectorAll('div'))
      .filter((e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 200);
    const target = nodes[nodes.length - 1] || document.scrollingElement;
    target.scrollTop += d;
  }, dy);
  await sleep(900);
}

async function boot(browser) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => log('PAGEERROR:', e.message.slice(0, 140)));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 240000 });
  await sleep(7000);
  return page;
}

// Clears the forced "Which day are you ordering for?" gate.
async function passDateGate(page) {
  const has = await page.evaluate(() => !!document.querySelector('[role="radio"]'));
  if (!has) return false;
  const box = await page.evaluate(() => {
    const r = document.querySelectorAll('[role="radio"]')[0];
    if (!r) return null;
    const b = r.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await clickBox(page, box, 600);
  await clickLabel(page, 'Confirm delivery day', 3500);
  return true;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });

  // ================= PASS 1 · customer =================
  let page = await boot(browser);
  await shot(page, '01-signin');

  // Sign Up — the toggle is a dynamic-label link (aria-label "Sign Up" only
  // while mode==='signin'), not the plain text "Sign Up" which also appears
  // in the "Don't have an account? Sign Up" sentence around it — match the
  // aria-label exactly or the click can land on the wrong node.
  // An @tcs.com address makes the company auto-match and the registered-site
  // picker both visible.
  if (await clickLabel(page, 'Sign Up', 1600)) {
    await typeIntoPlaceholder(page, 'Full Name (e.g., John Doe)', 'Gift Maise');
    await typeIntoPlaceholder(page, 'Email Address (e.g., john.doe@example.com)', 'gift.maise@tcs.com');
    await sleep(1800);
    await shot(page, '02-signup');
    await clickLabel(page, 'Sign In', 1600);
  }

  // Into the app.
  if (!(await clickLabel(page, 'Developer: skip login', 7000))) {
    log('dev bypass missing — using credentials');
    await typeIntoPlaceholder(page, 'Email Address (e.g., alex@example.com)', 'thandi@ecogra.org');
    await typeIntoPlaceholder(page, 'Password (e.g., \u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022)', 'password123');
    await sleep(600);
    await page.keyboard.press('Enter');
    await sleep(7000);
  }

  // The delivery-day gate is the first thing a signed-in customer sees.
  await sleep(1200);
  await shot(page, '03-select-date');
  await passDateGate(page);
  await sleep(1500);

  await shot(page, '04-menu-main');

  // Category filter. The chips are uppercased by CSS, so textContent still
  // reads "Ciao Italy" — match that, not what is on screen.
  await clickText(page, 'Ciao Italy', 2200);
  await shot(page, '05-menu-category');

  // Customize Order modal — top (size + add-ons), then scrolled to DELIVER ON
  const opened = await clickLabel(page, 'Add to cart', 2500);
  log('customizer opened:', opened);
  await shot(page, '06-customize');
  await scrollBy(page, 420);
  await shot(page, '07-customize-deliveron');

  // Add it — this is what raises the Added to Basket popup
  await clickText(page, 'Add to Cart', 2200, { exact: false });
  await shot(page, '08-added-to-basket');
  await clickText(page, 'Continue', 2000, { exact: false });

  // Today's Menu (the rotating cycle menu)
  await clickText(page, "Today's Menu", 3000);
  await shot(page, '09-todays-menu');
  await clickText(page, 'Standard Classics', 2000);

  // Cart
  await clickLabel(page, 'Cart,', 3200, { prefix: true });
  await shot(page, '10-cart');

  // PayFast checkout
  await clickLabel(page, 'Checkout, total R', 4000, { prefix: true });
  await shot(page, '11-payfast');
  // Cancel does router.replace('/cart') — a real navigation, not history back
  // — landing on the populated-cart view, whose own back control is labelled
  // exactly "Back to menu" (cart.tsx, distinct from payfast.tsx's identically
  // labelled button on its *success* screen, which isn't mounted here).
  await clickLabel(page, 'Cancel', 2200);
  await clickLabel(page, 'Back to menu', 3000);

  // Cart's back button is router.back(), whose destination depends on
  // in-app history depth rather than a fixed route — poll for the tab bar
  // rather than assuming one hop lands on it.
  async function tabBarHref(hrefPath) {
    return page.evaluate((p) => {
      const el = document.querySelector(`a[href="${p}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return null;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, hrefPath);
  }
  for (let i = 0; i < 3 && !(await tabBarHref('/orders')); i++) {
    log('tab bar not back yet, browser-back attempt', i + 1);
    await page.goBack();
    await sleep(1500);
  }

  // Orders — active batch tracker, then past orders + invoice
  const toOrders = await tabBarHref('/orders');
  await clickBox(page, toOrders, 3200);
  await shot(page, '12-orders-active');

  await clickText(page, 'Past Orders', 2200, { exact: false });
  await shot(page, '13-orders-past');

  await clickLabel(page, 'Tax invoice for order', 2600, { prefix: true });
  await shot(page, '14-invoice');
  await clickLabel(page, 'Close tax invoice', 1800);

  // Profile
  const toProfile = await tabBarHref('/profile');
  await clickBox(page, toProfile, 3200);
  await shot(page, '15-profile');

  await page.close();

  // ================= PASS 2 · admin =================
  page = await boot(browser);
  await typeIntoPlaceholder(page, 'Email Address (e.g., alex@example.com)', 'admin@gmail.com');
  await typeIntoPlaceholder(page, 'Password (e.g., \u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022)', 'kitchen123');
  await sleep(700);
  await clickLabel(page, 'Sign in as Admin', 8000);
  await sleep(1500);

  await shot(page, '16-admin-dashboard');

  const tabs = [
    ['Analytics tab', '17-admin-analytics'],
    ['Chef tab', '18-admin-chef'],
    ['Orders tab', '19-admin-orders'],
    ['Users tab', '20-admin-users'],
    ['Weeks tab', '21-admin-weeks'],
    ['Meals tab', '22-admin-meals'],
    ['Discounts tab', '23-admin-discounts'],
    ['Companies tab', '24-admin-companies'],
    ['Notify tab', '25-admin-notify'],
  ];
  for (const [label, name] of tabs) {
    const ok = await clickLabel(page, label, 2800);
    log('admin tab', label, ok);
    await shot(page, name);
  }

  // The Chef production sheet scrolled to the per-client prep breakdown —
  // the sheet is the operational heart of the build, so it gets two frames.
  await clickLabel(page, 'Chef tab', 2600);
  await scrollBy(page, 420);
  await shot(page, '18b-admin-chef-clients');

  await browser.close();
  log('done ->', OUT);
})().catch((e) => { console.error('[shot] ERR:', e.stack); process.exit(1); });
