// One-off data import: loads src/data/staticMenu.json + cycleMenu.json into
// the real schema. Run once against a fresh project (safe to re-run —
// it's idempotent per category/item name).
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node supabase/seed/import-menu.mjs
//
// Deliberately takes the service_role key via env, not the app's
// EXPO_PUBLIC_* vars — this bypasses RLS on purpose (menu writes are
// admin-only) and must never run on-device.

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'src', 'data');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function parsePriceString(raw) {
  return parseFloat(String(raw).replace(/[^\d.]/g, '')) || 0;
}

// Mirrors src/utils/menuNormalize.ts's size-labeling rule exactly, so the
// imported catalog matches what the app has always shown.
function normalizeSizes(rawItem) {
  if (Array.isArray(rawItem.sizes)) {
    return rawItem.sizes.map((s) => ({ label: s.label || 'Regular', price: Number(s.price) || 0 }));
  }
  if (rawItem.price !== undefined && rawItem.price !== null) {
    return [{ label: 'Regular', price: parsePriceString(rawItem.price) }];
  }
  if (Array.isArray(rawItem.prices)) {
    const labels = rawItem.prices.length === 2 ? ['Standard', 'Large'] : null;
    return rawItem.prices.map((p, idx) => ({
      label: labels ? labels[idx] : idx === 0 ? 'Regular' : `Option ${idx + 1}`,
      price: parsePriceString(p),
    }));
  }
  return [{ label: 'Regular', price: 0 }];
}

const WEEKDAY_MAP = { Monday: 'mon', Tuesday: 'tue', Wednesday: 'wed', Thursday: 'thu', Friday: 'fri' };
const SLOT_MAP = {
  'MAIN MEAL': 'main',
  'VEGETARIAN MEAL': 'vegetarian',
  'HEALTHY MEAL': 'healthy',
  'CURRY OF THE DAY': 'curry',
  'GOURMET SANDWICH': 'gourmet_sandwich',
};

async function importStaticMenu() {
  const raw = JSON.parse(await readFile(path.join(dataDir, 'staticMenu.json'), 'utf8'));
  const icons = raw._icons || {};
  const addOnsByCategory = raw._addOns || {};

  let sortOrder = 0;
  for (const [categoryName, items] of Object.entries(raw)) {
    if (categoryName.startsWith('_') || !Array.isArray(items)) continue;

    const { data: category, error: categoryError } = await supabase
      .from('menu_categories')
      .upsert({ name: categoryName, icon: icons[categoryName] ?? null, sort_order: sortOrder++ }, { onConflict: 'name' })
      .select()
      .single();
    if (categoryError) throw categoryError;

    for (const rawItem of items) {
      const { data: menuItem, error: itemError } = await supabase
        .from('menu_items')
        .upsert(
          {
            category_id: category.id,
            name: rawItem.name || 'Unnamed Item',
            description: rawItem.description || null,
            tags: Array.isArray(rawItem.tags) ? rawItem.tags : [],
            source: 'static',
          },
          { onConflict: 'category_id,name' }
        )
        .select()
        .single();
      if (itemError) throw itemError;

      const sizes = normalizeSizes(rawItem);
      for (const size of sizes) {
        const { error: sizeError } = await supabase.from('menu_item_sizes').upsert(
          { menu_item_id: menuItem.id, label: size.label, price_cents: Math.round(size.price * 100) },
          { onConflict: 'menu_item_id,label' }
        );
        if (sizeError) throw sizeError;
      }
    }

    const addOns = Array.isArray(addOnsByCategory[categoryName]) ? addOnsByCategory[categoryName] : [];
    for (const addOn of addOns) {
      const { error: addOnError } = await supabase.from('menu_item_addons').upsert(
        { category_id: category.id, name: addOn.name, price_cents: Math.round(Number(addOn.price) * 100) },
        { onConflict: 'category_id,name' }
      );
      if (addOnError) throw addOnError;
    }

    console.log(`  ✓ ${categoryName} (${items.length} items, ${addOns.length} add-ons)`);
  }
}

async function importCycleMenu() {
  const raw = JSON.parse(await readFile(path.join(dataDir, 'cycleMenu.json'), 'utf8'));

  for (const [weekLabel, days] of Object.entries(raw)) {
    const weekNumber = parseInt(weekLabel.replace(/\D/g, ''), 10);
    for (const day of days) {
      const dayOfWeek = WEEKDAY_MAP[day.DAY];
      if (!dayOfWeek) continue;

      for (const [rawSlot, slot] of Object.entries(SLOT_MAP)) {
        const itemName = day[rawSlot];
        if (!itemName) continue;
        const { error } = await supabase.from('cycle_menu_slots').upsert(
          { week_number: weekNumber, day_of_week: dayOfWeek, slot, item_name: itemName },
          { onConflict: 'week_number,day_of_week,slot' }
        );
        if (error) throw error;
      }
    }
    console.log(`  ✓ ${weekLabel}`);
  }
}

console.log('Importing static menu...');
await importStaticMenu();
console.log('Importing cycle menu...');
await importCycleMenu();
console.log('Done.');
