// Verifies the Today's Menu grid after replacing its nested FlatLists with
// plain View rows: no nested scroll container survives inside the tab, the
// 2-column layout is intact, and selecting more delivery days grows the
// scrollable content as it should.
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[scroll]', ...a); }
const fails = [];
function check(name, cond, detail) {
  log((cond ? 'PASS' : 'FAIL') + ' -- ' + name + (detail ? ' :: ' + detail : ''));
  if (!cond) fails.push(name);
}

async function clickLabel(page, label, wait) {
  const b = await page.evaluate((l) => {
    const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!b) { log('MISSING: ' + label); return null; }
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
  if (!b) { log('MISSING text: ' + text); return null; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 1500);
  return b;
}

// Every scroll container inside the tab body, biggest first.
const scrollBoxes = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('div'))
    .filter((e) => {
      const s = getComputedStyle(e);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.getBoundingClientRect().height > 150;
    })
    .map((e) => ({ scrollH: e.scrollHeight, clientH: e.clientHeight, h: Math.round(e.getBoundingClientRect().height) })));

// Card x-positions per row tell us the 2-column grid still lines up.
// Meal cards carry accessibilityLabel `<name>, R80` (renderCycleCard).
const cardCols = (page) => page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('[aria-label]'))
    .filter((e) => /, R\d+$/.test(e.getAttribute('aria-label') || '') && e.getBoundingClientRect().width > 120);
  const xs = cards.map((c) => Math.round(c.getBoundingClientRect().x));
  const ws = cards.map((c) => Math.round(c.getBoundingClientRect().width));
  return { count: cards.length, distinctX: Array.from(new Set(xs)).sort((a, b) => a - b), widths: Array.from(new Set(ws)) };
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => { log('PAGEERROR: ' + e.message); fails.push('pageerror'); });
  page.on('console', (m) => {
    if (/VirtualizedList/i.test(m.text())) { log('RN WARNING: ' + m.text().slice(0, 160)); fails.push('VirtualizedList warning'); }
  });

  await page.setViewport({ width: 390, height: 780 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(6000);
  await clickLabel(page, 'Developer: skip login', 7000);
  // The delivery-day picker is a forced stop before the menu renders; it was
  // added after this script was written, and without confirming it the run
  // never reaches the menu at all (every later check then "passes" vacuously).
  await clickLabel(page, 'Confirm delivery day', 3500);

  // Main Menu is the default view and had the same nested-FlatList pattern
  // Today's Menu was fixed for, so assert it here too.
  const mainBoxes = await scrollBoxes(page);
  const mainScrollables = mainBoxes.filter((b) => b.scrollH > b.clientH + 4);
  check('Main Menu: exactly one scroll container drives the tab', mainScrollables.length === 1, JSON.stringify(mainBoxes));

  await clickText(page, "Today's Menu", 3000);

  const boxes = await scrollBoxes(page);
  const scrollables = boxes.filter((b) => b.scrollH > b.clientH + 4);
  check('exactly one scroll container drives the tab', scrollables.length === 1, JSON.stringify(boxes));

  // Single full-width column, not two: commit 72ba039 "Give Today's Menu the
  // same full-width item rows as Standard Classics" deliberately dropped the
  // 2-up grid. The check that matters is still that every card shares one
  // left edge — a broken row wrap shows up as extra distinct x values.
  const grid = await cardCols(page);
  check('cards render in one aligned full-width column', grid.distinctX.length === 1 && grid.count > 0,
    grid.count + ' cards at x=' + JSON.stringify(grid.distinctX));

  const before = scrollables[0];
  log('single day: scrollH=' + before.scrollH + ' clientH=' + before.clientH);

  // Add a second delivery day — content should grow, still one scroller.
  const chips = await page.evaluate(() => Array.from(document.querySelectorAll('[role="checkbox"]'))
    .map((e) => e.getAttribute('aria-label')).filter(Boolean));
  log('date chips: ' + JSON.stringify(chips.slice(0, 6)));
  const second = chips[1];
  if (second) {
    await clickLabel(page, second, 2000);
    const after = (await scrollBoxes(page)).filter((b) => b.scrollH > b.clientH + 4);
    check('still exactly one scroll container after adding a day', after.length === 1, JSON.stringify(after));
    check('content grows when a second day is added', after[0] && after[0].scrollH > before.scrollH,
      before.scrollH + ' -> ' + (after[0] && after[0].scrollH));
    const grid2 = await cardCols(page);
    check('grid stays 2 columns with more days', grid2.distinctX.length === 2, grid2.count + ' cards at x=' + JSON.stringify(grid2.distinctX));
  }

  // And it actually scrolls all the way.
  await page.mouse.move(195, 500);
  for (let i = 0; i < 14; i++) { await page.mouse.wheel({ deltaY: 400 }); await sleep(90); }
  await sleep(800);
  const end = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).filter((e) => e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 300)
      .sort((a, b) => b.clientHeight - a.clientHeight)[0];
    return el ? { top: Math.round(el.scrollTop), max: Math.round(el.scrollHeight - el.clientHeight) } : null;
  });
  check('scrolls to the bottom of the content', end && end.top >= end.max - 2, JSON.stringify(end));
  await page.screenshot({ path: '_qa-output/todaymenu-multiday.png' });

  log(fails.length ? 'FAILURES: ' + JSON.stringify(fails) : 'ALL CHECKS PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('[scroll] ERR: ' + e.message); process.exit(1); });
