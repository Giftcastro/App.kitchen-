/** UserDashboardPage.xaml + UserDashboardViewModel. */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/AppText';
import { Btn, Card, Page, SearchBar } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { setNavParam } from '../../state/navParams';
import { getProducts } from '../../services/catalog';
import { fmtDayLabel } from '../../services/scheduling';
import type { Product } from '../../models';

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
  const { colors, isDark, cartCount, cartTotal, selectedOrderingDate } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentMenu, setCurrentMenu] = useState<MenuKind>('Main');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const busyRef = useRef(false);

  const loadData = useCallback(
    async (menu: MenuKind) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setIsBusy(true);
      try {
        const items = await getProducts(menu, selectedOrderingDate);
        // Pulled dishes (Admin > Menu Catalog > Available off) stay off the customer menu.
        setProducts(items.filter(p => p.isAvailable));
      } catch {
        setProducts([]);
      } finally {
        busyRef.current = false;
        setIsBusy(false);
        setLoadedOnce(true);
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

  const toggleButton = (label: string, menu: MenuKind) => {
    const selected = currentMenu === menu;
    return (
      <Pressable
        onPress={() => switchMenu(menu)}
        accessibilityRole="tab"
        aria-selected={selected}
        style={({ pressed }) => [styles.toggleBtn, selected && { backgroundColor: colors.primary }, pressed && styles.pressed]}
      >
        <Text style={[styles.toggleText, { color: selected ? colors.onPrimary : colors.segmentText }]}>{label}</Text>
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
    <Page bg={colors.cream}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: cartCount > 0 ? 96 : 16 }}
        refreshControl={<RefreshControl refreshing={isBusy && loadedOnce} onRefresh={() => loadData(currentMenu)} tintColor={colors.primary} />}
      >
        {/* 1. Logo + cart */}
        <View style={styles.header}>
          <Image
            source={isDark ? require('../../../assets/images/yourkcodark.png') : require('../../../assets/images/yourkcolight.png')}
            style={styles.headerLogo}
            resizeMode="contain"
            accessibilityLabel="Your Kitchen Co."
          />
          <Pressable onPress={() => router.push('/cart')} accessibilityRole="button" accessibilityLabel={`Basket, ${cartCount} items`} style={styles.cartWrap}>
            <View style={[styles.cartButton, { backgroundColor: colors.primary }]}>
              <Text style={{ fontSize: 18 }}>🛒</Text>
            </View>
            {cartCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.badge, borderColor: colors.pageBg }]}>
                <Text style={styles.badgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* 2. Search */}
        <View style={[styles.searchBox, { borderColor: colors.surfaceBorder, backgroundColor: colors.cardBg }]}>
          <SearchBar value={searchText} onChangeText={setSearchText} placeholder="Search dishes, ingredients..." bare />
        </View>

        {/* 3. Delivery day — tap to change */}
        <Card radius={12} padding={[14, 10]} border={colors.surfaceBorder} style={styles.dateCard} onPress={() => router.push('/select-date')}>
          <View style={styles.dateRow}>
            <Text style={{ fontSize: 15, color: colors.brandPop }}>📅</Text>
            <View style={styles.flex}>
              <Text style={[styles.dateCaption, { color: colors.textSecondary }]}>Delivering</Text>
              <Text style={[styles.dateValue, { color: colors.text }]}>{dateLabel}</Text>
            </View>
            <Text style={[styles.change, { color: colors.primary }]}>Change ›</Text>
          </View>
        </Card>

        {/* 4. Main / Cycling toggle */}
        <View style={[styles.toggle, { backgroundColor: colors.segmentTrack }]}>
          {toggleButton('Main Menu', 'Main')}
          {toggleButton('Cycling Menu', 'Weekly')}
        </View>

        {/* 5. */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Explore Our Menu</Text>

        {/* 6. Category slider */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slider} style={styles.sliderWrap}>
          {chip('All', '', activeCategory === '')}
          {categories.map(c => chip(titleCase(c.name), c.name, activeCategory.toLowerCase() === c.name.toLowerCase()))}
        </ScrollView>

        {/* 7. Cutoff message */}
        <View style={[styles.notice, { borderColor: colors.surfaceBorder, backgroundColor: colors.tan }]}>
          <Text style={[styles.noticeText, { color: colors.text }]}>Orders close at 9:00 AM, two business days before your delivery date.</Text>
        </View>

        {!loadedOnce && isBusy && <ActivityIndicator color={colors.primary} style={styles.loader} />}

        {/* 8. Category sections */}
        {grouped.map(section => (
          <View key={section.category.name} style={styles.section}>
            <ImageBackground source={{ uri: section.category.imageUrl }} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover">
              <View style={styles.heroShade} />
              <Text style={styles.heroTitle}>{titleCase(section.category.name)}</Text>
            </ImageBackground>
            <View style={styles.products}>
              {section.products.map(product => (
                <Card key={product.id} border={colors.surfaceBorder} shadow="soft" onPress={() => openProduct(product)}>
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
                            <View key={tag} style={[styles.tag, { borderColor: colors.surfaceBorder, backgroundColor: colors.tan }]}>
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
          </View>
        ))}
      </ScrollView>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <Pressable
          onPress={() => router.push('/cart')}
          accessibilityRole="button"
          style={[styles.floatBar, { backgroundColor: colors.floatingBar, borderColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }]}
        >
          <View style={[styles.floatCount, { backgroundColor: isDark ? '#121212' : '#FFFFFF' }]}>
            <Text style={[styles.floatCountText, { color: isDark ? '#F7F2E8' : '#121212' }]}>{cartCount}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.floatTotal, { color: colors.onFloatingBar }]}>R {cartTotal.toFixed(2)}</Text>
            <Text style={[styles.floatDate, { color: colors.onFloatingBarMuted }]} numberOfLines={1}>
              {dateLabel}
            </Text>
          </View>
          <Text style={[styles.floatAction, { color: colors.onFloatingBar }]}>Review Order</Text>
          <Text style={[styles.floatArrow, { color: colors.onFloatingBar }]}>→</Text>
        </Pressable>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  // 32pt tall at the artwork's 2236x490 aspect, left-aligned (AspectFit + Start).
  headerLogo: { width: 146, height: 32 },
  cartWrap: { width: 42, height: 42, marginLeft: 'auto' },
  cartButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  searchBox: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 20, height: 42, justifyContent: 'center' },
  dateCard: { marginHorizontal: 16, marginBottom: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateCaption: { fontSize: 10 },
  dateValue: { fontSize: 13, fontWeight: '700' },
  change: { fontSize: 12, fontWeight: '700' },
  toggle: { marginHorizontal: 16, marginBottom: 14, borderRadius: 24, padding: 4, height: 48, flexDirection: 'row' },
  toggleBtn: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginHorizontal: 16, marginBottom: 10 },
  sliderWrap: { marginBottom: 10, flexGrow: 0 },
  slider: { gap: 22, paddingHorizontal: 16 },
  chip: { alignItems: 'center', gap: 6 },
  chipText: { fontSize: 14 },
  chipUnderline: { height: 2.5, width: 20, borderRadius: 1.5 },
  notice: { marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  noticeText: { fontSize: 12 },
  loader: { marginVertical: 24 },
  section: { marginBottom: 20 },
  hero: { height: 110, marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end' },
  heroImage: { borderRadius: 16 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginHorizontal: 16, marginBottom: 12 },
  products: { gap: 10, paddingHorizontal: 16 },
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
