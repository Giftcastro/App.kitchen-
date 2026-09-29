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
    intent: 'Signing up reads your work email and matches you to your employer automatically — no invite code, no picking your company from a list. Anyone without a matching employer instead picks a delivery point from the ones you have registered, rather than typing an address of their own. Right after that, you pick which day you want your order delivered.',
    screens: [
      ['01-signin.png', 'Sign In', 'Segmented Sign In / Sign Up, remember-me, password reveal and forgot-password recovery.'],
      ['02-signup.png', 'Sign Up — Company', 'Typing a @tcs.com address live-matches "Joining as TATA" and surfaces that employer’s registered office to deliver to.'],
      ['02b-signup-individual.png', 'Sign Up — Individual', 'A personal email (no matching employer domain) shows "Joining as Individual" and offers a delivery-location dropdown — individuals no longer type an address of their own.'],
      ['02c-signup-location.png', 'Delivery Location', 'The dropdown open. Individuals choose from the delivery points registered for the app, so every order goes somewhere already covered rather than an address nobody has checked.'],
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
      ['21-admin-weeks.png', 'Menu Cycles', 'The eight-week rotation advances to the next week on its own every Monday — nothing to click. Normal state: no override, nothing to undo.'],
      ['21b-admin-weeks-override.png', 'Menu Cycles — Manual Override', 'Picking a week by hand, for an exception like a swapped or repeated week. It does not switch the rotation off: the menu keeps advancing every Monday from the corrected position, and "Back to automatic" restores the calendar week whenever you want it.'],
      ['22-admin-meals.png', 'Meals', 'The live catalogue by category, with price points, and a live/off switch per dish.'],
      ['23-admin-discounts.png', 'Discounts', 'Percentage codes with expiry and active state, optionally targeted at a company, a category or a single dish.'],
      ['24-admin-companies.png', 'Corporate Partner Accounts', 'Active-profile counts, distance-based delivery tier, per-company discount, approved email domains and every registered pantry drop-off point.'],
      ['25-admin-notify.png', 'Notify', 'Announcements broadcast to customers’ menu screens, optionally targeted at one company.'],
    ],
  },
  {
    label: 'Edge cases & empty states',
    spec: 'Not in the original spec — added because these are the screens a real customer meets first',
    intent: 'What the app says when something is missing, empty or wrong. A brand-new account sees most of these before it ever sees a populated screen, so they are designed rather than left blank.',
    screens: [
      ['e1-signup-validation.png', 'Sign-up Validation', 'Each field is checked in place before an account is created — here a delivery location that was never picked and a confirmation password that does not match.'],
      ['e2-search-empty.png', 'No Search Results', 'A search matching nothing says so plainly, repeats the term, and offers a one-tap way back to the full menu rather than leaving an empty grid.'],
      ['e3-cart-empty.png', 'Empty Basket', 'The basket before anything is added, with a route straight back to the menu.'],
      ['e4-orders-empty.png', 'No Orders Yet', 'A new account has no history to show — this stands in until the first order is placed.'],
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

/* Screen-flow map — laid out vertically on purpose: a horizontal chain wraps
   unpredictably at print width and strands arrows mid-row. */
.flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.4rem;align-items:start}
.lane{border:1px solid var(--line);border-radius:14px;padding:1.15rem 1.25rem;background:var(--panel)}
.lanelabel{font-family:var(--m);font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--dim);font-weight:500;display:block;margin-bottom:.9rem}
.fstep{display:flex;align-items:center;gap:.6rem;background:#fff;border:1px solid var(--line);
  border-radius:10px;padding:.55rem .75rem}
.fstep .num{font-family:var(--m);font-size:.66rem;color:var(--dim);min-width:1.1rem}
.fstep .lbl{font-size:.82rem;font-weight:700;color:var(--text)}
.fstep .lbl em{font-style:normal;font-weight:400;color:var(--dim)}
.fdown{display:block;text-align:center;color:var(--dim);font-size:.9rem;line-height:1;margin:.3rem 0}
.fforks{margin:.45rem 0 .45rem 1.25rem;padding-left:.85rem;border-left:2px solid var(--line);
  display:flex;flex-direction:column;gap:.35rem}
.ffork{font-size:.78rem;line-height:1.4;color:var(--muted);background:transparent;
  border:1px dashed var(--line);border-radius:8px;padding:.4rem .6rem}
.ffork b{font-weight:700;color:var(--text)}
.fchips{display:flex;flex-wrap:wrap;gap:.35rem;margin:.55rem 0 0 1.25rem}
.fchip{font-size:.75rem;color:var(--muted);border:1px dashed var(--line);border-radius:7px;
  padding:.32rem .55rem;background:transparent}

/* Palette & type */
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(178px,1fr));gap:1rem;margin-bottom:1.4rem}
.sw{margin:0;display:flex;flex-direction:column;gap:.45rem}
.chip{display:block;height:54px;border-radius:10px;border:1px solid var(--line)}
.sw b{font-family:var(--m);font-size:.78rem;font-weight:500;color:var(--text)}
.sw .note{font-size:.76rem;line-height:1.45;color:var(--muted)}
.typerow{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:1rem}
.ty{border:1px solid var(--line);border-radius:12px;padding:.85rem .95rem;background:var(--panel)}
.ty b{display:block;font-size:.95rem;margin-bottom:.2rem}
.ty .note{font-size:.78rem;color:var(--muted);line-height:1.45}
.ruleline{font-size:.86rem;color:var(--muted);line-height:1.6;max-width:72ch;margin:.2rem 0 1.5rem}

figcaption{display:flex;flex-direction:column;gap:.3rem}
figcaption .n{font-family:var(--m);font-size:.68rem;letter-spacing:.1em;color:var(--dim)}
figcaption b{font-size:1rem;font-weight:700;letter-spacing:-.01em;color:var(--text)}
figcaption .note{font-size:.85rem;line-height:1.55;color:var(--muted);font-weight:400}

footer{margin-top:clamp(3rem,7vw,5rem);padding-top:1.4rem;border-top:1px solid var(--line);
  display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;
  font-family:var(--m);font-size:.72rem;color:var(--dim)}
footer .changelog{flex-basis:100%;margin-top:.5rem;font-family:var(--f);font-size:.76rem;
  line-height:1.5;color:var(--muted)}

@media print{
  section{break-inside:auto}
  /* Anything that reads as a single panel must never be sliced across a page
     break — a half a lane or half a swatch row looks broken, not compact. */
  .phone,figcaption,.lane,.swatches,.sw,.ty,.typerow,.fstep,.ffork,.fchips{
    break-inside:avoid;page-break-inside:avoid}
  /* A section heading must stay whole AND stay with the content it
     introduces — otherwise the label lands at the foot of one page and its
     own paragraph starts the next. */
  .shead{break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid}
  /* Title page stands alone, so the first real section starts clean instead
     of being wedged into whatever space is left under the masthead. */
  header{break-after:page;page-break-after:always}
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

  <section>
    <div class="shead">
      <span class="slabel">Screen flow</span>
      <span class="spec-ref">How the screens connect</span>
      <p class="sintent">Two journeys. A customer is routed by their email domain at sign-up, picks the day they are ordering for, then orders. The kitchen team signs in to a separate console. Every box below is one of the numbered screens that follow.</p>
    </div>
    <div class="flow">
      <div class="lane">
        <span class="lanelabel">Customer</span>
        <div class="fstep"><span class="num">01</span><span class="lbl">Sign In / Sign Up <em>&mdash; one screen, toggled</em></span></div>
        <div class="fforks">
          <div class="ffork"><b>Returning</b> &mdash; signs in and goes straight through</div>
          <div class="ffork"><b>New, work email</b> &mdash; auto-matched to their employer, delivers to that office</div>
          <div class="ffork"><b>New, personal email</b> &mdash; picks one of the registered delivery locations</div>
        </div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">02</span><span class="lbl">Delivery Day</span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">03</span><span class="lbl">Menu <em>&mdash; Standard or Today&rsquo;s</em></span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">04</span><span class="lbl">Customize <em>&mdash; size, extras, delivery days</em></span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">05</span><span class="lbl">Cart</span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">06</span><span class="lbl">PayFast <em>&mdash; checkout</em></span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">07</span><span class="lbl">Orders &amp; Invoices <em>&mdash; tracking, history, tax invoice</em></span></div>
      </div>
      <div class="lane">
        <span class="lanelabel">Kitchen &amp; admin</span>
        <div class="fstep"><span class="num">01</span><span class="lbl">Sign In</span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">02</span><span class="lbl">Kitchen Controls</span></div>
        <div class="fchips">
          <span class="fchip">Dashboard</span>
          <span class="fchip">Analytics</span>
          <span class="fchip">Chef production sheet</span>
          <span class="fchip">Order queue</span>
          <span class="fchip">Orders register</span>
          <span class="fchip">Users</span>
          <span class="fchip">Menu cycles</span>
          <span class="fchip">Meals</span>
          <span class="fchip">Discounts</span>
          <span class="fchip">Companies</span>
          <span class="fchip">Notify</span>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="shead">
      <span class="slabel">Design system</span>
      <span class="spec-ref">Palette &amp; typography</span>
      <p class="sintent">The app is deliberately black and white. Colour is used sparingly, and only where it carries meaning or comes from the Your Kitchen Co. palette.</p>
    </div>
    <div class="swatches">
      <figure class="sw"><span class="chip" style="background:#000000"></span><b>#000000</b><span class="note">Every primary button, active chip and selected state.</span></figure>
      <figure class="sw"><span class="chip" style="background:#FFFFFF"></span><b>#FFFFFF</b><span class="note">Cards and surfaces.</span></figure>
      <figure class="sw"><span class="chip" style="background:#FDF9E9"></span><b>#FDF9E9</b><span class="note">Screen background — a soft tint of the palette&rsquo;s cream, used instead of stark white.</span></figure>
      <figure class="sw"><span class="chip" style="background:#3571B7"></span><b>#3571B7</b><span class="note">Brand blue, from the palette. Active tab, the sign-in glow and the delivery-day icon.</span></figure>
      <figure class="sw"><span class="chip" style="background:#AF1718"></span><b>#AF1718</b><span class="note">Brand red, from the palette. Errors, warnings and cancelled orders.</span></figure>
    </div>
    <p class="ruleline"><b>Status colours are not brand colours.</b> Order states use a separate, conventional set so they stay instantly readable: green <b>#1DA836</b> delivered, amber <b>#E8A100</b> awaiting action, blue <b>#0073E6</b> in transit, red <b>#AF1718</b> cancelled.</p>
    <div class="typerow">
      <div class="ty"><b>Gotcha Gothic</b><span class="note">Headings and screen titles.</span></div>
      <div class="ty"><b>Montserrat</b><span class="note">Interface text throughout the app.</span></div>
      <div class="ty"><b>Roboto Condensed</b><span class="note">Body copy on Menu, Orders and Profile.</span></div>
    </div>
  </section>
${body}
  <footer>
    <div>your kitchen co. &middot; prototype &amp; screen flow &middot; v6</div>
    <div>${total} screens &middot; captured 15 September 2026</div>
    <div class="changelog">New in v6: screen-flow map, palette &amp; typography, edge cases &amp; empty states, individual sign-up by delivery location, menu-cycle override.</div>
  </footer>
</div>
`;

fs.writeFileSync(OUT, html);
console.log('[build] wrote', OUT, (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB');
