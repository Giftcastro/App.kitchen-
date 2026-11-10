import { supabase, isSupabaseConfigured } from '../config/supabase';
import {
  MenuCategory,
  MenuItem,
  OrderHistoryItem,
  CartItem,
  OrderStatus,
  CycleWeekConfig,
  CycleWeekPlan,
  CycleDayPlan,
  CorporateAccount,
  CompanyDomain,
  UserRole,
  BroadcastNotification,
  EmailRoutingDirectory,
} from '../types';

/**
 * Service to interface directly with live Supabase PostgreSQL tables
 * with real-time updates and graceful offline resilience.
 */

// ============================================================================
// 1. MENU CATEGORIES & ITEMS (Live DB with Hero Images & Ingredients)
// ============================================================================

export async function fetchCategoriesFromDb(): Promise<MenuCategory[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (error || !data) {
    console.warn('Error fetching menu categories from Supabase:', error);
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug || row.name.toLowerCase().replace(/\s+/g, '-'),
    menuType: row.menu_type || 'standard',
    heroImage:
      row.hero_image_url ||
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&auto=format&fit=crop&q=80',
    displayOrder: row.display_order ?? row.sort_order ?? 1,
    isActive: row.is_active ?? true,
    addOns: Array.isArray(row.add_ons) ? row.add_ons : [],
  }));
}

export async function fetchMenuItemsFromDb(): Promise<MenuItem[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('menu_items')
    .select('*, menu_categories(name, add_ons, hero_image_url)')
    .order('name', { ascending: true });

  if (error || !data) {
    console.warn('Error fetching menu items from Supabase:', error);
    return [];
  }

  return data.map((row: any) => {
    const standardPrice = parseFloat(row.price_regular || row.price || '80');
    const largePrice = row.price_large ? parseFloat(row.price_large) : undefined;
    const catAddOns = Array.isArray(row.menu_categories?.add_ons)
      ? row.menu_categories.add_ons
      : [];

    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description || '',
      ingredients: row.ingredients || 'Chef prepared ingredients, herbs and seasonings',
      dietaryTags: Array.isArray(row.dietary_tags) ? row.dietary_tags : [],
      price: standardPrice,
      prices: {
        standard: standardPrice,
        large: largePrice,
      },
      addOns: catAddOns,
      categoryName: row.menu_categories?.name || undefined,
      menuType: row.menu_type || 'standard',
      isAvailable: row.is_available ?? true,
      calories: row.calories || undefined,
    };
  });
}

// ============================================================================
// 2. 8-WEEK CHEF'S CHOICE CYCLE CONTROL
// ============================================================================

export async function fetchCycleRotationsFromDb(): Promise<CycleWeekConfig[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('cycle_rotations')
    .select('*')
    .order('week_number', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    weekNumber: row.week_number,
    title: row.title,
    description: row.description || '',
    mealCount: 25,
    status: row.is_active_now
      ? 'active_now'
      : row.is_advance_locked
      ? 'inactive'
      : 'scheduled_next',
  }));
}

export async function fetchAllCycleDayPlansFromDb(): Promise<CycleWeekPlan[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('cycle_day_plans')
    .select('*')
    .order('week_number', { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  const dayOrder: Record<string, number> = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
  };

  const weekMap = new Map<number, CycleDayPlan[]>();
  data.forEach((row: any) => {
    const wk = Number(row.week_number) || 1;
    if (!weekMap.has(wk)) weekMap.set(wk, []);
    weekMap.get(wk)!.push({
      day: row.day_name,
      main_meal: row.main_meal || '',
      vegetarian_meal: row.vegetarian_meal || '',
      healthy_meal: row.healthy_meal || '',
      curry_of_the_day: row.curry_of_the_day || '',
      gourmet_sandwich: row.gourmet_sandwich || '',
    });
  });

  const result: CycleWeekPlan[] = [];
  for (const [week, days] of weekMap.entries()) {
    days.sort((a, b) => (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99));
    result.push({ week, days });
  }
  result.sort((a, b) => a.week - b.week);
  return result;
}

export async function fetchCycleDayPlansFromDb(weekNumber: number): Promise<CycleDayPlan[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('cycle_day_plans')
    .select('*')
    .eq('week_number', weekNumber);

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    day: row.day_name,
    main_meal: row.main_meal,
    vegetarian_meal: row.vegetarian_meal,
    healthy_meal: row.healthy_meal,
    curry_of_the_day: row.curry_of_the_day,
    gourmet_sandwich: row.gourmet_sandwich,
  }));
}

export async function updateCycleDayPlanInDb(
  weekNumber: number,
  dayName: string,
  updates: Partial<CycleDayPlan>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const dbUpdates: any = {};
  if (updates.main_meal !== undefined) dbUpdates.main_meal = updates.main_meal;
  if (updates.vegetarian_meal !== undefined) dbUpdates.vegetarian_meal = updates.vegetarian_meal;
  if (updates.healthy_meal !== undefined) dbUpdates.healthy_meal = updates.healthy_meal;
  if (updates.curry_of_the_day !== undefined) dbUpdates.curry_of_the_day = updates.curry_of_the_day;
  if (updates.gourmet_sandwich !== undefined) dbUpdates.gourmet_sandwich = updates.gourmet_sandwich;
  dbUpdates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('cycle_day_plans')
    .update(dbUpdates)
    .match({ week_number: weekNumber, day_name: dayName });

  return !error;
}

export async function updateCycleRotationInDb(
  weekNumber: number,
  updates: { title?: string; description?: string }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const dbUpdates: any = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;

  const { error } = await supabase
    .from('cycle_rotations')
    .update(dbUpdates)
    .eq('week_number', weekNumber);

  return !error;
}

export async function setActiveCycleWeekInDb(weekNumber: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  // Deactivate all, activate selected
  await supabase.from('cycle_rotations').update({ is_active_now: false }).neq('week_number', -1);
  const { error } = await supabase
    .from('cycle_rotations')
    .update({ is_active_now: true })
    .eq('week_number', weekNumber);

  return !error;
}

// ============================================================================
// 3. ORDERS, REALTIME TRACKER & KITCHEN DISPATCH
// ============================================================================

function mapDbOrderToHistoryItem(ord: any, profile?: any): OrderHistoryItem {
  const customerName = profile?.full_name || ord.customer_name || '';
  const customerEmail = profile?.email || ord.customer_email || '';
  const companyName = ord.company_name_snapshot || profile?.companies?.name || ord.company_name || '';
  const location =
    ord.company_location ||
    (profile?.location_name ? `${profile.location_name}${profile.building_name ? ` • ${profile.building_name}` : ''}` : '');

  return {
    id: ord.id,
    userId: ord.user_id,
    customerName: customerName || undefined,
    customerEmail: customerEmail || undefined,
    companyName: companyName || undefined,
    orderNumber: ord.order_number || `ORD-${ord.id.substring(0, 8)}`,
    targetDeliveryDate: ord.target_delivery_date,
    deliveryDateFormatted: ord.delivery_date_formatted || ord.target_delivery_date,
    deliverySlot: ord.delivery_slot || '12:00 PM Sharp',
    deliveryFloor: ord.delivery_floor || profile?.delivery_floor || '',
    companyLocation: location,
    items: (ord.order_items || []).map((item: any) => {
      const dishName = item.dish_name || 'Standard Dish';
      const lowerDish = dishName.toLowerCase();
      const isChefsChoice =
        !item.menu_item_id &&
        (lowerDish.includes("chef's") ||
          lowerDish.includes('chef’s') ||
          lowerDish.includes('curry of the day') ||
          lowerDish.includes('gourmet sandwich of the day'));
      return {
        id: item.id,
        menuItem: {
          id: item.menu_item_id || (isChefsChoice ? `chef_${item.id}` : item.id),
          categoryId: isChefsChoice ? 'cat_chefs_choice' : 'cat_standard',
          categoryName: isChefsChoice ? "Chef's Choice" : undefined,
          name: dishName,
          description: '',
          ingredients: '',
          dietaryTags: [],
          price: parseFloat(item.unit_price || '80'),
          menuType: isChefsChoice ? ('chefs_choice' as const) : ('standard' as const),
          isAvailable: true,
        },
        quantity: item.quantity,
        size: item.size || 'standard',
        selectedAddOns: item.selected_add_ons || [],
        allergyNotes: item.allergy_notes,
        targetDeliveryDate: ord.target_delivery_date,
        unitPrice: parseFloat(item.unit_price || '80'),
        totalPrice: parseFloat(item.total_price || '80'),
      };
    }),
    itemSubtotal: parseFloat(ord.item_subtotal || '0'),
    discountType: ord.discount_type || 'percentage',
    discountValue: parseFloat(ord.discount_value || '0'),
    discountZar: parseFloat(ord.discount_zar || '0'),
    discountPercentage: ord.discount_type === 'percentage' ? parseFloat(ord.discount_value || '0') : 0,
    deliveryFee: parseFloat(ord.delivery_fee || '0'),
    vatAmount: parseFloat(ord.vat_amount || '0'),
    totalPaid: parseFloat(ord.total_amount || '0'),
    paymentMethod: ord.payment_method || 'Instant EFT',
    paymentReference: ord.payment_reference || '',
    status: (ord.status as OrderStatus) || 'paid_scheduled',
    stage: (ord.stage as 1 | 2 | 3 | 4) || 1,
    createdAt: ord.created_at,
    itnVerifiedAt: ord.itn_verified_at,
    taxInvoiceNumber: ord.tax_invoice_number || `INV-${ord.id.substring(0, 8)}`,
    rating: ord.rating_score
      ? {
          rating: ord.rating_score,
          feedback: ord.rating_feedback || undefined,
          submittedAt: ord.rated_at || ord.updated_at,
        }
      : undefined,
    dispute: ord.is_disputed
      ? {
          reportedAt: ord.dispute_reported_at || ord.updated_at,
          reason: ord.dispute_reason || '',
          supportTicketRef: ord.dispute_ticket_ref || '',
          status: 'investigating' as const,
        }
      : undefined,
  };
}

export async function fetchUserOrdersFromDb(userId: string): Promise<OrderHistoryItem[]> {
  if (!isSupabaseConfigured() || !userId) return [];

  const [ordersRes, profileRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          menu_item_id,
          dish_name,
          quantity,
          unit_price,
          total_price,
          size,
          selected_add_ons,
          allergy_notes
        )
      `)
      .eq('user_id', userId)
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name, email, location_name, building_name, delivery_floor, companies(id, name)')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  if (ordersRes.error || !ordersRes.data) {
    return [];
  }

  const profile = profileRes.data;
  return ordersRes.data.map((ord: any) => mapDbOrderToHistoryItem(ord, profile));
}

export async function fetchAllOrdersFromDb(): Promise<OrderHistoryItem[]> {
  if (!isSupabaseConfigured()) return [];

  const [ordersRes, profilesRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          menu_item_id,
          dish_name,
          quantity,
          unit_price,
          total_price,
          size,
          selected_add_ons,
          allergy_notes
        )
      `)
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name, email, location_name, building_name, delivery_floor, companies(id, name)'),
  ]);

  if (ordersRes.error || !ordersRes.data) {
    console.warn('Error fetching all orders from Supabase:', ordersRes.error);
    return [];
  }

  const profileMap = new Map<string, any>();
  (profilesRes.data || []).forEach((p: any) => {
    profileMap.set(p.id, p);
  });

  return ordersRes.data.map((ord: any) => {
    const prof = profileMap.get(ord.user_id);
    return mapDbOrderToHistoryItem(ord, prof);
  });
}

export async function fetchAllOrdersForDateFromDb(targetDate: string): Promise<OrderHistoryItem[]> {
  if (!isSupabaseConfigured()) return [];

  const [ordersRes, profilesRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          menu_item_id,
          dish_name,
          quantity,
          unit_price,
          total_price,
          size,
          selected_add_ons,
          allergy_notes
        )
      `)
      .eq('target_delivery_date', targetDate)
      .neq('status', 'pending_payment'),
    supabase
      .from('profiles')
      .select('id, full_name, email, location_name, building_name, delivery_floor, companies(id, name)'),
  ]);

  if (ordersRes.error || !ordersRes.data) {
    return [];
  }

  const profileMap = new Map<string, any>();
  (profilesRes.data || []).forEach((p: any) => {
    profileMap.set(p.id, p);
  });

  return ordersRes.data.map((ord: any) => {
    const prof = profileMap.get(ord.user_id);
    return mapDbOrderToHistoryItem(ord, prof);
  });
}

export interface CheckoutCartPayload {
  floor?: string;
  dates: {
    date: string;
    items: {
      menuItemId: string;
      size: 'standard' | 'large';
      quantity: number;
      addOns: string[];
      allergyNotes?: string;
    }[];
  }[];
}

export interface PayFastCheckout {
  intentId: string;
  amount: number;
  orderNumbers: string[];
  redirectUrl: string;
}

/** The server prices the cart, creates pending orders and signs the PayFast request. */
export async function createPayFastCheckout(cart: CheckoutCartPayload): Promise<PayFastCheckout> {
  const { data, error } = await supabase.functions.invoke('payfast-create-payment', { body: cart });
  if (error) {
    // Validation failures come back as JSON with a customer-readable message.
    const body = await (error as any).context?.json?.().catch(() => null);
    throw new Error(body?.error || 'Unable to start checkout. Please try again.');
  }
  return data as PayFastCheckout;
}

export type PaymentIntentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'amount_mismatch';

export async function fetchPaymentIntentStatus(intentId: string): Promise<PaymentIntentStatus | null> {
  const { data, error } = await supabase
    .from('payment_intents')
    .select('status')
    .eq('id', intentId)
    .maybeSingle();
  return error || !data ? null : (data.status as PaymentIntentStatus);
}

export async function updateOrderStatusInDb(
  orderId: string,
  newStatus: OrderStatus,
  newStage: 1 | 2 | 3 | 4
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('orders')
    .update({
      status: newStatus,
      stage: newStage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  return !error;
}

export async function updateBatchOrderStatusesInDb(
  orderIds: string[],
  newStatus: OrderStatus,
  newStage: 1 | 2 | 3 | 4
): Promise<boolean> {
  if (!isSupabaseConfigured() || orderIds.length === 0) return false;

  const { error } = await supabase
    .from('orders')
    .update({
      status: newStatus,
      stage: newStage,
      updated_at: new Date().toISOString(),
    })
    .in('id', orderIds);

  return !error;
}

export async function submitOrderRatingInDb(
  orderId: string,
  rating: number,
  feedback?: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !orderId) return false;

  const { error } = await supabase
    .from('orders')
    .update({
      rating_score: rating,
      rating_feedback: feedback?.trim() || null,
      rated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  return !error;
}

export async function reportOrderDisputeInDb(
  orderId: string,
  reason: string,
  supportTicketRef: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !orderId) return false;

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'unfulfilled',
      is_disputed: true,
      dispute_reason: reason,
      dispute_ticket_ref: supportTicketRef,
      dispute_reported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  return !error;
}

// ============================================================================
// 4. ADMIN MENU CRUD (Adding/Editing dishes & categories in real time)
// ============================================================================

export async function adminAddMenuItemToDb(item: Omit<MenuItem, 'id'>): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      category_id: item.categoryId,
      name: item.name,
      description: item.description,
      ingredients: item.ingredients,
      dietary_tags: item.dietaryTags,
      price_regular: item.price,
      price_large: item.prices?.large || null,
      menu_type: item.menuType,
      is_available: true,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.warn('Error adding menu item to Supabase:', error);
    return null;
  }

  return data.id;
}

export async function adminUpdateMenuItemInDb(
  id: string,
  updates: Partial<MenuItem>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const dbUpdates: any = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.ingredients !== undefined) dbUpdates.ingredients = updates.ingredients;
  if (updates.dietaryTags !== undefined) dbUpdates.dietary_tags = updates.dietaryTags;
  if (updates.price !== undefined) dbUpdates.price_regular = updates.price;
  if (updates.prices?.large !== undefined) dbUpdates.price_large = updates.prices.large;
  if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
  if (updates.menuType !== undefined) dbUpdates.menu_type = updates.menuType;
  if (updates.isAvailable !== undefined) dbUpdates.is_available = updates.isAvailable;

  const { error } = await supabase.from('menu_items').update(dbUpdates).eq('id', id);

  return !error;
}

export async function adminArchiveMenuItemInDb(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('menu_items')
    .update({ is_available: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  return !error;
}

export async function adminAddCategoryToDb(cat: Omit<MenuCategory, 'id'>): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('menu_categories')
    .insert({
      name: cat.name,
      slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
      menu_type: cat.menuType || 'standard',
      hero_image_url: cat.heroImage,
      display_order: cat.displayOrder || 1,
      is_active: true,
      add_ons: cat.addOns || [],
    })
    .select('id')
    .single();

  if (error || !data) {
    console.warn('Error adding category to Supabase:', error);
    return null;
  }

  return data.id;
}

export async function adminUpdateCategoryInDb(
  id: string,
  updates: Partial<MenuCategory>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const dbUpdates: any = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
  if (updates.heroImage !== undefined) dbUpdates.hero_image_url = updates.heroImage;
  if (updates.menuType !== undefined) dbUpdates.menu_type = updates.menuType;
  if (updates.displayOrder !== undefined) dbUpdates.display_order = updates.displayOrder;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
  if (updates.addOns !== undefined) dbUpdates.add_ons = updates.addOns;

  const { error } = await supabase.from('menu_categories').update(dbUpdates).eq('id', id);

  return !error;
}

// ============================================================================
// 5. CORPORATE WHITELIST & DOMAINS
// ============================================================================

export async function fetchWhitelistedDomainsFromDb(): Promise<CompanyDomain[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('company_domains')
    .select('*, companies(name, distance_km)')
    .eq('is_active', true);

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    domain: row.domain,
    companyName: row.companies?.name || 'Partner Company',
    locationName: `${row.companies?.name || 'Corporate'} Campus`,
    buildingName: 'Building 1',
    deliveryFloor: 'Floor 3 (Reception Pantry)',
    distanceKm: parseFloat(row.companies?.distance_km || '8.0'),
    isActive: row.is_active,
  }));
}

export async function fetchCorporateAccountsFromDb(): Promise<CorporateAccount[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('companies')
    .select(`
      *,
      company_domains (domain),
      delivery_locations (
        id,
        location_name,
        building_name,
        street_address,
        dropoff_floors (floor_label)
      ),
      profiles (id)
    `)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Error fetching corporate accounts from Supabase:', error);
    return [];
  }

  // Someone registering has no company yet, so RLS returns nothing. They get
  // the sign-up directory instead: names and sites only, no commercial terms.
  let rows: any[] = data || [];
  if (rows.length === 0) {
    const { data: directory } = await supabase.rpc('signup_company_directory');
    rows = Array.isArray(directory) ? directory : [];
  }

  return rows.map((comp: any) => {
    const domains = (comp.company_domains || []).map((d: any) => d.domain).filter(Boolean);
    const locations: string[] = [];
    (comp.delivery_locations || []).forEach((loc: any) => {
      const hasDistinctBuilding =
        loc.building_name &&
        loc.building_name !== 'Main Campus' &&
        !loc.location_name?.includes(loc.building_name);
      const locLabel = loc.location_name + (hasDistinctBuilding ? ` • ${loc.building_name}` : '');
      if (locLabel && !locations.includes(locLabel)) {
        locations.push(locLabel);
      }
    });

    const discountVal = parseFloat(comp.discount_value || '0');
    const realUserCount = Array.isArray(comp.profiles) ? comp.profiles.length : 0;
    const cleanSlug = comp.slug || comp.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    return {
      id: comp.id,
      companyName: comp.name,
      domains: domains.length > 0 ? domains : [`${cleanSlug}.co.za`],
      activeUsersCount: realUserCount,
      locations: locations.length > 0 ? locations : [comp.street_address || `${comp.name} Sandton Complex`],
      distanceKm: parseFloat(comp.distance_km || '8.0'),
      discountType: comp.discount_type || 'percentage',
      discountValue: discountVal,
      discountPercentage: comp.discount_type === 'percentage' ? discountVal : undefined,
      billingEmail: comp.billing_email || `accounts@${cleanSlug}.co.za`,
      mealSubsidyAmount: comp.meal_subsidy_amount !== undefined && comp.meal_subsidy_amount !== null ? parseFloat(comp.meal_subsidy_amount) : 0,
      deliveryFeeMode: comp.delivery_fee_mode || 'distance',
      flatFeeAmount: comp.flat_fee_amount !== undefined && comp.flat_fee_amount !== null ? parseFloat(comp.flat_fee_amount) : 20.0,
      isActive: comp.is_active !== false,
      createdAt: comp.created_at || new Date().toISOString(),
    };
  });
}

// ============================================================================
// 6. PUBLIC HOLIDAYS (Live from Supabase)
// ============================================================================

export async function fetchPublicHolidaysFromDb(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('public_holidays')
    .select('holiday_date')
    .order('holiday_date', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((r: any) => r.holiday_date);
}

// ============================================================================
// 7. BROADCAST NOTIFICATIONS (Live from Supabase)
// ============================================================================

export async function fetchBroadcastMessagesFromDb(): Promise<BroadcastNotification[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('broadcast_messages')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('Error fetching broadcast messages from Supabase:', error);
    return [];
  }

  return data.map((b: any) => {
    const aud = String(b.target_audience || 'all');
    const isPersonal = aud.startsWith('Active') || aud.startsWith('User:') || aud.includes('@');
    const isCompany = aud !== 'all' && aud !== 'All Customers' && !isPersonal;
    return {
      id: b.id,
      title: b.title,
      body: b.message,
      targetAudience: aud,
      recipientCount: Number(b.recipient_count) || (aud.startsWith('User:') ? 1 : 0),
      sentAt: b.created_at,
      channel: isPersonal ? 'me' : isCompany ? 'company' : 'kitchenco',
    };
  });
}

export async function sendBroadcastMessageToDb(
  title: string,
  message: string,
  targetAudience: string = 'all',
  recipientCount?: number
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const user = (await supabase.auth.getUser()).data.user;
  const { error } = await supabase
    .from('broadcast_messages')
    .insert({
      title,
      message,
      target_audience: targetAudience,
      sender_id: user?.id || null,
      is_active: true,
      recipient_count: recipientCount ?? null,
    });

  if (error) {
    console.warn('Error inserting broadcast into Supabase:', error);
    return false;
  }
  return true;
}

// ============================================================================
// 8. ADMIN USER MANAGEMENT (Live from Supabase Profiles)
// ============================================================================

export interface DbManagedUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  companyName: string;
  deliveryFloor: string;
  isActive: boolean;
  joinedDate: string;
}

export async function fetchAdminUsersFromDb(): Promise<DbManagedUser[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*, companies(name)')
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('Error fetching profiles from Supabase:', error);
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    fullName: p.full_name || p.email.split('@')[0],
    email: p.email,
    role: (p.role as UserRole) || 'user',
    companyName: p.companies?.name || (p.role === 'admin' ? 'Kitchen Co Administration' : p.role === 'chef' ? 'Kitchen Co Culinary Hub' : 'Corporate Customer'),
    deliveryFloor: p.delivery_floor || '',
    isActive: !p.is_suspended,
    joinedDate: p.created_at || new Date().toISOString(),
  }));
}

export async function adminUpdateUserRoleInDb(
  userId: string,
  newRole: UserRole
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', userId);

  return !error;
}

export async function adminToggleUserSuspendInDb(
  userId: string,
  isSuspended: boolean
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  const { error } = await supabase
    .from('profiles')
    .update({ is_suspended: isSuspended, updated_at: new Date().toISOString() })
    .eq('id', userId);

  return !error;
}

/** Deletes the person and keeps their orders anonymised. Returns an error message, or null. */
export async function adminDeleteUserFromDb(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !userId) return 'The database is not available.';

  const { error } = await supabase.rpc('anonymise_customer', { p_user: userId });
  return error ? error.message : null;
}

/** Marks orders Out for Delivery and notifies each customer. Returns the number moved, or null. */
export async function markOrdersOutForDeliveryInDb(orderIds: string[]): Promise<number | null> {
  if (!isSupabaseConfigured() || orderIds.length === 0) return null;

  const { data, error } = await supabase.rpc('admin_mark_out_for_delivery', { p_order_ids: orderIds });
  return error ? null : Number(data);
}

export interface CustomerComplaint {
  id: string;
  ticketRef: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  companyName: string;
  orderId: string | null;
  category: string;
  body: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
}

/** Saves a complaint and returns its ticket reference, or null if it could not be saved. */
export async function submitComplaintToDb(
  userId: string,
  category: string,
  body: string,
  orderId?: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('customer_complaints')
    .insert({ user_id: userId, category, body: body.trim().slice(0, 2000), order_id: orderId || null })
    .select('ticket_ref')
    .single();

  return error || !data ? null : data.ticket_ref;
}

export async function fetchComplaintsFromDb(): Promise<CustomerComplaint[]> {
  if (!isSupabaseConfigured()) return [];

  const [complaintsRes, profilesRes] = await Promise.all([
    supabase.from('customer_complaints').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email, companies(name)'),
  ]);

  if (complaintsRes.error || !complaintsRes.data) return [];

  const people = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
  return complaintsRes.data.map((c: any) => {
    const person: any = people.get(c.user_id);
    return {
      id: c.id,
      ticketRef: c.ticket_ref,
      userId: c.user_id,
      customerName: person?.full_name || (c.user_id ? 'Customer' : 'Anonymised customer'),
      customerEmail: person?.email || '',
      companyName: person?.companies?.name || '',
      orderId: c.order_id,
      category: c.category,
      body: c.body,
      status: c.status,
      createdAt: c.created_at,
      resolvedAt: c.resolved_at,
    };
  });
}

export async function resolveComplaintInDb(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('customer_complaints')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function fetchPlatformSetting<T>(key: string): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle();
  return error || !data ? null : (data.setting_value as T);
}

export async function savePlatformSetting(key: string, value: unknown): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('platform_settings')
    .upsert({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() }, { onConflict: 'setting_key' });
  return !error;
}

export interface ManifestRun {
  at: string;
  status: string;
  orders: number;
  meals: number;
  date: string;
  to?: string;
}

/** Runs the 09:00 email immediately. Returns a message describing what happened. */
export async function sendManifestNowFromDb(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('daily-kitchen-manifest', { body: {} });
  if (error) {
    const body = await (error as any).context?.json?.().catch(() => null);
    return body?.error || 'The manifest could not be sent.';
  }
  if (data?.status === 'no orders') return 'There are no orders for delivery today, so nothing was sent.';
  return `Manifest sent: ${data.orders} orders, ${data.meals} meals.`;
}

// ============================================================================
// 9. CORPORATE ACCOUNT DB PERSISTENCE (Enrolling & Updating Companies)
// ============================================================================

export async function adminAddCompanyToDb(
  name: string,
  domain: string,
  locations: string[],
  distanceKm: number = 8.0,
  discountType: 'percentage' | 'fixed_zar' = 'percentage',
  discountValue: number = 0,
  billingEmail?: string,
  deliveryFeeMode: 'free' | 'flat' | 'distance' = 'distance',
  flatFeeAmount: number = 20.0
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const primaryAddress = locations[0] || `${name.trim()} Head Office, Sandton`;

  // Try inserting with extended columns first, then fallback to base schema columns if migration v5 isn't applied yet
  let compData: { id: string } | null = null;
  const fullPayload: Record<string, any> = {
    name: name.trim(),
    slug: `${slug}-${Date.now().toString().slice(-4)}`,
    street_address: primaryAddress,
    city: 'Johannesburg',
    postal_code: '2196',
    distance_km: distanceKm,
    discount_type: discountType,
    discount_value: discountValue,
    billing_email: billingEmail || `accounts@${domain || `${slug}.co.za`}`,
    delivery_fee_mode: deliveryFeeMode,
    flat_fee_amount: flatFeeAmount,
    is_active: true,
  };

  const { data: firstTry, error: firstErr } = await supabase
    .from('companies')
    .insert(fullPayload)
    .select('id')
    .single();

  if (!firstErr && firstTry) {
    compData = firstTry;
  } else {
    const fallbackPayload: Record<string, any> = {
      name: name.trim(),
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      street_address: primaryAddress,
      distance_km: distanceKm,
      discount_type: discountType,
      discount_value: discountValue,
      is_active: true,
    };
    const { data: secondTry, error: secondErr } = await supabase
      .from('companies')
      .insert(fallbackPayload)
      .select('id')
      .single();

    if (secondErr || !secondTry) {
      console.warn('Error inserting company into Supabase:', secondErr || firstErr);
      return null;
    }
    compData = secondTry;
  }

  const companyId = compData.id;

  if (domain) {
    await supabase.from('company_domains').insert({
      company_id: companyId,
      domain: domain.trim().toLowerCase(),
      is_active: true,
    });
  }

  if (locations.length > 0) {
    await adminSyncCompanyLocationsInDb(companyId, locations);
  }

  return companyId;
}

export async function adminSyncCompanyLocationsInDb(
  companyId: string,
  locations: string[]
): Promise<boolean> {
  if (!isSupabaseConfigured() || !companyId) return false;

  const cleanLocations = locations.map((l) => l.trim()).filter(Boolean);
  if (cleanLocations.length === 0) return false;

  // Sites are matched by the label admins see, so unchanged sites keep their building and floors.
  const { data: existing, error: readErr } = await supabase
    .from('delivery_locations')
    .select('id, location_name, building_name')
    .eq('company_id', companyId);
  if (readErr) return false;

  const labelsOf = (l: any) => [l.location_name, `${l.location_name} • ${l.building_name}`];
  const kept = (existing || []).filter((l: any) => labelsOf(l).some((x) => cleanLocations.includes(x)));
  const removed = (existing || []).filter((l: any) => !kept.includes(l));
  const added = cleanLocations.filter((name) => !kept.some((l: any) => labelsOf(l).includes(name)));

  if (added.length > 0) {
    const { data: inserted, error } = await supabase
      .from('delivery_locations')
      .insert(
        added.map((name) => ({
          company_id: companyId,
          location_name: name,
          building_name: name,
          street_address: name,
          city: 'Johannesburg',
          postal_code: '2196',
        }))
      )
      .select('id, location_name');

    if (error || !inserted) {
      console.warn('Error adding company delivery locations in Supabase:', error);
      return false;
    }

    const { error: floorErr } = await supabase.from('dropoff_floors').insert(
      inserted.map((l: any) => ({
        location_id: l.id,
        floor_label: l.location_name,
        description: 'Designated corporate delivery point',
        is_default: true,
      }))
    );
    if (floorErr) return false;
  }

  if (removed.length > 0) {
    const { error } = await supabase
      .from('delivery_locations')
      .delete()
      .in('id', removed.map((l: any) => l.id));
    if (error) return false;
  }

  return true;
}

export async function adminUpdateCompanyInDb(
  companyId: string,
  updates: {
    distanceKm?: number;
    discountType?: 'percentage' | 'fixed_zar';
    discountValue?: number;
    isActive?: boolean;
    billingEmail?: string;
    mealSubsidyAmount?: number;
    deliveryFeeMode?: 'free' | 'flat' | 'distance';
    flatFeeAmount?: number;
    locations?: string[];
  }
): Promise<boolean> {
  if (!isSupabaseConfigured() || !companyId) return false;

  if (updates.locations && updates.locations.length > 0) {
    if (!(await adminSyncCompanyLocationsInDb(companyId, updates.locations))) return false;
  }

  const baseUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.distanceKm !== undefined) baseUpdates.distance_km = updates.distanceKm;
  if (updates.discountType !== undefined) baseUpdates.discount_type = updates.discountType;
  if (updates.discountValue !== undefined) baseUpdates.discount_value = updates.discountValue;
  if (updates.isActive !== undefined) baseUpdates.is_active = updates.isActive;
  if (updates.locations && updates.locations[0]) baseUpdates.street_address = updates.locations[0];

  const extendedUpdates: Record<string, any> = { ...baseUpdates };
  if (updates.billingEmail !== undefined) extendedUpdates.billing_email = updates.billingEmail;
  if (updates.mealSubsidyAmount !== undefined) extendedUpdates.meal_subsidy_amount = updates.mealSubsidyAmount;
  if (updates.deliveryFeeMode !== undefined) extendedUpdates.delivery_fee_mode = updates.deliveryFeeMode;
  if (updates.flatFeeAmount !== undefined) extendedUpdates.flat_fee_amount = updates.flatFeeAmount;

  const { error } = await supabase.from('companies').update(extendedUpdates).eq('id', companyId);
  if (error) {
    // Fallback to base columns if extended columns are not yet migrated
    const { error: fallbackErr } = await supabase.from('companies').update(baseUpdates).eq('id', companyId);
    return !fallbackErr;
  }
  return true;
}

export async function adminAddDomainToCompanyInDb(
  companyId: string,
  domain: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !companyId || !domain) return false;

  const { error } = await supabase.from('company_domains').insert({
    company_id: companyId,
    domain: domain.trim().toLowerCase(),
    is_active: true,
  });

  return !error;
}

// ============================================================================
// 10. PLATFORM SETTINGS & EMAIL ROUTING DIRECTORY (Live DB + Local Fallback)
// ============================================================================

export async function fetchEmailRoutingDirectoryFromDb(): Promise<EmailRoutingDirectory | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'email_routing_directory')
      .maybeSingle();

    if (error || !data?.setting_value) return null;
    return data.setting_value as EmailRoutingDirectory;
  } catch {
    return null;
  }
}

export async function saveEmailRoutingDirectoryToDb(
  directory: EmailRoutingDirectory
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from('platform_settings')
      .upsert(
        {
          setting_key: 'email_routing_directory',
          setting_value: directory,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'setting_key' }
      );
    return !error;
  } catch {
    return false;
  }
}
