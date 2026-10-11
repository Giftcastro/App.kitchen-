const L = require('./walk-lib'); const OUT = '_qa-output/walk/';
const TABS = ['Analytics','Users','Orders','Chef','Weeks','Meals','Discounts','Companies','Addresses','Notify'];
(async () => {
  const { browser, page } = await L.open();
  await L.login(page, 'admin@kitchenco.demo', 'KitchenCoDemo1!');
  for (const t of TABS) {
    const ok = await L.clickBox(page, L.byText, t, 1800);
    if (!ok) continue;
    await page.evaluate(() => window.scrollTo(0, 0));
    const file = 'adm-' + t.toLowerCase() + '.png';
    await page.screenshot({ path: OUT + file });
    const small = await page.evaluate(() => Array.from(document.querySelectorAll('[role="button"],a,button,input,[role="switch"]')).filter(e => {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || e.offsetParent === null) return false;
      let p = e; while (p) { const cs = getComputedStyle(p); if (cs.zIndex === '-1' && cs.position === 'absolute') return false; p = p.parentElement; }
      return r.top >= 0 && r.top < 844 && (r.height < 40 || r.width < 40);
    }).map(e => { const r = e.getBoundingClientRect(); return `${(e.getAttribute('aria-label') || e.textContent || e.placeholder || '').replace(/[-]/g,'').trim().slice(0,28)} ${Math.round(r.width)}x${Math.round(r.height)}`; }));
    console.log('== ' + t, small.length ? '\n  small: ' + small.join(' | ') : '(no small targets)');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
