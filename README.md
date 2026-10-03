# Kitchen Co.

A corporate meal-ordering app built with Expo / React Native on a Supabase
backend. Its screens and behaviour mirror the **YourKitchenCo** .NET MAUI app
(`qwertystig/KitchenCO`, `main`) one-for-one: customers pick a delivery day,
browse the static and 8-week cycling menus, check out, and track orders, while
admins run the kitchen from the "Central Command" admin shell.

## Features

- **Delivery day first** — after sign-in, customers choose which day they're ordering for
- **Menu** — Main Menu / Cycling Menu toggle, category slider with hero banners, search
- **Dish detail** — size and add-on options, special requests, and an allergy "chef alert"
- **Basket & checkout** — company meal subsidy, discounts, distance-based delivery fee,
  then Card (demo) or PayFast (sandbox) payment, order confirmation and SARS tax invoice
- **Orders** — Active (4-stage delivery tracker) and History (ratings, reorder, invoices,
  report an issue)
- **Admin** — Overview hub, Active Orders + kitchen prep summary and print sheets, Companies
  & locations (subsidy, discount, email domains), Discount codes, Broadcast notifications,
  Menu catalog + cycle-menu editor, User management, Reports & analytics
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
    (tabs)/             Menu, Orders (Active / History), Profile
    admin/              Admin shell: Overview, Active Orders, Companies, Discounts,
                        Notifications, Menu Catalog, Users, Reports, Settings
    login, register, select-date, product, cart, payment,
    order-confirmation, tax-invoice, settings, help, cancellation-policy
  components/          Shared UI (MAUI control styles, branded popups, admin nav, charts)
  services/            Data + business rules (Supabase-backed: catalog, orders,
                       directory, promos, pricing, scheduling, auth, PayFast)
  state/               App-wide session/cart/settings state, page hand-off params
  lib/supabase/        Supabase client
supabase/
  migrations/          Schema, RLS, RPCs (0001–0008)
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
notes, broadcast audience, re-rateable orders).

Other scripts:

```bash
npm run lint        # ESLint
npm run ts:check    # TypeScript check
node tools/verify-maui-port.js   # read-only web walkthrough (needs `npx expo start --web`)
```

## Status

- Card payment is a demo checkout, as in the MAUI app. PayFast uses PayFast's
  public **sandbox** credentials in `src/services/payfast.ts` — swap in the real
  merchant id/key and production URL, and confirm payments via PayFast's ITN
  callback server-side, before going live.
