// Verifies the Chef tab additions: collapsible client sections, prep
// check-off, special-request badges, due-date badges in the queue, and the
// per-day scoping of the chef's working state.
// Same launch/sign-in recipe as shot-tabs.js, but signs in as the admin
// account (admin@gmail.com + any non-empty password) since the Chef view
// lives inside Kitchen Controls.
const puppeteer = require('puppeteer-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[chef]', ...a); }

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

// RNW ignores synthetic .click() (pointer-responder system), so scroll the
// node into view and dispatch a real mouse click at its centre.
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
  if (!b) { log('no element for aria-label: ' + label); return null; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 900);
  return b;
}

const ariaAll = (page, src) => page.evaluate((s) => {
  const re = new RegExp(s);
  return Array.from(document.querySelectorAll('[aria-label]'))
    .map((e) => ({ label: e.getAttribute('aria-label'), checked: e.getAttribute('aria-checked'), expanded: e.getAttribute('aria-expanded') }))
    .filter((e) => re.test(e.label));
}, src);

const ariaOne = (page, label) => page.evaluate((l) => {
  const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
  return el ? { label: el.getAttribute('aria-label'), checked: el.getAttribute('aria-checked'), expanded: el.getAttribute('aria-expanded') } : null;
}, label);

// textContent, not innerText: react-native-web clips scroll content in a way
// that leaves large parts of the page out of innerText even though they render
// (Grand Total and Order Queue both went missing that way). Ionicons
// private-use glyphs are stripped so text comparisons stay clean.
const bodyText = (page) => page.evaluate(() => document.body.textContent.replace(/[-]/g, ''));

const HDR = 'items, \\d+ of \\d+ prepped';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => { log('PAGEERROR: ' + e.message); fails.push('pageerror: ' + e.message); });
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE-ERR: ' + m.text().slice(0, 200)); });

  await page.setViewport({ width: 430, height: 1200 });
  log('loading ' + URL);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(6000);

  await typeIntoPlaceholder(page, 'Email Address (e.g., alex@example.com)', 'admin@gmail.com');
  await typeIntoPlaceholder(page, 'Password (e.g., ••••••••)', 'kitchen123');
  await sleep(300);
  // The CTA relabels itself once the admin email is recognised (login.tsx:608).
  await clickLabel(page, 'Sign in as Admin', 7000);
  const afterLogin = await bodyText(page);
  check('signed in as admin', afterLogin.indexOf('Chef') !== -1, JSON.stringify(afterLogin.slice(0, 60)));

  await clickLabel(page, 'Chef tab', 2500);
  let txt = await bodyText(page);
  check('Production Sheet renders', txt.indexOf('Production Sheet') !== -1);
  check('Grand Total renders', txt.indexOf('Grand Total') !== -1);
  check('Order Queue renders', txt.indexOf('Order Queue') !== -1);
  await page.screenshot({ path: '_qa-output/chef-1-default.png', fullPage: true });

  const headers = await ariaAll(page, HDR);
  check('client sections expose collapse state', headers.length > 0,
    JSON.stringify(headers.map((h) => h.label + ' [expanded=' + h.expanded + ']')));
  const collapsedCount = headers.filter((h) => h.expanded === 'false').length;
  check('with more than 2 clients the sections start collapsed',
    headers.length > 2 ? collapsedCount === headers.length : true, collapsedCount + '/' + headers.length + ' collapsed');
  check('collapsed sections hide Prep Totals', headers.length > 2 ? txt.indexOf('Prep Totals') === -1 : true);

  const firstLabel = headers[0] && headers[0].label;
  log('expanding: ' + firstLabel);
  if (firstLabel) await clickLabel(page, firstLabel, 1200);
  txt = await bodyText(page);
  check('expanding a client reveals Prep Totals', txt.indexOf('Prep Totals') !== -1);
  check('expanding a client reveals Special Requests', txt.indexOf('Special Requests') !== -1);

  const prepBoxes = (await ariaAll(page, '^\\d+ ')).filter((b) => b.checked !== null);
  check('prep rows render as checkboxes', prepBoxes.length > 0, JSON.stringify(prepBoxes.slice(0, 4)));
  const target = prepBoxes[0];
  if (target) {
    await clickLabel(page, target.label, 1000);
    const after = await ariaOne(page, target.label);
    check('tapping a prep row ticks it', !!after && after.checked === 'true', JSON.stringify(after));
    const hdrAfter = (await ariaAll(page, HDR))[0];
    check('progress counter advances to 1 of N',
      /, 1 of \d+ prepped/.test(hdrAfter ? hdrAfter.label : ''), hdrAfter && hdrAfter.label);
  }
  await page.screenshot({ path: '_qa-output/chef-2-expanded-ticked.png', fullPage: true });

  txt = await bodyText(page);
  check('queue shows a DUE TODAY badge', txt.indexOf('DUE TODAY') !== -1);
  const dueOther = txt.match(/(OVERDUE|DUE) \d{1,2} [A-Z]{3}/g);
  check('queue labels non-today entries with their due date', !!dueOther, JSON.stringify(dueOther));

  await clickLabel(page, 'Next day', 1200);
  const nextTicked = (await ariaAll(page, '^\\d+ ')).filter((b) => b.checked === 'true');
  const nextHdrs = await ariaAll(page, HDR);
  check('ticks do not carry to the next production day',
    nextTicked.length === 0 && nextHdrs.every((h) => /, 0 of \d+ prepped/.test(h.label)),
    JSON.stringify(nextHdrs.map((h) => h.label)));
  await page.screenshot({ path: '_qa-output/chef-3-next-day.png', fullPage: true });

  await clickLabel(page, 'Previous day', 1200);
  const backHdr = (await ariaAll(page, HDR))[0];
  check('stepping back restores the ticks for that day',
    /, 1 of \d+ prepped/.test(backHdr ? backHdr.label : ''), backHdr && backHdr.label);

  log(fails.length ? 'FAILURES (' + fails.length + '): ' + JSON.stringify(fails) : 'ALL CHECKS PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('[chef] ERR: ' + e.message); process.exit(1); });
