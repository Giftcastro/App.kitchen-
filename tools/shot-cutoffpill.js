// Screenshots the CutoffCountdown pill on Today's Menu across phone widths,
// and reports whether its single line of text is being clipped.
// Usage: node shot-cutoffpill.js [tag]
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TAG = process.argv[2] || 'before';
const WIDTHS = [320, 360, 390, 430];

async function clickLabel(page, label, wait) {
  const b = await page.evaluate((l) => {
    const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!b) return null;
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 900);
  return b;
}
async function clickText(page, text, wait) {
  const b = await page.evaluate((t) => {
    const el = Array.from(document.querySelectorAll('div, span'))
      .find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === t);
    if (!el) return null;
    const r = (el.closest('[role="button"]') || el).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, text);
  if (!b) return null;
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 1500);
  return b;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 800 });
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
    await sleep(6000);
    await clickLabel(page, 'Developer: skip login', 7000);
    await clickText(page, "Today's Menu", 3000);

    // The pill is the element whose text starts with Closed/Order closes.
    const info = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div, span'))
        .filter((e) => /^(Closed (for )?today|Order closes in)/.test((e.textContent || '').trim()))
        .sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // scrollWidth > clientWidth means the single line is being ellipsised.
      return {
        text: el.textContent.trim(),
        clipped: el.scrollWidth > el.clientWidth + 1,
        scrollW: el.scrollWidth, clientW: el.clientWidth,
        box: { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 10), w: Math.min(r.width + 40, window.innerWidth), h: r.height + 20 },
      };
    });
    if (!info) { console.log(width + 'px: pill not found'); await page.close(); continue; }
    console.log(width + 'px  clipped=' + info.clipped + '  (' + info.scrollW + '/' + info.clientW + ')  ' + JSON.stringify(info.text));
    await page.screenshot({ path: '_qa-output/pill-' + TAG + '-' + width + '.png', clip: { x: info.box.x, y: info.box.y, width: info.box.w, height: info.box.h } });
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error('ERR: ' + e.message); process.exit(1); });
