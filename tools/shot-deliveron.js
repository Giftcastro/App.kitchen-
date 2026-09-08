// Captures the lower half of the Customize Order modal — the multi-date
// "DELIVER ON" pre-scheduling picker, quantity stepper and allergy field.
const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:8081';
const OUT = path.join(__dirname, 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[deliver]', ...a);

async function clickText(page, text, exact = true, wait = 2400) {
  const ok = await page.evaluate((t, ex) => {
    const all = Array.from(document.querySelectorAll('div,span,button,a'));
    const hits = all.filter((e) => {
      const tx = (e.textContent || '').trim();
      return ex ? tx === t : tx.includes(t);
    });
    if (!hits.length) return false;
    hits.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    let el = hits[0];
    for (let i = 0; i < 6 && el; i++) {
      const r = el.getBoundingClientRect();
      if (r.width > 20 && r.height > 16) { el.click(); return true; }
      el = el.parentElement;
    }
    return false;
  }, text, exact);
  if (ok) await sleep(wait);
  return ok;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => log('PAGEERROR:', e.message.slice(0, 120)));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 240000 });
  await sleep(7000);

  log('skip login:', await clickText(page, 'DEV: Skip Login', true, 6500));
  log('category:', await clickText(page, 'Ciao Italy', false, 2600));
  log('dish:', await clickText(page, 'Chicken Pesto Penne', false, 2800));

  // Scroll the modal's own scroll container so the date picker is in frame.
  const scrolled = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('div,span'))
      .find((e) => (e.textContent || '').trim() === 'DELIVER ON (OPTIONAL)');
    if (!label) return 'label-not-found';
    label.scrollIntoView({ block: 'start', behavior: 'instant' });
    // nudge up a little so the label isn't flush against the top edge
    let el = label.parentElement;
    while (el) {
      if (el.scrollHeight > el.clientHeight + 10) { el.scrollTop -= 12; break; }
      el = el.parentElement;
    }
    return 'ok';
  });
  log('scroll:', scrolled);
  await sleep(1400);

  await page.screenshot({ path: path.join(OUT, '05b-deliver-on.png') });
  log('saved 05b-deliver-on');

  await browser.close();
})().catch((e) => { console.error('[deliver] ERR:', e.stack); process.exit(1); });
