// Walks the running app the way a user would and screenshots each stop:
// login -> admin Kitchen Controls -> Chef tab -> expand + tick a prep row ->
// Preview App (customer menu). Not an assertion suite (that is
// verify-chef.js) -- this is for eyeballing that the app actually runs.
const puppeteer = require('puppeteer-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const OUT = '_qa-output/run-';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[run]', ...a); }

async function typeIntoPlaceholder(page, placeholder, value) {
  await page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === ph);
    if (!input) throw new Error('input not found: ' + ph);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, placeholder, value);
}

// RNW ignores synthetic .click() (pointer-responder system) -- scroll the node
// into view and dispatch a real mouse click at its centre.
async function clickLabel(page, label, wait) {
  const b = await page.evaluate((l) => {
    const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!b) { log('MISSING aria-label: ' + label); return null; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 900);
  return b;
}

const labels = (page, src) => page.evaluate((s) => {
  const re = new RegExp(s);
  return Array.from(document.querySelectorAll('[aria-label]'))
    .map((e) => e.getAttribute('aria-label')).filter((l) => re.test(l));
}, src);

// textContent, not innerText: RNW clipping hides rendered text from innerText.
const bodyText = (page) => page.evaluate(() => document.body.textContent.replace(/[\uE000-\uF8FF]/g, ''));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); log('PAGEERROR: ' + e.message); });
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE-ERR: ' + m.text().slice(0, 160)); });

  await page.setViewport({ width: 430, height: 1200 });
  log('loading ' + URL);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(6000);
  await page.screenshot({ path: OUT + '1-login.png' });
  log('login screen ok');

  await typeIntoPlaceholder(page, 'Email Address (e.g., alex@example.com)', 'admin@gmail.com');
  await typeIntoPlaceholder(page, 'Password (e.g., ••••••••)', 'kitchen123');
  await sleep(300);
  await clickLabel(page, 'Sign in as Admin', 7000);
  await page.screenshot({ path: OUT + '2-dashboard.png' });
  log('signed in; dashboard tabs: ' + JSON.stringify(await labels(page, ' tab$')));

  await clickLabel(page, 'Chef tab', 2500);
  await page.screenshot({ path: OUT + '3-chef.png', fullPage: true });
  const clients = await labels(page, 'prepped$');
  log('chef clients: ' + JSON.stringify(clients));

  if (clients[0]) {
    await clickLabel(page, clients[0], 1400);
    const rows = await labels(page, '^[0-9]+ [A-Z]');
    log('prep rows: ' + JSON.stringify(rows));
    if (rows[0]) await clickLabel(page, rows[0], 1000);
    log('after tick: ' + JSON.stringify(await labels(page, 'prepped$')));
    await page.screenshot({ path: OUT + '4-chef-ticked.png', fullPage: true });
  }

  await clickLabel(page, 'Preview app as customer', 4000);
  await page.screenshot({ path: OUT + '5-customer.png', fullPage: true });
  const txt = await bodyText(page);
  log('customer view reached: ' + (txt.indexOf('Menu') !== -1 || txt.indexOf('Cart') !== -1));

  log(errors.length ? 'PAGE ERRORS: ' + JSON.stringify(errors) : 'no page errors');
  await browser.close();
})().catch((e) => { console.error('[run] ERR: ' + e.message); process.exit(1); });
