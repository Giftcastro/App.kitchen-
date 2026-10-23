// Captures every page of the MAUI-parity build for the client prototype PDF
// (build-prototype-doc-v8.js). Walks the same path as verify-maui-port.js,
// plus the states that script skips: invoice, order confirmation, export and
// status sheets.
//
// Read-only against Supabase: the one write on the path (place_orders on the
// Payment page) is intercepted and answered with an order the demo customer
// already owns, so the confirmation page renders real data without a new row.
//   npx expo start --web -c   (from Kitchen_APP/)   then   node tools/shot-prototype-v8.js
const path = require('path');
const fs = require('fs');
const { open, sleep } = require('./walk-lib');

const OUT = process.env.SHOT_DIR || path.join(__dirname, 'shots-v8');
fs.mkdirSync(OUT, { recursive: true });
const PASSWORD = 'KitchenCoDemo1!';
const missing = [];
const LOCATIONS = process.env.LOCATIONS ? JSON.parse(fs.readFileSync(process.env.LOCATIONS, 'utf8')) : null;

const clickText = async (page, label, wait = 1500) => {
  const box = await page.evaluate(t => {
    const onScreen = n => { const r = n.getBoundingClientRect(); return r.x >= 0 && r.x < window.innerWidth; };
    const nodes = Array.from(document.querySelectorAll('*')).filter(
      e => e.children.length === 0 && (e.textContent || '').replace(/[-]/g, '').trim() === t
    );
    const sized = nodes.filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const el = sized.find(onScreen) ?? sized[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!box) { console.log('  MISSING:', label); missing.push(label); return false; }
  await page.mouse.click(box.x, box.y);
  await sleep(wait);
  return true;
};
const clickLast = async (page, label, wait = 1500) => {
  const box = await page.evaluate(t => {
    const b = Array.from(document.querySelectorAll('[role="button"]')).filter(
      e => (e.textContent || '').replace(/[-]/g, '').trim() === t && e.getBoundingClientRect().width > 0
    );
    const el = b[b.length - 1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!box) { console.log('  MISSING button:', label); missing.push(label); return false; }
  await page.mouse.click(box.x, box.y);
  await sleep(wait);
  return true;
};
const clickPrefix = async (page, prefix, wait = 1500) => {
  const box = await page.evaluate(t => {
    const el = Array.from(document.querySelectorAll('[role="button"]')).find(
      e => (e.textContent || '').trim().startsWith(t) && e.getBoundingClientRect().width > 0
    );
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, prefix);
  if (!box) { console.log('  MISSING prefix:', prefix); missing.push(prefix); return false; }
  await page.mouse.click(box.x, box.y);
  await sleep(wait);
  return true;
};
const clickTestId = async (page, id, wait = 1500) => {
  const box = await page.evaluate(i => {
    const el = Array.from(document.querySelectorAll(`[data-testid="${i}"]`)).find(e => e.getBoundingClientRect().width > 0);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);
  if (!box) { console.log('  MISSING testID:', id); missing.push(id); return false; }
  await page.mouse.click(box.x, box.y);
  await sleep(wait);
  return true;
};
const clickLabel = async (page, label, wait = 1500) => {
  const box = await page.evaluate(l => {
    const el = Array.from(document.querySelectorAll(`[aria-label="${l}"]`)).find(e => e.getBoundingClientRect().width > 0);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!box) { console.log('  MISSING label:', label); missing.push(label); return false; }
  await page.mouse.click(box.x, box.y);
  await sleep(wait);
  return true;
};
const clickTab = async (page, href, wait = 3500) => {
  const box = await page.evaluate(h => {
    const el = document.querySelector(`a[role="tab"][href="${h}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, href);
  if (!box) { console.log('  MISSING tab:', href); missing.push(href); return false; }
  await page.mouse.click(box.x, box.y);
  await sleep(wait);
  return true;
};
// Scroll every scrollable container back to the top so frames start at the header.
const toTop = page => page.evaluate(() => {
  window.scrollTo(0, 0);
  document.querySelectorAll('*').forEach(e => { if (e.scrollTop) e.scrollTop = 0; });
});
const shot = async (page, name, { top = true } = {}) => {
  if (top) await toTop(page);
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('  shot', name);
  if (process.env.AUDIT) for (const d of await audit(page)) console.log('    !', d);
};
// AUDIT=1: report layout defects on the visible screen — content past the
// viewport edge, text clipped by its box, and overlapping text. Skips inactive
// tab screens (parked at z-index -1) and children of horizontal scrollers.
const audit = page => page.evaluate(() => {
  const W = window.innerWidth;
  const out = new Set();
  const hidden = el => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return true;
      if (cs.zIndex === '-1' && cs.position === 'absolute') return true;
    }
    return false;
  };
  const inHScroll = el => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
  };
  const label = el => (el.textContent || el.getAttribute('aria-label') || el.tagName).replace(/[-]/g, '').trim().slice(0, 40);
  const texts = [];
  for (const el of document.querySelectorAll('div, span, input, a')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > window.innerHeight) continue;
    if (hidden(el) || inHScroll(el)) continue;
    const leafText = el.children.length === 0 && (el.textContent || '').trim();
    if (r.right > W + 1 && leafText) out.add(`off-screen right by ${Math.round(r.right - W)}px: "${label(el)}"`);
    if (leafText && getComputedStyle(el).whiteSpace !== 'pre' && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).textOverflow !== 'ellipsis')
      out.add(`clipped text (${el.scrollWidth}>${el.clientWidth}): "${label(el)}"`);
    if (leafText) texts.push({ r, t: label(el), el });
  }
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 3 && oy > 3) out.add(`overlap: "${a.t}" × "${b.t}"`);
  }
  return [...out];
});
const has = (page, t) => page.evaluate(s => document.body.textContent.includes(s), t);
const signIn = async (page, email) => {
  await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(2500);
  await page.type('[data-testid="login-email"]', email, { delay: 10 });
  await page.type('[data-testid="login-password"]', PASSWORD, { delay: 10 });
  await clickTestId(page, 'login-submit', 6000);
};

(async () => {
  const { browser, page } = await open();

  // Remember an order id the signed-in customer owns; answer place_orders with it.
  let ownedOrderId = null;
  page.on('response', async res => {
    if (ownedOrderId || !/\/rest\/v1\/orders\?/.test(res.url()) || res.request().method() !== 'GET') return;
    try {
      const body = await res.json();
      const row = Array.isArray(body) ? body[0] : body;
      if (row && row.id) ownedOrderId = row.id;
    } catch {}
  });
  await page.setRequestInterception(true);
  page.on('request', req => {
    // Register's company/location list (list_delivery_locations, migration 0007/0008).
    // LOCATIONS = a JSON export of company_addresses with companies(name), for a
    // project that hasn't had those migrations run yet.
    if (LOCATIONS && /\/rpc\/list_delivery_locations/.test(req.url())) {
      const cors = {
        'Access-Control-Allow-Origin': req.headers().origin || '*',
        'Access-Control-Allow-Headers': req.headers()['access-control-request-headers'] || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      };
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors, body: '' });
      const rows = LOCATIONS
        .map(a => ({ address_id: a.id, company_id: a.company_id, company_name: a.companies.name, label: a.label, street: a.street, unit: a.unit, suburb: a.suburb, city: a.city, code: a.code, distance_km: a.distance_km, sort_order: a.sort_order }))
        .sort((x, y) => x.company_name.localeCompare(y.company_name) || x.sort_order - y.sort_order);
      return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (/\/rpc\/place_orders/.test(req.url())) {
      const cors = {
        'Access-Control-Allow-Origin': req.headers().origin || '*',
        'Access-Control-Allow-Headers': req.headers()['access-control-request-headers'] || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      };
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors, body: '' });
      console.log('  intercepted place_orders ->', ownedOrderId);
      return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{ id: ownedOrderId }]) });
    }
    req.continue();
  });

  try {
    // ── Sign in & sign up ──
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
    await sleep(3500);
    await shot(page, '01-login');
    await clickText(page, 'Sign Up', 2500);
    await shot(page, '02-register');
    await clickText(page, '🚀  🚀  GET STARTED', 1500);
    await shot(page, '02b-register-validation', { top: false });
    await clickLast(page, 'OK', 800);
    await page.type('input[placeholder="Full Name (e.g., John Doe)"]', 'Lerato Dlamini', { delay: 10 });
    await page.type('input[placeholder="Email Address (e.g., john.doe@example.com)"]', 'lerato@ecogra.org', { delay: 10 });
    await page.keyboard.press('Tab');
    await sleep(800);
    await shot(page, '02c-register-automatch');
    await clickText(page, 'Select your delivery location', 1500);
    await shot(page, '02d-register-location', { top: false });
    await clickLast(page, 'Cancel', 800);
    await page.goBack();
    await sleep(1500);

    // ── Customer ──
    await signIn(page, 'thandiwe@ecogra.org');
    await shot(page, '03-select-day');
    await clickTestId(page, 'confirm-day', 5000);
    await shot(page, '04-menu');
    await clickLabel(page, 'Change delivery day', 1500);
    await shot(page, '04b-day-overlay', { top: false });
    await clickLabel(page, 'Close', 1200);
    await clickText(page, 'Cycling Menu', 4000);
    await shot(page, '05-cycling-menu');
    await clickText(page, 'Main Menu', 4000);

    await clickText(page, '+', 2500);
    await shot(page, '06-product-cutoff-alert', { top: false });
    await clickText(page, 'Got it', 1200);
    await shot(page, '07-product-detail');
    await clickTestId(page, 'add-to-basket', 1500);
    await shot(page, '08-added-to-basket', { top: false });
    const continueLabel = await page.evaluate(
      () => (Array.from(document.querySelectorAll('*')).map(e => (e.textContent || '').trim()).find(t => /^Keep ordering for \w+$/.test(t)) || '')
    );
    await clickText(page, continueLabel, 2500);
    await shot(page, '09-menu-with-cart-bar');

    // Visit Orders first so an owned order id is known before checkout.
    await clickTab(page, '/orders', 4500);
    await shot(page, '13-orders-active');
    await clickText(page, 'Order History', 3500);
    await shot(page, '14-orders-history');
    if (await clickText(page, 'Invoice', 3500)) {
      await shot(page, '15-tax-invoice');
      await page.goBack();
      await sleep(1500);
    }
    await clickTab(page, '/', 3500);

    await clickText(page, 'Review Order', 3500);
    await shot(page, '10-cart');
    await clickTestId(page, 'proceed-to-payment', 2500);
    await shot(page, '11-payment');
    if (ownedOrderId) {
      await clickPrefix(page, 'Pay R', 600);
      await shot(page, '11b-payment-redirect', { top: false });
      await sleep(5000);
      await shot(page, '12-order-confirmation');
      await clickText(page, 'Done', 3000);
    } else {
      console.log('  no owned order seen — skipping confirmation');
      await page.goBack(); await sleep(1200); await page.goBack(); await sleep(1500);
    }

    // ── Profile ──
    await clickTab(page, '/profile', 3500);
    await shot(page, '16-profile');
    await clickText(page, 'Settings', 2000);
    await shot(page, '17-settings');
    await clickText(page, 'Mediterranean Pantry', 1200);
    await clickText(page, 'Apply', 1500);
    await shot(page, '17b-settings-pantry');
    await clickTab(page, '/', 3500);
    await shot(page, '17c-menu-pantry');
    await clickTab(page, '/profile', 2500);
    await clickText(page, 'Settings', 2000);
    await clickText(page, 'Ink & Cream', 1200);
    await clickText(page, 'Apply', 1500);
    await page.goBack();
    await sleep(1200);
    await clickText(page, 'Help & Support', 2000);
    // The web build is a dev build; the shipped app reads "Version: 1.0.0".
    await page.evaluate(() => document.querySelectorAll('*').forEach(e => {
      if (e.children.length === 0 && / \(Debug\)$/.test(e.textContent || '')) e.textContent = e.textContent.replace(' (Debug)', '');
    }));
    await shot(page, '18-help');
    await clickText(page, 'Cancellation & Holiday Policy', 2000);
    await shot(page, '19-policy');
    await page.goBack(); await sleep(1200);
    await page.goBack(); await sleep(1500);
    await clickText(page, 'Sign Out', 1200);
    await shot(page, '20-signout-confirm', { top: false });
    await clickLast(page, 'Sign Out', 3500);

    // ── Admin ──
    await signIn(page, 'admin@kitchenco.demo');
    await sleep(3000);
    await shot(page, '21-admin-overview');
    for (const [label, name] of [
      ['Active Orders', '22-admin-active-orders'],
      ['Companies', '25-admin-companies'],
      ['Notifications', '26-admin-notifications'],
      ['Menu Catalog', '27-admin-menu'],
      ['Users', '29-admin-users'],
      ['Reports', '30-admin-reports'],
      ['Settings', '31-admin-settings'],
    ]) {
      await clickText(page, label, 4500);
      await shot(page, name);
    }
    await clickText(page, 'Menu Catalog', 3500);
    await clickText(page, 'Cycle Menu', 3500);
    await shot(page, '28-admin-cycle-menu');
    await clickText(page, 'Active Orders', 3500);
    if (await clickText(page, '⬇  Export', 1500)) {
      await shot(page, '22b-admin-export-sheet', { top: false });
      await clickLast(page, 'Cancel', 1000);
    }
    await clickText(page, 'Prep Summary', 1500);
    await shot(page, '23-admin-prep-summary');
    await clickText(page, 'Orders', 1500);
    await clickText(page, '👤 Customer View', 5000);
    await shot(page, '32-admin-customer-view');
    await clickText(page, '← Back to Admin', 4000);
  } catch (err) {
    console.log('ERROR', err);
  } finally {
    console.log(`\nmissing: ${missing.length ? missing.join(' | ') : 'none'}`);
    await browser.close();
  }
})();
