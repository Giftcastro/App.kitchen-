// Read-only walkthrough of the MAUI-parity port on the Expo web build.
// Signs in as a demo customer and the demo admin (supabase/seed/demo-data.sql),
// screenshots every screen, and never submits an order or changes data.
//   npx expo start --web -c   (from Kitchen_APP/)   then   node tools/verify-maui-port.js
const path = require('path');
const fs = require('fs');
const { open, sleep } = require('./walk-lib');

const OUT = process.env.SHOT_DIR || path.join(__dirname, 'shots-maui');
fs.mkdirSync(OUT, { recursive: true });
const PASSWORD = 'KitchenCoDemo1!';

const clickText = async (page, label, wait = 1200) => {
  const box = await page.evaluate(t => {
    const nodes = Array.from(document.querySelectorAll('*')).filter(
      e => e.children.length === 0 && (e.textContent || '').replace(/[-]/g, '').trim() === t
    );
    // Prefer the visible one (other tab screens stay mounted off-screen).
    const sized = nodes.filter(n => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    // On-screen first; otherwise one parked off to the side in a horizontal scroller (nav pills).
    const el = sized.find(n => {
      const r = n.getBoundingClientRect();
      return r.x >= 0 && r.x < window.innerWidth;
    }) ?? sized[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!box) {
    console.log('  MISSING:', label);
    return false;
  }
  await page.mouse.click(box.x, box.y);
  await sleep(wait);
  return true;
};
const clickTestId = async (page, id, wait = 1200) => {
  const box = await page.evaluate(i => {
    const el = document.querySelector(`[data-testid="${i}"]`);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);
  if (!box) {
    console.log('  MISSING testID:', id);
    return false;
  }
  await page.mouse.click(box.x, box.y);
  await sleep(wait);
  return true;
};
const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('  shot', name);
};
const clickTab = async (page, href, wait = 3500) => {
  const box = await page.evaluate(h => {
    const el = document.querySelector(`a[role="tab"][href="${h}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, href);
  if (!box) return console.log('  MISSING tab:', href), false;
  await page.mouse.click(box.x, box.y);
  await sleep(wait);
  return true;
};
const has = (page, t) => page.evaluate(s => document.body.textContent.includes(s), t);
const signIn = async (page, email) => {
  await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(2500);
  await page.type('[data-testid="login-email"]', email, { delay: 10 });
  await page.type('[data-testid="login-password"]', PASSWORD, { delay: 10 });
  await clickTestId(page, 'login-submit', 6000);
};

(async () => {
  const { browser, page } = await open();
  const results = [];
  const check = async (label, ok) => {
    results.push([label, ok]);
    console.log(ok ? 'PASS' : 'FAIL', label);
  };
  try {
    // ── Customer ──
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
    await sleep(3000);
    await shot(page, '01-login');
    await check('login page renders', await has(page, 'Sign in to continue'));

    await clickText(page, 'Sign Up', 2500);
    await shot(page, '02-register');
    await check('register page renders', await has(page, 'Create Account'));
    await page.goBack();
    await sleep(1500);

    await signIn(page, 'thandiwe@ecogra.org');
    await shot(page, '03-select-day');
    await check('customer lands on delivery-day picker', await has(page, 'Which day are you ordering for?'));
    await clickTestId(page, 'confirm-day', 5000);
    await shot(page, '04-menu');
    await check('menu shows Explore Our Menu', await has(page, 'Explore Our Menu'));
    await check('menu loads dishes from Supabase', await has(page, 'Large R'));

    await clickText(page, 'Cycling Menu', 4000);
    await shot(page, '05-cycling-menu');
    await clickText(page, 'Main Menu', 4000);

    // Open the first dish via its "+" button.
    await clickText(page, '+', 2500);
    await shot(page, '06-product-cutoff-alert');
    await check('one-time 9AM cutoff popup', await has(page, 'Order cutoff: 9:00 AM'));
    await clickText(page, 'Got it', 1200);
    await shot(page, '07-product-detail');
    await check('product detail has allergy chef alert', await has(page, 'Allergy Notes (Chef Alert)'));
    await clickTestId(page, 'add-to-basket', 1500);
    await shot(page, '08-added-to-basket');
    await check('added-to-basket prompt', await has(page, 'Order for a different day'));
    const continueLabel = await page.evaluate(
      () => (Array.from(document.querySelectorAll('*')).map(e => (e.textContent || '').trim()).find(t => /^Continue with \w+$/.test(t)) || '')
    );
    await clickText(page, continueLabel, 2500);
    await shot(page, '09-menu-with-cart-bar');
    await check('floating cart bar', await has(page, 'Review Order'));

    await clickText(page, 'Review Order', 3500);
    await shot(page, '10-cart');
    await check('cart shows You Pay', await has(page, 'You Pay:'));
    await check('cart shows Ecogra subsidy line', await has(page, 'per meal (incl. VAT)'));
    await clickTestId(page, 'proceed-to-payment', 2500);
    await shot(page, '11-payment');
    await check('payment screen (not submitted)', await has(page, 'Choose Payment Method'));
    await clickText(page, 'PayFast', 800);
    await shot(page, '12-payment-payfast');
    await page.goBack();
    await sleep(1200);
    await page.goBack();
    await sleep(1500);

    await clickTab(page, '/orders', 4500);
    await shot(page, '13-orders-active');
    await check('orders tab active view', await has(page, 'Active Orders'));
    await clickText(page, 'History', 3500);
    await shot(page, '14-orders-history');
    await check('history has Report an Issue / Invoice', (await has(page, 'Invoice')) || (await has(page, 'No Order History')));

    await clickTab(page, '/profile', 3500);
    await shot(page, '15-profile');
    await check('profile shows company', await has(page, 'Ecogra'));
    await clickText(page, 'Settings', 2000);
    await shot(page, '16-settings');
    await page.goBack();
    await sleep(1200);
    await clickText(page, 'Help & Support', 2000);
    await shot(page, '17-help');
    await clickText(page, 'Cancellation & Holiday Policy', 2000);
    await shot(page, '18-policy');

    // Sign out via Settings.
    await page.goBack();
    await sleep(1200);
    await page.goBack();
    await sleep(1500);
    await clickText(page, 'Sign Out', 1200);
    await shot(page, '19-signout-confirm');
    // The popup's title is also "Sign Out" — tap its button, the last one rendered.
    const confirmBox = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[role="button"]')).filter(b => (b.textContent || '').trim() === 'Sign Out');
      const el = buttons[buttons.length - 1];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (confirmBox) await page.mouse.click(confirmBox.x, confirmBox.y);
    await sleep(3500);
    await check('sign out returns to login', await has(page, 'Sign in to continue'));

    // ── Admin ──
    await signIn(page, 'admin@kitchenco.demo');
    await sleep(3000);
    await shot(page, '20-admin-overview');
    await check('admin lands on Overview hub', await has(page, 'Upcoming Deliveries'));
    for (const [label, name, marker] of [
      ['Active Orders', '21-admin-active-orders', 'Mark All Filtered As'],
      ['Companies', '22-admin-companies', 'Client Companies'],
      ['Discounts', '23-admin-discounts', 'New Discount Code'],
      ['Notifications', '24-admin-notifications', 'Compose Broadcast'],
      ['Menu Catalog', '25-admin-menu', 'Menu Inventory'],
      ['Users', '26-admin-users', 'Role Filter:'],
      ['Reports', '27-admin-reports', 'Revenue Over Time'],
      ['Settings', '28-admin-settings', 'App Preferences'],
    ]) {
      // Nav pills sit in a horizontal scroller; the label is unique there.
      await clickText(page, label, 4500);
      await shot(page, name);
      await check(`admin ${label}`, await has(page, marker));
    }
    await clickText(page, 'Menu Catalog', 3500);
    await clickText(page, 'Cycle Menu (8-week)', 3500);
    await shot(page, '29-admin-cycle-menu');
    await check('admin cycle editor', await has(page, 'Currently active for this week'));
    await clickText(page, 'Active Orders', 3500);
    await clickText(page, '🍳  Prep Summary', 1500);
    await shot(page, '30-admin-prep-summary');
  } catch (err) {
    console.log('ERROR', err);
  } finally {
    const failed = results.filter(([, ok]) => !ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    await browser.close();
  }
})();
