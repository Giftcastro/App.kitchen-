const L = require('./walk-lib'); const OUT = '_qa-output/walk/';
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'admin@kitchenco.demo', 'KitchenCoDemo1!');
  await L.L; 
  console.log('URL', page.url());
  await page.screenshot({ path: OUT + 'a01.png' });
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('a[role="tab"]')).map(a => a.getAttribute('href') + ' ' + a.textContent.replace(/[-]/g,'')));
  console.log('tabs', tabs);
  console.log((await L.text(page)).slice(0, 500));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
