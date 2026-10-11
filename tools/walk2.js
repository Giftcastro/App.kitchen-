const L = require('./walk-lib'); const OUT = '_qa-output/walk/';
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await page.screenshot({ path: OUT + '02-after-login.png' });
  console.log('URL', page.url()); console.log(await L.text(page));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
