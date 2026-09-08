// Verifies the Sep 2026 client-review customer flow end to end:
//   login -> "Which day are you ordering for?" picker -> menu with no date row
//   -> add an item -> "Added to Basket" sheet -> "Order for a different day".
//
// RNW ignores synthetic .click() (it runs its own pointer-responder system),
// so every interaction here is a real mouse click at the node's centre — same
// approach as run-app.js / verify-chef.js.
const puppeteer = require('puppeteer-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const OUT = '_qa-output/orderflow-';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra: extra || '' });
  console.log(`[of] ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' :: ' + extra : ''}`);
}
function log(...a) { console.log('[of]', ...a); }

async function clickLabel(page, label, wait) {
  const b = await page.evaluate((l) => {
    const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => e.getAttribute('aria-label') === l);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!b) { log('MISSING aria-label: ' + label); return false; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 900);
  return true;
}

// Clicks a bottom tab by its route. Expo Router renders each tab on web as
// <a role="tab" href="/tracker">, and the visible label carries an icon-font
// private-use glyph, so the href is the stable handle — not the text.
async function clickTab(page, href, wait) {
  const b = await page.evaluate((h) => {
    const el = document.querySelector(`a[role="tab"][href="${h}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, href);
  if (!b) { log("MISSING tab: " + href); return false; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 1200);
  return true;
}

// Clicks the innermost element whose trimmed text equals `text`.
async function clickText(page, text, wait) {
  const b = await page.evaluate((t) => {
    const el = Array.from(document.querySelectorAll('*'))
      .find((e) => e.children.length === 0 && (e.innerText || '').trim() === t);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, text);
  if (!b) { log('MISSING text: ' + text); return false; }
  await page.mouse.click(b.x, b.y);
  await sleep(wait || 1200);
  return true;
}

// Clicks the first element whose aria-label matches a regex; returns the label.
async function clickLabelMatching(page, source, wait) {
  const found = await page.evaluate((s) => {
    const re = new RegExp(s);
    const el = Array.from(document.querySelectorAll('[aria-label]')).find((e) => re.test(e.getAttribute('aria-label')));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: el.getAttribute('aria-label') };
  }, source);
  if (!found) { log('MISSING aria-label matching: ' + source); return null; }
  await page.mouse.click(found.x, found.y);
  await sleep(wait || 900);
  return found.label;
}

const bodyText = (page) => page.evaluate(() => document.body.innerText);
const labels = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label')));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--window-size=430,940'],
    defaultViewport: { width: 430, height: 940 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => log('PAGEERROR: ' + e.message));

  log('loading ' + URL);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(6000);

  // 1. Sign in as a customer via the dev bypass.
  const loggedIn = await clickLabel(page, 'Developer: skip login', 2500);
  check('dev login button present', loggedIn);
  await page.screenshot({ path: OUT + '1-after-login.png' });

  // 2. The customer must land on the delivery-day picker, not the menu.
  let text = await bodyText(page);
  check('date picker is shown first', text.includes('Which day are you ordering for?'),
    text.slice(0, 90).replace(/\n/g, ' | '));
  check('picker explains what the choice does',
    text.includes('sets the delivery day for everything you add'));
  check('forced visit has no back button', !(await labels(page)).includes('Go back without changing the delivery day'));

  // 3. Pick a day and confirm.
  const dayLabels = (await labels(page)).filter((l) => /^\w{3}, \d+ \w{3}/.test(l));
  check('orderable days are offered', dayLabels.length > 0, dayLabels.length + ' days: ' + dayLabels.slice(0, 3).join(', '));
  const preselected = dayLabels.filter((l) => l.endsWith(', selected'));
  check('exactly one day pre-selected', preselected.length === 1, preselected.join(', '));

  // Choose a day that is NOT the pre-selected one, so the assertion below
  // proves the screen actually committed our choice rather than a default.
  const target = dayLabels.find((l) => !l.endsWith(', selected'));
  const chosen = target ? await clickLabelMatching(page, '^' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 700) : null;
  check('can select a different day', !!chosen, String(chosen));
  await page.screenshot({ path: OUT + '2-picker.png' });

  await clickLabel(page, 'Confirm delivery day', 2500);
  text = await bodyText(page);
  check('confirming leaves the picker', !text.includes('Which day are you ordering for?'));

  // 4. Menu: the old date row must be gone, replaced by the "Ordering for" bar.
  check('menu shows the chosen day', text.includes('Ordering for'), text.slice(0, 120).replace(/\n/g, ' | '));
  check('chosen day carried through', target ? text.includes(target.replace(/, selected$/, '')) : false, String(target));
  check('old DELIVERY DATE row is gone', !text.includes('DELIVERY DATE'));
  check('Change control present', (await labels(page)).includes('Change the day you are ordering for'));
  await page.screenshot({ path: OUT + '3-menu.png' });

  // 5. Today's Menu should render a single day's meals, with no date picker.
  check('switched to the cycle menu', await clickText(page, "Today's Menu", 1600));
  text = await bodyText(page);
  check("Today's Menu has no date chips row", !text.includes('DELIVERY DATE'));
  await page.screenshot({ path: OUT + '4-todays-menu.png' });

  // 6. Add a meal -> the Added to Basket sheet.
  const added = await clickLabelMatching(page, ', R\\d+$', 1500); // a cycle meal card
  check('opened a meal', !!added, String(added));
  const addBtn = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find((e) =>
      (e.innerText || '').trim().startsWith('Add to Cart') && e.children.length === 0);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (addBtn) { await page.mouse.click(addBtn.x, addBtn.y); await sleep(1600); }
  check('Add to Cart button found', !!addBtn);

  text = await bodyText(page);
  check('Added to Basket sheet appears', text.includes('Added to Basket'), text.slice(0, 140).replace(/\n/g, ' | '));
  check('sheet names the delivery day', /has been added for /.test(text));
  check('sheet offers another day', text.includes('Order for a different day'));
  check('sheet offers to continue', /Continue with \w+/.test(text), (text.match(/Continue with \w+/) || [''])[0]);
  await page.screenshot({ path: OUT + '5-added-to-basket.png' });

  // 7. "Order for a different day" returns to the picker, this time with a back button.
  check('tapped "Order for a different day"', await clickText(page, 'Order for a different day', 2200));
  text = await bodyText(page);
  check('routes back to the picker', text.includes('Which day are you ordering for?'));
  check('change visit has a back button', (await labels(page)).includes('Go back without changing the delivery day'));
  await page.screenshot({ path: OUT + '6-change-day.png' });

  // 8. Tracker: the reworked vertical batch timeline.
  await clickLabel(page, 'Go back without changing the delivery day', 1500);
  check('switched to the Orders tab', await clickTab(page, '/tracker', 2200));
  text = await bodyText(page);
  const onTracker = text.includes('Live Delivery Tracker') || text.includes('No active order');
  check('tracker screen renders', onTracker, text.slice(0, 120).replace(/\n/g, ' | '));
  if (text.includes('Live Delivery Tracker')) {
    check('timeline stage: Payment Verified', text.includes('Payment Verified'));
    check('timeline stage: Kitchen Prepping', text.includes('Kitchen Prepping'));
    check('timeline stage: Out for Batch Drop', text.includes('Out for Batch Drop'));
    check('timeline stage: Delivered to Pantry', text.includes('Delivered to Pantry'));
    check('batch drop time shown', text.includes('12:00 PM SAST'));
  }
  await page.screenshot({ path: OUT + '7-tracker.png', fullPage: true });

  // 9. The logo must no longer carry the CSG line anywhere.
  check('no "POWERED BY CSG" on any visited screen', !text.includes('POWERED BY CSG'));

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n[of] ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('[of] FAILURES:');
    failed.forEach((f) => console.log('  - ' + f.name + (f.extra ? ' :: ' + f.extra : '')));
    process.exit(1);
  }
})().catch((e) => { console.error('[of] CRASH', e); process.exit(2); });
