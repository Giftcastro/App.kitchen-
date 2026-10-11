const L = require('./walk-lib'); const OUT = '_qa-output/walk/';
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await L.clickBox(page, L.byText, 'Confirm', 4000);
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('[aria-label]')).find(e => /Chicken Aglio/.test(e.getAttribute('aria-label'))); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }, 'dish', 1800);
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('*')).find(e => e.children.length===0 && /^Add to Cart/.test((e.textContent||'').trim())); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, 'addtocart', 1500);
  await L.clickBox(page, L.byText, 'Continue with Friday', 1500);
  // open cart
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll('[aria-label]')).map(e => e.getAttribute('aria-label')).filter(l => /cart|basket/i.test(l)));
  console.log('cart labels', labels);
  await L.clickBox(page, (ls) => { const el = Array.from(document.querySelectorAll('[aria-label]')).find(e => /cart|basket/i.test(e.getAttribute('aria-label')) && !/add/i.test(e.getAttribute('aria-label'))); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, 0, 2500);
  console.log('URL', page.url());
  await page.screenshot({ path: OUT + '08-cart.png' });
  console.log(await L.text(page));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
