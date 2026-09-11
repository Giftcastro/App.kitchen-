// Assembles the current build's screens into a client-facing HTML screen-flow
// page, section by section, cross-referenced against Joseph's 21-screen
// "KitchenCo UI-UX" enterprise spec (the brief Ingrid circulated) via the
// spec-ref line under each section heading. Rendered to PDF by
// build-pdf-light.js.
const fs = require('fs');
const path = require('path');

const SHOTS = path.join(__dirname, 'shots-prototype');
const OUT = process.argv[2] || path.join(__dirname, 'kitchenco-prototype.html');

const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, f)).toString('base64');

const SECTIONS = [
  {
    label: 'Onboarding',
    spec: 'Spec Screen 01 — Corporate Gated Authentication',
    intent: 'Signing up reads your work email and matches you to your employer automatically — no invite code, no picking your company from a list. Right after that, you pick which day you want your order delivered.',
    screens: [
      ['01-signin.png', 'Sign In', 'Segmented Sign In / Sign Up, remember-me, password reveal and forgot-password recovery.'],
      ['02-signup.png', 'Sign Up — Company', 'Typing a @tcs.com address live-matches "Joining as TATA" and surfaces that employer’s registered office to deliver to.'],
      ['02b-signup-individual.png', 'Sign Up — Individual', 'A personal email (no matching employer domain) shows "Joining as Individual" and collects the delivery address inline instead, since there’s no registered office to fall back on.'],
      ['03-select-date.png', 'Delivery Day', 'Added on top of the original brief: the first thing a signed-in customer picks is which day they’re ordering for.'],
    ],
  },
  {
    label: 'Menu & discovery',
    spec: 'Spec Screens 02–03 — Scheduled Daily Menu, Dish Catalog and Dietary Badges',
    intent: 'There are two menus, and one switch flips between them. The regular menu can be booked up to 2 weeks ahead. The weekly menu changes every week, so it can only be booked 1 week ahead. Both stop taking orders at 9:00 AM, at least 2 business days before the delivery date.',
    screens: [
      ['04-menu-main.png', 'Main Menu', 'The permanent à la carte catalogue. Search, Main / Today toggle, category chips, and the dish grid with quick-add.'],
      ['05-menu-category.png', 'Category Filter', 'Filtering to Ciao Italy narrows the grid in place.'],
      ['09-todays-menu.png', "Today's Menu", 'The rotating weekly menu, capped at 1 week ahead since its content is set week by week rather than being a fixed catalogue.'],
    ],
  },
  {
    label: 'Ordering',
    spec: 'Spec Screens 04–07 — Customization, Cart, Checkout, PayFast',
    intent: 'Picking size, extras and delivery day all happens in one screen, so the price stays visible the whole time. The moment something is added, a pop-up confirms it and shows the day it will arrive.',
    screens: [
      ['06-customize.png', 'Customize Order', 'Portion, paid extras and the live line total, with a Special Instructions field that reaches the kitchen’s allergy/special-request flagging directly.'],
      ['07-customize-deliveron.png', 'Deliver On', 'The same sheet, scrolled: pick several weekdays in one go, each becoming its own basket line — this goes beyond the original single-date picker.'],
      ['08-added-to-basket.png', 'Added to Basket', 'The confirmation pop-up: names the dish and the day it’s booked for, then offers "order for a different day" or continuing.'],
      ['10-cart.png', 'Cart', 'Auto-applied discount with per-line savings shown, a delivery-fee prompt, and the cutoff notice above checkout.'],
      ['11-payfast.png', 'Card Details', 'PayFast-style checkout sheet with order summary, fees and discount carried through.'],
    ],
  },
  {
    label: 'Account & tracking',
    spec: 'Spec Screens 08–11 — Batch Tracker, Order History, Profile',
    intent: 'After checkout, this is where three simple questions get answered: where is my order right now, what have I ordered before, and what details are saved to my account.',
    screens: [
      ['12-orders-active.png', 'Active Orders', 'The four-stage batch tracker — Payment Verified, Kitchen Prepping, Out for Batch Drop, Delivered to Pantry — with a live progress state.'],
      ['13-orders-past.png', 'Past Orders', 'Reverse-chronological order history in the same tab, one tap away from Active Orders.'],
      ['14-invoice.png', 'Tax Invoice', 'A downloadable, itemised tax invoice generated per order.'],
      ['15-profile.png', 'Profile', 'Account and company affiliation, theme, notification preferences, saved delivery addresses and saved cards.'],
    ],
  },
  {
    label: 'Kitchen & admin console',
    spec: 'Spec Screens 12–21 — Central Command, Chef Kitchen, Menu CRUD, Corporate Onboarding',
    intent: 'Wherever orders are listed for the kitchen or admin team, they’re grouped by company. So a 40-meal order for one company shows up as a single thing to manage, not 40 separate ones.',
    screens: [
      ['16-admin-dashboard.png', 'Dashboard', 'Today’s live operational tiles — orders due, revenue, active orders — and a direct entry point into the Chef production sheet.'],
      ['17-admin-analytics.png', 'Analytics', 'Date- and company-filtered KPIs, revenue trend, top items and an exportable report, kept separate from the always-live Dashboard.'],
      ['18-admin-chef.png', "Chef's Kitchen", 'The production sheet: grand totals for the day, then per-client prep totals, filterable by company.'],
      ['18b-admin-chef-clients.png', 'Production Sheet — Per Client', 'Each client’s line items with a one-tap download or emailed copy, for the whole day or one client at a time.'],
      ['18c-admin-chef-bulk.png', 'Order Queue — Bulk Status Update', '"Select all" (or individual checkboxes) selects any mix of single orders and full company batches, then one tap moves every selected one to Received / Preparing / On the Way / Delivered together.'],
      ['19-admin-orders.png', 'Orders Register', 'The full order record, grouped under company headers with individual order detail preserved underneath.'],
      ['20-admin-users.png', 'Users', 'Registered accounts with account type, matched company, join date and lifetime order count.'],
      ['21-admin-weeks.png', 'Menu Cycles', 'Sets which of the eight rotation weeks is live with one tap.'],
      ['22-admin-meals.png', 'Meals', 'The live catalogue by category, with price points, and a live/off switch per dish.'],
      ['23-admin-discounts.png', 'Discounts', 'Percentage codes with expiry and active state, optionally targeted at a company, a category or a single dish.'],
      ['24-admin-companies.png', 'Corporate Partner Accounts', 'Active-profile counts, distance-based delivery tier, per-company discount, approved email domains and every registered pantry drop-off point.'],
      ['25-admin-notify.png', 'Notify', 'Announcements broadcast to customers’ menu screens, optionally targeted at one company.'],
    ],
  },
];

const total = SECTIONS.reduce((n, s) => n + s.screens.length, 0);

const phone = (file, name, note, n) => `
      <figure class="phone">
        <div class="frame">
          <div class="bezel"><span class="speaker"></span></div>
          <img src="${b64(file)}" alt="${name} screen" loading="lazy">
        </div>
        <figcaption>
          <span class="n">${String(n).padStart(2, '0')}</span>
          <b>${name}</b>
          <span class="note">${note}</span>
        </figcaption>
      </figure>`;

let n = 0;
const body = SECTIONS.map((s) => `
    <section>
      <div class="shead">
        <span class="slabel">${s.label}</span>
        <span class="spec-ref">${s.spec}</span>
        <p class="sintent">${s.intent}</p>
      </div>
      <div class="grid">${s.screens.map((sc) => phone(sc[0], sc[1], sc[2], ++n)).join('')}
      </div>
    </section>`).join('');

const html = `<title>Kitchen Co. Prototype &amp; Screen Flow</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --ground:#FFFFFF;
  --panel:#F6F6F4;
  --line:#E2E2DD;
  --text:#161613;
  --muted:#5B5B55;
  --dim:#8B8B84;
  --f:'Montserrat','Segoe UI',system-ui,sans-serif;
  --m:'IBM Plex Mono',ui-monospace,Consolas,monospace;
}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--text);font-family:var(--f);margin:0;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1240px;margin-inline:auto;padding:0 clamp(1rem,4vw,2.5rem) 5rem}

header{padding:clamp(3rem,8vw,5.5rem) 0 clamp(2rem,5vw,3.5rem);border-bottom:1px solid var(--line)}
.mark{font-size:clamp(1.5rem,4vw,2rem);letter-spacing:-.02em;font-weight:300}
.mark b{font-weight:800}
.rule{width:34px;height:3px;background:var(--text);margin:.7rem 0 1.6rem;border-radius:2px}
h1{font-size:clamp(2.1rem,6.5vw,4rem);font-weight:800;letter-spacing:-.035em;line-height:1.02;
  margin:0 0 1rem;text-wrap:balance;max-width:20ch;color:var(--text)}
h1 em{font-style:normal;font-weight:400;color:var(--muted)}
.sub{color:var(--muted);font-size:clamp(1rem,2.2vw,1.15rem);font-weight:400;max-width:62ch;
  line-height:1.6;margin:0 0 2rem}

section{padding-top:clamp(2.5rem,6vw,4.5rem)}
.shead{margin-bottom:2rem;padding-bottom:1rem;border-bottom:1px solid var(--line)}
.slabel{font-family:var(--m);font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;
  color:var(--text);font-weight:700;white-space:nowrap;display:block;margin-bottom:.4rem}
.spec-ref{font-size:.78rem;color:var(--dim);font-weight:600;display:block;margin-bottom:.7rem}
.sintent{margin:0;color:var(--muted);font-size:.95rem;line-height:1.55;max-width:70ch}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));
  gap:clamp(1.5rem,3vw,2.5rem)}
.phone{margin:0;display:flex;flex-direction:column;gap:.95rem}
.frame{background:#000;border:1px solid #000;border-radius:26px;padding:9px 7px 11px;
  box-shadow:0 10px 26px -14px rgba(0,0,0,.4);position:relative}
.bezel{height:15px;display:flex;align-items:center;justify-content:center}
.speaker{display:block;width:42px;height:4px;border-radius:3px;background:#3A3A3A}
.frame img{display:block;width:100%;height:auto;border-radius:16px;background:#fff}

figcaption{display:flex;flex-direction:column;gap:.3rem}
figcaption .n{font-family:var(--m);font-size:.68rem;letter-spacing:.1em;color:var(--dim)}
figcaption b{font-size:1rem;font-weight:700;letter-spacing:-.01em;color:var(--text)}
figcaption .note{font-size:.85rem;line-height:1.55;color:var(--muted);font-weight:400}

footer{margin-top:clamp(3rem,7vw,5rem);padding-top:1.4rem;border-top:1px solid var(--line);
  display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;
  font-family:var(--m);font-size:.72rem;color:var(--dim)}

@media print{
  section{break-inside:auto}
  .phone{break-inside:avoid}
  @page{margin:14mm}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <header>
    <div class="mark">your kitchen <b>co.</b></div>
    <div class="rule"></div>
    <h1>Prototype &amp; <em>screen flow</em></h1>
    <p class="sub">Every screen of the corporate ordering app and the kitchen operations console, captured from the running build. Menus, orders and companies shown are seeded demo data, not production records.</p>
  </header>
${body}
  <footer>
    <div>your kitchen co. &middot; prototype &amp; screen flow</div>
    <div>${total} screens &middot; captured 11 September 2026</div>
  </footer>
</div>
`;

fs.writeFileSync(OUT, html);
console.log('[build] wrote', OUT, (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB');
