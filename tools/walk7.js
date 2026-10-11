const L = require('./walk-lib'); const OUT = '_qa-output/walk/';
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await L.clickBox(page, L.byText, 'Confirm', 4000);
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('[aria-label]')).find(e => /Chicken Aglio/.test(e.getAttribute('aria-label'))); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }, 'dish', 1800);
  await page.screenshot({ path: OUT + '09-modal-default.png' });
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('*')).find(e => e.children.length===0 && /^Add to Cart/.test((e.textContent||'').trim())); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, 'addtocart', 1500);
  await L.clickBox(page, L.byText, 'Continue with Friday', 1500);
  await L.clickBox(page, () => { const el = document.querySelector('[aria-label^="Cart"]'); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, 0, 2500);
  await page.screenshot({ path: OUT + '10-cart-fixed.png' });
  await L.clickBox(page, () => { const el = document.querySelector('[aria-label^="Checkout"]'); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, 0, 3500);
  console.log('URL', page.url());
  await page.screenshot({ path: OUT + '11-payment.png' });
  console.log((await L.text(page)).slice(0, 600));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
