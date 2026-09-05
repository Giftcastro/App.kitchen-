// Shared menu normalization — the single place raw staticMenu.json entries
// (or an admin-authored item) get turned into the canonical shape the rest
// of the app renders. Previously this logic lived only inline in the Menu
// screen, and admin's add/edit/delete wrote into a completely separate,
// never-rendered `menus` array — so admin menu edits silently went nowhere.
// Both now go through this file so there's exactly one source of truth.

export interface SizeOption {
  label: string;
  price: number;
}

export interface NormalizedMenuItem {
  id: string;
  name: string;
  description: string;
  image?: string;
  sizes: SizeOption[];
  /** Optional dietary tags (e.g. "Keto", "Vegan") — only rendered when present in data. */
  tags?: string[];
}

/** An optional per-category extra (e.g. "Extra Bacon") a customer can add to any dish in that category — an Uber-Eats-style modifier tied to the specific item being ordered, not a standalone menu item. */
export interface AddOnOption {
  name: string;
  price: number;
}

export interface NormalizedMenuCategory {
  id: string;
  name: string;
  items: NormalizedMenuItem[];
  addOns?: AddOnOption[];
}

function normalizeAddOns(raw: any): AddOnOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const addOns = raw
    .map((a: any) => ({
      name: typeof a?.name === 'string' ? a.name : '',
      price: typeof a?.price === 'number' ? a.price : parseFloat(String(a?.price).replace(/[^\d.]/g, '')) || 0,
    }))
    .filter((a: AddOnOption) => a.name);
  return addOns.length > 0 ? addOns : undefined;
}

/** Turns one raw staticMenu.json entry into the canonical item shape. */
export function normalizeRawMenuItem(rawItem: any, category: string, idx: number): NormalizedMenuItem {
  let parsedSizes: SizeOption[] = [];
  if (rawItem.sizes && Array.isArray(rawItem.sizes)) {
    parsedSizes = rawItem.sizes.map((s: any) => ({ label: s.label || 'Regular', price: Number(s.price) || 0 }));
  } else if (rawItem.price !== undefined && rawItem.price !== null) {
    const cleanPrice = typeof rawItem.price === 'number' ? rawItem.price : parseFloat(String(rawItem.price).replace(/[^\d.]/g, '')) || 0;
    parsedSizes = [{ label: 'Regular', price: cleanPrice }];
  } else if (rawItem.prices && Array.isArray(rawItem.prices)) {
    // Two-price items are almost always a standard/large portion split — label them
    // accordingly instead of the generic "Option N" so the size picker reads naturally.
    const sizeLabels = rawItem.prices.length === 2 ? ['Standard', 'Large'] : null;
    parsedSizes = rawItem.prices.map((p: any, pIdx: number) => {
      const priceStr = typeof p === 'string' ? p : String(p);
      const price = parseFloat(priceStr.replace(/[^\d.]/g, '')) || 0;
      return {
        label: sizeLabels ? sizeLabels[pIdx] : (pIdx === 0 ? 'Regular' : `Option ${pIdx + 1}`),
        price,
      };
    });
  }
  if (parsedSizes.length === 0) parsedSizes = [{ label: 'Regular', price: 0 }];

  return {
    id: `menu-item-${category}-${idx}-${(rawItem.name || '').replace(/\s+/g, '')}`,
    name: rawItem.name || 'Unnamed Item',
    description: rawItem.description || '',
    image: rawItem.image,
    sizes: parsedSizes,
    tags: Array.isArray(rawItem.tags) ? rawItem.tags.filter((t: any) => typeof t === 'string') : undefined,
  };
}

/** Groups the whole raw staticMenu.json object into normalized categories. */
export function buildMenuFromStaticData(staticMenuData: any): NormalizedMenuCategory[] {
  if (!staticMenuData || typeof staticMenuData !== 'object') return [];

  const categories: NormalizedMenuCategory[] = [];
  const addOnsByCategory: Record<string, any> =
    !Array.isArray(staticMenuData) && staticMenuData._addOns && typeof staticMenuData._addOns === 'object'
      ? staticMenuData._addOns
      : {};

  if (Array.isArray(staticMenuData)) {
    const byCategory = new Map<string, any[]>();
    staticMenuData.forEach((item: any) => {
      const cat = item.category || 'General';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(item);
    });
    byCategory.forEach((items, cat) => {
      categories.push({
        id: cat,
        name: cat,
        items: items.map((item, idx) => normalizeRawMenuItem(item, cat, idx)),
      });
    });
    return categories;
  }

  Object.entries(staticMenuData).forEach(([key, value]) => {
    if (key.startsWith('_')) return;
    if (Array.isArray(value)) {
      categories.push({
        id: key,
        name: key,
        items: value.map((item: any, idx: number) => normalizeRawMenuItem(item, key, idx)),
        addOns: normalizeAddOns(addOnsByCategory[key]),
      });
    } else if (value && typeof value === 'object') {
      const cat = (value as any).category || key;
      categories.push({ id: cat, name: cat, items: [normalizeRawMenuItem(value, cat, 0)] });
    }
  });

  return categories;
}
