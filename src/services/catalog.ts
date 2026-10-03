/**
 * Menu data — the MAUI JsonProductService + CycleMenuService, backed by the
 * Supabase menu_* / cycle_* tables instead of the bundled JSON files.
 *
 * "Main" returns the static (always-available) menu; "Weekly" returns the
 * cycle menu for the customer's chosen delivery day (or the whole coming
 * week if that day has fallen out of the window), each item locked to its
 * date because the dish only exists on that day.
 */
import { supabase } from '../lib/supabase/client';
import type { CustomizationGroup, CycleMenuDay, Product } from '../models';
import { CYCLE_WINDOW, fmtDayLabel, fromIso, getOrderableDeliveryDates, toIso } from './scheduling';

// ── Category art (MAUI JsonProductService) ──────────────────────────────

const unsplash = (photoId: string) => `https://images.unsplash.com/photo-${photoId}?w=800&h=600&fit=crop&auto=format&q=80`;

const STATIC_ICONS: Record<string, string> = {
  'SALAD BAR': '🥗',
  'POKE BOWL': '🍱',
  'STIR FRY': '🥘',
  'CIAO ITALY': '🍝',
  WRAPS: '🌯',
  SANDWICHES: '🥪',
  'HOT DOGS': '🌭',
  'BURGER BAR': '🍔',
  'FITNESS MEALS': '🥑',
  'HOMEMADE WINTER SOUPS': '🍲',
  SOUPS: '🍲',
  'RAMEN BOWLS': '🍜',
  'VEGAN MEALS': '🥦',
  'PORK SPECIALITIES': '🐷',
};

const STATIC_PHOTOS: Record<string, string> = {
  'SALAD BAR': '1512621776951-a57141f2eefd',
  'POKE BOWL': '1759429179911-4e1f0e4e69f7',
  'STIR FRY': '1751560048567-b38f5cf3448a',
  'CIAO ITALY': '1755594461640-b800c6bafdfa',
  WRAPS: '1571331421405-51b8feea1033',
  SANDWICHES: '1469648034646-7911874fe62b',
  'HOT DOGS': '1638368593249-7cadb261e8b3',
  'BURGER BAR': '1667329829058-ac191ba4a905',
  'FITNESS MEALS': '1761027101409-fa96d88349c7',
  'HOMEMADE WINTER SOUPS': '1631531515768-cb84c3bd98f0',
  SOUPS: '1631531515768-cb84c3bd98f0',
  'RAMEN BOWLS': '1711394370771-817a30b06215',
  'VEGAN MEALS': '1654199903998-e49181b41a95',
  'PORK SPECIALITIES': '1659415401946-bbee8c483e83',
};

/** Exact per-dish photo overrides, keyed case-insensitively by name. */
const ITEM_PHOTOS: Record<string, string> = {
  'tuna salad': '1514518189759-94d8ee01ecf1',
  'roasted butternut salad': '1623428188474-b1d532c5e560',
  'grilled chicken salad': '1505714197102-6ae95091ed70',
  'grilled haloumi salad': '1505714197102-6ae95091ed70',
  'thai beef noodle salad': '1673258551460-268b47871a32',
  'roasted vegetable and couscous salad': '1623428188474-b1d532c5e560',
};

export const DEFAULT_PRODUCT_IMAGE = unsplash('1512621776951-a57141f2eefd');

const staticIcon = (category: string) => STATIC_ICONS[category.toUpperCase()] ?? '🍽️';
const staticCategoryImage = (category: string) => unsplash(STATIC_PHOTOS[category.toUpperCase()] ?? '1512621776951-a57141f2eefd');

function staticItemImage(category: string, name: string, dbImage: string | null): string {
  const override = ITEM_PHOTOS[name.toLowerCase()];
  if (override) return unsplash(override);
  if (dbImage && /^https?:\/\//.test(dbImage)) return dbImage;
  return staticCategoryImage(category);
}

export const CYCLE_SLOTS: { slot: string; label: string; icon: string; photo: string }[] = [
  { slot: 'main', label: 'Main Meal', icon: '🍽️', photo: '1635897411141-7bd2b9c6ab16' },
  { slot: 'vegetarian', label: 'Vegetarian Meal', icon: '🥕', photo: '1654199903998-e49181b41a95' },
  { slot: 'healthy', label: 'Healthy Meal', icon: '🍎', photo: '1512621776951-a57141f2eefd' },
  { slot: 'curry', label: 'Curry of the Day', icon: '🍛', photo: '1708782344490-9026aaa5eec7' },
  { slot: 'gourmet_sandwich', label: 'Gourmet Sandwich', icon: '🥪', photo: '1469648034646-7911874fe62b' },
];

const DB_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ── Static menu ─────────────────────────────────────────────────────────

/** Every static dish, available or not (the admin catalog needs both). */
export async function getStaticProducts(): Promise<Product[]> {
  const [{ data: categories, error: catErr }, { data: items, error: itemErr }, { data: addons, error: addonErr }] = await Promise.all([
    supabase.from('menu_categories').select('id, name, sort_order').order('sort_order'),
    supabase.from('menu_items').select('*, menu_item_sizes(label, price_cents)').order('created_at'),
    supabase.from('menu_item_addons').select('category_id, name, price_cents').order('created_at'),
  ]);
  if (catErr) throw catErr;
  if (itemErr) throw itemErr;
  if (addonErr) throw addonErr;

  const products: Product[] = [];
  for (const cat of categories ?? []) {
    const categoryAddOns = (addons ?? []).filter((a: any) => a.category_id === cat.id);
    for (const item of (items ?? []).filter((i: any) => i.category_id === cat.id)) {
      const sizes = ((item.menu_item_sizes ?? []) as { label: string; price_cents: number }[])
        .map(s => ({ label: s.label, price: s.price_cents / 100 }))
        .sort((a, b) => a.price - b.price);
      const standard = sizes[0] ?? { label: 'Regular', price: 0 };
      const large = sizes.length > 1 ? sizes[1] : undefined;
      const groups: CustomizationGroup[] = [];
      if (large && large.price > standard.price) {
        groups.push({
          title: 'Size',
          isMultiSelect: false,
          options: [
            { name: 'Standard', additionalPrice: 0, sizeLabel: standard.label },
            { name: 'Large', additionalPrice: large.price - standard.price, sizeLabel: large.label },
          ],
        });
      }
      if (categoryAddOns.length > 0) {
        groups.push({
          title: 'Add-Ons',
          isMultiSelect: true,
          options: categoryAddOns.map((a: any) => ({ name: a.name, additionalPrice: a.price_cents / 100, isAddOn: true })),
        });
      }
      products.push({
        id: item.id,
        name: item.name,
        description: item.description?.trim() ? item.description : 'A perfect addition to complement your meal.',
        basePrice: standard.price,
        imageUrl: staticItemImage(cat.name, item.name, item.image_url),
        icon: staticIcon(cat.name),
        category: cat.name,
        categoryId: cat.id,
        ingredients: item.ingredients ?? '',
        dietaryTags: item.tags ?? [],
        largePrice: large && large.price > standard.price ? large.price : undefined,
        isAvailable: item.active,
        menuType: 'static',
        customizationGroups: groups,
        baseSizeLabel: standard.label,
      });
    }
  }
  return products;
}

// ── Cycle rotation (MAUI CycleMenuService) ──────────────────────────────

interface RotationConfig {
  anchorMonday: string;
  weekOffset: number;
}

async function getRotation(): Promise<RotationConfig> {
  const { data } = await supabase.from('cycle_rotation_config').select('anchor_monday, week_offset').maybeSingle();
  return { anchorMonday: data?.anchor_monday ?? '2026-09-07', weekOffset: data?.week_offset ?? 0 };
}

function mondayOf(d: Date): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function weekNumberFor(iso: string, rotation: RotationConfig): number {
  const weeks = Math.round((mondayOf(fromIso(iso)).getTime() - mondayOf(fromIso(rotation.anchorMonday)).getTime()) / (7 * 86400000));
  return ((((weeks + rotation.weekOffset) % 8) + 8) % 8) + 1;
}

type SlotRow = { week_number: number; day_of_week: string; slot: string; item_name: string };

async function getAllSlots(): Promise<SlotRow[]> {
  const { data, error } = await supabase.from('cycle_menu_slots').select('week_number, day_of_week, slot, item_name');
  if (error) throw error;
  return data ?? [];
}

function buildDay(slots: SlotRow[], weekNumber: number, dbDay: string): CycleMenuDay {
  return {
    day: DAY_NAMES[DB_DAYS.indexOf(dbDay)],
    weekNumber,
    categories: CYCLE_SLOTS.map(({ slot, label }) => [
      label,
      slots.find(s => s.week_number === weekNumber && s.day_of_week === dbDay && s.slot === slot)?.item_name ?? '',
    ]),
  };
}

/** The rotating menu for a delivery date, or null on a weekend. */
export async function getCycleMenuForDates(dates: string[]): Promise<Record<string, CycleMenuDay | null>> {
  const [rotation, slots] = await Promise.all([getRotation(), getAllSlots()]);
  const result: Record<string, CycleMenuDay | null> = {};
  for (const iso of dates) {
    const dow = fromIso(iso).getDay();
    result[iso] = dow === 0 || dow === 6 ? null : buildDay(slots, weekNumberFor(iso, rotation), DB_DAYS[dow - 1]);
  }
  return result;
}

/** "Week 1".."Week 8" -> the five days, for the admin cycle screen. */
export async function getAllWeeks(): Promise<Record<string, CycleMenuDay[]>> {
  const slots = await getAllSlots();
  const weeks: Record<string, CycleMenuDay[]> = {};
  for (let w = 1; w <= 8; w++) weeks[`Week ${w}`] = DB_DAYS.map(d => buildDay(slots, w, d));
  return weeks;
}

export async function getActiveWeekNumber(): Promise<number> {
  return weekNumberFor(toIso(new Date()), await getRotation());
}

/** Re-anchors the rotation so this calendar week is `weekNumber`; later weeks keep cycling from there. */
export async function setActiveWeek(weekNumber: number): Promise<void> {
  if (weekNumber < 1 || weekNumber > 8) throw new Error('Week number must be between 1 and 8.');
  const rotation = await getRotation();
  const current = weekNumberFor(toIso(new Date()), rotation);
  const weekOffset = (((rotation.weekOffset + (weekNumber - current)) % 8) + 8) % 8;
  const { error } = await supabase.from('cycle_rotation_config').update({ week_offset: weekOffset }).eq('id', true);
  if (error) throw error;
}

/** Sets one slot's dish; an empty string leaves the slot empty (MAUI's "Remove"). */
export async function updateCycleItem(weekKey: string, dayName: string, categoryLabel: string, newValue: string): Promise<void> {
  const weekNumber = Number(weekKey.replace('Week ', ''));
  const dayOfWeek = DB_DAYS[DAY_NAMES.indexOf(dayName)];
  const slot = CYCLE_SLOTS.find(s => s.label === categoryLabel)?.slot;
  if (!dayOfWeek || !slot) return;
  const { error } = await supabase
    .from('cycle_menu_slots')
    .upsert({ week_number: weekNumber, day_of_week: dayOfWeek, slot, item_name: newValue }, { onConflict: 'week_number,day_of_week,slot' });
  if (error) throw error;
}

async function getCyclePrice(): Promise<number> {
  const { data } = await supabase.from('pricing_config').select('value_cents').eq('key', 'cycle_item_price').maybeSingle();
  return (data?.value_cents ?? 8000) / 100;
}

/** Cycle dishes for the chosen day (or the whole coming week if it's outside the window). */
export async function getCycleProducts(selectedDate: string | null): Promise<Product[]> {
  const window = getOrderableDeliveryDates(CYCLE_WINDOW);
  const dates = selectedDate && window.includes(selectedDate) ? [selectedDate] : window;
  const [menus, price] = await Promise.all([getCycleMenuForDates(dates), getCyclePrice()]);
  const products: Product[] = [];
  for (const iso of dates) {
    const day = menus[iso];
    if (!day) continue;
    const dbDay = DB_DAYS[fromIso(iso).getDay() - 1];
    day.categories.forEach(([label, itemName], idx) => {
      if (!itemName.trim()) return;
      const meta = CYCLE_SLOTS[idx];
      products.push({
        id: `cycle:${day.weekNumber}:${dbDay}:${meta.slot}:${iso}`,
        name: itemName,
        description: `${label} — delivered ${fmtDayLabel(iso)}. Part of week ${day.weekNumber}'s rotating menu.`,
        basePrice: price,
        imageUrl: unsplash(meta.photo),
        icon: meta.icon,
        category: label,
        ingredients: '',
        dietaryTags: [],
        isAvailable: true,
        menuType: 'cycle',
        customizationGroups: [],
        lockedDeliveryDate: iso,
        cycleRef: { weekNumber: day.weekNumber, dayOfWeek: dbDay, slot: meta.slot },
      });
    });
  }
  return products;
}

export async function getProducts(menu: 'Main' | 'Weekly', selectedDate: string | null): Promise<Product[]> {
  return menu === 'Weekly' ? getCycleProducts(selectedDate) : getStaticProducts();
}

// ── Admin static-menu CRUD ──────────────────────────────────────────────

/** Postgres unique-violation — menu_items has unique (category_id, name). */
const DUPLICATE = '23505';

async function ensureCategory(name: string): Promise<string> {
  const { data: existing } = await supabase.from('menu_categories').select('id').ilike('name', name).maybeSingle();
  if (existing) return existing.id;
  const { data: maxRow } = await supabase.from('menu_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from('menu_categories')
    .insert({ name, sort_order: (maxRow?.sort_order ?? 0) + 1, icon: '🍽️' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export interface ProductDraft {
  name: string;
  basePrice: number;
  category: string;
  description: string;
  ingredients: string;
  dietaryTags: string[];
  imageUrl?: string;
}

export async function addStaticProduct(draft: ProductDraft): Promise<void> {
  const categoryId = await ensureCategory(draft.category);
  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      category_id: categoryId,
      name: draft.name,
      description: draft.description,
      ingredients: draft.ingredients || null,
      tags: draft.dietaryTags,
      image_url: draft.imageUrl ?? null,
      active: true,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === DUPLICATE) throw new Error(`A dish named "${draft.name}" already exists in this category.`);
    throw error;
  }
  const { error: sizeErr } = await supabase
    .from('menu_item_sizes')
    .insert({ menu_item_id: data.id, label: 'Standard', price_cents: Math.round(draft.basePrice * 100) });
  if (sizeErr) throw sizeErr;
}

/** Updates the item; the base (cheapest) size takes the new price, a Large size keeps its own. */
export async function updateStaticProduct(product: Product, draft: Omit<ProductDraft, 'category' | 'imageUrl'>): Promise<void> {
  const { error } = await supabase
    .from('menu_items')
    .update({ name: draft.name, description: draft.description, ingredients: draft.ingredients || null, tags: draft.dietaryTags })
    .eq('id', product.id);
  if (error) {
    if (error.code === DUPLICATE) throw new Error(`A dish named "${draft.name}" already exists in this category.`);
    throw error;
  }
  const { error: sizeErr } = await supabase
    .from('menu_item_sizes')
    .update({ price_cents: Math.round(draft.basePrice * 100) })
    .eq('menu_item_id', product.id)
    .eq('label', product.baseSizeLabel ?? 'Standard');
  if (sizeErr) throw sizeErr;
}

export async function setProductAvailable(productId: string, isAvailable: boolean): Promise<void> {
  const { error } = await supabase.from('menu_items').update({ active: isAvailable }).eq('id', productId);
  if (error) throw error;
}

export async function deleteStaticProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('menu_items').delete().eq('id', productId);
  if (error) throw error;
}
