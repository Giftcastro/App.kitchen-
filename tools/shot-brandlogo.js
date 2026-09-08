// Screenshots the customer Menu header after swapping the text wordmark for
// the official BrandLogo artwork (ported from JoTsav/kicthenCoV1 main).
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const OUT = '_qa-output/brandlogo-';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[logo]', ...a);

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

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); log('PAGEERROR: ' + e.message); });
  page.on('requestfailed', (r) => { if (/logo/.test(r.url())) log('ASSET FAILED: ' + r.url()); });
  await page.setViewport({ width: 430, height: 1000, deviceScaleFactor: 2 });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(7000);
  await clickLabel(page, 'Developer: skip login', 4000);

  // Delivery-day picker is forced up front before the menu renders.
  const dayLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label')));
  log('labels after login: ' + JSON.stringify(dayLabels.slice(0, 25)));

  const picked = dayLabels.find((l) => /^Order for /.test(l) || /Continue|Confirm/i.test(l));
  if (picked) { log('picking: ' + picked); await clickLabel(page, picked, 3500); }

  await page.screenshot({ path: OUT + 'full.png' });
  // Tight crop of the header band, matching the screenshot that was shared.
  await page.screenshot({ path: OUT + 'header.png', clip: { x: 0, y: 0, width: 430, height: 150 } });

  const imgs = await page.evaluate(() => Array.from(document.querySelectorAll('img, [style*="logo"]'))
    .map((e) => (e.src || e.getAttribute('style') || '').slice(0, 160)).filter((s) => /logo/.test(s)));
  log('logo nodes: ' + JSON.stringify(imgs));
  log(errors.length ? 'PAGE ERRORS: ' + JSON.stringify(errors) : 'no page errors');
  await browser.close();
})().catch((e) => { console.error('[logo] ERR: ' + e.message); process.exit(1); });
