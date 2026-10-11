/**
 * UserDashboardPage.xaml + UserDashboardViewModel. The delivery day is
 * changed from the 📅 pill via the in-page DeliveryDayOverlay.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../components/AppText';
import { Btn, Card, Page, SearchBar, HScroll } from '../../../components/ui';
import { useApp } from '../../../state/AppState';
import { BrandLogo } from '../../../components/BrandLogo';
import { setNavParam } from '../../../state/navParams';
import { getProducts } from '../../../services/catalog';
import { fmtDayLabel, fmtDayMonth, STATIC_WINDOW } from '../../../services/scheduling';
import { DeliveryDayOverlay } from '../../../components/DeliveryDayPicker';
import type { Product } from '../../../models';

type MenuKind = 'Main' | 'Weekly';

interface CategoryChip {
  name: string;
  icon: string;
  imageUrl: string;
}

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

export default function UserDashboardScreen() {
  const { colors, isDark, cartCount, cartTotal, selectedOrderingDate, setSelectedOrderingDate, isAdminPreview, returnToAdmin } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentMenu, setCurrentMenu] = useState<MenuKind>('Main');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const busyRef = useRef(false);

  const loadData = useCallback(
    async (menu: MenuKind) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const items = await getProducts(menu, selectedOrderingDate);
        // Pulled dishes (Admin > Menu Catalog > Available off) stay off the customer menu.
        setProducts(items.filter(p => p.isAvailable));
      } catch {
        setProducts([]);
      } finally {
        busyRef.current = false;
      }
    },
    [selectedOrderingDate]
  );

  useFocusEffect(
    useCallback(() => {
      loadData(currentMenu);
    }, [loadData, currentMenu])
  );

  const switchMenu = (menu: MenuKind) => {
    if (menu === currentMenu) return;
    setSearchText('');
    setActiveCategory('');
    setProducts([]);
    setCurrentMenu(menu);
  };

  const categories: CategoryChip[] = useMemo(() => {
    const seen = new Map<string, CategoryChip>();
    for (const p of products) {
      if (p.category && !seen.has(p.category)) seen.set(p.category, { name: p.category, icon: p.icon, imageUrl: p.imageUrl });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const grouped = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const filtered = products.filter(
      p =>
        (!activeCategory || p.category.toLowerCase() === activeCategory.toLowerCase()) &&
        (!query || p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query))
    );
    return categories
      .map(category => ({ category, products: filtered.filter(p => p.category.toLowerCase() === category.name.toLowerCase()) }))
      .filter(section => section.products.length > 0);
  }, [products, categories, activeCategory, searchText]);

  const filterCategory = (category: string) => setActiveCategory(prev => (prev === category ? '' : category));

  const openProduct = (product: Product) => {
    setNavParam('SelectedProduct', product);
    router.push('/product');
  };

  const dateLabel = selectedOrderingDate ? fmtDayLabel(selectedOrderingDate) : 'Choose a delivery day';
  const shortDateLabel = selectedOrderingDate ? fmtDayMonth(selectedOrderingDate) : 'Set date';

  const toggleButton = (label: string, menu: MenuKind) => {
    const selected = currentMenu === menu;
    return (
      <Pressable
        onPress={() => switchMenu(menu)}
        accessibilityRole="tab"
        aria-selected={selected}
        style={({ pressed }) => [styles.toggleBtn, selected && { backgroundColor: colors.primary }, pressed && styles.pressed]}
      >
        <Text style={[styles.toggleText, { color: selected ? colors.onPrimary : colors.mutedText }]}>{label}</Text>
      </Pressable>
    );
  };

  const chip = (label: string, key: string, active: boolean) => (
    <Pressable key={key} onPress={() => (key === '' ? setActiveCategory('') : filterCategory(key))} style={styles.chip}>
      <Text style={[styles.chipText, { color: colors.text, fontWeight: active ? '700' : '400' }]}>{label}</Text>
      <View style={[styles.chipUnderline, { backgroundColor: active ? colors.primary : 'transparent' }]} />
    </Pressable>
  );

  return (
    <Page>
      <ScrollView>
        {/* Themed header band: admin-preview chip, logo + cart, search + date pill */}
        <View style={[styles.band, { backgroundColor: colors.headerBg, paddingTop: insets.top }]}>
          {isAdminPreview && (
            <Pressable
              onPress={returnToAdmin}
              accessibilityRole="button"
              style={({ pressed }) => [styles.previewChip, { backgroundColor: colors.headerChipBg }, pressed && styles.dim]}
            >
              <Text style={[styles.previewText, { color: colors.onPrimary }]}>Previewing as a customer</Text>
              <Text style={[styles.previewText, { color: colors.onPrimary }]}>← Back to Admin</Text>
            </Pressable>
          )}
          <View style={styles.header}>
            <View style={styles.headerSide} />
            <View style={styles.headerCenter}>
              <BrandLogo size={26} color={colors.headerLogoInk} />
            </View>
            <Pressable
              onPress={() => router.push('/cart')}
              accessibilityRole="button"
              accessibilityLabel={`Basket, ${cartCount} items`}
              style={styles.headerSide}
            >
              <View style={[styles.cartButton, { backgroundColor: colors.headerChipBg }]}>
                <Text style={{ fontSize: 18 }}>🛒</Text>
              </View>
              {cartCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.headerBg }]}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <View style={[styles.searchBox, { borderColor: colors.surfaceBorder, backgroundColor: colors.cardBg }]}>
              <SearchBar value={searchText} onChangeText={setSearchText} placeholder="Search dishes, ingredients..." bare />
            </View>
            <Pressable
              onPress={() => setDayPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Change delivery day"
              style={({ pressed }) => [styles.datePill, { borderColor: colors.surfaceBorder, backgroundColor: colors.cardBg }, pressed && styles.dim]}
            >
              <Text style={styles.dateIcon}>📅</Text>
              <Text style={[styles.dateShort, { color: colors.text }]} numberOfLines={1}>
                {shortDateLabel}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Main / Cycling toggle */}
        <View style={[styles.toggle, { backgroundColor: colors.chipBg }]}>
          {toggleButton('Main Menu', 'Main')}
          {toggleButton('Cycling Menu', 'Weekly')}
        </View>

        {/* Category slider — "All" stays pinned on the left; only the categories scroll */}
        <View style={styles.sliderRow}>
          <View style={styles.sliderAll}>{chip('All', '', activeCategory === '')}</View>
          <HScroll contentContainerStyle={styles.slider} style={styles.sliderScroll}>
            {categories.map(c => chip(titleCase(c.name), c.name, activeCategory.toLowerCase() === c.name.toLowerCase()))}
          </HScroll>
        </View>

        {/* Cutoff message */}
        <View style={[styles.notice, { borderColor: colors.surfaceBorder, backgroundColor: colors.chipBg }]}>
          <Text style={[styles.noticeText, { color: colors.text }]}>Orders close at 9:00 AM, two business days before your delivery date.</Text>
        </View>

        {/* Category sections */}
        {grouped.map(section => (
          <View key={section.category.name}>
            <ImageBackground source={{ uri: section.category.imageUrl }} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover">
              <View style={styles.heroShade} />
              <Text style={styles.heroTitle}>{titleCase(section.category.name)}</Text>
            </ImageBackground>
            {section.products.map(product => (
              <Card key={product.id} border={colors.surfaceBorder} shadow="soft" style={styles.productCard} onPress={() => openProduct(product)}>
                <View style={styles.productRow}>
                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
                      {product.name}
                    </Text>
                    {!!product.description && (
                      <Text style={[styles.productDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {product.description}
                      </Text>
                    )}
                    {!!product.ingredients.trim() && (
                      <Text style={[styles.ingredients, { color: colors.textSecondary }]} numberOfLines={1}>
                        <Text style={[styles.ingredients, styles.bold, { color: colors.textSecondary }]}>Ingredients: </Text>
                        {product.ingredients}
                      </Text>
                    )}
                    {product.dietaryTags.length > 0 && (
                      <View style={styles.tags}>
                        {product.dietaryTags.map(tag => (
                          <View key={tag} style={[styles.tag, { borderColor: colors.surfaceBorder, backgroundColor: colors.chipBg }]}>
                            <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.priceCol}>
                    <Text style={[styles.price, { color: colors.primary }]}>R {product.basePrice.toFixed(2)}</Text>
                    {product.largePrice != null && (
                      <Text style={[styles.largePrice, { color: colors.textSecondary }]}>Large R {product.largePrice.toFixed(2)}</Text>
                    )}
                    <Btn title="+" onPress={() => openProduct(product)} bold fontSize={20} height={40} radius={20} paddingH={0} style={styles.plus} />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <Pressable
          onPress={() => router.push('/cart')}
          accessibilityRole="button"
          style={[styles.floatBar, { backgroundColor: colors.primary, borderColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }]}
        >
          <View style={[styles.floatCount, { backgroundColor: colors.onPrimary }]}>
            <Text style={[styles.floatCountText, { color: colors.primary }]}>{cartCount}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.floatTotal, { color: colors.onPrimary }]}>R {cartTotal.toFixed(2)}</Text>
            <Text style={[styles.floatDate, { color: isDark ? 'rgba(18,18,18,0.65)' : 'rgba(255,255,255,0.65)' }]} numberOfLines={1}>
              {dateLabel}
            </Text>
          </View>
          <Text style={[styles.floatAction, { color: colors.onPrimary }]}>Review Order</Text>
          <Text style={[styles.floatArrow, { color: colors.onPrimary }]}>→</Text>
        </Pressable>
      )}

      <DeliveryDayOverlay
        visible={dayPickerOpen}
        windowDays={STATIC_WINDOW}
        onConfirm={date => {
          setSelectedOrderingDate(date);
          setDayPickerOpen(false);
        }}
        onClose={() => setDayPickerOpen(false)}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  dim: { opacity: 0.85 },
  band: { paddingBottom: 14, marginBottom: 12 },
  previewChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewText: { fontSize: 12, fontWeight: '700' },
  // Grid 42 / * / 42: the empty left column keeps the logo truly centred.
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  headerSide: { width: 42, height: 42 },
  // Middle column of the 42 / * / 42 grid, so the wordmark is centred and clear of the cart button.
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 10 },
  cartButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16 },
  searchBox: { flex: 1, borderWidth: 1, borderRadius: 20, height: 42, justifyContent: 'center' },
  datePill: {
    height: 42,
    minWidth: 72,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dateIcon: { fontSize: 13 },
  dateShort: { fontSize: 11, fontWeight: '700', maxWidth: 56 },
  toggle: { marginHorizontal: 16, marginBottom: 14, borderRadius: 24, padding: 4, height: 48, flexDirection: 'row' },
  toggleBtn: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 13, fontWeight: '700' },
  sliderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  sliderAll: { paddingLeft: 16, paddingRight: 22 },
  sliderScroll: { flex: 1, flexGrow: 1 },
  slider: { gap: 22, paddingRight: 16 },
  chip: { alignItems: 'center', gap: 6 },
  chipText: { fontSize: 14 },
  chipUnderline: { height: 2.5, width: 20, borderRadius: 1.5 },
  notice: { marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  noticeText: { fontSize: 12 },
  hero: { height: 110, marginHorizontal: 16, marginVertical: 10, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end' },
  heroImage: { borderRadius: 16 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginHorizontal: 16, marginBottom: 12 },
  productCard: { marginHorizontal: 16, marginBottom: 10 },
  productRow: { flexDirection: 'row', gap: 14 },
  productInfo: { flex: 1, gap: 4 },
  productName: { fontSize: 16, fontWeight: '700' },
  productDesc: { fontSize: 13 },
  ingredients: { fontSize: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  tag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 6 },
  tagText: { fontSize: 11, fontWeight: '700' },
  priceCol: { minWidth: 78, alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  price: { fontSize: 16, fontWeight: '700' },
  largePrice: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  plus: { width: 40, marginTop: 2 },
  floatBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  floatCount: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  floatCountText: { fontSize: 13, fontWeight: '700' },
  floatTotal: { fontSize: 15, fontWeight: '700' },
  floatDate: { fontSize: 10, fontWeight: '700' },
  floatAction: { fontSize: 13, fontWeight: '700' },
  floatArrow: { fontSize: 15, fontWeight: '700', marginLeft: -6 },
});
