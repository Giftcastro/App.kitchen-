// Verifies this round's admin work:
//   Dashboard - tappable stat cards, the Cancelled breakdown row, and the
//               revenue trend strip (tap-to-read column values).
//   Chef      - day-level prep summary, expand/collapse all, the unset
//               kitchen-email warning, and the queue -> production sheet jump.
// Signs in as admin (admin@gmail.com + any non-empty password).
const puppeteer = require('puppeteer-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[dash]', ...a); }

const fails = [];
function check(name, cond, detail) {
  log((cond ? 'PASS' : 'FAIL') + ' -- ' + name + (detail ? ' :: ' + detail : ''));
  if (!cond) fails.push(name);
}

async function typeIntoPlaceholder(page, placeholder, value) {
  await page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === ph);
    if (!input) throw new Error('input not found: ' + ph);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, placeholder, value);
}

// RNW ignores synthetic .click(); scroll into view and click the real centre.
async function clickLabel(page, label, wait) {
  await page.evaluate((l) => {
    const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
    if (el) el.scrollIntoView({ block: 'center' });
  }, label);
  await sleep(400);
  const b = await page.evaluate((l) => {
    const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!b) { log('MISSING aria-label: ' + label); return null; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 900);
  return b;
}

const ariaAll = (page, src) => page.evaluate((s) => {
  const re = new RegExp(s);
  return Array.from(document.querySelectorAll('[aria-label]'))
    .map((e) => ({ label: e.getAttribute('aria-label'), expanded: e.getAttribute('aria-expanded'), checked: e.getAttribute('aria-checked') }))
    .filter((e) => re.test(e.label));
}, src);

// textContent, not innerText: RNW clipping hides rendered text from innerText.
const bodyText = (page) => page.evaluate(() => document.body.textContent.replace(/[\uE000-\uF8FF]/g, ''));

// Which admin sub-tab pill is currently active (RNW drops accessibilityState,
// so read the pill's painted background instead of aria-selected).
const activeTab = (page) => page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('[aria-label]')).filter((e) => / tab$/.test(e.getAttribute('aria-label')));
  const bgs = pills.map((p) => ({ label: p.getAttribute('aria-label'), bg: getComputedStyle(p).backgroundColor }));
  const counts = {};
  bgs.forEach((b) => { counts[b.bg] = (counts[b.bg] || 0) + 1; });
  const odd = bgs.find((b) => counts[b.bg] === 1);
  return odd ? odd.label : null;
});

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => { log('PAGEERROR: ' + e.message); fails.push('pageerror: ' + e.message); });
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE-ERR: ' + m.text().slice(0, 160)); });

  await page.setViewport({ width: 430, height: 1200 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(6000);
  await typeIntoPlaceholder(page, 'name@company.com', 'admin@gmail.com');
  await typeIntoPlaceholder(page, 'Your password', 'kitchen123');
  await sleep(300);
  await clickLabel(page, 'Sign in as Admin', 7000);

  // ---------- Dashboard ----------
  let txt = await bodyText(page);
  check('Cancelled row added to Order Status Breakdown', txt.indexOf('Cancelled') !== -1);
  check('Revenue Trend card renders', txt.indexOf('Revenue Trend') !== -1);

  const cards = await ariaAll(page, '^(Total Users|Total Orders|In Progress|Revenue):');
  check('all four stat cards are buttons with values', cards.length === 4, JSON.stringify(cards.map((c) => c.label)));

  const bars = await ariaAll(page, '^[0-9]+ [A-Za-z]{3}( [0-9]{2})?: R[0-9]');
  check('revenue trend renders tappable columns', bars.length >= 2, bars.length + ' columns: ' + JSON.stringify(bars.slice(0, 3).map((b) => b.label)));
  const capBefore = (await bodyText(page)).match(/(Daily|Weekly|Monthly) . R[0-9]+ across [0-9]+ (days|weeks|months)/);
  check('trend caption summarises the period by default', !!capBefore, capBefore && capBefore[0]);
  if (bars[0]) {
    await clickLabel(page, bars[0].label, 900);
    const capAfter = await bodyText(page);
    const wanted = bars[0].label.replace(': ', ' · ');
    check('tapping a column shows that bucket value', capAfter.indexOf(wanted) !== -1, wanted);
  }
  await page.screenshot({ path: '_qa-output/v2-1-dashboard.png', fullPage: true });

  // Stat card navigation: In Progress should open the Chef tab.
  await clickLabel(page, cards.find((c) => /In Progress/.test(c.label)).label, 2000);
  check('In Progress card opens the Chef tab', (await activeTab(page)) === 'Chef tab', String(await activeTab(page)));

  // ---------- Chef ----------
  txt = await bodyText(page);
  check('day-level prep summary renders', /[0-9]+\/[0-9]+ prepped/.test(txt), (txt.match(/[0-9]+\/[0-9]+ prepped/) || [])[0]);
  check('kitchen-email warning shows when unset', txt.indexOf('No kitchen email set') !== -1);

  const before = await ariaAll(page, 'items, [0-9]+ of [0-9]+ prepped');
  check('client sections start collapsed', before.every((h) => h.expanded === 'false'), JSON.stringify(before.map((h) => h.expanded)));
  await clickLabel(page, 'Expand all clients', 1400);
  const afterExpand = await ariaAll(page, 'items, [0-9]+ of [0-9]+ prepped');
  check('Expand all opens every client', afterExpand.every((h) => h.expanded === 'true'), JSON.stringify(afterExpand.map((h) => h.expanded)));
  await page.screenshot({ path: '_qa-output/v2-2-chef-expanded.png', fullPage: true });

  await clickLabel(page, 'Collapse all clients', 1400);
  const afterCollapse = await ariaAll(page, 'items, [0-9]+ of [0-9]+ prepped');
  check('Collapse all closes every client', afterCollapse.every((h) => h.expanded === 'false'), JSON.stringify(afterCollapse.map((h) => h.expanded)));

  // Queue -> sheet jump: pick a batch card and confirm its client expands.
  const jumps = await ariaAll(page, '^Show .* in the production sheet$');
  check('queue cards link into the production sheet', jumps.length > 0, JSON.stringify(jumps.slice(0, 3).map((j) => j.label)));
  const ecogra = jumps.find((j) => /Show Ecogra /.test(j.label));
  if (ecogra) {
    await clickLabel(page, ecogra.label, 1800);
    const hdr = (await ariaAll(page, '^Ecogra, .* prepped'))[0];
    check('jumping expands that client in the sheet', hdr && hdr.expanded === 'true', hdr && hdr.label + ' expanded=' + hdr.expanded);
  }
  await page.screenshot({ path: '_qa-output/v2-3-chef-jump.png', fullPage: true });

  log(fails.length ? 'FAILURES (' + fails.length + '): ' + JSON.stringify(fails) : 'ALL CHECKS PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('[dash] ERR: ' + e.message); process.exit(1); });
