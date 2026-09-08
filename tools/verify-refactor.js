// Post-refactor smoke check:
//   1. seed data now comes from lazy useState, not a mount effect -> the
//      seeded orders must still be on the History tab.
//   2. appliedDiscount is now derived, not stored -> adding an item must
//      still auto-apply WELCOME10 (10%, the only unexpired seeded discount;
//      SAVE20 expired 30 Aug 2026).
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[verify]', ...a); }
const clean = (s) => (s || '').replace(/[\uE000-\uF8FF]/g, '').trim();

async function clickTab(page, label) {
  const box = await page.evaluate((want) => {
    const t = Array.from(document.querySelectorAll('[role="tab"]'))
      .find((e) => (e.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim() === want);
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); log('PAGEERROR:', e.message.slice(0, 200)); });
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE-ERR:', m.text().slice(0, 200)); });

  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 240000 });
  await sleep(6000);

  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div, span, [role="button"], button'))
      .find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === 'DEV: Skip Login');
    (el.closest('[role="button"]') || el).click();
  });
  await sleep(8000);

  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]'))
    .map((t) => ({ l: (t.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim(), x: t.getBoundingClientRect().x }))
    .sort((a, b) => a.x - b.x).map((t) => t.l));
  log('CHECK tab order:', JSON.stringify(tabs));

  // --- 1. seeded orders survived the effect -> initial-state move ---
  await clickTab(page, 'History');
  await sleep(3500);
  const hist = await page.evaluate(() => document.body.innerText);
  const seeded = ['ORD-1296', 'ORD-1297', 'ORD-1298'].filter((id) => hist.includes(id));
  log('CHECK seeded orders on History:', JSON.stringify(seeded), seeded.length === 3 ? 'PASS' : 'FAIL');
  log('CHECK History header:', hist.includes('Order History') ? 'PASS' : 'FAIL');

  // --- 2. derived discount still auto-applies ---
  await clickTab(page, 'Menu');
  await sleep(3500);
  const added = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('[role="button"]'))
      .find((e) => (e.textContent || '').trim() === '+');
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (added) { await page.mouse.click(added.x, added.y); log('clicked + on first card'); }
  else log('no + button found');
  await sleep(3000);
  await page.screenshot({ path: '_qa-output/verify-after-add.png' });

  const afterAdd = await page.evaluate(() => document.body.innerText);
  log('customizer/modal open:', /Add to Cart|Customi/i.test(afterAdd));
  // If a customizer opened, confirm the add.
  const confirm = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('[role="button"]'))
      .find((e) => /^Add to Cart/i.test((e.textContent || '').trim()));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (confirm) { await page.mouse.click(confirm.x, confirm.y); log('confirmed Add to Cart'); await sleep(2500); }

  const cartBtn = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="cart-button"]') ||
      Array.from(document.querySelectorAll('[role="button"]')).find((e) => /Cart,/.test(e.getAttribute('aria-label') || ''));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (cartBtn) { await page.mouse.click(cartBtn.x, cartBtn.y); log('opened cart'); await sleep(3500); }
  else log('cart button not found');

  const cartText = await page.evaluate(() => document.body.innerText);
  log('CHECK auto-applied WELCOME10:', cartText.includes('WELCOME10') ? 'PASS' : 'FAIL');
  log('CHECK 10% shown:', /10%/.test(cartText) ? 'PASS' : 'FAIL');
  log('CHECK expired SAVE20 not applied:', cartText.includes('SAVE20') ? 'FAIL (present)' : 'PASS');
  await page.screenshot({ path: '_qa-output/verify-cart.png' });

  log('page errors:', errors.length === 0 ? 'none' : JSON.stringify(errors.slice(0, 3)));
  await browser.close();
  log('done');
})().catch((e) => { console.error('[verify] ERR:', e.message); process.exit(1); });
