import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Modal, TextInput, Dimensions, ScrollView } from 'react-native';
import { useKitchen } from '../../context/KitchenCoContext';
import FloatingCartBanner from '../../components/FloatingCartBanner';
import { DeliveryEstimator } from '../../components/DeliveryEstimator';

import staticMenuData from '../../data/staticMenu.json';
import cycleMenuData from '../../data/cycleMenu.json';

interface SizeOption { label: string; price: number; }

interface UIReadyItem {
  id: string; name: string; description: string;
  category: string; image?: string; sizes: SizeOption[];
}

const CYCLE_ITEM_PRICE = 80;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const NUM_COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const MEAL_TYPE_ICONS: Record<string, string> = {
  'MAIN MEAL': '🍖', 'VEGETARIAN MEAL': '🥦',
  'HEALTHY MEAL': '🥗', 'CURRY OF THE DAY': '🍛', 'GOURMET SANDWICH': '🥙',
};
const MEAL_TYPE_COLORS: Record<string, string> = {
  'MAIN MEAL': '#FF7F50', 'VEGETARIAN MEAL': '#22C55E',
  'HEALTHY MEAL': '#06C167', 'CURRY OF THE DAY': '#FF9500', 'GOURMET SANDWICH': '#5AC8FA',
};

export default function MenuScreen() {
  const { addToCart, cart, activeWeek, theme, discounts } = useKitchen();
  const [isStaticMenu, setIsStaticMenu] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isCycleItem, setIsCycleItem] = useState(false);

  // Get current day of the week
  const getCurrentDayName = (): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
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

  const flattenedStaticMenu = useMemo(() => {
    const items: UIReadyItem[] = [];
    if (!staticMenuData) return items;
    const parseItem = (rawItem: any, category: string, idx: number): UIReadyItem => {
      let parsedSizes: SizeOption[] = [];
      if (rawItem.sizes && Array.isArray(rawItem.sizes)) {
        parsedSizes = rawItem.sizes.map((s: any) => ({ label: s.label || 'Regular', price: Number(s.price) || 0 }));
      } else if (rawItem.price !== undefined && rawItem.price !== null) {
        const cleanPrice = typeof rawItem.price === 'number' ? rawItem.price : parseFloat(String(rawItem.price).replace(/[^\d.]/g, '')) || 0;
        parsedSizes = [{ label: 'Regular', price: cleanPrice }];
      } else if (rawItem.prices && Array.isArray(rawItem.prices)) {
        parsedSizes = rawItem.prices.map((p: any, pIdx: number) => {
          const priceStr = typeof p === 'string' ? p : String(p);
          const price = parseFloat(priceStr.replace(/[^\d.]/g, '')) || 0;
          return {
            label: pIdx === 0 ? 'Regular' : `Option ${pIdx + 1}`,
            price: price
          };
        });
      }
      if (parsedSizes.length === 0) parsedSizes = [{ label: 'Regular', price: 0 }];
      return {
        id: `menu-item-${category}-${idx}-${(rawItem.name || '').replace(/\s+/g, '')}`,
        name: rawItem.name || 'Unnamed Item', description: rawItem.description || '',
        category: category, image: rawItem.image, sizes: parsedSizes,
      };
    };
    if (Array.isArray(staticMenuData)) {
      staticMenuData.forEach((item: any, idx: number) => items.push(parseItem(item, item.category || 'General', idx)));
    } else if (typeof staticMenuData === 'object' && staticMenuData !== null) {
      Object.entries(staticMenuData).forEach(([key, value]) => {
        if (key.startsWith('_')) return;
        if (Array.isArray(value)) value.forEach((item: any, idx: number) => items.push(parseItem(item, key, idx)));
        else if (value && typeof value === 'object') items.push(parseItem(value, (value as any).category || key, 0));
      });
    }
    return items;
  }, []);

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
  };

  const confirmAddToCart = () => {
    if (!selectedItem) return;
    const defaultSize = selectedItem.sizes[0];
    addToCart({
      id: selectedItem.id,
      name: selectedItem.name,
      price: defaultSize.price,
      category: selectedItem.category,
      quantity: 1,
      image: selectedItem.image,
      selectedSize: defaultSize.label,
      notes: specialInstructions || undefined
    });
    setSelectedItem(null);
    setSpecialInstructions('');
    setIsCycleItem(false);
  };

  const handleAddCycleItem = (mealName: string, mealType: string, day: string, weekName: string) => {
    const cycleItem = {
      id: `cycle-${weekName}-${day}-${mealType}-${mealName.replace(/\s+/g, '')}`,
      name: mealName,
      description: mealType.replace(/_/g, ' '),
      category: `${weekName} • ${day}`,
      sizes: [{ label: 'Regular', price: CYCLE_ITEM_PRICE }],
      mealType,
      day,
      weekName
    };
    setSelectedItem(cycleItem);
    setSpecialInstructions('');
    setIsCycleItem(true);
  };

  const renderCategoryFilter = () => {
    if (!isStaticMenu) return null;

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
                  {category}
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

    return (
      <TouchableOpacity
        style={[styles.uberCard, { width: CARD_WIDTH }]}
        activeOpacity={0.9}
        onPress={() => handleAddItem(item)}
      >
        {/* Image Section */}
        <View style={styles.uberImageSection}>
          <View style={[styles.uberImageContainer, itemDiscounts.length > 0 && { backgroundColor: '#2A1A00' }]}>
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
          <TouchableOpacity
            style={[styles.uberQuickAdd, qty > 0 && styles.uberQuickAddActive]}
            onPress={() => handleAddItem(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.uberQuickAddText, qty > 0 && styles.uberQuickAddTextActive]}>
              {qty > 0 ? `${qty}` : '+'}
            </Text>
          </TouchableOpacity>
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
              <Text style={styles.categoryTitle}>{category}</Text>
            </View>

            {/* Properly aligned grid - 2 columns with consistent alignment */}
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              numColumns={NUM_COLUMNS}
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

  const renderActiveWeekMenu = () => {
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

    // Find today's meals only
    const todayData = weekData.find((dayObj: any) => dayObj.DAY === todayName);

    if (!todayData) {
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          <View style={styles.cycleHero}>
            <Text style={styles.cycleHeroEmoji}>📅</Text>
            <Text style={styles.cycleHeroTitle}>Week {activeWeek} Menu</Text>
            <Text style={styles.cycleHeroSub}>All items R{CYCLE_ITEM_PRICE}.00 • Freshly prepared</Text>
          </View>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>😴</Text>
            <Text style={styles.emptyTitle}>No meals scheduled for today</Text>
            <Text style={styles.emptySub}>Today is {todayName}. Check back tomorrow!</Text>
          </View>
        </ScrollView>
      );
    }

    const { DAY, ...meals } = todayData;
    const todayMeals = Object.entries(meals).map(([mealType, mealDescription]: [string, any]) => ({
      mealType,
      mealDescription: typeof mealDescription === 'string' ? mealDescription : String(mealDescription),
      isToday: true,
    }));

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        <View style={styles.cycleHero}>
          <Text style={styles.cycleHeroEmoji}>📅</Text>
          <Text style={styles.cycleHeroTitle}>Week {activeWeek} Menu</Text>
          <Text style={styles.cycleHeroSub}>All items R{CYCLE_ITEM_PRICE}.00 • Freshly prepared</Text>
          <View style={styles.cycleMetaRow}>
            <View style={styles.cycleMetaBadge}><Text style={styles.cycleMetaText}>Week {activeWeek}</Text></View>
            <View style={styles.cycleMetaBadge}><Text style={styles.cycleMetaText}>R{CYCLE_ITEM_PRICE} flat</Text></View>
          </View>
        </View>
        
        <View style={styles.todayIndicator}>
          <Text style={styles.todayIndicatorText}>Today is <Text style={styles.todayIndicatorDay}>{todayName}</Text></Text>
        </View>

        {/* DAY HEADER */}
        <View style={styles.categorySection}>
          <View style={styles.dayHeaderBar}>
            <View style={styles.dayHeaderLeft}>
              <View style={styles.todayDot} />
              <Text style={[styles.dayTitle, styles.dayTitleToday]}>{todayName}</Text>
            </View>
            <Text style={styles.dayMealCount}>{todayMeals.length} meals</Text>
          </View>

          {/* GRID LAYOUT - 2 COLUMNS (always grid, never list) */}
          <View style={styles.uberGridFlex}>
            {todayMeals.map((meal: any, idx: number) => {
              const icon = MEAL_TYPE_ICONS[meal.mealType] || '🍽️';
              const color = MEAL_TYPE_COLORS[meal.mealType] || '#8E8E93';
              const mealName = meal.mealDescription;
              const qty = getItemQuantity(`cycle-${weekKey}-${todayName}-${meal.mealType}-${mealName.replace(/\s+/g, '')}`);

              return (
                <TouchableOpacity
                  key={`today-${idx}`}
                  style={[styles.uberCard, { width: CARD_WIDTH }, styles.todayCardBorder]}
                  activeOpacity={0.7}
                  onPress={() => handleAddCycleItem(mealName, meal.mealType, todayName, `Week ${activeWeek}`)}
                >
                  <View style={styles.uberImageSection}>
                    <View style={[styles.cycleCardIconWrapFull, { backgroundColor: color + '18' }]}>
                      <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>TODAY</Text></View>
                      <Text style={styles.cycleCardIcon}>{icon}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.uberQuickAdd, qty > 0 && styles.uberQuickAddActive]}
                      onPress={() => handleAddCycleItem(mealName, meal.mealType, todayName, `Week ${activeWeek}`)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.uberQuickAddText, qty > 0 && styles.uberQuickAddTextActive]}>
                        {qty > 0 ? `${qty}` : '+'}
                      </Text>
                    </TouchableOpacity>
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
            })}
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.background} />

      {/* Search Bar - at the top */}
      <View style={styles.searchSection}>
        <View style={styles.searchWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search dishes, meals..."
            placeholderTextColor="#6B7280"
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

      {/* 48-Hour Cutoff Notice */}
      <View style={styles.allergyBanner}>
        <Text style={styles.allergyIcon}>⏰</Text>
        <Text style={styles.allergyText}>48-hour advance ordering cutoff applies</Text>
      </View>

      <View style={styles.toggleContainer}>
        <TouchableOpacity style={[styles.toggleBtn, isStaticMenu && styles.toggleBtnActive]} onPress={() => setIsStaticMenu(true)}>
          <Text style={[styles.toggleBtnText, isStaticMenu && styles.toggleBtnTextActive]}>Main Menu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, !isStaticMenu && styles.toggleBtnActive]} onPress={() => setIsStaticMenu(false)}>
          <Text style={[styles.toggleBtnText, !isStaticMenu && styles.toggleBtnTextActive]}>Today's Menu</Text>
        </TouchableOpacity>
      </View>

      {isStaticMenu ? renderCategoryFilter() : null}

      {isStaticMenu ? renderStaticMenuGrid() : renderActiveWeekMenu()}

      <FloatingCartBanner />

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

            {selectedItem && (
              <>
                <View style={styles.modalItemInfo}>
                  <Text style={styles.modalItemIcon}>{getItemIcon(selectedItem.name, selectedItem.category)}</Text>
                  <View style={styles.modalItemDetails}>
                    <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                    <Text style={styles.modalItemPrice}>
                      R{selectedItem.sizes[0] ? selectedItem.sizes[0].price.toFixed(0) : '0'}
                    </Text>
                    {isCycleItem && selectedItem.description ? (
                      <Text style={styles.modalItemMealType}>{selectedItem.description}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>Special Instructions / Allergies</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="e.g., No onions, allergy to nuts, extra sauce..."
                    placeholderTextColor="#6B7280"
                    value={specialInstructions}
                    onChangeText={setSpecialInstructions}
                    multiline={true}
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <TouchableOpacity style={styles.modalAddBtn} onPress={confirmAddToCart}>
                  <Text style={styles.modalAddBtnText}>Add to Cart</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  searchSection: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#2E3340',
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#F5F7FA', paddingVertical: 0, height: 44 },
  searchClear: { padding: 4 },
  searchClearIcon: { fontSize: 16, color: '#6B7280', fontWeight: '700' },
  toggleContainer: {
    flexDirection: 'row',
    padding: 6,
    paddingHorizontal: 8,
    backgroundColor: '#0F1115',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2E3340',
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, marginHorizontal: 2 },
  toggleBtnActive: { backgroundColor: '#FF6B35' },
  toggleBtnText: { color: '#6B7280', fontSize: 14, fontWeight: '700' },
  toggleBtnTextActive: { color: '#FFFFFF' },
  deliverySection: { marginBottom: 4 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#6B7280', textAlign: 'center', fontSize: 14 },
  emptyEmoji: { fontSize: 32, marginBottom: 12 },
  emptyTitle: { color: '#F5F7FA', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub: { color: '#6B7280', fontSize: 13, textAlign: 'center' },

  allergyBanner: {
    backgroundColor: '#2A1F00',
    borderBottomWidth: 1,
    borderBottomColor: '#4A3F00',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
  },
  allergyIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  allergyText: {
    color: '#FFD60A',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },

  categoryFilterContainer: { marginBottom: 12 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D24',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2E3340',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  categoryChipIcon: { fontSize: 16, marginRight: 6 },
  categoryChipText: { color: '#9AA3B2', fontSize: 13, fontWeight: '700' },
  categoryChipTextActive: { color: '#FFFFFF' },

  categorySection: { marginBottom: 24 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: 4 },
  categoryIcon: { fontSize: 22, marginRight: 8 },
  categoryTitle: { fontSize: 12, fontWeight: '900', color: '#F5F7FA', textTransform: 'uppercase', letterSpacing: 1.2 },
  uberGrid: {
    paddingHorizontal: 16,
  },
  uberGridColumn: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  uberGridFlex: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  uberCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2E3340',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: CARD_GAP,
    marginRight: CARD_GAP / 2,
    marginLeft: CARD_GAP / 2,
  },
  uberImageSection: {
    position: 'relative',
    height: 150,
  },
  uberImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#22262F',
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
  uberItemEmoji: { fontSize: 64 },
  uberQuickAdd: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  uberQuickAddActive: { backgroundColor: '#22C55E' },
  uberQuickAddText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', lineHeight: 22 },
  uberQuickAddTextActive: { color: '#FFFFFF' },
  uberContent: { padding: 14 },
  uberItemName: { fontSize: 14, fontWeight: '800', color: '#F5F7FA', lineHeight: 20, marginBottom: 4, letterSpacing: -0.2 },
  uberItemDesc: { fontSize: 12, color: '#9AA3B2', lineHeight: 16, marginBottom: 10 },
  uberMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  uberPrice: { fontSize: 16, fontWeight: '900', color: '#FF6B35', letterSpacing: -0.4 },

  cycleHero: { backgroundColor: '#1A1D24', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2E3340', alignItems: 'center' },
  cycleHeroEmoji: { fontSize: 32, marginBottom: 10 },
  cycleHeroTitle: { fontSize: 18, fontWeight: '900', color: '#F5F7FA', textAlign: 'center', letterSpacing: -0.3 },
  cycleHeroSub: { fontSize: 13, color: '#9AA3B2', textAlign: 'center', marginTop: 6 },
  cycleMetaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cycleMetaBadge: { backgroundColor: '#22262F', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12, borderWidth: 1, borderColor: '#2E3340' },
  cycleMetaText: { color: '#9AA3B2', fontSize: 11, fontWeight: '600' },
  todayIndicator: { 
    backgroundColor: '#22262F', 
    borderRadius: 16, 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E3340',
  },
  todayIndicatorText: { color: '#9AA3B2', fontSize: 14, fontWeight: '600' },
  todayIndicatorDay: { color: '#22C55E', fontWeight: '800' },
  
  dayHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 },
  dayTitle: { fontSize: 15, fontWeight: '800', color: '#F5F7FA' },
  dayTitleToday: { color: '#22C55E' },
  dayMealCount: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  
  cycleCardIconWrapFull: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cycleCardIcon: { fontSize: 48 },
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
    backgroundColor: '#1A1D24',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#2E3340',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#F5F7FA', letterSpacing: -0.5 },
  modalClose: { fontSize: 28, color: '#9AA3B2', fontWeight: '600' },
  modalItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22262F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2E3340',
  },
  modalItemIcon: { fontSize: 40, marginRight: 12 },
  modalItemDetails: { flex: 1 },
  modalItemName: { fontSize: 16, fontWeight: '800', color: '#F5F7FA', marginBottom: 4 },
  modalItemPrice: { fontSize: 18, fontWeight: '900', color: '#FF6B35' },
  modalItemMealType: { fontSize: 13, fontWeight: '600', color: '#9AA3B2', marginTop: 2 },
  notesSection: { marginBottom: 20 },
  notesLabel: { fontSize: 13, fontWeight: '700', color: '#9AA3B2', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  notesInput: {
    backgroundColor: '#14171C',
    borderWidth: 1,
    borderColor: '#2E3340',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#F5F7FA',
    minHeight: 120,
  },
  modalAddBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  modalAddBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});