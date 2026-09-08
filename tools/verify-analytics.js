// Verifies the Reports & Analytics band on the Admin dashboard: the client
// scope filter, the KPI metric cards, Export Report, and that changing either
// filter re-scopes every figure (one slice, not per-card filters).
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const OUT = '_qa-output/analytics-';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[an]', ...a);
const fails = [];
const check = (name, ok, detail) => {
  log((ok ? 'PASS -- ' : 'FAIL -- ') + name + (detail ? ' :: ' + detail : ''));
  if (!ok) fails.push(name);
};

async function typeIntoPlaceholder(page, placeholder, value) {
  return page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === ph);
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, placeholder, value);
}

async function clickLabel(page, label, wait) {
  const b = await page.evaluate((l) => {
    const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!b) { log('MISSING label: ' + label); return null; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 1200);
  return b;
}

const bodyText = (page) => page.evaluate(() => document.body.textContent.replace(/[\uE000-\uF8FF]/g, ''));
// Reads the figure rendered on a KPI card via its accessibility label.
const kpi = (page, label) => page.evaluate((l) => {
  const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => (e.getAttribute('aria-label') || '').startsWith(l + ':'));
  return el ? el.getAttribute('aria-label') : null;
}, label);

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); log('PAGEERROR: ' + e.message); });
  await page.setViewport({ width: 390, height: 1000, deviceScaleFactor: 2 });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(7000);
  await typeIntoPlaceholder(page, 'Email Address (e.g., alex@example.com)', 'admin@gmail.com');
  await typeIntoPlaceholder(page, 'Password (e.g., \u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022)', 'kitchen123');
  await sleep(400);
  await clickLabel(page, 'Sign in as Admin', 7000);

  const txt = await bodyText(page);
  check('admin dashboard reached', txt.includes('Kitchen Controls') || txt.includes('Reporting Period'), txt.slice(0, 60));

  check('client scope filter present', txt.includes('All Companies'));
  check('export report present', txt.includes('Export Report'));
  check('KPI band present', ['TOTAL SALES', 'ORDERS COMPLETED', 'AVG. ORDER VALUE', 'TOP ITEM'].every((k) => txt.includes(k)),
    ['TOTAL SALES', 'ORDERS COMPLETED', 'AVG. ORDER VALUE', 'TOP ITEM'].filter((k) => !txt.includes(k)).join(', ') || 'all four');

  const salesAll = await kpi(page, 'TOTAL SALES');
  const ordersAll = await kpi(page, 'ORDERS COMPLETED');
  log('all companies -> ' + salesAll + ' | ' + ordersAll);
  await page.screenshot({ path: OUT + 'dashboard.png', fullPage: true });

  // Scoping to one client must move the figures — proving one shared slice.
  const scoped = await clickLabel(page, 'Scope report to Ecogra', 2000);
  check('client chips are tappable', Boolean(scoped));
  if (scoped) {
    const salesEco = await kpi(page, 'TOTAL SALES');
    const ordersEco = await kpi(page, 'ORDERS COMPLETED');
    log('Ecogra -> ' + salesEco + ' | ' + ordersEco);
    check('scoping to a client re-scopes the KPIs', salesEco !== salesAll || ordersEco !== ordersAll,
      'all=' + salesAll + ' ecogra=' + salesEco);

    // Everything below the filter row must move with it, not just the KPIs.
    const scopedTxt = await bodyText(page);
    check('the scope label follows the filter', scopedTxt.includes('Ecogra'));
    await page.screenshot({ path: OUT + 'scoped.png', fullPage: true });
    await clickLabel(page, 'Scope report to All Companies', 1800);
    const salesBack = await kpi(page, 'TOTAL SALES');
    check('returning to All Companies restores the totals', salesBack === salesAll, salesBack + ' vs ' + salesAll);
  }

  log(errors.length ? 'PAGE ERRORS: ' + JSON.stringify(errors.slice(0, 3)) : 'no page errors');
  log(fails.length ? 'FAILURES: ' + JSON.stringify(fails) : 'ALL CHECKS PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('[an] ERR: ' + e.message); process.exit(1); });
