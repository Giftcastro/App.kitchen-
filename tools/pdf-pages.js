// Rasterises every page of a PDF to PNG so the finished document can actually
// be looked at before it is sent. Chrome renders the HTML; nothing until now
// rendered the PDF, which is how a panel sliced across a page break shipped.
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

const SRC = process.argv[2];
const OUTDIR = process.argv[3] || path.join(__dirname, 'pages');
const SCALE = Number(process.argv[4] || 1.2);

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });
  for (const f of fs.readdirSync(OUTDIR)) fs.unlinkSync(path.join(OUTDIR, f));

  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(SRC)) }).promise;
  console.log('pages:', doc.numPages);

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: SCALE });
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const out = path.join(OUTDIR, 'p' + String(n).padStart(2, '0') + '.png');
    fs.writeFileSync(out, canvas.toBuffer('image/png'));
    console.log('wrote', out);
  }
})().catch((e) => { console.error(e.stack); process.exit(1); });
