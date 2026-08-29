import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, StatusBar, Modal, TextInput, ScrollView, useWindowDimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKitchen } from '../../context/KitchenCoContext';
import { DeliveryEstimator } from '../../components/DeliveryEstimator';
import { CutoffCountdown } from '../../components/CutoffCountdown';
import { QuickAddButton } from '../../components/QuickAddButton';
import { getUpcomingOrderableWeekdays, getOrderCutoffInfo } from '../../utils/deliveryHelpers';
import { useResponsive } from '../../utils/responsive';
import { APP_MAX_WIDTH } from '../../utils/theme';

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

const MEAL_TYPE_ICONS: Record<string, string> = {
  'MAIN MEAL': '🍖', 'VEGETARIAN MEAL': '🥦',
  'HEALTHY MEAL': '🥗', 'CURRY OF THE DAY': '🍛', 'GOURMET SANDWICH': '🥙',
};
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
  const { addToCart, cart, activeWeek, theme, discounts, menus, user } = useKitchen();
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
  // Names of category-level extras (e.g. "Extra Bacon") selected for the item
  // currently open in the customize modal — an Uber-Eats-style modifier tied
  // to this specific order, not a standalone browsable menu item.
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const upcomingWeekdays = useMemo(() => getUpcomingOrderableWeekdays(), []);

  // Today's Menu (cycle items) has no future-date picker — it's an order for
  // "today" only. Once today's 9:00 AM cutoff has passed (or it's a
  // non-business day), there's no valid delivery slot left for it, so adding
  // it to the cart must be blocked rather than just showing a passive banner.
  const [cutoffInfo, setCutoffInfo] = useState(() => getOrderCutoffInfo());
  useEffect(() => {
    const interval = setInterval(() => setCutoffInfo(getOrderCutoffInfo()), 30000);
    return () => clearInterval(interval);
  }, []);
  const todayOrderingClosed = !cutoffInfo.isOpenToday;
  const [showOrderingClosedNotice, setShowOrderingClosedNotice] = useState(false);

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

  // Get current day of the week
  const getCurrentDayName = (): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  // Meals only run Monday–Friday, so the "no meals today" message should
  // point to the next weekday with a menu (Monday) rather than always
  // saying "tomorrow" — which is wrong on Saturday (tomorrow is Sunday,
  // also meal-less).
  const getNoMealsMessage = (): string => {
    const dayIndex = new Date().getDay(); // 0=Sun ... 6=Sat
    if (dayIndex === 6 || dayIndex === 0) {
      // Saturday or Sunday
      return 'Meals are served Monday to Friday. Check back Monday!';
    }
    return 'Check back tomorrow!';
  };

  const getItemQuantity = (id: string) => {
    const item = cart.find(c => c.id === id);
    return item ? item.quantity : 0;
  };

  const categoryIcons = useMemo(() => {
    if (!staticMenuData || typeof staticMenuData !== 'object') return {};
    return (staticMenuData as any)._icons || {};
  }, []);

  const getItemIcon = (itemName: string, category: string): string => {
    const name = itemName.toLowerCase();
    const cat = category.toLowerCase();

    if (cat.includes('salad')) return '🥗';
    if (cat.includes('poke') || cat.includes('bowl')) return '🍱';
    if (cat.includes('stir-fry')) return '🍳';
    if (cat.includes('italy') || cat.includes('pasta')) return '🍝';
    if (cat.includes('wrap')) return '🌯';
    if (cat.includes('sandwich')) return '🥪';
    if (cat.includes('hot dog')) return '🌭';
    if (cat.includes('burger')) return '🍔';
    if (cat.includes('side')) return '🍟';
    if (cat.includes('fitness')) return '💪';
    if (cat.includes('soup')) return '🍲';
    if (cat.includes('ramen')) return '🍜';
    if (cat.includes('vegan')) return '🌱';

    if (name.includes('tuna')) return '🐟';
    if (name.includes('chicken')) return '🍗';
    if (name.includes('beef')) return '🥩';
    if (name.includes('salmon')) return '🍣';
    if (name.includes('prawn') || name.includes('calamari')) return '🦐';
    if (name.includes('bacon') || name.includes('macon')) return '🥓';
    if (name.includes('cheese')) return '🧀';
    if (name.includes('egg')) return '🥚';
    if (name.includes('lamb')) return '🐑';
    if (name.includes('pork')) return '🐷';
    if (name.includes('ham')) return '🥩';
    if (name.includes('salami')) return '🥖';
    if (name.includes('prosciutto')) return '🥖';
    if (name.includes('roast')) return '🍖';
    if (name.includes('grilled')) return '🔥';
    if (name.includes('smoked')) return '💨';
    if (name.includes('halloumi')) return '🧀';
    if (name.includes('tofu')) return '🧈';
    if (name.includes('vegetable') || name.includes('veg')) return '🥬';

    return '🍽️';
  };

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
    setSelectedAddOns(new Set());
  };

  const toggleDeliveryDate = (iso: string) => {
    setSelectedDeliveryDates(prev =>
      prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso]
    );
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
    // in one go; cycle items and undated adds just place a single normal order.
    const datesToApply = !isCycleItem && selectedDeliveryDates.length > 0
      ? selectedDeliveryDates
      : [undefined];

    datesToApply.forEach((iso) => {
      const dateMeta = iso ? upcomingWeekdays.find(w => w.iso === iso) : undefined;
      for (let i = 0; i < modalQuantity; i++) {
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
    setSelectedAddOns(new Set());
  };

  const handleAddCycleItem = (mealName: string, mealType: string, day: string, weekName: string) => {
    if (todayOrderingClosed) {
      setShowOrderingClosedNotice(true);
      return;
    }
    const cycleItem = {
      id: `cycle-${weekName}-${day}-${mealType}-${mealName.replace(/\s+/g, '')}`,
      name: mealName,
      description: mealType.replace(/_/g, ' '),
      category: `${weekName} • ${day}`,
      sizes: [{ label: 'Regular', price: CYCLE_ITEM_PRICE }],
      mealType,
      day,
      weekName,
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
    const displayPrice = item.sizes[0] ? `R${item.sizes[0].price.toFixed(0)}` : 'R0';
    const itemIcon = getItemIcon(item.name, item.category);
    const itemDiscounts = getItemDiscounts(item);
    const categoryColor = STATIC_CATEGORY_COLORS[item.category] || '#000000';

    return (
      <TouchableOpacity
        style={[styles.uberCard, { width: CARD_WIDTH }]}
        activeOpacity={0.9}
        onPress={() => handleAddItem(item)}
      >
        {/* Image Section */}
        <View style={styles.uberImageSection}>
          <View style={[styles.uberImageContainer, { backgroundColor: categoryColor + '1F' }, itemDiscounts.length > 0 && { backgroundColor: '#FFF3E0' }]}>
            <Text style={styles.uberItemEmoji}>{itemIcon}</Text>
            {itemDiscounts.length > 0 && (
              <View style={styles.discountChipContainer}>
                {itemDiscounts.map((disc, i) => (
                  <View key={i} style={styles.menuDiscountBadge}>
                    <Text style={styles.menuDiscountBadgeText}>-{disc.percentage}%</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {/* Quick Add Button */}
          <View style={styles.uberQuickAddWrap}>
            <QuickAddButton quantity={qty} onPress={() => handleAddItem(item)} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.uberContent}>
          <Text style={styles.uberItemName} numberOfLines={2}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.uberItemDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View style={styles.uberMetaRow}>
            <Text style={styles.uberPrice}>{displayPrice}</Text>
            {itemDiscounts.length > 0 && (
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
        ListHeaderComponent={
          <View style={styles.deliverySection}>
            <DeliveryEstimator />
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
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryIcon}>{categoryIcons[category] || '🍽️'}</Text>
              <Text style={styles.categoryTitle}>{formatCategoryLabel(category)}</Text>
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

  // Today's cycle menu — shows only today's meals
  // Customers only ever see today's meals — never a week picker. Which week is
  // "live" is entirely admin-controlled (see admin.tsx WeeksSection), and which
  // day is "today" is derived automatically from the system date.
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

    const weekKey = `Week ${activeWeek}`;
    const weekData = (cycleMenuData as any)[weekKey];
    const todayName = getCurrentDayName();

    if (!weekData || !Array.isArray(weekData)) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>Week {activeWeek} menu not available</Text>
          <Text style={styles.emptySub}>Check back later for this week's schedule</Text>
        </View>
      );
    }

    // Find today's meals
    const todayData = weekData.find((dayObj: any) => dayObj.DAY === todayName);
    const todayMeals = todayData
      ? Object.entries(todayData)
          .filter(([k]) => k !== 'DAY')
          .map(([mealType, mealDescription]: [string, any]) => ({
            mealType,
            mealDescription: typeof mealDescription === 'string' ? mealDescription : String(mealDescription),
          }))
      : [];

    // Cycle meal card renderer
    const renderCycleCard = (
      meal: { mealType: string; mealDescription: string },
      dayName: string,
      weekKeyStr: string
    ) => {
      const icon = MEAL_TYPE_ICONS[meal.mealType] || '🍽️';
      const color = MEAL_TYPE_COLORS[meal.mealType] || '#8E8E93';
      const mealName = meal.mealDescription;
      const qty = getItemQuantity(`cycle-${weekKeyStr}-${dayName}-${meal.mealType}-${mealName.replace(/\s+/g, '')}`);

      return (
        <TouchableOpacity
          style={[styles.uberCard, { width: CARD_WIDTH }, todayOrderingClosed && styles.uberCardClosed]}
          activeOpacity={0.7}
          onPress={() => handleAddCycleItem(mealName, meal.mealType, dayName, weekKeyStr)}
        >
          <View style={styles.uberImageSection}>
            <View style={[styles.cycleCardIconWrapFull, { backgroundColor: color + '18' }]}>
              <Text style={styles.cycleCardIcon}>{icon}</Text>
            </View>
            <View style={styles.uberQuickAddWrap}>
              {todayOrderingClosed ? (
                <View style={styles.closedBadge}>
                  <Text style={styles.closedBadgeText}>Closed</Text>
                </View>
              ) : (
                <QuickAddButton
                  quantity={qty}
                  onPress={() => handleAddCycleItem(mealName, meal.mealType, dayName, weekKeyStr)}
                />
              )}
            </View>
          </View>
          <View style={styles.uberContent}>
            <Text style={[styles.cycleMealType, { color }]}>{meal.mealType.replace(/_/g, ' ')}</Text>
            <Text style={styles.uberItemName} numberOfLines={2}>{mealName}</Text>
            <View style={styles.uberMetaRow}>
              <Text style={styles.uberPrice}>R{CYCLE_ITEM_PRICE}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    };

    // TODAY view — only today's meals
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        <View style={styles.todayIndicator}>
          <Text style={styles.todayIndicatorText}>Today is <Text style={styles.todayIndicatorDay}>{todayName}</Text></Text>
        </View>

        <View style={styles.weekStatusRow}>
          <CutoffCountdown compact />
        </View>

        {todayMeals.length > 0 ? (
          <View style={styles.categorySection}>
            <View style={styles.dayHeaderBar}>
              <View style={styles.dayHeaderLeft}>
                <View style={styles.todayDot} />
                <Text style={[styles.dayTitle, styles.dayTitleToday]}>{todayName}</Text>
              </View>
              <Text style={styles.dayMealCount}>{todayMeals.length} meals</Text>
            </View>
            <FlatList
              key={`today-${numColumns}`}
              data={todayMeals}
              keyExtractor={(_, idx) => `today-${idx}`}
              numColumns={numColumns}
              columnWrapperStyle={styles.uberGridColumn}
              scrollEnabled={false}
              nestedScrollEnabled={true}
              renderItem={({ item: meal }) => renderCycleCard(meal, todayName, weekKey)}
            />
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>😴</Text>
            <Text style={styles.emptyTitle}>No meals scheduled for today</Text>
            <Text style={styles.emptySub}>Today is {todayName}. {getNoMealsMessage()}</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.background} />

      {/* Admins land here deliberately (via "Preview App") to see exactly what a
          customer sees while editing items — not to place personal orders. */}
      {user?.role === 'admin' && (
        <View style={styles.previewBanner}>
          <View style={styles.previewBannerLeft}>
            <Ionicons name="eye" size={14} color="#000000" />
            <Text style={styles.previewBannerText}>Previewing as a customer</Text>
          </View>
          <TouchableOpacity onPress={() => router.replace('/admin')}>
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
            placeholderTextColor="#9E9E9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <Text style={styles.searchClearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.toggleContainer}>
        <TouchableOpacity style={[styles.toggleBtn, menuView === 'main' && styles.toggleBtnActive]} onPress={() => setMenuView('main')}>
          <Text style={[styles.toggleBtnText, menuView === 'main' && styles.toggleBtnTextActive]}>Main Menu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, menuView === 'today' && styles.toggleBtnActive]} onPress={() => setMenuView('today')}>
          <Text style={[styles.toggleBtnText, menuView === 'today' && styles.toggleBtnTextActive]}>Today's Menu</Text>
        </TouchableOpacity>
      </View>

      {menuView === 'main' && (
        <Text style={styles.exploreHeading}>Explore the menu</Text>
      )}
      {menuView === 'main' ? renderCategoryFilter() : null}

      {menuView === 'main' ? renderStaticMenuGrid() : renderCycleMenu()}

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
              <Text style={styles.modalTitle}>{isCycleItem ? 'Add Today\'s Meal' : 'Customize Order'}</Text>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedItem && (() => {
              const activeSize = selectedItem.sizes[selectedSizeIndex] || selectedItem.sizes[0];
              const dayMultiplier = !isCycleItem && selectedDeliveryDates.length > 0 ? selectedDeliveryDates.length : 1;
              const categoryAddOns = menus.find(c => c.name === selectedItem.category)?.addOns;
              const addOnsTotal = (categoryAddOns ?? [])
                .filter(a => selectedAddOns.has(a.name))
                .reduce((sum, a) => sum + a.price, 0);
              const lineTotal = (activeSize.price + addOnsTotal) * modalQuantity * dayMultiplier;

              return (
                <>
                  <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.modalItemInfo}>
                      <Text style={styles.modalItemIcon}>{getItemIcon(selectedItem.name, selectedItem.category)}</Text>
                      <View style={styles.modalItemDetails}>
                        <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                        <Text style={styles.modalItemPrice}>R{activeSize.price.toFixed(0)}</Text>
                        {isCycleItem && selectedItem.description ? (
                          <Text style={styles.modalItemMealType}>{selectedItem.description}</Text>
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
                            <TouchableOpacity onPress={() => setSelectedDeliveryDates([])}>
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
                      <DietaryTagRow key={selectedItem.id} tags={selectedItem.tags} />
                    )}

                    <View style={styles.quantitySection}>
                        <Text style={styles.notesLabel}>QUANTITY</Text>
                        <View style={styles.quantityStepperRow}>
                          <TouchableOpacity
                            style={[styles.stepperBtn, modalQuantity <= 1 && styles.stepperBtnDisabled]}
                            onPress={() => setModalQuantity(q => Math.max(1, q - 1))}
                            disabled={modalQuantity <= 1}
                          >
                            <Text style={styles.stepperBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.stepperValue}>{modalQuantity}</Text>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => setModalQuantity(q => Math.min(20, q + 1))}
                          >
                            <Text style={styles.stepperBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                    <View style={styles.notesSection}>
                      <Text style={styles.notesLabel}>Special Instructions / Allergies</Text>
                      <TextInput
                        style={styles.notesInput}
                        placeholder="e.g., No onions, allergy to nuts, extra sauce..."
                        placeholderTextColor="#9E9E9E"
                        value={specialInstructions}
                        onChangeText={setSpecialInstructions}
                        multiline={true}
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                    </View>
                  </ScrollView>

                  <TouchableOpacity style={styles.modalAddBtn} onPress={confirmAddToCart} activeOpacity={0.9}>
                    <Text style={styles.modalAddBtnText}>
                      Add to Cart · R{lineTotal.toFixed(2)}
                      {dayMultiplier > 1 ? ` (${dayMultiplier} days)` : ''}
                    </Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showOrderingClosedNotice}
        animationType="fade"
        transparent
        onRequestClose={() => setShowOrderingClosedNotice(false)}
      >
        <View style={styles.closedDialogOverlay}>
          <View style={styles.closedDialogCard}>
            <Text style={styles.closedDialogIcon}>🕒</Text>
            <Text style={styles.closedDialogTitle}>Today's ordering has closed</Text>
            <Text style={styles.closedDialogText}>
              {cutoffInfo.message} Today's Menu items can only be ordered for today, so this one can't be added right now.
            </Text>
            <Text style={styles.closedDialogDate}>Next window: {cutoffInfo.formattedEarliest}</Text>
            <TouchableOpacity style={styles.closedDialogBtn} onPress={() => setShowOrderingClosedNotice(false)}>
              <Text style={styles.closedDialogBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Dietary tag chips fade + scale in with a short stagger when the customizer
// opens. Purely presentational — tags come straight from menu data and are
// only rendered when a dish actually has them (none of the bundled items do yet).
function DietaryTagRow({ tags }: { tags: string[] }) {
  return (
    <View style={styles.tagsSection}>
      <Text style={styles.notesLabel}>DIETARY TAGS</Text>
      <View style={styles.tagsRow}>
        {tags.map((tag, idx) => (
          <AnimatedTagChip key={tag} label={tag} delay={idx * 60} />
        ))}
      </View>
    </View>
  );
}

function AnimatedTagChip({ label, delay }: { label: string; delay: number }) {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  previewBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  previewBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewBannerText: { color: '#000000', fontSize: 12, fontWeight: '800' },
  previewBannerExit: { color: '#000000', fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  searchSection: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#000000', paddingVertical: 0, height: 44 },
  searchClear: { padding: 4 },
  searchClearIcon: { fontSize: 16, color: '#9E9E9E', fontWeight: '700' },
  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    paddingHorizontal: 6,
    backgroundColor: '#F6F6F6',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  toggleBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 9, marginHorizontal: 2 },
  toggleBtnActive: { backgroundColor: '#000000' },
  toggleBtnText: { color: '#9E9E9E', fontSize: 13, fontWeight: '700' },
  exploreHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.3,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  toggleBtnTextActive: { color: '#FFFFFF' },
  deliverySection: { marginBottom: 4 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9E9E9E', textAlign: 'center', fontSize: 14 },
  emptyEmoji: { fontSize: 32, marginBottom: 12 },
  emptyTitle: { color: '#000000', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub: { color: '#9E9E9E', fontSize: 13, textAlign: 'center' },

  categoryFilterContainer: { marginBottom: 16 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    marginRight: 10,
  },
  categoryChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  categoryChipIcon: { fontSize: 18, marginRight: 7 },
  categoryChipText: { color: '#6B6B6B', fontSize: 14, fontWeight: '700' },
  categoryChipTextActive: { color: '#FFFFFF' },

  categorySection: { marginBottom: 28 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  categoryIcon: { fontSize: 24, marginRight: 10 },
  categoryTitle: { fontSize: 21, fontWeight: '800', color: '#000000', letterSpacing: -0.4 },
  uberGrid: {},
  uberGridColumn: {
    justifyContent: 'space-between',
    marginBottom: ROW_GAP,
  },

  uberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  uberImageSection: {
    position: 'relative',
    height: 110,
  },
  uberImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountChipContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
  },
  menuDiscountBadge: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  menuDiscountBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },
  menuDiscountHint: {
    fontSize: 10,
    color: '#FF9500',
    fontWeight: '700',
    maxWidth: 100,
    textAlign: 'right',
  },
  uberItemEmoji: { fontSize: 48 },
  uberContent: { padding: 10 },
  uberItemName: { fontSize: 14, fontWeight: '800', color: '#000000', lineHeight: 18, marginBottom: 3, letterSpacing: -0.2 },
  uberItemDesc: { fontSize: 11, color: '#6B6B6B', lineHeight: 14, marginBottom: 8 },
  uberMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  uberPrice: { fontSize: 15, fontWeight: '900', color: '#000000', letterSpacing: -0.4 },

  todayIndicator: {
    backgroundColor: '#F6F6F6',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  todayIndicatorText: { color: '#6B6B6B', fontSize: 14, fontWeight: '600' },
  todayIndicatorDay: { color: '#22C55E', fontWeight: '800' },

  dayHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 },
  dayTitle: { fontSize: 15, fontWeight: '800', color: '#000000' },
  dayTitleToday: { color: '#22C55E' },
  dayMealCount: { fontSize: 12, color: '#9E9E9E', fontWeight: '600' },
  
  cycleCardIconWrapFull: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cycleCardIcon: { fontSize: 48 }, // matches uberItemEmoji size on Main Menu cards
  todayBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  todayBadgeText: { color: '#000000', fontSize: 10, fontWeight: '800' },
  todayCardBorder: {
    borderColor: '#22C55E',
  },
  cycleMealType: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
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
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#000000', letterSpacing: -0.5 },
  modalClose: { fontSize: 28, color: '#6B6B6B', fontWeight: '600' },
  modalItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  modalItemIcon: { fontSize: 40, marginRight: 12 },
  modalItemDetails: { flex: 1 },
  modalItemName: { fontSize: 16, fontWeight: '800', color: '#000000', marginBottom: 4 },
  modalItemPrice: { fontSize: 18, fontWeight: '900', color: '#000000' },
  modalItemMealType: { fontSize: 13, fontWeight: '600', color: '#6B6B6B', marginTop: 2 },
  notesSection: { marginBottom: 20 },
  notesLabel: { fontSize: 13, fontWeight: '700', color: '#6B6B6B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  ingredientsSection: {
    backgroundColor: '#F6F6F6',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  ingredientsText: { fontSize: 13, color: '#000000', lineHeight: 19, fontWeight: '500' },
  notesInput: {
    backgroundColor: '#F6F6F6',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#000000',
    minHeight: 120,
  },
  modalAddBtn: {
    backgroundColor: '#000000',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  modalAddBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Quick-add button positioning wrapper (button itself lives in QuickAddButton.tsx)
  uberQuickAddWrap: { position: 'absolute', bottom: 10, right: 10 },

  // Today's cycle menu — cutoff status row
  weekStatusRow: { paddingHorizontal: 16, marginBottom: 12, marginTop: 8 },

  // Cycle card dimmed state once today's ordering window has closed
  uberCardClosed: { opacity: 0.45 },
  closedBadge: {
    backgroundColor: '#000000CC',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  closedBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  // "Today's ordering has closed" explainer dialog
  closedDialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  closedDialogCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  closedDialogIcon: { fontSize: 36, marginBottom: 12 },
  closedDialogTitle: { fontSize: 18, fontWeight: '900', color: '#000000', marginBottom: 8, textAlign: 'center' },
  closedDialogText: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', lineHeight: 20 },
  closedDialogDate: { fontSize: 12, color: '#000000', fontWeight: '700', marginTop: 10, marginBottom: 20 },
  closedDialogBtn: { backgroundColor: '#000000', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, alignSelf: 'stretch', alignItems: 'center' },
  closedDialogBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  // Item customizer modal — size picker, quantity stepper, dietary tags
  sizeSection: { marginBottom: 20 },
  sizeRow: { flexDirection: 'row', gap: 10 },
  sizeChip: {
    flex: 1,
    backgroundColor: '#F6F6F6',
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sizeChipActive: { borderColor: '#000000', backgroundColor: '#F0F0F0' },
  sizeChipLabel: { color: '#000000', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  sizeChipPrice: { color: '#6B6B6B', fontSize: 12, fontWeight: '600' },
  sizeChipTextActive: { color: '#000000' },
  addOnsSection: { marginBottom: 20 },
  addOnsList: {
    backgroundColor: '#F6F6F6',
    borderWidth: 1,
    borderColor: '#EBEBEB',
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
  addOnRowDivider: { borderTopWidth: 1, borderTopColor: '#EBEBEB' },
  addOnRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  addOnCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#9E9E9E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addOnCheckboxSelected: { backgroundColor: '#000000', borderColor: '#000000' },
  addOnCheckboxCheck: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  addOnName: { color: '#000000', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  addOnPrice: { color: '#6B6B6B', fontSize: 13, fontWeight: '700' },
  deliveryDatesSection: { marginBottom: 20 },
  deliverySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deliveryClearText: { color: '#000000', fontSize: 12, fontWeight: '700' },
  deliveryHint: { color: '#9E9E9E', fontSize: 12, marginBottom: 12, lineHeight: 16 },
  deliveryGroup: { marginBottom: 12 },
  deliveryGroupLabel: { color: '#9E9E9E', fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  deliveryChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deliveryChip: {
    backgroundColor: '#F6F6F6',
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deliveryChipActive: { borderColor: '#000000', backgroundColor: '#F0F0F0' },
  deliveryChipText: { color: '#6B6B6B', fontSize: 12, fontWeight: '700' },
  deliveryChipTextActive: { color: '#000000' },
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
  quantityStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderWidth: 1,
    borderColor: '#EBEBEB',
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
  stepperBtnText: { color: '#000000', fontSize: 20, fontWeight: '800' },
  stepperValue: { color: '#000000', fontSize: 16, fontWeight: '800', minWidth: 32, textAlign: 'center' },
});