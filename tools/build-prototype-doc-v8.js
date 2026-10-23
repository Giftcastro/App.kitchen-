// Assembles the v8 screen captures (shot-prototype-v8.js -> shots-v8/) into the
// client-facing "Prototype & screen flow" HTML, one section per journey.
// Rendered to PDF by build-pdf-light.js; check pagination with pdf-pages.js.
const fs = require('fs');
const path = require('path');

const SHOTS = path.join(__dirname, 'shots-v8');
const OUT = process.argv[2] || path.join(__dirname, 'kitchenco-prototype-v8.html');
const CAPTURED = '16 October 2026';

const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, f)).toString('base64');

const SECTIONS = [
  {
    label: 'Sign in & sign up',
    spec: 'Login · Create Account',
    intent: 'One sign-in screen for everyone: customers and the kitchen team use the same door, and the app takes each person to their own side. New customers create an account themselves, and their company is matched from their work email.',
    screens: [
      ['01-login.png', 'Sign In', 'Email and password, remember-me and password recovery. Customers land in the ordering app; admin accounts land in the operations hub.'],
      ['02-register.png', 'Create Account', 'Name, email, password, then the company and delivery location the account belongs to. Orders are grouped by these, so both are required.'],
      ['02c-register-automatch.png', 'Company Matched from Email', 'Typing an @ecogra.org address picks Ecogra automatically and says so. Someone can still choose a different company by hand.'],
      ['02d-register-location.png', 'Delivery Location', 'Only the selected company’s registered drop-off points are offered, so every order goes to an address the kitchen already delivers to.'],
      ['02b-register-validation.png', 'Missing Details', 'Nothing is sent until the form is complete. Each problem is explained plainly in a pop-up rather than as a red field with no reason.'],
    ],
  },
  {
    label: 'Delivery day & menu',
    spec: 'Select Date · Menu · Cycling Menu',
    intent: 'The first question after signing in is which day the order is for. Everything added to the basket is booked for that day unless the customer changes it. There are two menus: the permanent Main Menu and the weekly Cycling Menu, which rotates on an eight-week cycle.',
    screens: [
      ['03-select-day.png', 'Which Day Are You Ordering For?', 'The next ten delivery days that are still open for orders. "Skip for now" goes straight to the menu, and "View my orders" goes to order tracking.'],
      ['04-menu.png', 'Main Menu', 'Search, the Main / Cycling switch, category tabs, and the 9:00 AM cutoff rule shown above the dishes. The date pill at the top shows the day being ordered for.'],
      ['04b-day-overlay.png', 'Change Delivery Day', 'Tapping the date pill reopens the day picker over the menu, so changing the day never loses your place.'],
      ['05-cycling-menu.png', 'Cycling Menu', 'This week’s rotating dishes for the chosen day, grouped by meal slot (Curry of the Day, Gourmet Sandwich, Healthy and so on), each labelled with its week in the cycle.'],
    ],
  },
  {
    label: 'Ordering & checkout',
    spec: 'Product · Basket · Payment · Order Confirmation',
    intent: 'From dish to paid order in four screens. The company’s meal subsidy and any discount are worked out in the basket, so the customer sees exactly what they pay before checkout. Payment goes through PayFast.',
    screens: [
      ['06-product-cutoff-alert.png', 'Order Cutoff Notice', 'Shown once, the first time a dish is opened: orders close at 9:00 AM, and anything later rolls over to the next delivery window.'],
      ['07-product-detail.png', 'Dish Detail', 'Photo, price and description, the delivery day for this dish, and paid extras. Further down is a single box for special requests and allergy notes, which goes straight to the kitchen.'],
      ['08-added-to-basket.png', 'Added to Basket', 'Confirms the dish and its delivery day, then offers three ways on: checkout, the same dish for a different day, or keep ordering.'],
      ['09-menu-with-cart-bar.png', 'Basket Bar', 'Back on the menu, a floating bar keeps the item count and running total in view, one tap from the basket.'],
      ['10-cart.png', 'Your Basket', 'Each line with its delivery day and quantity. Below that: the meal total, the company subsidy (Ecogra covers R80 a meal), the discount code, the distance-based delivery fee and what the customer actually pays.'],
      ['11-payment.png', 'Payment', 'The amount due with the delivery fee broken out. Payment is PayFast only: EFT, Instant EFT and all major cards.'],
      ['11b-payment-redirect.png', 'Redirecting to PayFast', 'On a phone, PayFast’s secure checkout opens inside the app. This build uses PayFast’s test mode, so no real money moves.'],
      ['12-order-confirmation.png', 'Order Scheduled & Paid', 'The order number, delivery date, what was in the order and the total paid, with links to tracking and the tax invoice. Shown here with a demo order.'],
    ],
  },
  {
    label: 'Orders & invoices',
    spec: 'Orders · Order History · Tax Invoice',
    intent: 'One tab answers two questions: what is on its way, and what has been ordered before. Every past order can be rated, reordered, reported or invoiced from its card.',
    screens: [
      ['13-orders-active.png', 'Active Orders', 'Orders still being prepared or delivered, updating as the kitchen moves them along. Empty here: this demo account has nothing in progress.'],
      ['14-orders-history.png', 'Order History', 'Each past order with its status, date and total. Rate it out of five, reorder it, open its invoice, or report an issue (which opens a support ticket).'],
      ['15-tax-invoice.png', 'Tax Invoice', 'A full tax invoice: supplier and VAT details, customer and drop-off, line items, then subsidy, discount and delivery fee. It can be downloaded as a PDF or shared as text.'],
    ],
  },
  {
    label: 'Profile & settings',
    spec: 'Profile · Settings · Help & Support · Cancellation Policy',
    intent: 'The account in one place, plus the app’s two looks. Ink & Cream is the default. Mediterranean Pantry is the alternative, chosen from Settings, and it re-themes the whole app at once.',
    screens: [
      ['16-profile.png', 'My Profile', 'Role, company, meal subsidy and delivery location, all set by the company account and read-only here. The customer can set their delivery floor themselves.'],
      ['17-settings.png', 'Settings', 'Push notifications, dark mode, the app theme and sign out.'],
      ['17b-settings-pantry.png', 'Theme: Mediterranean Pantry', 'The same Settings screen with the Mediterranean Pantry theme applied: olive, tomato red and leaf green on cream.'],
      ['17c-menu-pantry.png', 'Menu in Mediterranean Pantry', 'The menu under the alternative theme, to show the change runs across the whole app and isn’t limited to one screen.'],
      ['18-help.png', 'Help & Support', 'Direct email support and a shortcut to the cancellation and holiday policy.'],
      ['19-policy.png', 'Cancellation & Holiday Policy', 'The rules in plain language: the 9:00 AM cutoff, no changes or refunds after it, public-holiday closures and how batch drop-off works.'],
      ['20-signout-confirm.png', 'Sign Out', 'Signing out always asks first, so a stray tap doesn’t log anyone out.'],
    ],
  },
  {
    label: 'Kitchen operations hub',
    spec: 'Admin · Overview · Active Orders · Companies · Notifications · Menu Catalog · Users · Reports · Settings',
    intent: 'The kitchen and admin team’s console. The pills along the top switch between its sections, and a live clock with a 9AM Cutoff badge sits in every header. Customer orders are grouped by company and delivery day, so the kitchen manages each company’s order for the day as one batch.',
    screens: [
      ['21-admin-overview.png', 'Kitchen Operations Hub', 'Today’s deliveries and revenue, active orders, all-time and month-to-date revenue, and upcoming deliveries with a bulk status update for a whole filtered batch.'],
      ['22-admin-active-orders.png', 'Active Orders', 'Every open order, filtered by company and delivery date, with a status update per order. Empty here: the demo data has no open orders today.'],
      ['22b-admin-export-sheet.png', 'Export', 'One Export button for everything the kitchen prints: production sheet as PDF or Excel, delivery notes, invoices, and a printable order sheet.'],
      ['23-admin-prep-summary.png', 'Prep Summary', 'Total quantity needed per dish across every matching order, for bulk kitchen prep rather than plating one order at a time.'],
      ['25-admin-companies.png', 'Companies & Locations', 'Each client company with its meal subsidy and delivery-fee rule, buttons for suspending the company, editing financials, delivery and email domains, and its registered delivery locations with distance from the kitchen.'],
      ['26-admin-notifications.png', 'Broadcast Notifications', 'Write a push notification for all customers or one company, with a history of what was sent and when.'],
      ['27-admin-menu.png', 'Menu Catalog', 'The permanent menu: add, edit or delete dishes, and switch any dish on or off.'],
      ['28-admin-cycle-menu.png', 'Cycle Menu', 'The eight-week rotation. Browse any week, set it as the active week, and edit or remove each day’s slot dishes.'],
      ['29-admin-users.png', 'User Management', 'Search and filter accounts by role, add a user, change a role, or suspend an account.'],
      ['30-admin-reports.png', 'Reports & Analytics', 'Revenue, orders, meals and average order value against the previous period. Below that, where the revenue comes from (customers or company subsidies) and what discounts gave away. Filter by date, company and category, then export.'],
      ['31-admin-settings.png', 'Admin Settings', 'The same preferences as the customer app, from the admin side.'],
      ['32-admin-customer-view.png', 'Customer View', 'Admins can preview the customer app exactly as customers see it, with a banner and a one-tap way back to the hub.'],
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&family=Playfair+Display:wght@400;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --ground:#FFFFFF;
  --panel:#F7F2E8;
  --line:#E5DFD3;
  --text:#121212;
  --muted:#4E4E4E;
  --dim:#888888;
  --f:'Open Sans','Segoe UI',system-ui,sans-serif;
  --m:'IBM Plex Mono',ui-monospace,Consolas,monospace;
}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--text);font-family:var(--f);margin:0;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1240px;margin-inline:auto;padding:0 clamp(1rem,4vw,2.5rem) 5rem}

header{padding:clamp(3rem,8vw,5.5rem) 0 clamp(2rem,5vw,3.5rem);border-bottom:1px solid var(--line)}
.mark{font-family:'Playfair Display',Georgia,serif;font-size:clamp(1.6rem,4vw,2.2rem);font-weight:400}
.mark b{font-weight:700}
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
.nw{white-space:nowrap}
.fdown{display:block;text-align:center;color:var(--dim);font-size:.9rem;line-height:1;margin:.3rem 0}
.fchips{display:flex;flex-wrap:wrap;gap:.35rem;margin:.55rem 0 0 1.25rem}
.fchip{font-size:.75rem;color:var(--muted);border:1px dashed #CFC7B6;border-radius:7px;
  padding:.32rem .55rem;background:transparent}

/* Palette & type */
.swgroup{font-family:var(--m);font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--dim);margin:0 0 .7rem}
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
  /* Anything that reads as a single panel must never be sliced across a page break. */
  .phone,figcaption,.lane,.swatches,.sw,.ty,.typerow,.fstep,.fchips,footer{
    break-inside:avoid;page-break-inside:avoid}
  /* A section heading stays whole and stays with the content it introduces. */
  .shead{break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid}
  header{break-after:page;page-break-after:always}
  /* Caption beside each phone, two pairs a row: three rows fit an A4 page.
     Stacked captions made each row just over half a page, so pages held one. */
  .grid{grid-template-columns:repeat(2,1fr);gap:1.2rem 1.6rem}
  .phone{flex-direction:row;align-items:flex-start;gap:.9rem}
  .frame{flex:none;width:138px;border-radius:20px;padding:6px 5px 8px}
  .bezel{height:10px}
  .frame img{border-radius:12px}
  figcaption{padding-top:.6rem}
  figcaption b{font-size:.9rem}
  figcaption .note{font-size:.76rem;line-height:1.5}
  section{padding-top:1.6rem}
  .shead{margin-bottom:1.2rem}
  /* Flow map and design system each own a page, so neither heading is stranded. */
  section.solo{break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid}
  section.solo + section{break-before:page;page-break-before:always}
  /* The frame shadow of the first phone on a page bleeds a hairline onto the page before. */
  .frame{box-shadow:none}
  @page{margin:14mm}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <header>
    <div class="mark">your kitchen <b>co.</b></div>
    <div class="rule"></div>
    <h1>Prototype &amp; <em>screen flow</em></h1>
    <p class="sub">Every page of the customer ordering app and the kitchen operations hub, captured from the running build on ${CAPTURED}. Menus, orders, people and companies shown are demo data, not production records. Payment runs in PayFast&rsquo;s test mode.</p>
  </header>

  <section class="solo">
    <div class="shead">
      <span class="slabel">Screen flow</span>
      <span class="spec-ref">How the pages connect</span>
      <p class="sintent">Two journeys from one sign-in screen. Customers pick a delivery day, order and pay, then track. The kitchen team works from the operations hub. The numbers match the screens that follow.</p>
    </div>
    <div class="flow">
      <div class="lane">
        <span class="lanelabel">Customer</span>
        <div class="fstep"><span class="num">01</span><span class="lbl">Sign In <em>&mdash; or Create Account <span class="nw">(02&ndash;05)</span></em></span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">06</span><span class="lbl">Delivery Day</span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">07</span><span class="lbl">Menu <em>&mdash; Main or Cycling <span class="nw">(07&ndash;09)</span></em></span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">11</span><span class="lbl">Dish <em>&mdash; day, extras, notes <span class="nw">(10&ndash;13)</span></em></span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">14</span><span class="lbl">Basket <em>&mdash; subsidy, discount, delivery</em></span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">15</span><span class="lbl">Payment <em>&mdash; PayFast <span class="nw">(15&ndash;16)</span></em></span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">17</span><span class="lbl">Order Scheduled &amp; Paid</span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">18</span><span class="lbl">Orders <em>&mdash; active, history, invoice <span class="nw">(18&ndash;20)</span></em></span></div>
        <div class="fchips">
          <span class="fchip">Profile 21</span>
          <span class="fchip">Settings &amp; theme 22&ndash;24</span>
          <span class="fchip">Help 25</span>
          <span class="fchip">Policy 26</span>
          <span class="fchip">Sign out 27</span>
        </div>
      </div>
      <div class="lane">
        <span class="lanelabel">Kitchen &amp; admin</span>
        <div class="fstep"><span class="num">01</span><span class="lbl">Sign In</span></div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">28</span><span class="lbl">Kitchen Operations Hub</span></div>
        <div class="fchips">
          <span class="fchip">Active Orders 29</span>
          <span class="fchip">Export 30</span>
          <span class="fchip">Prep Summary 31</span>
          <span class="fchip">Companies 32</span>
          <span class="fchip">Notifications 33</span>
          <span class="fchip">Menu Catalog 34</span>
          <span class="fchip">Cycle Menu 35</span>
          <span class="fchip">Users 36</span>
          <span class="fchip">Reports 37</span>
          <span class="fchip">Settings 38</span>
        </div>
        <span class="fdown">&darr;</span>
        <div class="fstep"><span class="num">39</span><span class="lbl">Customer View <em>&mdash; preview, then back to the hub</em></span></div>
      </div>
    </div>
  </section>

  <section class="solo">
    <div class="shead">
      <span class="slabel">Design system</span>
      <span class="spec-ref">Two themes &amp; typography</span>
      <p class="sintent">Ink &amp; Cream is the default look: near-black ink on warm cream. Mediterranean Pantry is the alternative, switched on from Settings. Both have a light and a dark mode.</p>
    </div>
    <p class="swgroup">Ink &amp; Cream &mdash; default</p>
    <div class="swatches">
      <figure class="sw"><span class="chip" style="background:#121212"></span><b>#121212</b><span class="note">Ink. Text, primary buttons, selected states and the tab bar.</span></figure>
      <figure class="sw"><span class="chip" style="background:#F7F2E8"></span><b>#F7F2E8</b><span class="note">Cream. Screen background.</span></figure>
      <figure class="sw"><span class="chip" style="background:#FFFFFF"></span><b>#FFFFFF</b><span class="note">Cards and input fields.</span></figure>
      <figure class="sw"><span class="chip" style="background:#E5DFD3"></span><b>#E5DFD3</b><span class="note">Card borders and dividers.</span></figure>
    </div>
    <p class="swgroup">Mediterranean Pantry &mdash; alternative</p>
    <div class="swatches">
      <figure class="sw"><span class="chip" style="background:#363C1E"></span><b>#363C1E</b><span class="note">Olive. Header and tab bar.</span></figure>
      <figure class="sw"><span class="chip" style="background:#D53220"></span><b>#D53220</b><span class="note">Tomato red. Primary buttons and prices.</span></figure>
      <figure class="sw"><span class="chip" style="background:#507B45"></span><b>#507B45</b><span class="note">Leaf green. Secondary accents and switches.</span></figure>
      <figure class="sw"><span class="chip" style="background:#FBF7E7"></span><b>#FBF7E7</b><span class="note">Pantry cream. Screen background.</span></figure>
    </div>
    <p class="ruleline"><b>Status colours are not brand colours.</b> They stay the same in both themes so order states read instantly: blue <b>#1E88E5</b> preparing, amber <b>#FB8C00</b> out for delivery, green <b>#43A047</b> delivered, red <b>#DC2626</b> errors and destructive actions.</p>
    <div class="typerow">
      <div class="ty"><b style="font-family:'Playfair Display',Georgia,serif;font-weight:400">your kitchen <span style="font-weight:700">co.</span></b><span class="note">Playfair Display. The wordmark at the top of the main screens.</span></div>
      <div class="ty"><b>Open Sans</b><span class="note">Every other piece of text in the app, from headings to fine print.</span></div>
    </div>
  </section>
${body}
  <footer>
    <div>your kitchen co. &middot; prototype &amp; screen flow &middot; v8</div>
    <div>${total} screens &middot; captured ${CAPTURED}</div>
    <div class="changelog">New in v8: re-captured end to end after the app was rebuilt. Adds the delivery-day picker, Cycling Menu, payment and order confirmation, tax invoice, Help, Cancellation Policy and the Mediterranean Pantry theme, plus the new kitchen operations hub: Overview, Active Orders, Export, Prep Summary, Companies, Notifications, Menu Catalog, Cycle Menu, Users, Reports, Settings and Customer View.</div>
  </footer>
</div>
`;

fs.writeFileSync(OUT, html);
console.log('[build] wrote', OUT, (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB,', total, 'screens');
