import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useDeliveryCalendar } from '../hooks/useDeliveryCalendar';
import { SearchInput } from '../components/SearchInput';
import { DeliveryDateModal } from '../components/DeliveryDateModal';
import { CutoffBanner } from '../components/CutoffBanner';
import { MenuSegmentToggle } from '../components/MenuSegmentToggle';
import { CategorySlider } from '../components/CategorySlider';
import { CategorySection } from '../components/CategorySection';
import { AllergyModal } from '../components/AllergyModal';
import { FloatingCartBar } from '../components/FloatingCartBar';
import { CartModal } from '../components/CartModal';
import { BrandLogo } from '../components/BrandLogo';
import { MenuItem, MenuType, MenuAddOn } from '../types';
import { getChefsChoiceDishesForDate, getCycleWeekForDate, INITIAL_CYCLE_WEEKS } from '../data/mockData';

interface MenuBrowserScreenProps {
  onNavigateToCheckout?: () => void;
  onNavigateToOrders?: () => void;
}

export const MenuBrowserScreen: React.FC<MenuBrowserScreenProps> = ({
  onNavigateToCheckout,
  onNavigateToOrders,
}) => {
  const { theme, isDark } = useTheme();
  const {
    addItem,
    updateQuantity,
    removeItem,
    clearCartForDate,
    isCartModalOpen,
    openCartModal,
    closeCartModal,
    getActiveDateTotals,
    getCartTotals,
    activeDateCartItems,
    menuItems,
    categories: allCategories,
    cycleWeeks,
    cyclePlans,
    activeCycleWeekNumber,
  } = useCart();
  const { hasPromptedDeliveryDate, markDeliveryDatePrompted } = useAuth();

  const {
    deliveryDates,
    selectedDate,
    setSelectedDate,
    selectedDateOption,
    isOrderable,
  } = useDeliveryCalendar();

  const [activeMenuType, setActiveMenuType] = useState<MenuType>('standard');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDishForModal, setSelectedDishForModal] = useState<MenuItem | null>(null);
  const [isAllergyModalVisible, setIsAllergyModalVisible] = useState<boolean>(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  const [isDateModalVisible, setIsDateModalVisible] = useState<boolean>(!hasPromptedDeliveryDate);

  const handleConfirmDate = (newDate: string) => {
    setSelectedDate(newDate);
    setIsDateModalVisible(false);
    markDeliveryDatePrompted();
  };

  const handleCloseDateModal = () => {
    setIsDateModalVisible(false);
    markDeliveryDatePrompted();
  };

  // Cart summary for the active selected delivery date
  const dateTotals = getActiveDateTotals(selectedDate);
  const dateItems = activeDateCartItems(selectedDate);

  // The cart icon and the review bar open checkout, which lists every day, so they count
  // every day too. Counting only the selected day made a full cart look empty after a day switch.
  const cartTotals = getCartTotals();
  const cartBarDateLabel =
    cartTotals.deliveryDates.length > 1
      ? `${cartTotals.deliveryDates.length} delivery days`
      : deliveryDates.find((d) => d.dateString === cartTotals.deliveryDates[0])?.fullFormattedDate ||
        cartTotals.deliveryDates[0] ||
        selectedDate;

  // Filter categories matching active menu type
  const availableCategories = useMemo(() => {
    return allCategories
      .filter((cat) => cat.menuType === activeMenuType && cat.isActive !== false)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [allCategories, activeMenuType]);

  // Reset selected category tab when switching menu type
  const handleMenuTypeChange = (type: MenuType) => {
    setActiveMenuType(type);
    setSelectedCategoryTab('all');
  };

  // Generate or retrieve dishes matching the active menu type & date (dynamically calculating cycle week)
  const effectiveDishes = useMemo(() => {
    if (activeMenuType === 'chefs_choice') {
      return getChefsChoiceDishesForDate(activeCycleWeekNumber || 1, selectedDate, cyclePlans);
    }
    return menuItems.filter((dish) => dish.menuType === 'standard' && dish.isAvailable !== false);
  }, [activeMenuType, activeCycleWeekNumber, selectedDate, menuItems, cyclePlans]);

  // Dynamically compute the active cycle week based on the selected target date
  const currentWeekNumber = useMemo(() => {
    return getCycleWeekForDate(activeCycleWeekNumber || 1, selectedDate);
  }, [activeCycleWeekNumber, selectedDate]);

  const activeCycleWeekInfo = useMemo(() => {
    const list = cycleWeeks.length > 0 ? cycleWeeks : INITIAL_CYCLE_WEEKS;
    return list.find((w) => w.weekNumber === currentWeekNumber) || list[0];
  }, [currentWeekNumber, cycleWeeks]);

  // Filtered categories with dishes, accounting for category slider selection and search query
  const filteredCategoriesWithDishes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const targetCategories =
      selectedCategoryTab === 'all'
        ? availableCategories
        : availableCategories.filter((c) => c.id === selectedCategoryTab);

    return targetCategories
      .map((category) => {
        const categoryMatches = category.name.toLowerCase().includes(query);

        const matchingDishes = effectiveDishes.filter((dish) => {
          if (activeMenuType === 'standard' && dish.categoryId !== category.id) {
            return false;
          }
          if (!query) return true;

          return (
            categoryMatches ||
            dish.name.toLowerCase().includes(query) ||
            dish.description.toLowerCase().includes(query) ||
            dish.ingredients.toLowerCase().includes(query) ||
            dish.dietaryTags.some((tag) => tag.toLowerCase().includes(query))
          );
        });

        // For Chef's Choice, dynamically update category name to display active week
        const displayCategory =
          activeMenuType === 'chefs_choice'
            ? {
                ...category,
                name: `Week ${currentWeekNumber}: ${activeCycleWeekInfo.title}`,
              }
            : category;

        return {
          category: displayCategory,
          dishes: matchingDishes,
        };
      })
      .filter((group) => group.dishes.length > 0);
  }, [
    availableCategories,
    selectedCategoryTab,
    effectiveDishes,
    activeMenuType,
    activeCycleWeekInfo,
    currentWeekNumber,
    searchQuery,
  ]);

  const totalMatchingDishesCount = useMemo(() => {
    return filteredCategoriesWithDishes.reduce((acc, g) => acc + g.dishes.length, 0);
  }, [filteredCategoriesWithDishes]);

  const handleOpenAddModal = (item: MenuItem) => {
    if (!isOrderable) {
      Alert.alert(
        'Ordering Locked',
        'Ordering for this delivery date is closed because the 9:00 AM SAST cutoff, two business days before delivery, has passed, or it is a public holiday.'
      );
      return;
    }
    setSelectedDishForModal(item);
    setIsAllergyModalVisible(true);
  };

  const handleConfirmAddToCart = (
    item: MenuItem,
    quantity: number,
    notes: string,
    size: 'standard' | 'large' = 'standard',
    selectedAddOns: MenuAddOn[] = [],
    dateAllocations?: { dateString: string; quantity: number }[]
  ) => {
    if (dateAllocations && dateAllocations.length > 0) {
      dateAllocations.forEach((alloc) => {
        if (alloc.quantity > 0) {
          addItem(item, alloc.quantity, notes, alloc.dateString, size, selectedAddOns);
        }
      });
    } else {
      addItem(item, quantity, notes, selectedDate, size, selectedAddOns);
    }
  };

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    if (scrollY > 40 && !isHeaderCollapsed) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsHeaderCollapsed(true);
    } else if (scrollY <= 10 && isHeaderCollapsed) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsHeaderCollapsed(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* 1. Top Bar: Official Logo Centered + Cart Icon on Top Right */}
      <View style={[styles.topBar, { backgroundColor: theme.background, borderBottomColor: theme.surfaceBorder }]}>
        <View style={styles.topBarLeftSpacer} />

        {/* Center: Brand Logo */}
        <View style={styles.centerBrandWrapper}>
          <BrandLogo variant="compact" />
        </View>

        {/* Right: Cart Icon with Active Quantity Badge */}
        <TouchableOpacity
          onPress={onNavigateToCheckout || openCartModal}
          style={[styles.cartIconBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="cart-outline" size={20} color={theme.textPrimary} />
          {cartTotals.itemCount > 0 && (
            <View style={[styles.cartBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
              <Text style={[styles.cartBadgeText, { color:theme.onPrimary}]}>
                {cartTotals.itemCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. Universal Search Input with Calendar Date Trigger Button */}
      <SearchInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        onClear={() => setSearchQuery('')}
        placeholder="Search dishes, ingredients (e.g. Pasta, Salmon, Wrap)..."
        onCalendarPress={() => setIsDateModalVisible(true)}
      />

      {/* 3. Active Delivery Date Info Bar (Tap to Change Date) */}
      {/* 4. Cutoff Notice Banner (Smoothly collapses on scroll) */}
      <CutoffBanner
        selectedOption={selectedDateOption}
        isCollapsed={isHeaderCollapsed}
      />

      {/* 5. Menu Segment Toggle (Standard Classics vs Chef's Choice) */}
      <MenuSegmentToggle
        activeMenuType={activeMenuType}
        onMenuTypeChange={handleMenuTypeChange}
      />

      {/* 6. Horizontal Sliding Category Filter Bar */}
      {availableCategories.length > 1 && (
        <CategorySlider
          categories={availableCategories}
          selectedCategoryId={selectedCategoryTab}
          onSelectCategory={setSelectedCategoryTab}
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* Search Results Summary when Query is Active */}
        {searchQuery.trim().length > 0 && (
          <View style={styles.searchSummaryRow}>
            <Text style={[styles.searchSummaryText, { color: theme.textSecondary }]}>
              Found <Text style={[styles.searchSummaryBold, { color: theme.textPrimary }]}>{totalMatchingDishesCount}</Text> matching {totalMatchingDishesCount === 1 ? 'dish' : 'dishes'} for "{searchQuery}"
            </Text>
          </View>
        )}

        {/* 7. Category & Dish List or Empty Search State */}
        {filteredCategoriesWithDishes.length === 0 ? (
          <View style={[styles.emptySearchContainer, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="search" size={40} color={theme.textMuted} />
            <Text style={[styles.emptySearchTitle, { color: theme.textPrimary }]}>
              No dishes found for '{searchQuery}'
            </Text>
            <Text style={[styles.emptySearchSubtitle, { color: theme.textSecondary }]}>
              Try checking your spelling or exploring other categories.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSelectedCategoryTab('all');
              }}
              style={[styles.clearSearchBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.clearSearchBtnText, { color: theme.onPrimary }]}>
                Clear Search Filter
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredCategoriesWithDishes.map((group) => (
            <CategorySection
              key={group.category.id}
              category={group.category}
              dishes={group.dishes}
              isOrderable={isOrderable}
              onAddToCart={handleOpenAddModal}
            />
          ))
        )}

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Floating Cart Bar */}
      {cartTotals.itemCount > 0 && (
        <FloatingCartBar
          itemCount={cartTotals.itemCount}
          formattedTotal={`R ${cartTotals.totalZar.toFixed(2)}`}
          deliveryDateFormatted={cartBarDateLabel}
          onPress={onNavigateToCheckout || openCartModal}
        />
      )}

      {/* Dish Customizer & Allergy Modal (Portion Size, Add-Ons, Notes, Stepper) */}
      <AllergyModal
        visible={isAllergyModalVisible}
        dish={selectedDishForModal}
        selectedDateOption={selectedDateOption}
        selectedDateFormatted={selectedDateOption?.fullFormattedDate || selectedDate}
        availableDates={deliveryDates}
        onClose={() => setIsAllergyModalVisible(false)}
        onConfirm={handleConfirmAddToCart}
        onNavigateToCheckout={() => {
          setIsAllergyModalVisible(false);
          if (onNavigateToCheckout) {
            onNavigateToCheckout();
          }
        }}
        onOpenDateSelector={() => {
          setIsAllergyModalVisible(false);
          setIsDateModalVisible(true);
        }}
      />

      {/* Cart Summary Modal */}
      <CartModal
        visible={isCartModalOpen}
        items={dateItems}
        deliveryDateFormatted={selectedDateOption?.fullFormattedDate || selectedDate}
        totals={dateTotals}
        onClose={closeCartModal}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onClearCart={() => clearCartForDate(selectedDate)}
        onProceedToCheckout={() => {
          closeCartModal();
          if (onNavigateToCheckout) {
            onNavigateToCheckout();
          }
        }}
      />

      {/* 2-Week Advance Centered Date Modal with Blurred Background */}
      <DeliveryDateModal
        visible={isDateModalVisible}
        deliveryDates={deliveryDates}
        selectedDate={selectedDate}
        onConfirm={handleConfirmDate}
        onClose={handleCloseDateModal}
        canDismiss={true}
        // Skip and Orders belong to the prompt shown after login only. Opened from the calendar
        // icon, the picker is just Confirm (and the close button).
        onSkip={!hasPromptedDeliveryDate ? handleCloseDateModal : undefined}
        onViewOrders={
          !hasPromptedDeliveryDate && onNavigateToOrders
            ? () => {
                handleCloseDateModal();
                onNavigateToOrders();
              }
            : undefined
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topBarLeftSpacer: {
    width: 38,
  },
  centerBrandWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 28,
    height: 28,
  },
  headerBrandText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cartIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContainer: {
    paddingBottom: 90,
  },
  searchSummaryRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  searchSummaryText: {
    fontSize: 13,
  },
  searchSummaryBold: {
    fontWeight: '700',
  },
  emptySearchContainer: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  emptySearchSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  clearSearchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  clearSearchBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footerSpacing: {
    height: 30,
  },
});
