// Assembles the captured screens into a single self-contained UI/UX showcase page.
const fs = require('fs');
const path = require('path');

const SHOTS = path.join(__dirname, 'shots');
const OUT = process.argv[2] || path.join(__dirname, 'kitchenco-ui.html');

const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, f)).toString('base64');

const SECTIONS = [
  {
    label: 'Onboarding',
    intent: 'Account creation resolves the employer automatically from the work-email domain — no invite codes, no company picker.',
    screens: [
      ['01-signin.png', 'Sign In', 'Segmented Sign In / Sign Up, remember-me, password reveal and a dev bypass. The full logo lockup appears here only.'],
      ['02-signup.png', 'Sign Up', 'Company account type selected, and typing an @ecogra.org address surfaces the live "Joining as Ecogra" match beneath the field.'],
    ],
  },
  {
    label: 'Menu & discovery',
    intent: 'Two menus on one screen, switched by a single toggle — and they book different distances ahead. The Main Menu catalogue never changes, so it can be pre-ordered up to 2 weeks out; the cycle menu is set week by week, so Today’s Menu caps at 1 week. Both close at 9:00 AM, at least 2 business days before delivery.',
    screens: [
      ['03-menu-main.png', 'Main Menu', 'The permanent à la carte catalogue — orderable up to 2 weeks ahead. Search, Main / Today toggle, category chips, cutoff banner and the dish grid with quick-add.'],
      ['04-menu-category.png', 'Category Filter', 'Filtering to Ciao Italy narrows the grid in place — the category chip stays selected and the toggle never moves.'],
      ['06-todays-menu.png', "Today's Menu", 'The rotating cycle menu, addressed by delivery date and capped at 1 week ahead — its content is set week by week, so it can’t be committed further out. Pick one or more days and each day’s meals appear in their own section.'],
    ],
  },
  {
    label: 'Ordering',
    intent: 'Every decision that changes price, production or delivery is made in one modal, so the menu grid stays clean.',
    screens: [
      ['05-customize.png', 'Customize Order', 'Portion, paid extras, pre-scheduled delivery days and allergy notes — with the CTA carrying the live line total.'],
      ['05b-deliver-on.png', 'Pre-schedule Delivery', 'The same modal, scrolled: pick several weekdays in one go, up to 2 weeks ahead, bucketed by week. Only dates that clear the 9&nbsp;AM two-business-day cutoff are offered, so an invalid order is impossible rather than rejected. Each day picked becomes its own cart line at the chosen quantity.'],
      ['07-add-meal.png', 'Add Meal', 'The reduced customiser for cycle meals: no size picker, no date picker, because the date is already fixed by the strip behind it.'],
      ['08-cart.png', 'Cart', 'WELCOME10 auto-applied with per-line savings shown, a delivery-fee prompt when no address is set, and the cutoff notice above checkout.'],
    ],
  },
  {
    label: 'Account & tracking',
    intent: 'After checkout the app answers one question at a time: where is it, what did I order before, and what is saved to my account.',
    screens: [
      ['10-orders.png', 'Order Status', 'Four-stage tracker — Received, Preparing, Out for delivery, Delivered — with a proportional progress bar and the full receipt beneath.'],
      ['09-activity.png', 'Activity', 'Reverse-chronological order history with one-tap reorder, blocked with an explanation where the order contains rotating cycle items.'],
      ['11-profile.png', 'Profile', 'Account and company affiliation, theme control, notification toggles, saved delivery addresses and saved cards.'],
    ],
  },
  {
    label: 'Kitchen & admin console',
    intent: 'Every admin surface that lists orders groups them by corporate client — a batch of forty is one unit of work, not forty.',
    screens: [
      ['12-admin-dashboard.png', 'Dashboard', 'Today’s operational tiles lead; period statistics for users, orders, in-progress work and revenue follow beneath.'],
      ['15-admin-chef.png', 'Chef’s Kitchen', 'The production sheet: grand totals across the day, then per-client prep totals and special requests, emailable per client.'],
      ['14-admin-orders.png', 'Orders Register', 'The full order record, grouped under company headers with individual order detail preserved underneath.'],
      ['16-admin-weeks.png', 'Cycle Weeks', 'Sets which of the eight rotation weeks is live — the value customer-facing future menus project forward from.'],
      ['19-admin-companies.png', 'Companies', 'Corporate clients with their matching email domains, registered sites and per-meal subsidy.'],
      ['18-admin-discounts.png', 'Discounts', 'Percentage codes with expiry and active state, optionally targeted at a company, a category or a single dish.'],
      ['17-admin-meals.png', 'Meals', 'The live catalogue by category, with price points and per-category paid extras.'],
      ['13-admin-users.png', 'Users', 'Registered accounts with account type, matched company, join date and lifetime order count.'],
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
        <p class="sintent">${s.intent}</p>
      </div>
      <div class="grid">${s.screens.map((sc) => phone(sc[0], sc[1], sc[2], ++n)).join('')}
      </div>
    </section>`).join('');

const html = `<title>Kitchen Co. Screen Flow</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --ground:#0C0D0B;
  --panel:#161814;
  --line:#272A22;
  --text:#F2F3EE;
  --muted:#9A9E92;
  --dim:#6E7268;
  --sage:#C4D29B;
  --red:#AF1718;
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
.rule{width:34px;height:3px;background:var(--red);margin:.7rem 0 1.6rem;border-radius:2px}
h1{font-size:clamp(2.1rem,6.5vw,4rem);font-weight:800;letter-spacing:-.035em;line-height:1.02;
  margin:0 0 1rem;text-wrap:balance;max-width:16ch}
h1 em{font-style:normal;color:var(--sage)}
.sub{color:var(--muted);font-size:clamp(1rem,2.2vw,1.15rem);font-weight:400;max-width:58ch;
  line-height:1.6;margin:0 0 2rem}
.facts{display:flex;flex-wrap:wrap;gap:0;border-top:1px solid var(--line)}
.facts div{padding:.9rem 1.6rem .9rem 0;margin-right:1.6rem;border-right:1px solid var(--line)}
.facts div:last-child{border-right:0}
.facts dt{font-family:var(--m);font-size:.64rem;letter-spacing:.15em;text-transform:uppercase;
  color:var(--dim);margin-bottom:.25rem}
.facts dd{margin:0;font-size:.92rem;font-weight:600}

section{padding-top:clamp(2.5rem,6vw,4.5rem)}
.shead{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem 1.5rem;margin-bottom:2rem;
  padding-bottom:1rem;border-bottom:1px solid var(--line)}
.slabel{font-family:var(--m);font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;
  color:var(--sage);white-space:nowrap}
.sintent{margin:0;color:var(--muted);font-size:.95rem;line-height:1.55;max-width:66ch;flex:1 1 22rem}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));
  gap:clamp(1.5rem,3vw,2.5rem)}
.phone{margin:0;display:flex;flex-direction:column;gap:.95rem}
.frame{background:#000;border:1px solid #2E312A;border-radius:26px;padding:9px 7px 11px;
  box-shadow:0 18px 44px -22px rgba(0,0,0,.95);position:relative}
.bezel{height:15px;display:flex;align-items:center;justify-content:center}
.speaker{display:block;width:42px;height:4px;border-radius:3px;background:#24261F}
.frame img{display:block;width:100%;height:auto;border-radius:16px;background:#fff}

figcaption{display:flex;flex-direction:column;gap:.3rem}
figcaption .n{font-family:var(--m);font-size:.68rem;letter-spacing:.1em;color:var(--sage)}
figcaption b{font-size:1rem;font-weight:700;letter-spacing:-.01em}
figcaption .note{font-size:.85rem;line-height:1.55;color:var(--muted);font-weight:400}

footer{margin-top:clamp(3rem,7vw,5rem);padding-top:1.4rem;border-top:1px solid var(--line);
  display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;
  font-family:var(--m);font-size:.72rem;color:var(--dim)}

@media print{
  body{background:#fff;color:#000}
  .frame{box-shadow:none;border-color:#999}
  .sintent,figcaption .note{color:#444}
  .slabel,figcaption .n{color:#5C6B33}
  .facts dt{color:#666}
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
    <h1>UI / UX <em>screen flow</em></h1>
    <p class="sub">Every screen of the corporate ordering app and the kitchen operations console, captured from the running build at 390&nbsp;&times;&nbsp;844. Menus, orders and companies shown are seeded demo data, not production records.</p>
    <dl class="facts">
      <div><dt>Screens</dt><dd>${total}</dd></div>
      <div><dt>Platform</dt><dd>Expo &middot; React Native</dd></div>
      <div><dt>Viewport</dt><dd>390 &times; 844 @2x</dd></div>
      <div><dt>Captured</dt><dd>5 September 2026</dd></div>
    </dl>
  </header>
${body}
  <footer>
    <div>your kitchen co. &middot; UI/UX screen flow</div>
    <div>${total} screens &middot; captured from the running build</div>
  </footer>
</div>
`;

fs.writeFileSync(OUT, html);
console.log('[build] wrote', OUT, (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB');
