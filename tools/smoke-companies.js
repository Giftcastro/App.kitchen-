// Smoke test: the `companies` context state now loads over the network
// (fetchCompanies) instead of being available synchronously from a
// hardcoded array. Confirms a regular customer session (dev-bypass) still
// boots cleanly through Menu -> Orders -> Profile with no console/page
// errors, since Profile reads `companies` too (to find the user's own).
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[smoke]', ...a); }

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

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => { log('PAGEERROR: ' + e.message); fails.push('pageerror: ' + e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { log('CONSOLE-ERR: ' + m.text().slice(0, 300)); fails.push('console-error: ' + m.text().slice(0, 120)); } });

  await page.setViewport({ width: 430, height: 1200 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(6000);

  await clickLabel(page, 'Developer: skip login', 2500);
  await clickText(page, 'Confirm', 2000);

  check('Menu tab reachable (still on / after confirm)', page.url().endsWith('8081/') || page.url().endsWith('8081'));

  check('Orders tab clicked', await clickTab(page, '/orders', 1500));
  await sleep(500);
  check('Profile tab clicked', await clickTab(page, '/profile', 1500));
  await sleep(800);

  await browser.close();
  log(fails.length === 0 ? 'ALL PASS' : `FAILURES: ${fails.join(', ')}`);
  process.exit(fails.length === 0 ? 0 : 1);
})();
