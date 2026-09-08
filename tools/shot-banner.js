// Screenshots the customer Menu's delivery banner at several phone widths, to
// see how the DeliveryEstimator copy behaves when the column gets narrow.
// Usage: node shot-banner.js [tag]   (tag is used in the output filenames)
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
  if (!b) { console.log('MISSING: ' + label); return null; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 900);
  return b;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 860 });
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
    await sleep(6000);
    await clickLabel(page, 'Developer: skip login', 7000);

    // Find the banner by its bicycle-icon row and shoot just that region.
    const box = await page.evaluate(() => {
      const hit = Array.from(document.querySelectorAll('div')).find((e) => {
        const t = (e.textContent || '');
        return /order (now|by)|Kitchen opens|cutoff/.test(t) && t.length < 200 && e.getBoundingClientRect().height > 20 && e.getBoundingClientRect().height < 120;
      });
      if (!hit) return null;
      const r = hit.getBoundingClientRect();
      return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: Math.min(r.width + 12, window.innerWidth), height: r.height + 12, text: hit.textContent };
    });
    if (!box) { console.log(width + 'px: banner not found'); await page.close(); continue; }
    console.log(width + 'px -> h=' + Math.round(box.height) + ' :: ' + JSON.stringify(box.text));
    await page.screenshot({ path: '_qa-output/banner-' + TAG + '-' + width + '.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error('ERR: ' + e.message); process.exit(1); });
