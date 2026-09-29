import { supabase } from './client';
import type { NormalizedMenuItem, AddOnOption } from '../../utils/menuNormalize';

export interface MenuCategoryFromDb {
  id: string;
  name: string;
  items: NormalizedMenuItem[];
  addOns?: AddOnOption[];
}

/** Same shape the app's menu_categories/menu_items/menu_item_sizes/menu_item_addons tables produce. */
export async function fetchMenuCategories(): Promise<MenuCategoryFromDb[]> {
  const { data: categories, error: catError } = await supabase
    .from('menu_categories')
    .select('id, name, sort_order')
    .order('sort_order');
  if (catError) throw catError;

  const { data: items, error: itemsError } = await supabase
    .from('menu_items')
    .select('id, category_id, name, description, image_url, tags, active, menu_item_sizes(label, price_cents)');
  if (itemsError) throw itemsError;

  const { data: addons, error: addonsError } = await supabase
    .from('menu_item_addons')
    .select('category_id, name, price_cents');
  if (addonsError) throw addonsError;

  return (categories ?? []).map(cat => ({
    id: cat.id,
    name: cat.name,
    items: (items ?? [])
      .filter(item => item.category_id === cat.id)
      .map((item): NormalizedMenuItem => ({
        id: item.id,
        name: item.name,
        description: item.description ?? '',
        image: item.image_url ?? undefined,
        tags: item.tags && item.tags.length > 0 ? item.tags : undefined,
        active: item.active,
        sizes: (item.menu_item_sizes ?? []).map((s: { label: string; price_cents: number }) => ({
          label: s.label,
          price: s.price_cents / 100,
        })),
      })),
    addOns: (() => {
      const forCategory = (addons ?? [])
        .filter(a => a.category_id === cat.id)
        .map(a => ({ name: a.name, price: a.price_cents / 100 }));
      return forCategory.length > 0 ? forCategory : undefined;
    })(),
  }));
}

/** Postgres unique-violation code — menu_items has `unique (category_id, name)`. */
const DUPLICATE_NAME = '23505';

/**
 * Admin-only (menu_items_write_admin / menu_item_sizes_write_admin in
 * 0002). The admin form only ever collects a single price, so every write
 * here represents it as one 'Regular' size row, collapsing whatever sizes
 * existed before — same lossy behavior the old local-only version had.
 */
export async function adminCreateMenuItem(
  categoryId: string,
  item: { name: string; price: number; description: string; image?: string }
): Promise<void> {
  const { data: menuItem, error } = await supabase
    .from('menu_items')
    .insert({
      category_id: categoryId,
      name: item.name,
      description: item.description || null,
      image_url: item.image || null,
      active: true,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === DUPLICATE_NAME) throw new Error(`A dish named "${item.name}" already exists in this category.`);
    throw error;
  }

  const { error: sizeErr } = await supabase
    .from('menu_item_sizes')
    .insert({ menu_item_id: menuItem.id, label: 'Regular', price_cents: Math.round(item.price * 100) });
  if (sizeErr) throw sizeErr;
}

export async function adminUpdateMenuItem(
  itemId: string,
  item: { name: string; price: number; description: string; image?: string }
): Promise<void> {
  const { error } = await supabase
    .from('menu_items')
    .update({ name: item.name, description: item.description || null, image_url: item.image || null })
    .eq('id', itemId);
  if (error) {
    if (error.code === DUPLICATE_NAME) throw new Error(`A dish named "${item.name}" already exists in this category.`);
    throw error;
  }

  const { error: deleteSizesErr } = await supabase.from('menu_item_sizes').delete().eq('menu_item_id', itemId);
  if (deleteSizesErr) throw deleteSizesErr;
  const { error: insertSizeErr } = await supabase
    .from('menu_item_sizes')
    .insert({ menu_item_id: itemId, label: 'Regular', price_cents: Math.round(item.price * 100) });
  if (insertSizeErr) throw insertSizeErr;
}

/** Pulls a dish off the customer menu without deleting it. */
export async function adminSetMenuItemActive(itemId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('menu_items').update({ active }).eq('id', itemId);
  if (error) throw error;
}

/**
 * Cascades to menu_item_sizes. order_items.menu_item_id (SET NULL) and
 * discounts.item_id (CASCADE) also reference this row (see 0001) — a past
 * order keeps its own name/price snapshot regardless, and any discount
 * narrowly targeting this exact dish goes with it.
 */
export async function adminDeleteMenuItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function fetchCycleItemPriceRands(): Promise<number> {
  const { data } = await supabase.from('pricing_config').select('value_cents').eq('key', 'cycle_item_price').single();
  return (data?.value_cents ?? 8000) / 100;
}

const DB_DAY_TO_NAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };
const DB_SLOT_TO_KEY: Record<string, string> = {
  main: 'MAIN MEAL',
  vegetarian: 'VEGETARIAN MEAL',
  healthy: 'HEALTHY MEAL',
  curry: 'CURRY OF THE DAY',
  gourmet_sandwich: 'GOURMET SANDWICH',
};
const NAME_TO_DB_DAY: Record<string, string> = Object.fromEntries(Object.entries(DB_DAY_TO_NAME).map(([k, v]) => [v, k]));
const KEY_TO_DB_SLOT: Record<string, string> = Object.fromEntries(Object.entries(DB_SLOT_TO_KEY).map(([k, v]) => [v, k]));

/** "Monday" -> "mon", for turning a cycle-menu display day back into the DB enum when adding to cart. */
export function dayNameToDbDay(name: string): string | undefined {
  return NAME_TO_DB_DAY[name];
}

/** "MAIN MEAL" -> "main", same idea for the meal slot. */
export function mealTypeKeyToDbSlot(key: string): string | undefined {
  return KEY_TO_DB_SLOT[key];
}

/**
 * Reshapes the whole cycle_menu_slots table back into the exact
 * `{ "Week 1": [{DAY, 'MAIN MEAL': ..., ...}], "Week 2": [...], ... }`
 * object the app's cycle-menu rendering already expects (from the old
 * cycleMenu.json) — fetched all at once, not per-week, because a rolling
 * upcoming-days window can span a rotation boundary and land on two
 * different week numbers in the same render. Small dataset (8 weeks x 5
 * days x 5 slots), so loading everything is simpler and cheaper than
 * chasing which weeks are currently in view.
 */
export async function fetchAllCycleMenus(): Promise<Record<string, Record<string, string>[]>> {
  const { data, error } = await supabase.from('cycle_menu_slots').select('week_number, day_of_week, slot, item_name');
  if (error) throw error;

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const byWeek = new Map<number, Map<string, Record<string, string>>>();

  for (const row of data ?? []) {
    const dayName = DB_DAY_TO_NAME[row.day_of_week];
    const slotKey = DB_SLOT_TO_KEY[row.slot];
    if (!dayName || !slotKey) continue;
    if (!byWeek.has(row.week_number)) byWeek.set(row.week_number, new Map());
    const byDay = byWeek.get(row.week_number)!;
    if (!byDay.has(dayName)) byDay.set(dayName, { DAY: dayName });
    byDay.get(dayName)![slotKey] = row.item_name;
  }

  const result: Record<string, Record<string, string>[]> = {};
  for (const [weekNumber, byDay] of byWeek) {
    result[`Week ${weekNumber}`] = dayOrder.filter(d => byDay.has(d)).map(d => byDay.get(d)!);
  }
  return result;
}
