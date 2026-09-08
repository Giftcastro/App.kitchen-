// Renders the showcase page to a client-sendable PDF, keeping the dark design
// (the page's own @media print block flips to light — overridden here).
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

  // Keep the dark identity in print
  await page.addStyleTag({ content: `
    @media print{
      body{background:#0C0D0B !important;color:#F2F3EE !important}
      .frame{box-shadow:none !important;border-color:#2E312A !important}
      .sintent, figcaption .note{color:#9A9E92 !important}
      .slabel, figcaption .n{color:#C4D29B !important}
      .facts dt, footer{color:#6E7268 !important}
      header, .shead, .facts, footer{border-color:#272A22 !important}
      .facts div{border-color:#272A22 !important}
      /* full-bleed: the dark ground runs to the paper edge, so the gutter is
         page padding rather than a white @page margin */
      .wrap{padding-left:13mm !important;padding-right:13mm !important;
            padding-bottom:16mm !important;max-width:none !important}
      header{padding-top:16mm !important}
    }
    @page{margin:0}
  ` });

  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();
  console.log('[pdf] wrote', OUT, (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB');
})().catch((e) => { console.error('[pdf] ERR:', e.stack); process.exit(1); });
