const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(...a) { console.log('[shot]', ...a); }

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

async function dumpTodayCards(page) {
  return page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim() === 'TODAY') {
        let el = walker.currentNode.parentElement;
        for (let i = 0; i < 8 && el; i++) {
          const r = el.getBoundingClientRect();
          if (r.width > 80) {
            out.push({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
            break;
          }
          el = el.parentElement;
        }
      }
    }
    return out;
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

  // Mobile viewport
  await page.setViewport({ width: 390, height: 844 });
  log('loading', URL);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(5000);

  // Sign in: fill by placeholder, submit with Enter in password field
  await typeIntoPlaceholder(page, 'name@company.com', 'customer@example.com');
  await typeIntoPlaceholder(page, 'Your password', 'password123');
  await sleep(500);
  await page.focus('input[placeholder="Your password"]');
  await page.keyboard.press('Enter');
  log('submitted sign-in');
  await sleep(6000);

  const onMenu = await page.evaluate(() => document.body.textContent.includes('Main Menu'));
  log('menu visible:', onMenu);
  await page.screenshot({ path: 'shot-main-mobile.png' });
  log('main menu shot saved');

  // Go to Today's Menu (cycle menu)
  const ok = await clickByText(page, "Today's Menu");
  log("clicked Today's Menu:", ok);
  await sleep(4000);
  await page.screenshot({ path: 'shot-cycle-mobile.png' });
  log('cycle menu shot saved');

  const cards = await dumpTodayCards(page);
  log('TODAY cards mobile:', JSON.stringify(cards));

  // Desktop viewport
  await page.setViewport({ width: 1440, height: 900 });
  await sleep(4000);
  await page.screenshot({ path: 'shot-cycle-desktop.png' });
  const cardsDesktop = await dumpTodayCards(page);
  log('TODAY cards desktop:', JSON.stringify(cardsDesktop));

  await browser.close();
  log('done');
})().catch((e) => { console.error('[shot] ERR:', e.message); process.exit(1); });