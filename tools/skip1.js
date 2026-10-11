const L = require('./walk-lib');
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await page.screenshot({ path: '_qa-output/walk/skip-picker.png' });
  await L.clickBox(page, L.byText, 'Skip for now', 3500);
  console.log('URL after skip:', page.url());
  console.log((await L.text(page)).includes('Ordering for') ? 'menu shows Ordering-for bar' : (await L.text(page)).slice(0, 200));
  await L.clickBox(page, L.byTab, '/tracker', 2500);
  console.log('Orders tab URL:', page.url());
  await page.screenshot({ path: '_qa-output/walk/skip-orders.png' });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
