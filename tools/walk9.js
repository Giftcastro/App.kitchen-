const L = require('./walk-lib');
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await L.clickBox(page, L.byText, 'Confirm', 4000);
  await page.screenshot({ path: '_qa-output/walk/15-black-tabs.png', clip: { x: 0, y: 0, width: 390, height: 300 } });
  await page.screenshot({ path: '_qa-output/walk/16-black-tabbar.png', clip: { x: 0, y: 764, width: 390, height: 80 } });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
