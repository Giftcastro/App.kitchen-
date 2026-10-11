const L = require('./walk-lib');
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await L.clickBox(page, L.byText, 'Confirm', 4000);
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('[aria-label]')).find(e => /Chicken Aglio/.test(e.getAttribute('aria-label'))); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }, 'd', 1800);
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('*')).find(e => e.children.length===0 && /^Add to Cart/.test((e.textContent||'').trim())); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, 'a', 1500);
  await L.clickBox(page, L.byText, 'Continue with Friday', 1500);
  await L.clickBox(page, () => { const el = document.querySelector('[aria-label^="Cart"]'); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, 0, 2500);
  await page.screenshot({ path: '_qa-output/walk/17-cart-header.png', clip: { x: 0, y: 0, width: 390, height: 120 } });
  const b = await page.evaluate(() => { const r = document.querySelector('[aria-label="Back to menu"]').getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
  console.log('back button', b);
  await L.clickBox(page, (l) => { const el = document.querySelector('[aria-label="Back to menu"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }, 0, 2000);
  console.log('after back:', page.url());
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
