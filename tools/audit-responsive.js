// Responsive/UX audit: walks the app at several phone+tablet widths and
// reports measured layout defects (horizontal overflow, clipped text,
// under-sized touch targets) rather than relying on eyeballed screenshots.
//
// Elements inside a horizontal ScrollView are expected to sit past the right
// edge, so they are excluded from the overflow check -- only content that
// overflows a NON-scrolling ancestor is a real defect.
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[audit]', ...a);
const WIDTHS = [320, 360, 390, 430, 768];

async function clickLabel(page, label, wait) {
  const b = await page.evaluate((l) => {
    const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!b) { log('MISSING label: ' + label); return null; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 1200);
  return b;
}

const probe = (page) => page.evaluate(() => {
  const vw = window.innerWidth;
  const out = { pageOverflow: document.documentElement.scrollWidth > vw + 1, wide: [], clipped: [], tiny: [], squashed: [] };
  const txt = (el) => {
    const a = el.getAttribute('aria-label');
    const t = (el.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim().slice(0, 45);
    return a ? '[' + a + ']' : t;
  };
  const inHScroller = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  // Inactive tab screens stay mounted behind the active one, so measure only
  // what is actually on screen -- otherwise every tab reports the same defects.
  // react-navigation parks inactive tab screens at position:absolute with
  // z-index:-1 -- they stay 'visible' to CSS, so they must be excluded by hand
  // or every tab reports the previous tab's defects.
  const visible = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.position === 'absolute' && cs.zIndex === '-1') return false;
    }
    return true;
  };
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!visible(el)) continue;
    if (r.bottom < 0 || r.top > window.innerHeight * 4) continue;
    if (r.right > vw + 1 && !inHScroller(el) && r.width <= vw * 3) {
      out.wide.push({ right: Math.round(r.right), w: Math.round(r.width), text: txt(el) });
    }
    if (el.childElementCount === 0 && (el.textContent || '').trim()) {
      const cs = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') {
        out.clipped.push({ text: txt(el), scrollW: el.scrollWidth, clientW: el.clientWidth });
      }
      // text box shorter than one line of its own type -> descenders clipped
      const lh = parseFloat(cs.lineHeight) || 0;
      if (lh > 0 && r.height + 0.5 < lh && cs.overflow === 'hidden') out.squashed.push({ text: txt(el), h: Math.round(r.height), lineHeight: lh });
    }
    if (el.getAttribute('role') === 'button' || el.tagName === 'BUTTON') {
      if (r.height > 2 && (r.height < 44 || r.width < 44)) out.tiny.push({ text: txt(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  const dedupe = (a, k) => { const s = new Set(); return a.filter((o) => { const v = k(o); if (s.has(v)) return false; s.add(v); return true; }); };
  out.wide = dedupe(out.wide, (o) => o.text + o.right).slice(0, 10);
  out.clipped = dedupe(out.clipped, (o) => o.text).slice(0, 10);
  out.tiny = dedupe(out.tiny, (o) => o.text).slice(0, 10);
  out.squashed = dedupe(out.squashed, (o) => o.text).slice(0, 10);
  out.activeTab = (document.querySelector('[role="tab"][aria-selected="true"]') || {}).textContent || "?";
  out.activeTab = out.activeTab.replace(/[-]/g, "").trim();
  return out;
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 390, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(7000);
  await clickLabel(page, 'Developer: skip login', 4000);
  await clickLabel(page, 'Confirm delivery day', 3500);

  // Real tab buttons carry role="tab"; matching on the word "tab" in a label
  // catches dish names like "Roasted VegeTABle" instead.
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]'))
    .map((e) => e.getAttribute('aria-label') || (e.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim()).filter(Boolean));
  log('tabs found: ' + JSON.stringify(tabs));

  const report = [];
  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 900 });
    await sleep(1200);
    for (const t of tabs) {
      const hit = await page.evaluate((label) => {
        const el = Array.from(document.querySelectorAll('[role="tab"]')).find((e) =>
          (e.getAttribute('aria-label') || (e.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim()) === label);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, t);
      if (!hit) { log(w + 'px ' + t + ' -> TAB NOT FOUND'); continue; }
      await page.mouse.click(hit.x, hit.y);
      await sleep(1600);
      const r = await probe(page);
      const lines = [];
      if (r.pageOverflow) lines.push('PAGE SCROLLS HORIZONTALLY');
      if (r.wide.length) lines.push('OFF-SCREEN: ' + JSON.stringify(r.wide));
      if (r.clipped.length) lines.push('CLIPPED TEXT: ' + JSON.stringify(r.clipped));
      if (r.squashed.length) lines.push('SQUASHED TEXT: ' + JSON.stringify(r.squashed));
      if (r.tiny.length) lines.push('TARGETS <44px: ' + JSON.stringify(r.tiny));
      const entry = w + 'px  ' + t + ' (active: ' + r.activeTab + ')' + (lines.length ? '\n    ' + lines.join('\n    ') : '  -> ok');
      report.push(entry);
      log(entry);
    }
  }
  require('fs').writeFileSync('_qa-output/audit-responsive.txt', report.join('\n') + '\n');
  log(errors.length ? 'PAGE ERRORS: ' + JSON.stringify(errors.slice(0, 5)) : 'no page errors');
  await browser.close();
})().catch((e) => { console.error('[audit] ERR: ' + e.message); process.exit(1); });
