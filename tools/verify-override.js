// The override path is what the discountAutoApplyPaused flag protects, and it
// is the part the derived-state refactor could most easily break:
//   Remove the auto-applied code -> bump quantity -> it must STAY removed.
//   Then empty the cart and re-add -> a fresh cart must auto-suggest again.
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[override]', ...a); }

async function clickText(page, text, exact = true) {
  const box = await page.evaluate((t, ex) => {
    const els = Array.from(document.querySelectorAll('[role="button"], button, div'));
    const el = els.find((e) => {
      const s = (e.textContent || '').trim();
      return ex ? s === t : s.startsWith(t);
    });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, text, exact);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}
const body = (page) => page.evaluate(() => document.body.innerText);

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 240000 });
  await sleep(6000);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div, span, [role="button"], button'))
      .find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === 'DEV: Skip Login');
    (el.closest('[role="button"]') || el).click();
  });
  await sleep(8000);

  // add an item
  const plus = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('[role="button"]')).find((e) => (e.textContent || '').trim() === '+');
    const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(plus.x, plus.y); await sleep(2500);
  await clickText(page, 'Add to Cart', false); await sleep(2500);
  const cb = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('[role="button"]')).find((e) => /Cart,/.test(e.getAttribute('aria-label') || ''));
    const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(cb.x, cb.y); await sleep(3500);

  log('1. auto-applied on arrival:', (await body(page)).includes('WELCOME10') ? 'yes' : 'NO');

  // remove the discount (explicit user override)
  log('   clicked Remove:', await clickText(page, 'Remove'));
  await sleep(2500);
  const afterRemove = await body(page);
  log('2. gone after Remove:', !afterRemove.includes('WELCOME10') ? 'PASS' : 'FAIL');

  // bump quantity — the override must survive this
  log('   clicked +:', await clickText(page, '+'));
  await sleep(2500);
  const afterBump = await body(page);
  log('3. STAYS removed after qty change:', !afterBump.includes('WELCOME10') ? 'PASS' : 'FAIL (auto-apply overrode the user)');
  log('   qty is now 2:', /\b2\b/.test(afterBump) ? 'yes' : 'unclear');

  // empty the cart, then re-add: a fresh cart should auto-suggest again
  log('   clicked Clear:', await clickText(page, 'Clear'));
  await sleep(2500);
  const cleared = await body(page);
  log('4. cart emptied:', /empty|Your cart/i.test(cleared) ? 'yes' : 'unclear');

  await clickText(page, '← Menu');
  await sleep(3000);
  const plus2 = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('[role="button"]')).find((e) => (e.textContent || '').trim() === '+');
    if (!b) return null;
    const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (plus2) { await page.mouse.click(plus2.x, plus2.y); await sleep(2500); await clickText(page, 'Add to Cart', false); await sleep(2500); }
  const cb2 = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('[role="button"]')).find((e) => /Cart,/.test(e.getAttribute('aria-label') || ''));
    if (!b) return null;
    const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (cb2) { await page.mouse.click(cb2.x, cb2.y); await sleep(3500); }
  const refilled = await body(page);
  log('5. fresh cart auto-suggests again:', refilled.includes('WELCOME10') ? 'PASS' : 'FAIL (override leaked across carts)');
  await page.screenshot({ path: '_qa-output/verify-override.png' });

  log('page errors:', errs.length ? JSON.stringify(errs.slice(0, 2)) : 'none');
  await browser.close();
})().catch((e) => { console.error('[override] ERR:', e.message); process.exit(1); });
