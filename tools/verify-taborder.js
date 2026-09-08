// Confirms the bottom tab bar order after moving Admin ahead of Profile:
// admin should read Admin | Profile, and the customer bar must be unchanged.
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[tabs]', ...a); }
const fails = [];
function check(name, cond, detail) {
  log((cond ? 'PASS' : 'FAIL') + ' -- ' + name + (detail ? ' :: ' + detail : ''));
  if (!cond) fails.push(name);
}

async function typeIntoPlaceholder(page, placeholder, value) {
  await page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === ph);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
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
  if (!b) { log('MISSING: ' + label); return null; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 900);
  return b;
}

// Read the tab bar left-to-right; Ionicons private-use glyphs are stripped.
const readTabs = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="tab"]'))
    .map((t) => ({ label: (t.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim(), x: Math.round(t.getBoundingClientRect().x) }))
    .filter((t) => t.label)
    .sort((a, b) => a.x - b.x)
    .map((t) => t.label));

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => { log('PAGEERROR: ' + e.message); fails.push('pageerror'); });
  await page.setViewport({ width: 430, height: 900 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(6000);

  // Admin bar.
  await typeIntoPlaceholder(page, 'Email Address (e.g., alex@example.com)', 'admin@gmail.com');
  await typeIntoPlaceholder(page, 'Password (e.g., ••••••••)', 'kitchen123');
  await sleep(300);
  await clickLabel(page, 'Sign in as Admin', 7000);
  const adminTabs = await readTabs(page);
  check('admin bar reads Admin then Profile', JSON.stringify(adminTabs) === JSON.stringify(['Admin', 'Profile']), JSON.stringify(adminTabs));
  await page.screenshot({ path: '_qa-output/taborder-admin.png' });

  // Customer bar — reload to a clean session and use the dev bypass.
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(6000);
  await clickLabel(page, 'Developer: skip login', 7000);
  // Fresh session -> orderingForDate is unset -> forced to /select-date
  // (no tab bar there) before landing on the tab navigator.
  await clickLabel(page, 'Confirm delivery day', 1500);
  const custTabs = await readTabs(page);
  check('customer bar unchanged', JSON.stringify(custTabs) === JSON.stringify(['Menu', 'Orders', 'Profile']), JSON.stringify(custTabs));
  await page.screenshot({ path: '_qa-output/taborder-customer.png' });

  log(fails.length ? 'FAILURES: ' + JSON.stringify(fails) : 'ALL CHECKS PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('[tabs] ERR: ' + e.message); process.exit(1); });
