// Verifies the customer tab bar order after renaming Activity -> History
// and moving Orders above it. Same launch/sign-in recipe as shot.js.
const puppeteer = require('puppeteer-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[tabs]', ...a); }

async function typeIntoPlaceholder(page, placeholder, value) {
  await page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === ph);
    if (!input) throw new Error('input not found: ' + ph);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, placeholder, value);
}

// Read the tab bar left-to-right: every element with role=tab, sorted by x.
async function readTabs(page) {
  return page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    return tabs
      .map((t) => ({ label: (t.textContent || '').replace(/[-]/g, '').trim(), x: Math.round(t.getBoundingClientRect().x) }))
      .filter((t) => t.label)
      .sort((a, b) => a.x - b.x)
      .map((t) => t.label);
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => log('PAGEERROR:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE-ERR:', m.text().slice(0, 200)); });

  await page.setViewport({ width: 390, height: 844 });
  log('loading', URL);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(5000);

  // "DEV: Skip Login" signs in as an individual customer (login.tsx:628) —
  // deterministic, and the customer role is exactly the one whose tab bar
  // we are verifying.
  const signedIn = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div, span, [role="button"], button'))
      .find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === 'DEV: Skip Login');
    if (!el) return false;
    (el.closest('[role="button"]') || el).click();
    return true;
  });
  log('clicked DEV skip login:', signedIn);
  await sleep(7000);

  log('TAB ORDER:', JSON.stringify(await readTabs(page)));
  await page.screenshot({ path: 'shot-tabs-menu.png' });

  // Open the renamed tab and confirm its header reads "Order History".
  // RNW tabs use the pointer-responder system, so a synthetic .click() is
  // ignored — dispatch a real mouse click at the tab centre instead.
  const box = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('[role="tab"]'))
      .find((e) => (e.textContent || '').replace(/[-]/g, '').trim() === 'History');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!box) { const dbg = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).map(e => ({ t: e.textContent, codes: Array.from(e.textContent||'').map(c=>c.charCodeAt(0)) }))); log('DEBUG tabs:', JSON.stringify(dbg)); }
  log('History tab box:', JSON.stringify(box));
  if (box) await page.mouse.click(box.x, box.y);
  await sleep(4000);
  const hasHeader = await page.evaluate(() => document.body.innerText.includes('Order History'));
  log('header shows Order History:', hasHeader);
  await page.screenshot({ path: 'shot-tabs-history.png' });

  await browser.close();
  log('done');
})().catch((e) => { console.error('[tabs] ERR:', e.message); process.exit(1); });
