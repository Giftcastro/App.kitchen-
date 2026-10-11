const L = require('./walk-lib'); const OUT = '_qa-output/walk/';
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'admin@kitchenco.demo', 'KitchenCoDemo1!');
  for (const t of ['Discounts']) {
    await L.clickBox(page, L.byText, t, 1800);
    await page.screenshot({ path: OUT + 'adm-disc2.png' });
    await L.clickBox(page, () => { const el = document.querySelector('[aria-label^="Delete discount SAVE20"]'); if(!el) return null; el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }, 0, 1200);
    await page.screenshot({ path: OUT + 'adm-disc-confirm.png' });
    console.log('still listed after tap (should be yes):', (await L.text(page)).includes('SAVE20'));
    await L.clickBox(page, L.byText, 'Cancel', 800);
  }
  await L.clickBox(page, L.byText, 'Meals', 1800);
  await page.screenshot({ path: OUT + 'adm-meals2.png' });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
