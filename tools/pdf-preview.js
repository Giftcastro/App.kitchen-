// Renders the showcase under print media at A4 proportions, so the PDF output
// can be eyeballed without a PDF rasteriser installed.
const puppeteer = require('puppeteer-core');
const { pathToFileURL } = require('url');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SRC = process.argv[2];

(async () => {
  const b = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 703, height: 995, deviceScaleFactor: 1.5 });
  await p.goto(pathToFileURL(SRC).href, { waitUntil: 'networkidle0', timeout: 240000 });
  await p.evaluate(() => document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; }));
  await p.emulateMediaType('print');
  await p.addStyleTag({ content: `@media print{
    body{background:#0C0D0B !important;color:#F2F3EE !important}
    .frame{box-shadow:none !important;border-color:#2E312A !important}
    .sintent,figcaption .note{color:#9A9E92 !important}
    .slabel,figcaption .n{color:#C4D29B !important}
    .facts dt,footer{color:#6E7268 !important}
    .wrap{padding-left:0;padding-right:0}}` });
  await p.evaluateHandle('document.fonts.ready');
  await new Promise((r) => setTimeout(r, 1500));

  await p.screenshot({ path: 'pdf-p1.png' });
  await p.evaluate(() => window.scrollTo(0, 1000));
  await new Promise((r) => setTimeout(r, 800));
  await p.screenshot({ path: 'pdf-p2.png' });

  await b.close();
  console.log('ok');
})().catch((e) => { console.error(e.message); process.exit(1); });
