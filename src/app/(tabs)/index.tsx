import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, StatusBar, Modal, ScrollView, useWindowDimensions, Animated, RefreshControl, Image } from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKitchen } from '../../context/KitchenCoContext';
import { DeliveryEstimator } from '../../components/DeliveryEstimator';
import { CutoffCountdown } from '../../components/CutoffCountdown';
import { QuickAddButton } from '../../components/QuickAddButton';
import { Skeleton } from '../../components/Skeleton';
import { getUpcomingOrderableWeekdays, UpcomingWeekday, ORDER_CUTOFF_LABEL } from '../../utils/deliveryHelpers';
import { useResponsive } from '../../utils/responsive';
import { useSimulatedLoad } from '../../utils/useSimulatedLoad';
import { APP_MAX_WIDTH, ThemeColors } from '../../utils/theme';

import staticMenuData from '../../data/staticMenu.json';
import cycleMenuData from '../../data/cycleMenu.json';

interface SizeOption { label: string; price: number; }

interface UIReadyItem {
  id: string; name: string; description: string;
  category: string; image?: string; sizes: SizeOption[];
  /** Optional dietary tags (e.g. "Keto", "Vegan") — only rendered when present in menu data. */
  tags?: string[];
}

const CYCLE_ITEM_PRICE = 80;
const PAGE_PADDING = 16;
const CARD_GAP = 20; // minimum horizontal gutter (actual gap grows via space-between)
const ROW_GAP = 28; // vertical spacing between grid rows

const MEAL_TYPE_COLORS: Record<string, string> = {
  'MAIN MEAL': '#FF7F50', 'VEGETARIAN MEAL': '#22C55E',
  'HEALTHY MEAL': '#06C167', 'CURRY OF THE DAY': '#FF9500', 'GOURMET SANDWICH': '#5AC8FA',
};

// A signature colour per Main Menu category — tints each card's image
// placeholder so the grid reads as varied and photo-like even without real
// food photography, the same trick already used for the Today's Menu cards.
const STATIC_CATEGORY_COLORS: Record<string, string> = {
  'CIAO ITALY': '#FF7F50',
  'STIR FRY': '#FF9500',
  'POKE BOWL': '#06C167',
  'WRAPS': '#F4B400',
  'HOT DOGS': '#E63946',
  'BURGER BAR': '#D97706',
  'SALAD BAR': '#22C55E',
  'SANDWICHES': '#5AC8FA',
  'FITNESS MEALS': '#00C2A8',
  'VEGAN MEALS': '#65A30D',
  'SOUPS': '#C2410C',
  'RAMEN BOWLS': '#DC2626',
  'PORK SPECIALITIES': '#B45309',
  "CHEF'S MEAL OF THE DAY": '#A855F7',
};

// One real, freely-licensed (Pexels License — free for commercial use) photo
// per Main Menu category, replacing the old per-item emoji placeholder. The
// client asked for genuine photography here, not per-dish photos — every
// item in a category shares that category's single image.
const STATIC_CATEGORY_IMAGES: Record<string, string> = {
  'CIAO ITALY': 'https://images.pexels.com/photos/5531093/pexels-photo-5531093.jpeg?auto=compress&cs=tinysrgb&w=400',
  'STIR FRY': 'https://images.pexels.com/photos/33145258/pexels-photo-33145258.jpeg?auto=compress&cs=tinysrgb&w=400',
  'POKE BOWL': 'https://images.pexels.com/photos/4770328/pexels-photo-4770328.jpeg?auto=compress&cs=tinysrgb&w=400',
  'WRAPS': 'https://images.pexels.com/photos/15076695/pexels-photo-15076695.jpeg?auto=compress&cs=tinysrgb&w=400',
  'HOT DOGS': 'https://images.pexels.com/photos/29476591/pexels-photo-29476591.jpeg?auto=compress&cs=tinysrgb&w=400',
  'BURGER BAR': 'https://images.pexels.com/photos/36007382/pexels-photo-36007382.jpeg?auto=compress&cs=tinysrgb&w=400',
  'SALAD BAR': 'https://images.pexels.com/photos/842545/pexels-photo-842545.jpeg?auto=compress&cs=tinysrgb&w=400',
  'SANDWICHES': 'https://images.pexels.com/photos/11256670/pexels-photo-11256670.jpeg?auto=compress&cs=tinysrgb&w=400',
  'FITNESS MEALS': 'https://images.pexels.com/photos/30635717/pexels-photo-30635717.jpeg?auto=compress&cs=tinysrgb&w=400',
  'VEGAN MEALS': 'https://images.pexels.com/photos/19647374/pexels-photo-19647374.jpeg?auto=compress&cs=tinysrgb&w=400',
  'SOUPS': 'https://images.pexels.com/photos/8738017/pexels-photo-8738017.jpeg?auto=compress&cs=tinysrgb&w=400',
  'RAMEN BOWLS': 'https://images.pexels.com/photos/31393431/pexels-photo-31393431.jpeg?auto=compress&cs=tinysrgb&w=400',
  'PORK SPECIALITIES': 'https://images.pexels.com/photos/15876423/pexels-photo-15876423.jpeg?auto=compress&cs=tinysrgb&w=400',
  "CHEF'S MEAL OF THE DAY": 'https://images.pexels.com/photos/7243881/pexels-photo-7243881.jpeg?auto=compress&cs=tinysrgb&w=400',
};

// Same idea for the Today's Menu (cycle) meal types.
const CYCLE_MEAL_TYPE_IMAGES: Record<string, string> = {
  'MAIN MEAL': 'https://images.pexels.com/photos/38330332/pexels-photo-38330332.jpeg?auto=compress&cs=tinysrgb&w=400',
  'VEGETARIAN MEAL': 'https://images.pexels.com/photos/17486827/pexels-photo-17486827.jpeg?auto=compress&cs=tinysrgb&w=400',
  'HEALTHY MEAL': 'https://images.pexels.com/photos/25315523/pexels-photo-25315523.jpeg?auto=compress&cs=tinysrgb&w=400',
  'CURRY OF THE DAY': 'https://images.pexels.com/photos/33643313/pexels-photo-33643313.jpeg?auto=compress&cs=tinysrgb&w=400',
  'GOURMET SANDWICH': 'https://images.pexels.com/photos/19202827/pexels-photo-19202827.jpeg?auto=compress&cs=tinysrgb&w=400',
};

const FALLBACK_CATEGORY_IMAGE = STATIC_CATEGORY_IMAGES["CHEF'S MEAL OF THE DAY"];

// Category names live in data as shouty caps ("CIAO ITALY") since that's how
// the client's product list is authored — display-only title-casing here
// (never used for matching/lookup) reads calmer, closer to the reference UI.
function formatCategoryLabel(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.replace(/^[a-z]/, c => c.toUpperCase()))
    .join(' ');
}

export default function MenuScreen() {
  const { addToCart, cart, activeWeek, theme, discounts, menus, user, triggerCartFly } = useKitchen();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { isLoading, refreshing, refresh } = useSimulatedLoad();
  const addToCartBtnRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const router = useRouter();
  const [menuView, setMenuView] = useState<'main' | 'today'>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isCycleItem, setIsCycleItem] = useState(false);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
  // Which upcoming weekdays (Main Menu only) this order should be scheduled for.
  // Empty = a normal, undated order. Only static-menu items support this — the
  // rotating weekly menu's content is admin-controlled week to week, so it isn't
  // safe to let customers book against it 2 weeks out.
  const [selectedDeliveryDates, setSelectedDeliveryDates] = useState<string[]>([]);
  // Per-date quantity, only used once 2+ dates are selected — lets a customer
  // put e.g. 3 of an item on one date and 6 on another in a single Add to
  // Cart pass instead of the shared QUANTITY stepper applying to every date.
  const [dateQuantities, setDateQuantities] = useState<Record<string, number>>({});
  // Names of category-level extras (e.g. "Extra Bacon") selected for the item
  // currently open in the customize modal — an Uber-Eats-style modifier tied
  // to this specific order, not a standalone browsable menu item.
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const upcomingWeekdays = useMemo(() => getUpcomingOrderableWeekdays(), []);

  // Today's Menu (cycle items) can now be pre-ordered up to a week ahead —
  // narrower than the Main Menu's ~2-3 week horizon, so this only takes
  // "This week"/"Next week" out of the shared upcomingWeekdays list (not
  // "In 2 weeks"). The 2-3 business day advance cutoff is still enforced for
  // free, since upcomingWeekdays never contains a date earlier than
  // getOrderCutoffInfo().earliestDeliveryDate.
  const cycleOrderableDays = useMemo(
    () => upcomingWeekdays.filter(w => w.weekLabel !== 'In 2 weeks'),
    [upcomingWeekdays]
  );
  // Multiple days can be picked at once — each checked day gets its own
  // "day header + meal grid" section stacked on the page (see
  // renderCycleMenu), so a customer can browse and add meals for e.g.
  // Monday and Friday without losing sight of either. Seeded with the
  // earliest orderable day so the page isn't blank on first load — this has
  // to be a real, recorded selection (not just a display fallback used only
  // when the array is empty), otherwise checking a second day would make the
  // first day's section vanish the moment the array stops being empty.
  const [selectedCycleDates, setSelectedCycleDates] = useState<string[]>(
    () => (cycleOrderableDays[0] ? [cycleOrderableDays[0].iso] : [])
  );
  const toggleCycleDate = (iso: string) => {
    setSelectedCycleDates(prev => {
      if (prev.includes(iso)) {
        // Keep at least one day selected — an empty picker would otherwise
        // read as "no dates available" (a different, genuine empty state).
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== iso);
      }
      return [...prev, iso];
    });
  };
  const activeCycleDays = useMemo(
    () => cycleOrderableDays.filter(w => selectedCycleDates.includes(w.iso)),
    [selectedCycleDates, cycleOrderableDays]
  );

  // Which rotation week (Week 1-8 in cycleMenu.json) a given upcoming weekday
  // pulls its meals from. The admin only ever sets "which week is live right
  // now" (see admin.tsx WeeksSection) with no calendar anchoring, so a future
  // date is projected forward from that as "N rotation-weeks after the
  // currently active one" — This week = the active week itself, Next week =
  // the week after, In 2 weeks = two after, wrapping through the 8 stored
  // weeks. This is an assumption, not a guarantee: it's only accurate if the
  // admin keeps advancing the active week on schedule.
  const CYCLE_WEEK_OFFSET: Record<UpcomingWeekday['weekLabel'], number> = {
    'This week': 0,
    'Next week': 1,
    'In 2 weeks': 2,
  };
  const getCycleWeekKeyForDate = (day: UpcomingWeekday): string => {
    const rotationWeek = ((activeWeek - 1 + CYCLE_WEEK_OFFSET[day.weekLabel]) % 8) + 1;
    return `Week ${rotationWeek}`;
  };

  // Card sizing follows the responsive app frame. Phones keep the compact
  // 2-column grid; tablets widen the frame and move to 3 columns so cards
  // stay readable instead of stretching.
  // 4px slack guards against scrollbar / sub-pixel rounding on web so cards
  // always genuinely fit side-by-side (prevents list-like wrapping).
  const { width: windowWidth } = useWindowDimensions();
  const { isTablet, contentMaxWidth } = useResponsive();
  const frameWidth = Math.min(windowWidth, contentMaxWidth);
  const usableWidth = frameWidth - PAGE_PADDING * 2 - 4;
  const numColumns = isTablet ? 3 : 2;
  const CARD_WIDTH = Math.floor((usableWidth - CARD_GAP * (numColumns - 1)) / numColumns);

  const getItemQuantity = (id: string) => {
    const item = cart.find(c => c.id === id);
    return item ? item.quantity : 0;
  };

  const categoryIcons = useMemo(() => {
    if (!staticMenuData || typeof staticMenuData !== 'object') return {};
    return (staticMenuData as any)._icons || {};
  }, []);

  // Looks up the one real photo standing in for a category (static menu
  // categories and cycle meal types share the same lookup) — see
  // STATIC_CATEGORY_IMAGES / CYCLE_MEAL_TYPE_IMAGES above.
  const getCategoryImage = (category: string): string =>
    STATIC_CATEGORY_IMAGES[category] || CYCLE_MEAL_TYPE_IMAGES[category] || FALLBACK_CATEGORY_IMAGE;

  // `menus` (from context) is the single source of truth — the same data
  // admin's Meals tab reads and writes. Flatten it into the flat, per-item
  // shape the rest of this screen (search, filters, grid) already expects.
  const flattenedStaticMenu = useMemo((): UIReadyItem[] => {
    return menus.flatMap(cat =>
      cat.items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: cat.name,
        image: item.image,
        sizes: item.sizes,
        tags: item.tags,
      }))
    );
  }, [menus]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(flattenedStaticMenu.map(item => item.category)));
    return cats;
  }, [flattenedStaticMenu]);

  const filteredStaticMenu = useMemo(() => {
    let items = flattenedStaticMenu;

    if (selectedCategory) {
      items = items.filter(item => item.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }

    return items;
  }, [flattenedStaticMenu, searchQuery, selectedCategory]);

  const handleAddItem = (item: UIReadyItem) => {
    setSelectedItem(item);
    setSpecialInstructions('');
    setIsCycleItem(false);
    setModalQuantity(1);
    setSelectedSizeIndex(0);
    setSelectedDeliveryDates([]);
    setDateQuantities({});
    setSelectedAddOns(new Set());
  };

  const toggleDeliveryDate = (iso: string) => {
    const isSelected = selectedDeliveryDates.includes(iso);
    if (isSelected) {
      setSelectedDeliveryDates(prev => prev.filter(d => d !== iso));
      setDateQuantities(prev => {
        const next = { ...prev };
        delete next[iso];
        return next;
      });
    } else {
      setSelectedDeliveryDates(prev => [...prev, iso]);
      // Always starts at 1, not the shared stepper's current value — that
      // stepper only reflects the last date it was displayed for (0 or 1
      // dates selected), so carrying it over to a newly added date would be
      // an arbitrary leftover value, not a deliberate choice for this date.
      setDateQuantities(prev => ({ ...prev, [iso]: prev[iso] ?? 1 }));
    }
  };

  const setDateQuantity = (iso: string, qty: number) => {
    setDateQuantities(prev => ({ ...prev, [iso]: Math.max(1, Math.min(20, qty)) }));
  };

  const toggleAddOn = (name: string) => {
    setSelectedAddOns(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const confirmAddToCart = () => {
    if (!selectedItem) return;
    const chosenSize = selectedItem.sizes[selectedSizeIndex] || selectedItem.sizes[0];

    const categoryAddOns = menus.find(c => c.name === selectedItem.category)?.addOns;
    const chosenAddOns = categoryAddOns?.filter(a => selectedAddOns.has(a.name)) ?? [];
    const addOnsTotal = chosenAddOns.reduce((sum, a) => sum + a.price, 0);
    // Distinct add-on selections on the same dish must land as separate cart
    // lines (not silently merge/overwrite each other) — addToCart merges by id.
    const addOnsIdSuffix = chosenAddOns.length > 0
      ? `::addons=${chosenAddOns.map(a => a.name).sort().join(',')}`
      : '';

    // Main Menu items can optionally be pre-scheduled across several weekdays
    // in one go; a cycle item instead carries the single date already picked
    // on the Today's Menu screen (selectedItem.deliveryDate); an undated add
    // just places a single normal order.
    const datesToApply = isCycleItem
      ? [selectedItem.deliveryDate as string | undefined]
      : selectedDeliveryDates.length > 0
        ? selectedDeliveryDates
        : [undefined];

    datesToApply.forEach((iso) => {
      const dateMeta = iso ? upcomingWeekdays.find(w => w.iso === iso) : undefined;
      // With 2+ dates selected, each date uses its own stepper value (see
      // dateQuantities); a single date/undated add still uses the shared
      // QUANTITY stepper.
      const qtyForDate = iso && selectedDeliveryDates.length > 1
        ? (dateQuantities[iso] ?? 1)
        : modalQuantity;
      for (let i = 0; i < qtyForDate; i++) {
        addToCart({
          id: (iso ? `${selectedItem.id}::${iso}` : selectedItem.id) + addOnsIdSuffix,
          name: selectedItem.name,
          price: chosenSize.price + addOnsTotal,
          category: selectedItem.category,
          quantity: 1,
          image: selectedItem.image,
          selectedSize: chosenSize.label,
          notes: specialInstructions || undefined,
          deliveryDate: iso,
          deliveryDateLabel: dateMeta?.label,
          addOns: chosenAddOns.length > 0 ? chosenAddOns : undefined,
        });
      }
    });

    setSelectedItem(null);
    setSpecialInstructions('');
    setIsCycleItem(false);
    setSelectedDeliveryDates([]);
    setDateQuantities({});
    setSelectedAddOns(new Set());
  };

  const handleAddCycleItem = (mealName: string, mealType: string, day: UpcomingWeekday, weekName: string) => {
    const cycleItem = {
      id: `cycle-${weekName}-${day.dayName}-${mealType}-${mealName.replace(/\s+/g, '')}`,
      name: mealName,
      description: mealType.replace(/_/g, ' '),
      category: `${weekName} • ${day.dayName}`,
      sizes: [{ label: 'Regular', price: CYCLE_ITEM_PRICE }],
      mealType,
      day: day.dayName,
      weekName,
      // Carries the customer's chosen delivery date through to the cart —
      // picked on the Today's Menu screen itself (see activeCycleDays), not
      // in this add-to-cart modal like the Main Menu's multi-date picker.
      deliveryDate: day.iso,
      deliveryDateLabel: day.label,
    };
    setSelectedItem(cycleItem);
    setSpecialInstructions('');
    setIsCycleItem(true);
    setModalQuantity(1);
    setSelectedSizeIndex(0);
    setSelectedDeliveryDates([]);
    setSelectedAddOns(new Set());
  };

  const renderCategoryFilter = () => {
    if (menuView !== 'main') return null;

    return (
      <View style={styles.categoryFilterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(cat) => cat}
          renderItem={({ item: category }) => {
            const isActive = selectedCategory === category;
            return (
              <TouchableOpacity
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(isActive ? null : category)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${formatCategoryLabel(category)} category`}
              >
                <Text style={styles.categoryChipIcon}>{categoryIcons[category] || '🍽️'}</Text>
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {formatCategoryLabel(category)}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListHeaderComponent={
            <TouchableOpacity
              style={[styles.categoryChip, selectedCategory === null && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(null)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedCategory === null }}
              accessibilityLabel="All categories"
            >
              <Text style={[styles.categoryChipText, selectedCategory === null && styles.categoryChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
          }
        />
      </View>
    );
  };

  // Find applicable discounts for an item (active, non-expired)
  const getItemDiscounts = (item: UIReadyItem) => {
    const now = new Date();
    return discounts.filter(d => {
      if (!d.active) return false;
      if (d.expires) {
        const expiry = new Date(d.expires);
        if (expiry < now) return false;
      }
      // Check if this discount targets this item
      if (d.itemName) return item.name.toLowerCase() === d.itemName.toLowerCase();
      if (d.categoryId) return item.category.toLowerCase() === d.categoryId.toLowerCase();
      if (d.company) return item.category.toLowerCase().includes(d.company.toLowerCase());
      return false; // Global discounts shown elsewhere, not per-item
    });
  };

  // Extract grid item renderer for reusability
  const renderGridItem = ({ item }: { item: UIReadyItem }) => {
    const qty = getItemQuantity(item.id);
    const rawPrice = item.sizes[0] ? item.sizes[0].price : 0;
    const itemDiscounts = getItemDiscounts(item);
    const hasDiscount = itemDiscounts.length > 0;
    const discountedPrice = hasDiscount ? rawPrice * (1 - itemDiscounts[0].percentage / 100) : rawPrice;
    const displayPrice = `R${discountedPrice.toFixed(0)}`;
    const originalDisplayPrice = `R${rawPrice.toFixed(0)}`;
    const categoryColor = STATIC_CATEGORY_COLORS[item.category] || theme.textSecondary;

    return (
      <TouchableOpacity
        style={[styles.uberCard, { width: CARD_WIDTH }]}
        activeOpacity={0.9}
        onPress={() => handleAddItem(item)}
        accessibilityLabel={`${item.name}, ${displayPrice}`}
      >
        {/* Thin category-colour accent, replacing the old empty image placeholder */}
        <View style={[styles.uberAccentBar, { backgroundColor: categoryColor }]} />

        {/* Content Section */}
        <View style={styles.uberContent}>
          <View style={styles.uberTopRow}>
            <Text style={[styles.uberItemName, styles.uberItemNameFlex]} numberOfLines={2}>{item.name}</Text>
            <QuickAddButton quantity={qty} onPress={() => handleAddItem(item)} theme={theme} />
          </View>
          {item.description ? (
            <Text style={styles.uberItemDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View style={styles.uberMetaRow}>
            <View style={styles.uberPriceRow}>
              <Text style={styles.uberPrice}>{displayPrice}</Text>
              {hasDiscount && <Text style={styles.uberOriginalPrice}>{originalDisplayPrice}</Text>}
            </View>
            {hasDiscount && (
              <Text style={styles.menuDiscountHint}>
                {itemDiscounts[0].percentage}% OFF
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Properly aligned grid layout for static menu using FlatList numColumns
  const renderStaticMenuGrid = () => {
    const itemsByCategory = filteredStaticMenu.reduce<Record<string, UIReadyItem[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    const sections = Object.entries(itemsByCategory);

    return (
      <FlatList
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.text} colors={[theme.text]} />
        }
        ListHeaderComponent={
          <View style={styles.deliverySection}>
            <DeliveryEstimator theme={theme} />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptySub}>Try different keywords or clear your search</Text>
          </View>
        }
        data={sections}
        keyExtractor={([cat]) => cat}
        renderItem={({ item: [category, items] }) => (
          <View style={styles.categorySection}>
            {/* One real photo per category — shown once here at the top of that
                category's items (this is what a category chip filters down to),
                never per-item. */}
            <View style={styles.categoryBanner}>
              <Image source={{ uri: getCategoryImage(category) }} style={styles.categoryBannerImage} resizeMode="cover" />
              <View style={styles.categoryBannerOverlay} />
              <Text style={styles.categoryBannerTitle}>{formatCategoryLabel(category)}</Text>
            </View>

            {/* 2-column grid - identical layout to Today's Menu */}
                        <FlatList
              key={`grid-${numColumns}`}
              data={items}
              keyExtractor={(item) => item.id}
              numColumns={numColumns}
              columnWrapperStyle={styles.uberGridColumn}
              scrollEnabled={false}
              nestedScrollEnabled={true}
              renderItem={renderGridItem}
              contentContainerStyle={styles.uberGrid}
            />
          </View>
        )}
      />
    );
  };

  // Today's Menu — customer picks one or more upcoming orderable weekdays
  // (same 2-3-business-day-minimum list the Main Menu uses) and each picked
  // day gets its own "day header + meal grid" section stacked on the page
  // (e.g. Monday's meals, then Friday's meals underneath), instead of only
  // ever showing a single day at a time. Which rotation week a date pulls
  // its meals from is projected from the admin's current "active week" (see
  // getCycleWeekKeyForDate above) — a given day's meals can genuinely differ
  // from another day's even within the same page.
  const renderCycleMenu = () => {
    if (!cycleMenuData) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>No menu available</Text>
          <Text style={styles.emptySub}>Check back later</Text>
        </View>
      );
    }

    if (activeCycleDays.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>No orderable dates available</Text>
          <Text style={styles.emptySub}>Check back later</Text>
        </View>
      );
    }

    // Resolves one day's meals (and which rotation week they came from) —
    // called once per section below, since each selected day can land in a
    // different rotation week.
    const getMealsForDay = (day: UpcomingWeekday) => {
      const weekKey = getCycleWeekKeyForDate(day);
      const weekData = (cycleMenuData as any)[weekKey];
      if (!weekData || !Array.isArray(weekData)) return { weekKey, meals: null as null | { mealType: string; mealDescription: string }[] };
      const dayData = weekData.find((dayObj: any) => dayObj.DAY === day.dayName);
      const meals = dayData
        ? Object.entries(dayData)
            .filter(([k]) => k !== 'DAY')
            .map(([mealType, mealDescription]: [string, any]) => ({
              mealType,
              mealDescription: typeof mealDescription === 'string' ? mealDescription : String(mealDescription),
            }))
        : [];
      return { weekKey, meals };
    };

    // Cycle meal card renderer
    const renderCycleCard = (
      meal: { mealType: string; mealDescription: string },
      day: UpcomingWeekday,
      weekKeyStr: string
    ) => {
      const color = MEAL_TYPE_COLORS[meal.mealType] || '#8E8E93';
      const mealName = meal.mealDescription;
      const qty = getItemQuantity(`cycle-${weekKeyStr}-${day.dayName}-${meal.mealType}-${mealName.replace(/\s+/g, '')}`);

      return (
        <TouchableOpacity
          style={[styles.uberCard, { width: CARD_WIDTH }]}
          activeOpacity={0.7}
          onPress={() => handleAddCycleItem(mealName, meal.mealType, day, weekKeyStr)}
          accessibilityLabel={`${mealName}, R${CYCLE_ITEM_PRICE}`}
        >
          <View style={[styles.uberAccentBar, { backgroundColor: color }]} />
          <View style={styles.uberContent}>
            <Text style={[styles.cycleMealType, { color }]}>{meal.mealType.replace(/_/g, ' ')}</Text>
            <View style={styles.uberTopRow}>
              <Text style={[styles.uberItemName, styles.uberItemNameFlex]} numberOfLines={2}>{mealName}</Text>
              <QuickAddButton
                quantity={qty}
                onPress={() => handleAddCycleItem(mealName, meal.mealType, day, weekKeyStr)}
                theme={theme}
              />
            </View>
            <View style={styles.uberMetaRow}>
              <Text style={styles.uberPrice}>R{CYCLE_ITEM_PRICE}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.text} colors={[theme.text]} />
        }
      >
        <View style={styles.deliveryDatesSection}>
          <Text style={styles.notesLabel}>DELIVERY DATE</Text>
          <Text style={styles.deliveryHint}>
            Pick one or more days to browse and order — each day's meals appear in their own section below. Orders still close {ORDER_CUTOFF_LABEL} at least 2 business days ahead.
          </Text>
          {(['This week', 'Next week'] as const).map((group) => {
            const groupDays = cycleOrderableDays.filter(w => w.weekLabel === group);
            if (groupDays.length === 0) return null;
            return (
              <View key={group} style={styles.deliveryGroup}>
                <Text style={styles.deliveryGroupLabel}>{group}</Text>
                <View style={styles.deliveryChipRow}>
                  {groupDays.map((day) => {
                    const isSelected = activeCycleDays.some(d => d.iso === day.iso);
                    return (
                      <TouchableOpacity
                        key={day.iso}
                        style={[styles.deliveryChip, isSelected && styles.deliveryChipActive]}
                        onPress={() => toggleCycleDate(day.iso)}
                        activeOpacity={0.8}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={day.label}
                      >
                        <Text style={[styles.deliveryChipText, isSelected && styles.deliveryChipTextActive]}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.weekStatusRow}>
          <CutoffCountdown compact theme={theme} />
        </View>

        {activeCycleDays.map((day) => {
          const { weekKey, meals } = getMealsForDay(day);
          return (
            <View key={day.iso} style={styles.categorySection}>
              <View style={styles.dayHeaderBar}>
                <View style={styles.dayHeaderLeft}>
                  <View style={styles.todayDot} />
                  <Text style={[styles.dayTitle, styles.dayTitleToday]}>{day.label}</Text>
                </View>
                {meals && meals.length > 0 && <Text style={styles.dayMealCount}>{meals.length} meals</Text>}
              </View>
              {meals === null ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>📅</Text>
                  <Text style={styles.emptyTitle}>{weekKey} menu not available</Text>
                  <Text style={styles.emptySub}>Check back later for this week's schedule</Text>
                </View>
              ) : meals.length > 0 ? (
                <FlatList
                  key={`cycle-${day.iso}-${numColumns}`}
                  data={meals}
                  keyExtractor={(_, idx) => `cycle-${day.iso}-${idx}`}
                  numColumns={numColumns}
                  columnWrapperStyle={styles.uberGridColumn}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                  renderItem={({ item: meal }) => renderCycleCard(meal, day, weekKey)}
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>😴</Text>
                  <Text style={styles.emptyTitle}>No meals scheduled for {day.dayName}</Text>
                  <Text style={styles.emptySub}>Try a different date above.</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // Brief shimmer shown for the useSimulatedLoad() initial-load window — a
  // stand-in for the real fetch this screen will eventually make.
  const renderMenuSkeleton = () => (
    <View style={styles.listContainer}>
      <View style={styles.uberGridColumn}>
        {[0, 1].map(i => <Skeleton key={`s1-${i}`} theme={theme} style={{ width: CARD_WIDTH, height: 190 }} />)}
      </View>
      <View style={styles.uberGridColumn}>
        {[0, 1].map(i => <Skeleton key={`s2-${i}`} theme={theme} style={{ width: CARD_WIDTH, height: 190 }} />)}
      </View>
      <View style={styles.uberGridColumn}>
        {[0, 1].map(i => <Skeleton key={`s3-${i}`} theme={theme} style={{ width: CARD_WIDTH, height: 190 }} />)}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />

      {/* Admins land here deliberately (via "Preview App") to see exactly what a
          customer sees while editing items — not to place personal orders. */}
      {user?.role === 'admin' && (
        <View style={styles.previewBanner}>
          <View style={styles.previewBannerLeft}>
            <Ionicons name="eye" size={14} color={theme.text} />
            <Text style={styles.previewBannerText}>Previewing as a customer</Text>
          </View>
          <TouchableOpacity onPress={() => router.replace('/admin')} accessibilityRole="button" accessibilityLabel="Exit customer preview">
            <Text style={styles.previewBannerExit}>Exit Preview</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar - at the top */}
      <View style={styles.searchSection}>
        <View style={styles.searchWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search dishes, meals..."
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search dishes, meals"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.searchClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Text style={styles.searchClearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, menuView === 'main' && styles.toggleBtnActive]}
          onPress={() => setMenuView('main')}
          accessibilityRole="button"
          accessibilityState={{ selected: menuView === 'main' }}
        >
          <Text style={[styles.toggleBtnText, menuView === 'main' && styles.toggleBtnTextActive]}>Main Menu</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, menuView === 'today' && styles.toggleBtnActive]}
          onPress={() => setMenuView('today')}
          accessibilityRole="button"
          accessibilityState={{ selected: menuView === 'today' }}
        >
          <Text style={[styles.toggleBtnText, menuView === 'today' && styles.toggleBtnTextActive]}>Today's Menu</Text>
        </TouchableOpacity>
      </View>

      {menuView === 'main' && (
        <Text style={styles.exploreHeading}>Explore the menu</Text>
      )}
      {menuView === 'main' ? renderCategoryFilter() : null}

      {isLoading ? renderMenuSkeleton() : (menuView === 'main' ? renderStaticMenuGrid() : renderCycleMenu())}

      {/* Add to Cart Modal with Notes */}
      <Modal
        visible={!!selectedItem}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isCycleItem ? 'Add Meal' : 'Customize Order'}</Text>
              <TouchableOpacity
                onPress={() => setSelectedItem(null)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedItem && (() => {
              const activeSize = selectedItem.sizes[selectedSizeIndex] || selectedItem.sizes[0];
              const categoryAddOns = menus.find(c => c.name === selectedItem.category)?.addOns;
              const addOnsTotal = (categoryAddOns ?? [])
                .filter(a => selectedAddOns.has(a.name))
                .reduce((sum, a) => sum + a.price, 0);
              // With 2+ dates selected each has its own quantity; otherwise
              // it's just the shared QUANTITY stepper (0 or 1 dates picked).
              const totalUnits = !isCycleItem && selectedDeliveryDates.length > 1
                ? selectedDeliveryDates.reduce((sum, iso) => sum + (dateQuantities[iso] ?? 1), 0)
                : modalQuantity;
              const lineTotal = (activeSize.price + addOnsTotal) * totalUnits;

              return (
                <>
                  <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.modalItemInfo}>
                      <View style={styles.modalItemDetails}>
                        <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                        <Text style={styles.modalItemPrice}>R{activeSize.price.toFixed(0)}</Text>
                        {isCycleItem && selectedItem.description ? (
                          <Text style={styles.modalItemMealType}>{selectedItem.description}</Text>
                        ) : null}
                        {isCycleItem && selectedItem.deliveryDateLabel ? (
                          <Text style={styles.modalItemMealType}>📅 Delivering {selectedItem.deliveryDateLabel}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Full, untruncated ingredients — shown in full here (unlike the
                        2-line preview on the browsing card) so anyone with an allergy
                        can actually check before adding to cart. */}
                    {!isCycleItem && selectedItem.description ? (
                      <View style={styles.ingredientsSection}>
                        <Text style={styles.notesLabel}>INGREDIENTS</Text>
                        <Text style={styles.ingredientsText}>{selectedItem.description}</Text>
                      </View>
                    ) : null}

                    {selectedItem.sizes.length > 1 && (
                      <View style={styles.sizeSection}>
                        <Text style={styles.notesLabel}>SIZE</Text>
                        <View style={styles.sizeRow}>
                          {selectedItem.sizes.map((size: SizeOption, idx: number) => (
                            <TouchableOpacity
                              key={size.label}
                              style={[styles.sizeChip, selectedSizeIndex === idx && styles.sizeChipActive]}
                              onPress={() => setSelectedSizeIndex(idx)}
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityState={{ selected: selectedSizeIndex === idx }}
                              accessibilityLabel={`${size.label}, R${size.price.toFixed(0)}`}
                            >
                              <Text style={[styles.sizeChipLabel, selectedSizeIndex === idx && styles.sizeChipTextActive]}>
                                {size.label}
                              </Text>
                              <Text style={[styles.sizeChipPrice, selectedSizeIndex === idx && styles.sizeChipTextActive]}>
                                R{size.price.toFixed(0)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {categoryAddOns && categoryAddOns.length > 0 && (
                      <View style={styles.addOnsSection}>
                        <Text style={styles.notesLabel}>ADD EXTRAS (OPTIONAL)</Text>
                        <View style={styles.addOnsList}>
                          {categoryAddOns.map((addOn, addOnIdx) => {
                            const isSelected = selectedAddOns.has(addOn.name);
                            return (
                              <TouchableOpacity
                                key={addOn.name}
                                style={[styles.addOnRow, addOnIdx > 0 && styles.addOnRowDivider]}
                                onPress={() => toggleAddOn(addOn.name)}
                                activeOpacity={0.7}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: isSelected }}
                                accessibilityLabel={`${addOn.name}, +R${addOn.price.toFixed(0)}`}
                              >
                                <View style={styles.addOnRowLeft}>
                                  <View style={[styles.addOnCheckbox, isSelected && styles.addOnCheckboxSelected]}>
                                    {isSelected && <Text style={styles.addOnCheckboxCheck}>✓</Text>}
                                  </View>
                                  <Text style={styles.addOnName}>{addOn.name}</Text>
                                </View>
                                <Text style={styles.addOnPrice}>+R{addOn.price.toFixed(0)}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {!isCycleItem && (
                      <View style={styles.deliveryDatesSection}>
                        <View style={styles.deliverySectionHeader}>
                          <Text style={styles.notesLabel}>DELIVER ON (OPTIONAL)</Text>
                          {selectedDeliveryDates.length > 0 && (
                            <TouchableOpacity
                              onPress={() => { setSelectedDeliveryDates([]); setDateQuantities({}); }}
                              accessibilityRole="button"
                              accessibilityLabel="Clear selected delivery dates"
                            >
                              <Text style={styles.deliveryClearText}>Clear</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.deliveryHint}>
                          Pick one or more weekdays to pre-order — up to 2 weeks ahead. Leave blank for a normal order.
                        </Text>
                        {(['This week', 'Next week', 'In 2 weeks'] as const).map((group) => {
                          const groupDays = upcomingWeekdays.filter(w => w.weekLabel === group);
                          if (groupDays.length === 0) return null;
                          return (
                            <View key={group} style={styles.deliveryGroup}>
                              <Text style={styles.deliveryGroupLabel}>{group}</Text>
                              <View style={styles.deliveryChipRow}>
                                {groupDays.map((day) => {
                                  const isSelected = selectedDeliveryDates.includes(day.iso);
                                  return (
                                    <TouchableOpacity
                                      key={day.iso}
                                      style={[styles.deliveryChip, isSelected && styles.deliveryChipActive]}
                                      onPress={() => toggleDeliveryDate(day.iso)}
                                      activeOpacity={0.8}
                                      accessibilityRole="checkbox"
                                      accessibilityState={{ checked: isSelected }}
                                      accessibilityLabel={day.label}
                                    >
                                      <Text style={[styles.deliveryChipText, isSelected && styles.deliveryChipTextActive]}>
                                        {day.label}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {selectedItem.tags && selectedItem.tags.length > 0 && (
                      <DietaryTagRow key={selectedItem.id} tags={selectedItem.tags} styles={styles} />
                    )}

                    <View style={styles.quantitySection}>
                      {selectedDeliveryDates.length > 1 ? (
                        <>
                          <Text style={styles.notesLabel}>QUANTITY PER DAY</Text>
                          {selectedDeliveryDates.map((iso) => {
                            const dateMeta = upcomingWeekdays.find(w => w.iso === iso);
                            const qty = dateQuantities[iso] ?? 1;
                            const label = dateMeta?.label ?? iso;
                            return (
                              <View key={iso} style={styles.dateQuantityRow}>
                                <Text style={styles.dateQuantityLabel}>{label}</Text>
                                <View style={styles.quantityStepperRow}>
                                  <TouchableOpacity
                                    style={[styles.stepperBtn, qty <= 1 && styles.stepperBtnDisabled]}
                                    onPress={() => setDateQuantity(iso, qty - 1)}
                                    disabled={qty <= 1}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Decrease quantity for ${label}`}
                                  >
                                    <Text style={styles.stepperBtnText}>−</Text>
                                  </TouchableOpacity>
                                  <Text style={styles.stepperValue} accessibilityLabel={`Quantity for ${label}: ${qty}`}>{qty}</Text>
                                  <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => setDateQuantity(iso, qty + 1)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Increase quantity for ${label}`}
                                  >
                                    <Text style={styles.stepperBtnText}>+</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          <Text style={styles.notesLabel}>QUANTITY</Text>
                          <View style={styles.quantityStepperRow}>
                            <TouchableOpacity
                              style={[styles.stepperBtn, modalQuantity <= 1 && styles.stepperBtnDisabled]}
                              onPress={() => setModalQuantity(q => Math.max(1, q - 1))}
                              disabled={modalQuantity <= 1}
                              accessibilityRole="button"
                              accessibilityLabel="Decrease quantity"
                            >
                              <Text style={styles.stepperBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.stepperValue} accessibilityLabel={`Quantity: ${modalQuantity}`}>{modalQuantity}</Text>
                            <TouchableOpacity
                              style={styles.stepperBtn}
                              onPress={() => setModalQuantity(q => Math.min(20, q + 1))}
                              accessibilityRole="button"
                              accessibilityLabel="Increase quantity"
                            >
                              <Text style={styles.stepperBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>

                    <View style={styles.notesSection}>
                      <Text style={styles.notesLabel}>Special Instructions / Allergies</Text>
                      <TextInput
                        style={styles.notesInput}
                        placeholder="e.g., No onions, allergy to nuts, extra sauce..."
                        placeholderTextColor={theme.textTertiary}
                        value={specialInstructions}
                        onChangeText={setSpecialInstructions}
                        multiline={true}
                        numberOfLines={4}
                        textAlignVertical="top"
                        accessibilityLabel="Special instructions or allergies"
                      />
                    </View>
                  </ScrollView>

                  <TouchableOpacity
                    ref={addToCartBtnRef}
                    style={styles.modalAddBtn}
                    onPress={() => {
                      addToCartBtnRef.current?.measureInWindow((x, y, width, height) => {
                        triggerCartFly(x + width / 2, y + height / 2);
                      });
                      confirmAddToCart();
                    }}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalAddBtnText}>
                      Add to Cart · R{lineTotal.toFixed(2)}
                      {selectedDeliveryDates.length > 1 ? ` (${selectedDeliveryDates.length} days)` : ''}
                    </Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type Styles = ReturnType<typeof createStyles>;

// Dietary tag chips fade + scale in with a short stagger when the customizer
// opens. Purely presentational — tags come straight from menu data and are
// only rendered when a dish actually has them (none of the bundled items do yet).
function DietaryTagRow({ tags, styles }: { tags: string[]; styles: Styles }) {
  return (
    <View style={styles.tagsSection}>
      <Text style={styles.notesLabel}>DIETARY TAGS</Text>
      <View style={styles.tagsRow}>
        {tags.map((tag, idx) => (
          <AnimatedTagChip key={tag} label={tag} delay={idx * 60} styles={styles} />
        ))}
      </View>
    </View>
  );
}

function AnimatedTagChip({ label, delay, styles }: { label: string; delay: number; styles: Styles }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 240, delay, useNativeDriver: true }).start();
  }, [anim, delay]);

  return (
    <Animated.View
      style={[
        styles.tagChip,
        {
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        },
      ]}
    >
      <Text style={styles.tagChipText}>{label}</Text>
    </Animated.View>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  previewBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  previewBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewBannerText: { color: theme.text, fontSize: 12, fontWeight: '800' },
  previewBannerExit: { color: theme.text, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  searchSection: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: theme.text, paddingVertical: 0, height: 44 },
  searchClear: { padding: 4 },
  searchClearIcon: { fontSize: 16, color: theme.textTertiary, fontWeight: '700' },
  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    paddingHorizontal: 6,
    backgroundColor: theme.surfaceSecondary,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  toggleBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 9, marginHorizontal: 2 },
  toggleBtnActive: { backgroundColor: theme.accent },
  toggleBtnText: { color: theme.textTertiary, fontSize: 13, fontWeight: '700' },
  exploreHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.3,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  toggleBtnTextActive: { color: theme.onAccent },
  deliverySection: { marginTop: 8, marginBottom: 12 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: theme.textTertiary, textAlign: 'center', fontSize: 14 },
  emptyEmoji: { fontSize: 32, marginBottom: 12 },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub: { color: theme.textTertiary, fontSize: 13, textAlign: 'center' },

  categoryFilterContainer: { marginBottom: 16 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceSecondary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 10,
  },
  categoryChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  categoryChipIcon: { fontSize: 18, marginRight: 7 },
  categoryChipText: { color: theme.textSecondary, fontSize: 14, fontWeight: '700' },
  categoryChipTextActive: { color: theme.onAccent },

  categorySection: { marginBottom: 28 },
  categoryBanner: {
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    justifyContent: 'flex-end',
  },
  categoryBannerImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  categoryBannerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  categoryBannerTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    padding: 14,
  },
  uberGrid: {},
  uberGridColumn: {
    justifyContent: 'space-between',
    marginBottom: ROW_GAP,
  },

  uberCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  // Thin category-colour accent strip — replaces the old empty image
  // placeholder block now that items don't carry their own picture.
  uberAccentBar: { height: 4, width: '100%' },
  menuDiscountHint: {
    fontSize: 10,
    color: '#FF9500',
    fontWeight: '700',
    maxWidth: 100,
    textAlign: 'right',
  },
  uberContent: { padding: 10 },
  uberTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
  uberItemNameFlex: { flex: 1, marginBottom: 0 },
  uberItemName: { fontSize: 15, fontWeight: '800', color: theme.text, lineHeight: 19, marginBottom: 3, letterSpacing: -0.2 },
  uberItemDesc: { fontSize: 11, color: theme.textSecondary, lineHeight: 15, marginBottom: 8 },
  uberMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  uberPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 1 },
  uberPrice: { fontSize: 15, fontWeight: '900', color: theme.text, letterSpacing: -0.4 },
  uberOriginalPrice: { fontSize: 12, fontWeight: '600', color: theme.textTertiary, textDecorationLine: 'line-through' },


  dayHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success, marginRight: 6 },
  dayTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  dayTitleToday: { color: theme.success },
  dayMealCount: { fontSize: 12, color: theme.textTertiary, fontWeight: '600' },

  todayBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: theme.success,
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  todayBadgeText: { color: '#000000', fontSize: 10, fontWeight: '800' },
  todayCardBorder: {
    borderColor: theme.success,
  },
  cycleMealType: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    width: '100%',
    maxWidth: APP_MAX_WIDTH,
    maxHeight: '86%',
    alignSelf: 'center',
  },
  modalScroll: { flexGrow: 0 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
  modalClose: { fontSize: 28, color: theme.textSecondary, fontWeight: '600' },
  modalItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalItemDetails: { flex: 1 },
  modalItemName: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
  modalItemPrice: { fontSize: 18, fontWeight: '900', color: theme.text },
  modalItemMealType: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginTop: 2 },
  notesSection: { marginBottom: 20 },
  notesLabel: { fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  ingredientsSection: {
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  ingredientsText: { fontSize: 13, color: theme.text, lineHeight: 19, fontWeight: '500' },
  notesInput: {
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: theme.text,
    minHeight: 120,
  },
  modalAddBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  modalAddBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: '800' },

  // Today's cycle menu — cutoff status row
  // No paddingHorizontal here — the parent ScrollView's contentContainerStyle
  // already pads 16px; adding it again here double-inset this row vs. every
  // other element on the Today's Menu tab (and vs. DeliveryEstimator's
  // equivalent slot on the Main Menu tab, which relies on the same parent
  // padding via `listContainer`).
  weekStatusRow: { marginBottom: 12, marginTop: 8 },

  // Item customizer modal — size picker, quantity stepper, dietary tags
  sizeSection: { marginBottom: 20 },
  sizeRow: { flexDirection: 'row', gap: 10 },
  sizeChip: {
    flex: 1,
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sizeChipActive: { borderColor: theme.accent, backgroundColor: theme.surfaceSecondary },
  sizeChipLabel: { color: theme.text, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  sizeChipPrice: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
  sizeChipTextActive: { color: theme.text },
  addOnsSection: { marginBottom: 20 },
  addOnsList: {
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  addOnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  addOnRowDivider: { borderTopWidth: 1, borderTopColor: theme.border },
  addOnRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  addOnCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: theme.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addOnCheckboxSelected: { backgroundColor: theme.accent, borderColor: theme.accent },
  addOnCheckboxCheck: { color: theme.onAccent, fontSize: 12, fontWeight: '800' },
  addOnName: { color: theme.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  addOnPrice: { color: theme.textSecondary, fontSize: 13, fontWeight: '700' },
  deliveryDatesSection: { marginBottom: 20 },
  deliverySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deliveryClearText: { color: theme.text, fontSize: 12, fontWeight: '700' },
  deliveryHint: { color: theme.textTertiary, fontSize: 12, marginBottom: 12, lineHeight: 16 },
  deliveryGroup: { marginBottom: 12 },
  deliveryGroupLabel: { color: theme.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  deliveryChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deliveryChip: {
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deliveryChipActive: { borderColor: theme.accent, backgroundColor: theme.surfaceSecondary },
  deliveryChipText: { color: theme.textSecondary, fontSize: 12, fontWeight: '700' },
  deliveryChipTextActive: { color: theme.text },
  tagsSection: { marginBottom: 20 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    backgroundColor: '#EAF7EE',
    borderWidth: 1,
    borderColor: '#22C55E40',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  tagChipText: { color: '#1DA836', fontSize: 12, fontWeight: '800' },
  quantitySection: { marginBottom: 20 },
  dateQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateQuantityLabel: { color: theme.text, fontSize: 14, fontWeight: '700' },
  quantityStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperBtnText: { color: theme.text, fontSize: 20, fontWeight: '800' },
  stepperValue: { color: theme.text, fontSize: 16, fontWeight: '800', minWidth: 32, textAlign: 'center' },
});