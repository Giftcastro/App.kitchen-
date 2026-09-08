const puppeteer = require('puppeteer-core');
const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = 'qa-debug-log.txt';
function log(...a) { fs.appendFileSync(LOG, a.join(' ') + '\n'); }

async function typeIntoPlaceholder(page, placeholder, value) {
  return page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === ph);
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, placeholder, value);
}

async function clickByText(page, text, { partial = false } = {}) {
  return page.evaluate((t, opt) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const clicked = new Set();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const txt = (node.textContent || '').trim();
      if (!txt) continue;
      const match = opt.partial ? txt.includes(t) : txt === t;
      if (!match) continue;
      let el = node.parentElement;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (!clicked.has(el)) { el.click(); clicked.add(el); }
    }
    return clicked.size > 0;
  }, text, { partial });
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') {
      log('=== CONSOLE ERR full:', m.text());
      log('--- stack:', (m.stackTrace ? m.stackTrace().map((f) => f.url + ':' + f.lineNumber + ':' + f.columnNumber).join('\n') : 'none'));
    }
  });
  page.on('pageerror', (e) => log('=== PAGEERROR full:', e.stack || e.message));

  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(4000);
  await typeIntoPlaceholder(page, 'name@company.com', 'customer@example.com');
  await typeIntoPlaceholder(page, 'Your password', 'password123');
  await sleep(300);
  await page.focus('input[placeholder="Your password"]');
  await page.keyboard.press('Enter');
  await sleep(6000);
  await clickByText(page, '+');
  await sleep(1500);
  await clickByText(page, 'Add to Cart');
  await sleep(1500);

  // Open the cart via the header badge (client-side navigation keeps SPA state)
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const txt = (walker.currentNode.textContent || '').trim();
      if (!/^\d+$/.test(txt)) continue;
      const el = walker.currentNode.parentElement;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.y < 160 && r.x > window.innerWidth - 160) { el.click(); return true; }
    }
    return false;
  });
  await sleep(2500);
  await clickByText(page, 'Checkout', { partial: true });
  await sleep(2500);
  log('--- on card form:', (await page.evaluate(() => document.body.innerText)).includes('Payment Details'));

  await typeIntoPlaceholder(page, 'John Doe', 'QA Test User');
  await typeIntoPlaceholder(page, '1234 5678 9012 3456', '4111 1111 1111 1111');
  await typeIntoPlaceholder(page, 'MM/YY', '12/28');
  await typeIntoPlaceholder(page, '123', '123');
  await sleep(300);
  await clickByText(page, 'Pay R', { partial: true });
  await sleep(4000);
  log('--- processing text head:', (await page.evaluate(() => document.body.innerText)).slice(0, 400));
  await browser.close();
  log('DONE');
})().catch((e) => { log('FATAL', e && e.message ? e.message : e); process.exit(1); });