// Follow-up to dark-check.js: RNW scrolls an inner container, so fullPage
// screenshots stop at the viewport. This scrolls that container and shoots
// the lower dashboard sections (Revenue by Category is the one under suspicion).
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[scroll]', ...a); }

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
async function clickTab(page, name) {
  const b = await page.evaluate((n) => {
    const t = Array.from(document.querySelectorAll('[role="tab"]'))
      .find((e) => (e.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim() === n);
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, name);
  if (b) await page.mouse.click(b.x, b.y);
  await sleep(2500);
  return b;
}

// Scroll whichever element is the tall scrolling container.
async function scrollTo(page, y) {
  await page.evaluate((top) => {
    const el = Array.from(document.querySelectorAll('div'))
      .filter((e) => e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 400)
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (el) el.scrollTop = top;
  }, y);
  await sleep(900);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 1200 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(6000);
  await typeIntoPlaceholder(page, 'name@company.com', 'admin@gmail.com');
  await typeIntoPlaceholder(page, 'Your password', 'kitchen123');
  await sleep(300);
  await clickLabel(page, 'Sign in as Admin', 7000);
  await clickTab(page, 'Profile');
  await clickLabel(page, process.argv[2] === 'light' ? 'Light theme' : 'Dark theme', 2000);
  await clickTab(page, 'Admin');

  const tag = process.argv[2] === 'light' ? 'light' : 'dark';
  for (const y of [900, 1500, 2100]) {
    await scrollTo(page, y);
    await page.screenshot({ path: '_qa-output/' + tag + '-scroll-' + y + '.png' });
    log('shot at ' + y);
  }
  await browser.close();
})().catch((e) => { console.error('[scroll] ERR: ' + e.message); process.exit(1); });
