const L = require('./walk-lib'); const OUT = '_qa-output/walk/';
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'raj@tcs.com', 'KitchenCoDemo1!');
  await page.screenshot({ path: OUT + '12-date.png' });
  await L.clickBox(page, L.byText, 'Confirm', 4000);
  await page.screenshot({ path: OUT + '13-menu.png' });
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('[aria-label]')).find(e => /Chicken Aglio/.test(e.getAttribute('aria-label'))); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; }, 'dish', 1800);
  await L.clickBox(page, () => { const el = Array.from(document.querySelectorAll('*')).find(e => e.children.length===0 && /^Add to Cart/.test((e.textContent||'').trim())); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, 'a', 1500);
  await L.clickBox(page, L.byText, 'Continue with Friday', 1500);
  await L.clickBox(page, () => { const el = document.querySelector('[aria-label^="Cart"]'); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }, 0, 2500);
  await page.screenshot({ path: OUT + '14-cart.png' });
  const sizes = await page.evaluate(() => Array.from(document.querySelectorAll('[role="button"],a,button')).filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&e.offsetParent!==null;}).map(e=>{const r=e.getBoundingClientRect();return `${(e.getAttribute('aria-label')||e.textContent||'').replace(/[-]/g,'').trim().slice(0,24)} ${Math.round(r.width)}x${Math.round(r.height)}`;}));
  console.log(sizes.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
