const L = require('./walk-lib'); const OUT = '_qa-output/walk/';
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await L.clickBox(page, L.byText, 'Confirm', 3500);
  // tap first dish card
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('[aria-label]')).find(e => /Chicken Aglio/.test(e.getAttribute('aria-label'))); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }, 'dish', 1800);
  await page.screenshot({ path: OUT + '04-dish-modal.png' });
  console.log('MODAL', (await L.text(page)).slice(0, 400));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
