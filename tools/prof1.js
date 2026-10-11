const L = require('./walk-lib');
(async () => {
  const email = process.argv[2];
  const { browser, page } = await L.open();
  await L.login(page, email, 'KitchenCoDemo1!');
  await L.clickBox(page, L.byText, 'Confirm', 3500);
  await L.clickBox(page, L.byTab, '/profile', 2500);
  await page.evaluate(() => { const el = Array.from(document.querySelectorAll('*')).find(e => e.children.length===0 && /Delivery Address/.test(e.textContent||'')); if (el) el.scrollIntoView({block:'start'}); });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: `_qa-output/walk/prof-${email.split('@')[0]}.png` });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
