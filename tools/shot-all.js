// Captures every screen of the Kitchen Co. app for the UI/UX showcase.
// Reuses the puppeteer-core + Edge setup already proven by shot.js.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:8081';
const OUT = path.join(__dirname, 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[all]', ...a);

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  log('saved', name);
}

async function typeIntoPlaceholder(page, placeholder, value) {
  return page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input,textarea')).find((i) => i.placeholder === ph);
    if (!input) return false;
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, placeholder, value);
}

// Clicks the smallest element whose trimmed text equals `text`, walking up to a
// tappable ancestor so RN-Web's nested pressable wrappers actually receive it.
async function clickText(page, text, opts = {}) {
  const ok = await page.evaluate((t, exact) => {
    const all = Array.from(document.querySelectorAll('div,span,button,a,input'));
    const hits = all.filter((e) => {
      const tx = (e.textContent || '').trim();
      return exact ? tx === t : tx.includes(t);
    });
    if (!hits.length) return false;
    // smallest = deepest / most specific
    hits.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    let el = hits[0];
    for (let i = 0; i < 6 && el; i++) {
      const r = el.getBoundingClientRect();
      if (r.width > 20 && r.height > 16) {
        el.click();
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }, text, opts.exact !== false);
  if (ok) await sleep(opts.wait || 2200);
  return ok;
}

async function clickTestable(page, label) {
  const ok = await page.evaluate((l) => {
    const el = document.querySelector(`[aria-label="${l}"]`);
    if (el) { el.click(); return true; }
    return false;
  }, label);
  if (ok) await sleep(2200);
  return ok;
}

async function boot(browser) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => log('PAGEERROR:', e.message.slice(0, 140)));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 240000 });
  await sleep(7000);
  return page;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });

  // ---------- PASS 1 · customer ----------
  let page = await boot(browser);

  await shot(page, '01-signin');

  // Sign Up, filled in as a real corporate signup so the domain-match banner shows
  if (await clickText(page, 'Sign Up')) {
    await clickText(page, 'Company', { wait: 900 });
    await typeIntoPlaceholder(page, 'John Doe', 'Thandi Mokoena');
    await typeIntoPlaceholder(page, 'name@company.com', 'thandi.mokoena@ecogra.org');
    await sleep(1800);
    await shot(page, '02-signup');
  }

  // back to sign in, then bypass into the app
  await clickText(page, 'Sign In');
  await sleep(800);
  if (!(await clickText(page, 'DEV: Skip Login', { wait: 6000 }))) {
    log('dev bypass missing — falling back to credentials');
    await typeIntoPlaceholder(page, 'name@company.com', 'thandi@ecogra.org');
    await typeIntoPlaceholder(page, 'Your password', 'password123');
    await page.focus('input[placeholder="Your password"]');
    await page.keyboard.press('Enter');
    await sleep(7000);
  }

  await shot(page, '03-menu-main');

  // a category chip, then a dish -> customiser
  const cat = await clickText(page, 'Ciao Italy', { exact: false, wait: 2600 });
  log('category open:', cat);
  await shot(page, '04-menu-category');

  const dish = await clickText(page, 'Chicken Pesto Penne', { exact: false, wait: 2600 });
  log('dish open:', dish);
  if (dish) {
    await shot(page, '05-customize');
    // add it so the cart has content
    await clickText(page, 'Add to Cart', { exact: false, wait: 3000 });
  }

  // cycle menu
  await clickText(page, "Today's Menu", { wait: 3000 });
  await shot(page, '06-todays-menu');

  // add a cycle item too
  const cyc = await clickText(page, 'MAIN MEAL', { exact: false, wait: 2600 });
  if (cyc) {
    await shot(page, '07-add-meal');
    await clickText(page, 'Add to Cart', { exact: false, wait: 3000 });
  }

  // cart — click the header button; NEVER goto(), a reload wipes the in-memory session
  const gotCart = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="cart-button"]')
      || document.querySelector('[aria-label^="Cart"]');
    if (el) { el.click(); return true; }
    return false;
  });
  log('cart opened:', gotCart);
  await sleep(3500);
  await shot(page, '08-cart');

  // back to the tabs via client-side history (no reload)
  await page.goBack();
  await sleep(3500);

  for (const [label, name] of [['Activity', '09-activity'], ['Orders', '10-orders'], ['Profile', '11-profile']]) {
    const ok = await clickText(page, label, { wait: 3200 });
    log('tab', label, ok);
    await shot(page, name);
  }

  await page.close();

  // ---------- PASS 2 · admin ----------
  page = await boot(browser);
  await typeIntoPlaceholder(page, 'name@company.com', 'admin@gmail.com');
  await typeIntoPlaceholder(page, 'Your password', 'admin12345');
  await sleep(600);
  await page.focus('input[placeholder="Your password"]');
  await page.keyboard.press('Enter');
  await sleep(8000);

  const sections = [
    ['Dashboard', '12-admin-dashboard'],
    ['Users', '13-admin-users'],
    ['Orders', '14-admin-orders'],
    ['Chef', '15-admin-chef'],
    ['Weeks', '16-admin-weeks'],
    ['Meals', '17-admin-meals'],
    ['Discounts', '18-admin-discounts'],
    ['Companies', '19-admin-companies'],
  ];

  await shot(page, '12-admin-dashboard');
  for (const [label, name] of sections.slice(1)) {
    const ok = await clickText(page, label, { wait: 2800 });
    log('admin section', label, ok);
    await shot(page, name);
  }

  await browser.close();
  log('done ->', OUT);
})().catch((e) => { console.error('[all] ERR:', e.stack); process.exit(1); });
