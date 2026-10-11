const L = require('./walk-lib');
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await L.clickBox(page, L.byText, 'Skip for now', 3500);
  const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a[role="tab"]')).map(a => a.getAttribute('href')));
  console.log('tabs', hrefs);
  const orders = hrefs.find(h => /order|tracker|activity/.test(h));
  await L.clickBox(page, L.byTab, orders, 2500);
  console.log('Orders URL:', page.url());
  const t = await L.text(page);
  console.log(t.includes('Which day are you ordering') ? 'BLOCKED by picker' : 'orders visible: ' + t.slice(0, 160));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
