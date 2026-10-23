// Renders invoice-draft.html (the client-facing invoice template draft) to an
// A4 PDF with a running footer. Usage: node build-invoice-draft.js <out.pdf>
const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SRC = path.join(__dirname, 'invoice-draft.html');
const OUT = process.argv[2] || path.join(__dirname, 'YKC_Invoice_DRAFT.pdf');

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="font-family:Arial;font-size:7pt;color:#777;width:100%;padding:0 16mm;display:flex;justify-content:space-between">' +
      '<span>Your KitchenCO (Pty) Ltd · Invoice INV-20261011-00200</span>' +
      '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
  });
  await browser.close();
  console.log('wrote', OUT);
})();
