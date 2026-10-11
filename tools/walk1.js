const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = '_qa-output/walk/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)); });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(3000);
  await page.screenshot({ path: OUT + '01-login.png' });
  const inputs = await page.$$eval('input', (els) => els.map((e) => ({ type: e.type, ph: e.placeholder })));
  console.log('inputs', JSON.stringify(inputs));
  const btns = await page.evaluate(() => Array.from(document.querySelectorAll('[role="button"],button')).map((e) => (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 40)));
  console.log('buttons', JSON.stringify(btns));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
