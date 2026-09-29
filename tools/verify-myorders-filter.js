// Verifies the "Orders tab shows only mine" fix in src/app/(tabs)/orders.tsx.
// DEV-Skip-Login signs in as dev-bypass@example.com, a persona with zero
// seeded demo orders and zero real orders. Before the fix, this screen
// rendered the full unfiltered `orders` array, so it showed every seeded
// demo persona's orders (thandiwe@ecogra.org, john@example.com, etc). After
// the fix it must show the empty state instead.
const puppeteer = require('puppeteer-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[myorders]', ...a); }

const fails = [];
function check(name, cond, detail) {
  log((cond ? 'PASS' : 'FAIL') + ' -- ' + name + (detail ? ' :: ' + detail : ''));
  if (!cond) fails.push(name);
}

async function clickLabel(page, label, wait) {
  const b = await page.evaluate((l) => {
    const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!b) { log('MISSING aria-label: ' + label); return false; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 900);
  return true;
}

async function clickTab(page, href, wait) {
  const b = await page.evaluate((h) => {
    const el = document.querySelector(`a[role="tab"][href="${h}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, href);
  if (!b) { log('MISSING tab: ' + href); return false; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 1200);
  return true;
}

// The dev-bypass login lands on the "Which day are you ordering for?" picker
// before the tab bar mounts at all.
async function clickText(page, text, wait) {
  const b = await page.evaluate((t) => {
    const el = Array.from(document.querySelectorAll('*'))
      .find((e) => e.children.length === 0 && (e.innerText || e.textContent || '').trim() === t);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, text);
  if (!b) return false;
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 1000);
  return true;
}

const bodyText = (page) => page.evaluate(() => document.body.textContent.replace(/[\uE000-\uF8FF]/g, ''));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => { log('PAGEERROR: ' + e.message); fails.push('pageerror: ' + e.message); });

  await page.setViewport({ width: 430, height: 1200 });
  log('loading ' + URL);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(6000);

  await clickLabel(page, 'Developer: skip login', 2500);
  await clickText(page, 'Confirm', 2000);

  const clickedTab = await clickTab(page, '/orders', 1500);
  check('Orders tab clicked', clickedTab);

  const text = await bodyText(page);
  check('No stray demo-persona order text leaks through ("Ecogra")', !text.includes('Ecogra'));
  check('No stray demo-persona order text leaks through ("ORD-")', !text.includes('ORD-'));
  check('Empty state shown for a persona with no orders', /No current orders|No Past Orders Yet|No past orders yet/.test(text));

  await browser.close();
  log(fails.length === 0 ? 'ALL PASS' : `FAILURES: ${fails.join(', ')}`);
  process.exit(fails.length === 0 ? 0 : 1);
})();
