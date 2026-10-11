const L = require('./walk-lib');
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'admin@kitchenco.demo', 'KitchenCoDemo1!');
  await L.clickBox(page, L.byText, 'Meals', 1800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '_qa-output/walk/adm-meals3.png', clip: { x: 0, y: 380, width: 390, height: 380 } });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
