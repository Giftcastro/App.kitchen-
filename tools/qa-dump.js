const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeIntoPlaceholder(page, placeholder, value) {
  return page.evaluate((ph, val) => {
    const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === ph);
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, placeholder, value);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(4000);
  await typeIntoPlaceholder(page, 'name@company.com', 'customer@example.com');
  await typeIntoPlaceholder(page, 'Your password', 'password123');
  await sleep(300);
  await page.focus('input[placeholder="Your password"]');
  await page.keyboard.press('Enter');
  await sleep(6000);

  const info = await page.evaluate(() => {
    const out = { plusChains: [], buttons: [] };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const txt = (node.textContent || '').trim();
      if (txt === '+') {
        const chain = [];
        let el = node.parentElement;
        for (let i = 0; el && i < 6; i++) {
          chain.push({ tag: el.tagName, role: el.getAttribute('role'), cls: (el.className || '').toString().slice(0, 60) });
          el = el.parentElement;
        }
        out.plusChains.push(chain);
      }
    }
    // Sample interactive elements with roles
    Array.from(document.querySelectorAll('[role="button"], button')).slice(0, 25).forEach((e) => {
      const r = e.getBoundingClientRect();
      out.buttons.push({ tag: e.tagName, role: e.getAttribute('role'), text: (e.textContent || '').trim().slice(0, 30), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
    });
    return out;
  });
  await browser.close();
  console.log(JSON.stringify(info, null, 2));
})().catch((e) => { console.error('ERR', e); process.exit(1); });