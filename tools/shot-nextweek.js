const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(...a) { console.log('[nw]', ...a); }

async function typeIntoPlaceholder(page, placeholder, value) {
  await page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === ph);
    if (!input) throw new Error('input not found: ' + ph);
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, placeholder, value);
}

async function clickByText(page, text) {
  return page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll('div[role="button"], [role="button"], button, div'));
    const el = els.find((e) => e.childElementCount === 0 && e.textContent && e.textContent.trim() === t);
    if (el) { el.click(); return true; }
    const el2 = els.find((e) => e.textContent && e.textContent.trim() === t);
    if (el2) { el2.click(); return true; }
    return false;
  }, text);
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

  await typeIntoPlaceholder(page, 'name@company.com', 'customer@example.com');
  await typeIntoPlaceholder(page, 'Your password', 'password123');
  await sleep(500);
  await page.focus('input[placeholder="Your password"]');
  await page.keyboard.press('Enter');
  await sleep(6000);

  const ok = await clickByText(page, "Today's Menu");
  log("clicked Today's Menu:", ok);
  await sleep(3000);

  // Click the Next Week chip
  const clickedNext = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div[role="button"], [role="button"], div'));
    const el = els.find((e) => e.childElementCount === 0 && e.textContent && e.textContent.includes('Next Week'));
    if (el) { el.click(); return true; }
    return false;
  });
  log('clicked Next Week chip:', clickedNext);
  await sleep(3000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const checks = {
    monday: bodyText.includes('Monday'),
    friday: bodyText.includes('Friday'),
    cottagePie: bodyText.includes('Cottage Pie'),
    dateLabel: /\d{1,2}\s\w{3}/.test(bodyText),
    heroGone: !bodyText.includes('Freshly prepared'),
  };
  log('next-week checks:', JSON.stringify(checks));
  await page.screenshot({ path: 'shot-nextweek-mobile.png' });
  log('next week shot saved');

  await browser.close();
  log('done');
})().catch((e) => { console.error('[nw] ERR:', e.message); process.exit(1); });