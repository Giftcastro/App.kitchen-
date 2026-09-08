// Verifies the Sep 2026 back-of-house changes in Kitchen Controls:
//   auto-rotating cycle menu, live dashboard tiles, bulk order status,
//   production-sheet scoping, menu item active/inactive, and notifications.
//
// Real mouse clicks throughout — RNW ignores synthetic .click().
const puppeteer = require('puppeteer-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const OUT = '_qa-output/boh-';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra: extra || '' });
  console.log(`[boh] ${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' :: ' + extra : ''}`);
}
function log(...a) { console.log('[boh]', ...a); }

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
  await sleep(wait || 1000);
  return true;
}

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
  await sleep(wait || 1000);
  return true;
}

async function typeIntoPlaceholder(page, placeholder, value) {
  return page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input, textarea')).find((i) => i.placeholder === ph);
    if (!input) return false;
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, placeholder, value);
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

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(6000);

  // Sign in as the admin (admin@gmail.com is the admin account; any password).
  check('email field found', await typeIntoPlaceholder(page, 'Email Address (e.g., alex@example.com)', 'admin@gmail.com'));
  check('password field found', await typeIntoPlaceholder(page, 'Password (e.g., ••••••••)', 'password123'));
  await sleep(600);
  // The button relabels itself once it recognises the admin email.
  check('admin sign-in button appears', await clickLabel(page, 'Sign in as Admin', 3500));

  let text = await bodyText(page);
  check('admin lands in Kitchen Controls', /Kitchen Dashboard|Kitchen Operations|Dashboard/.test(text),
    text.slice(0, 100).replace(/\n/g, ' | '));
  await page.screenshot({ path: OUT + '1-dashboard.png' });

  // Item 8 — the live tiles the client asked for.
  check('tile: Today\u2019s Deliveries Revenue', text.includes("Today's Deliveries Revenue"));
  check('tile: Active Orders', text.includes('Active Orders'));
  check('tile: Client Companies', text.includes('Client Companies'));
  check('tile: Registered Customers', text.includes('Registered Customers'));

  // Item 10 — cycle menu rotates on its own.
  await clickText(page, 'Weeks', 1500);
  text = await bodyText(page);
  check('Menu Cycles says it auto-rotates', text.includes('Rotates automatically every Monday'),
    text.slice(0, 100).replace(/\n/g, ' | '));
  check('a week is reported live', /Week \d is live/.test(text), (text.match(/Week \d is live/) || [''])[0]);
  check('auto state explains itself', text.includes('advances to the next week on its own'));
  // Re-aligning must switch it to the manual wording and offer a way back.
  await clickLabel(page, 'Week 4', 1200);
  text = await bodyText(page);
  check('re-aligning reports the shift', text.includes('Re-aligned by'), (text.match(/Re-aligned by \d+ weeks?/) || [''])[0]);
  check('offers a way back to automatic', (await labels(page)).includes('Put the menu cycle back on automatic rotation'));
  await page.screenshot({ path: OUT + '2-cycles.png' });
  await clickLabel(page, 'Put the menu cycle back on automatic rotation', 1200);
  text = await bodyText(page);
  check('back to automatic clears the shift', !text.includes('Re-aligned by'));

  // Item 9 — menu items can be switched off without deleting.
  await clickText(page, 'Meals', 1800);
  const itemToggles = (await labels(page)).filter((l) => / available to order$/.test(l));
  check('menu items have an availability switch', itemToggles.length > 0, itemToggles.length + ' switches');
  text = await bodyText(page);
  check('category counts what is live', /\d+ live/.test(text), (text.match(/\d+ live/) || [''])[0]);
  if (itemToggles.length > 0) {
    await clickLabel(page, itemToggles[0], 1200);
    text = await bodyText(page);
    check('switching one off marks it OFF MENU', text.includes('OFF MENU'));
    check('and it is counted as off', /\d+ off/.test(text), (text.match(/\d+ off/) || [''])[0]);
    await page.screenshot({ path: OUT + '3-meals.png' });
    await clickLabel(page, itemToggles[0], 1200); // restore
  }

  // Item 7 — bulk status control and production-sheet scoping.
  await clickText(page, 'Chef', 2000);
  text = await bodyText(page);
  check('queue offers Select all', (await labels(page)).includes('Select all orders'), '');
  check('production sheet can be scoped to all orders',
    (await labels(page)).includes('Show all clients in the production sheet'));
  const scopeLabels = (await labels(page)).filter((l) => /^Show only .* in the production sheet$/.test(l));
  check('production sheet can be scoped per company', scopeLabels.length > 0,
    scopeLabels.length + ': ' + scopeLabels.slice(0, 2).join(', '));

  await clickLabel(page, 'Select all orders', 1400);
  text = await bodyText(page);
  // The caption is CSS-uppercased and innerText returns it transformed
  // ("5 SELECTED · MOVE ALL TO"), so this has to match case-insensitively.
  const bulkSnippet = (text.match(/[^\n]*selected[^\n]*/i) || [''])[0];
  check('selecting all reveals the bulk bar',
    /\d/.test(bulkSnippet) && /move all to/i.test(text),
    JSON.stringify(bulkSnippet));
  const bulkLabels = (await labels(page)).filter((l) => /^Move \d+ selected orders to /.test(l));
  check('bulk bar offers every status', bulkLabels.length === 4, bulkLabels.length + ' actions');
  await page.screenshot({ path: OUT + '4-chef-bulk.png' });

  if (bulkLabels.length > 0) {
    const target = bulkLabels.find((l) => l.endsWith('Preparing')) || bulkLabels[0];
    await clickLabel(page, target, 1800);
    text = await bodyText(page);
    check('applying a bulk change clears the selection', !/move all to/i.test(text));
  }

  // Item 12 — notifications.
  await clickText(page, 'Notify', 1800);
  text = await bodyText(page);
  check('notifications composer opens', text.includes('Send a message to your customers'),
    text.slice(0, 100).replace(/\n/g, ' | '));
  check('can address all customers', (await labels(page)).includes('Send to all customers'));
  const perCompany = (await labels(page)).filter((l) => /^Send only to /.test(l));
  check('can address one company', perCompany.length > 0, perCompany.slice(0, 3).join(', '));

  await typeIntoPlaceholder(page, 'e.g. Friday menu update', 'Friday menu update');
  await typeIntoPlaceholder(page, 'What do your customers need to know?', 'The salad bar is unavailable this Friday.');
  await sleep(400);
  check('sent the notification', await clickLabel(page, 'Send notification', 1800));
  text = await bodyText(page);
  check('send is confirmed', text.includes('Sent — customers will see it on their menu.'));
  check('it is listed under Sent', text.includes('Friday menu update'));
  await page.screenshot({ path: OUT + '5-notify.png' });

  // The announcement must NOT appear to the admin who sent it.
  //
  // Asserted on the banner's own dismiss control rather than page text: React
  // Navigation keeps every tab screen mounted, so the admin's Notify tab (with
  // its 'Sent' list) is still in the DOM behind the customer preview and would
  // make a body-text search for the title pass regardless.
  await clickText(page, 'Preview App', 2500);
  const bannerLabels = (await labels(page)).filter((l) => /^Dismiss notification: /.test(l));
  check('admin preview does not show the admin their own banner',
    bannerLabels.length === 0, bannerLabels.join(', '));
  await page.screenshot({ path: OUT + '6-preview.png' });

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n[boh] ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('[boh] FAILURES:');
    failed.forEach((f) => console.log('  - ' + f.name + (f.extra ? ' :: ' + f.extra : '')));
    process.exit(1);
  }
})().catch((e) => { console.error('[boh] CRASH', e); process.exit(2); });
