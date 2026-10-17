const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open() {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
  const page = await browser.newPage();
  // VIEW_W / VIEW_H override the default iPhone-14-sized viewport (e.g. VIEW_W=320 for small phones).
  await page.setViewport({ width: +(process.env.VIEW_W || 390), height: +(process.env.VIEW_H || 844), deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
  return { browser, page };
}
async function clickBox(page, fn, arg, wait) {
  const b = await page.evaluate(fn, arg);
  if (!b) { console.log('MISSING', arg); return false; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 1000);
  return true;
}
const byLabel = (l) => {
  const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
  if (!el) return null; el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
const byText = (t) => {
  const el = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim() === t);
  if (!el) return null; el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
const byTab = (h) => {
  const el = document.querySelector(`a[role="tab"][href="${h}"]`); if (!el) return null;
  const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
async function login(page, email, pw) {
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(2500);
  await page.type('input[type="email"]', email, { delay: 15 });
  await page.type('input[type="password"]', pw, { delay: 15 });
  await clickBox(page, byLabel, 'Sign In', 4000);
}
const text = (page) => page.evaluate(() => document.body.textContent.replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').slice(0, 700));
module.exports = { open, sleep, clickBox, byLabel, byText, byTab, login, text };
