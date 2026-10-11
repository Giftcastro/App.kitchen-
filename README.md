# Kitchen Co.

A corporate meal-ordering app built with Expo / React Native on a Supabase
backend. Its screens and behaviour mirror the **YourKitchenCo** .NET MAUI app
(`qwertystig/KitchenCO`, `main`) one-for-one: customers pick a delivery day,
browse the static and 8-week cycling menus, check out, and track orders, while
admins run the kitchen from the "Central Command" admin shell.

## Features

- **Delivery day first** — after sign-in, customers choose which day they're ordering for
  (or skip / jump to their orders); the Menu's 📅 pill changes it later
- **Menu** — Main Menu / Cycling Menu toggle, category slider with hero banners, search
- **Dish detail** — size, sides, extras & sauces, and one special-requests box (anything
  mentioning an allergy is flagged to the chef)
- **Basket & checkout** — company meal subsidy, discounts, delivery fee (the company's own
  free / flat setting, otherwise by distance), PayFast (sandbox) payment, order confirmation,
  and an invoice to download as PDF or share as text
- **Orders** — Active (grouped by delivery day, collapsible cards with the 4-stage tracker)
  and History (ratings, reorder, invoices, report an issue)
- **App Theme** — Settings switches between Mediterranean Pantry and Ink & Cream, each
  with light and dark variants
- **Admin** — Overview hub (today / all-time / month-to-date revenue), Active Orders with
  prep summary and downloads (production sheet PDF/Excel, delivery notes, the day's
  invoices), Companies & locations (subsidy, discount, delivery fee, email domains),
  Broadcast notifications, Menu catalog + cycle-menu editor, Users (+ Add User), Reports
  (Top/Bottom 10, more reports, Excel downloads), and Customer View to preview the
  customer app without signing out
- **Order rules** — 9:00 AM cutoff, delivery two business days out; enforced again by the
  database's `place_order`

## Tech stack

- [Expo](https://expo.dev) / [Expo Router](https://docs.expo.dev/router/introduction/) (file-based navigation), TypeScript
- [Supabase](https://supabase.com) — Auth, Postgres with row-level security, and security-definer RPCs for all order writes
- Open Sans, react-native-svg (report charts), react-native-webview (PayFast checkout)

## Project structure

```
src/
  app/                 Screens (expo-router routes), one per MAUI page
    (tabs)/             One stack per tab, as MAUI's Shell pushes pages inside the tab:
      (menu)/             Menu, product, cart, payment, order-confirmation, invoice
      orders/             Orders (Active / History), invoice
      profile/            My Profile, settings, help, cancellation-policy
    admin/              Admin shell: Overview, Active Orders, Companies, Notifications,
                        Menu Catalog, Users, Reports, Settings
    login, register, select-date
  screens/             Pages shared by more than one route (the invoice)
  components/          Shared UI (MAUI control styles, branded popups, admin nav, charts)
  services/            Data + business rules (Supabase-backed: catalog, orders,
                       directory, promos, pricing, scheduling, auth, PayFast) and
                       dependency-free PDF / Excel exports
  state/               App-wide session/cart/settings state, page hand-off params
  lib/supabase/        Supabase client
supabase/
  migrations/          Schema, RLS, RPCs (0001–0009)
  seed/                Menu import + demo data
```

## Getting started

```bash
npm install
cp .env.example .env   # set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run start          # or: npm run android / npm run ios / npm run web
```

Apply every file in `supabase/migrations/` (in order) to the Supabase project
before running the app — `0008_maui_parity.sql` adds the columns and RPC
changes the MAUI-parity screens rely on (Register's company/location pickers,
company billing/active/discount, user suspension, delivery floor, allergy
notes, broadcast audience, re-rateable orders), and
`0009_company_delivery_fee.sql` adds each company's delivery-fee setting (free /
flat / distance) and makes `place_order` charge it.

Other scripts:

```bash
npm run lint        # ESLint
npm run ts:check    # TypeScript check
node tools/verify-maui-port.js   # read-only web walkthrough (needs `npx expo start --web`)
# MOCK=/path/to/stub.js node tools/verify-maui-port.js  — same, against a stub backend module
```

## Status

- Checkout is PayFast only, as in the MAUI app. PayFast uses PayFast's
  public **sandbox** credentials in `src/services/payfast.ts` — swap in the real
  merchant id/key and production URL, and confirm payments via PayFast's ITN
  callback server-side, before going live.
