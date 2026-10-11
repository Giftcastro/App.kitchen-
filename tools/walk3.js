const L = require('./walk-lib'); const OUT = '_qa-output/walk/';
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await L.clickBox(page, L.byText, 'Confirm', 3500);
  console.log('URL', page.url());
  await page.screenshot({ path: OUT + '03-menu.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  console.log(await L.text(page));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
