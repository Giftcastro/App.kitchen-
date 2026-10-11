const L = require('./walk-lib'); const OUT = '_qa-output/walk/';
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await L.clickBox(page, L.byText, 'Confirm', 4000);
  await page.screenshot({ path: OUT + '05-menu-fixed.png' });
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('[aria-label]')).find(e => /Chicken Aglio/.test(e.getAttribute('aria-label'))); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }, 'dish', 1800);
  await page.screenshot({ path: OUT + '06-modal-fixed.png' });
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('*')).find(e => e.children.length===0 && /^Add to Cart/.test((e.textContent||'').trim())); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, 'addtocart', 2000);
  await page.screenshot({ path: OUT + '07-added.png' });
  console.log(await L.text(page));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
