// Screenshots the reworked Orders page (ported from JoTsav/kicthenCoV1 main's
// OrderHistoryScreen) and exercises the new post-delivery actions: the star
// rating, the Tax Invoice sheet and the Report Issue sheet.
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8081';
const OUT = '_qa-output/orders-';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[orders]', ...a);
const fails = [];
const check = (name, ok, detail) => {
  log((ok ? 'PASS -- ' : 'FAIL -- ') + name + (detail ? ' :: ' + detail : ''));
  if (!ok) fails.push(name);
};

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

const bodyText = (page) => page.evaluate(() => document.body.textContent.replace(/[\uE000-\uF8FF]/g, ''));
const labels = (page, re) => page.evaluate((src) => {
  const r = new RegExp(src);
  return Array.from(document.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label')).filter((l) => r.test(l));
}, re);

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); log('PAGEERROR: ' + e.message); });
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(7000);
  await clickLabel(page, 'Developer: skip login', 4000);
  await clickLabel(page, 'Confirm delivery day', 3500);

  // Orders tab
  const hit = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[role="tab"]')).find((e) => (e.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim() === 'Orders');
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(hit.x, hit.y);
  await sleep(2500);

  const txt = await bodyText(page);
  check('his header bar renders', txt.includes('Orders & Invoices'), txt.slice(0, 60));
  check('no duplicate navigator header', !txt.includes('My Orders'), txt.includes('My Orders') ? 'both headers present' : '');
  check('cards expose a tax invoice action', (await labels(page, '^Tax invoice for order')).length > 0);
  check('reorder survived the port', (await labels(page, '^Reorder ')).length > 0);
  await page.screenshot({ path: OUT + 'page.png', fullPage: true });

  // Report Issue sheet
  const report = (await labels(page, '^Report an issue with order'))[0];
  check('delivered orders offer Report Issue', Boolean(report), report || 'none found');
  if (report) {
    await clickLabel(page, report, 1600);
    const sheet = await bodyText(page);
    check('report issue sheet opens', sheet.includes('Report Meal Issue / Non-Delivery'));
    await page.screenshot({ path: OUT + 'dispute.png' });
    await clickLabel(page, 'Cancel report', 1200);
  }

  // Tax invoice sheet
  const invoice = (await labels(page, '^Tax invoice for order'))[0];
  if (invoice) {
    await clickLabel(page, invoice, 1600);
    const sheet = await bodyText(page);
    check('tax invoice sheet opens', sheet.includes('Tax Invoice') && sheet.includes('SUPPLIER DETAILS'));
    check('invoice totals the order', /Total Paid \(ZAR\)/.test(sheet));
    await page.screenshot({ path: OUT + 'invoice.png' });
    await clickLabel(page, 'Close tax invoice', 1200);
  }

  // Star rating
  const star = (await labels(page, '^Rate 5 stars'))[0];
  check('delivered orders offer a rating', Boolean(star));
  if (star) {
    await clickLabel(page, star, 1200);
    const rated = await bodyText(page);
    check('choosing a rating reveals submit', rated.includes('Submit Rating'), rated.includes('Exceptional!') ? 'caption shown' : '');
    await page.screenshot({ path: OUT + 'rating.png' });
    await clickLabel(page, 'Submit rating', 1600);
    check('rating is recorded on the card', (await bodyText(page)).includes('Your Rating'));
  }

  // Filing a dispute must stop the card asking the customer to rate a meal
  // they just reported missing. The reference build got that for free (its
  // dispute set status to 'unfulfilled'); ours cannot, because status is
  // shared across a company+day batch, so the gate is explicit and worth a test.
  // A DIFFERENT order from the one rated above (which is the first). Disputing
  // the already-rated card would make the "prompt is hidden" check pass for the
  // wrong reason — that card shows its submitted rating, not a prompt, either way.
  const reportable = await labels(page, '^Report an issue with order');
  const report2 = reportable[reportable.length - 1];
  if (report2) {
    const orderRef = report2.replace('Report an issue with order ', '');
    await clickLabel(page, report2, 1600);
    await clickLabel(page, 'Confirm and dispatch ticket', 2500);
    const after = await bodyText(page);
    check('filing a dispute logs a ticket on the card', /Non-Delivery Ticket: TCK-\d+/.test(after),
      (after.match(/Non-Delivery Ticket: TCK-\d+/) || ['(none)'])[0]);

    // Scoped to the disputed card, not the page: other delivered orders are
    // still legitimately asking to be rated, so a body-wide check would fail
    // for the wrong reason.
    const cardText = await page.evaluate((ref) => {
      const nodes = Array.from(document.querySelectorAll('div'))
        .filter((e) => (e.textContent || '').includes(ref) && (e.textContent || '').includes('Non-Delivery Ticket'));
      // Deepest match is the card itself rather than one of its ancestors.
      return nodes.length ? (nodes[nodes.length - 1].textContent || '').replace(/[\uE000-\uF8FF]/g, '') : null;
    }, orderRef);
    check('the disputed card was found', Boolean(cardText), orderRef);
    check('an open dispute hides that card\'s rating prompt',
      Boolean(cardText) && !cardText.includes('How was your meal drop'),
      cardText ? cardText.slice(0, 90) : '(card not found)');
    check('a disputed order stops offering Report Issue',
      !(await labels(page, '^Report an issue with order')).includes(report2));
    await page.screenshot({ path: OUT + 'disputed.png' });
  }

  // Feedback must outlive a reload. Orders themselves are seeded demo data and
  // deliberately reset, so this is the one thing re-attached from storage by
  // order id — a customer losing their rating on refresh is a real bug.
  const ticketBefore = ((await bodyText(page)).match(/Non-Delivery Ticket: TCK-\d+/) || [])[0];
  await page.reload({ waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(7000);
  await clickLabel(page, 'Developer: skip login', 4000);
  await clickLabel(page, 'Confirm delivery day', 3500);
  const tabAgain = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[role="tab"]')).find((e) => (e.textContent || '').replace(/[\uE000-\uF8FF]/g, '').trim() === 'Orders');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (tabAgain) {
    await page.mouse.click(tabAgain.x, tabAgain.y);
    await sleep(2500);
    const reloaded = await bodyText(page);
    check('a submitted rating survives a reload', reloaded.includes('Your Rating'),
      reloaded.includes('Your Rating') ? 'restored' : 'lost on refresh');
    check('a logged dispute survives a reload',
      Boolean(ticketBefore) && reloaded.includes(ticketBefore),
      ticketBefore ? ticketBefore + (reloaded.includes(ticketBefore) ? ' restored' : ' LOST') : '(no ticket to check)');
    await page.screenshot({ path: OUT + 'after-reload.png' });
  }

  log(errors.length ? 'PAGE ERRORS: ' + JSON.stringify(errors.slice(0, 3)) : 'no page errors');
  log(fails.length ? 'FAILURES: ' + JSON.stringify(fails) : 'ALL CHECKS PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('[orders] ERR: ' + e.message); process.exit(1); });
