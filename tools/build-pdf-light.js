// Renders a light-themed HTML doc (build-prototype-doc.js's output) to a
// client-sendable PDF. Unlike build-pdf.js this does NOT force a dark palette
// in print — the page is already light, so default print behaviour is correct
// and printBackground:true is enough to keep the phone-frame black bezels.
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SRC = process.argv[2];
const OUT = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1400 });

  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 240000 });

  // data: URIs decode instantly, but lazy loading can still defer them off-screen
  await page.evaluate(() => {
    document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; });
  });
  await page.evaluate(() => Promise.all(
    Array.from(document.images).filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))
  ));
  await page.evaluateHandle('document.fonts.ready');
  await sleep(1500);

  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: false,
    margin: { top: '14mm', right: '13mm', bottom: '14mm', left: '13mm' },
  });

  await browser.close();
  console.log('[pdf] wrote', OUT, (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB');
})().catch((e) => { console.error('[pdf] ERR:', e.stack); process.exit(1); });
