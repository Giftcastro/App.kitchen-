# Kitchen Co.

A food ordering app built with Expo / React Native, styled with a black-and-white,
Uber-inspired design. Customers browse the menu, customize items with add-ons,
check out through PayFast, and track orders — while admins and kitchen staff
manage orders from dedicated views in the same app.

## Features

- **Menu & ordering** — browse the static menu and the rotating cycle menu, customize
  items with per-item add-ons, see full ingredient text for allergy safety
- **Delivery** — distance-based delivery fees and a 2-business-day, 9am order cutoff rule
- **Checkout** — PayFast payment flow (currently wired to PayFast's sandbox), saved cards
- **Order tracking** — live order status for customers on the Tracker tab
- **Admin dashboard** — "Today at a Glance" summary, order management
- **Chef Kitchen view** — prep list and order queue for kitchen staff
- **Push + email notifications** — order confirmation on successful payment

## Tech stack

- [Expo](https://expo.dev) SDK 54 / [Expo Router](https://docs.expo.dev/router/introduction/) (file-based navigation)
- React 19, React Native 0.81
- TypeScript
- react-native-webview (PayFast checkout), expo-notifications

## Project structure

```
src/
  app/                 Screens (expo-router file-based routes)
    (tabs)/             Menu, Activity, Tracker, Profile, Admin tabs
    cart.tsx, login.tsx, payfast.tsx
  components/          Shared UI components
  context/             App-wide state (KitchenCoContext)
  data/                Static + cycle menu data
  utils/               Delivery, discount, and menu helpers
```

## Getting started

```bash
npm install
npm run start      # or: npm run android / npm run ios / npm run web
```

Other scripts:

```bash
npm run lint        # ESLint
npm run ts:check    # TypeScript check
```

## Status

- Payment checkout currently uses PayFast's public **sandbox** credentials and
  placeholder return/cancel URLs in `src/app/payfast.tsx` — swap these for the
  real merchant credentials before going live.
