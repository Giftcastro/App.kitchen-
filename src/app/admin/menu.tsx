/** AdminMenuPage.xaml + AdminMenuViewModel — "Menu Catalog" (static menu + 8-week cycle). */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, Page, Picker, SearchBar, Switch } from '../../components/ui';
import { useApp } from '../../state/AppState';
import {
  addStaticProduct,
  DEFAULT_PRODUCT_IMAGE,
  deleteStaticProduct,
  getActiveWeekNumber,
  getAllWeeks,
  getStaticProducts,
  setActiveWeek,
  setProductAvailable,
  updateCycleItem,
  updateStaticProduct,
} from '../../services/catalog';
import type { Product } from '../../models';

type MenuType = 'Static' | 'Cycle';

/** One editable slot of the cycle menu: a single dish for one day + category of one week. */
interface CycleMenuItemRow {
  weekKey: string;
  dayName: string;
  categoryLabel: string;
  value: string;
}

const WEEK_OPTIONS = Array.from({ length: 8 }, (_, i) => `Week ${i + 1}`);
/** "Vegetarian, Gluten-Free" -> ['Vegetarian', 'Gluten-Free']. */
const splitTags = (value: string | null) =>
  (value ?? '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

export default function AdminMenuScreen() {
  const { colors, isDark } = useApp();
  const [menuType, setMenuType] = useState<MenuType>('Static');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWeekNumber, setActiveWeekNumber] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState('Week 1');
  const [cycleItems, setCycleItems] = useState<CycleMenuItemRow[]>([]);

  const loadProducts = useCallback(async () => {
    try {
      setProducts(await getStaticProducts());
    } catch (err) {
      await alerts.show('Could Not Load', (err as Error)?.message ?? 'Check your connection and try again.', 'OK');
    }
  }, []);

  /** Flattens one week's days x categories into a list of editable rows. */
  const loadCycleItems = useCallback(async (weekKey: string) => {
    try {
      const weeks = await getAllWeeks();
      setCycleItems(
        (weeks[weekKey] ?? []).flatMap(day => day.categories.map(([categoryLabel, value]) => ({ weekKey, dayName: day.day, categoryLabel, value })))
      );
    } catch {
      setCycleItems([]);
    }
  }, []);

  // On focus: reload the catalog and open the cycle editor on the currently active week.
  useFocusEffect(
    useCallback(() => {
      loadProducts();
      getActiveWeekNumber()
        .then(week => {
          setActiveWeekNumber(week);
          setSelectedWeek(`Week ${week}`);
          loadCycleItems(`Week ${week}`);
        })
        .catch(() => {});
    }, [loadProducts, loadCycleItems])
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q ? products.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) : products;
  }, [products, searchQuery]);

  const failed = (err: unknown) => alerts.show('Not Saved', (err as Error)?.message ?? 'Check your connection and try again.', 'OK');

  // ── Static menu CRUD ──

  /** + Add Item: a chain of prompts; anything skipped falls back to a sensible default. */
  const addProduct = async () => {
    const name = await alerts.prompt('New Menu Item', 'Enter item name:');
    if (!name?.trim()) return;
    const priceStr = await alerts.prompt('Price', 'Enter base price:', { keyboard: 'decimal-pad' });
    const parsed = parseFloat(String(priceStr ?? '').replace(',', '.'));
    const price = Number.isFinite(parsed) ? parsed : 9.99;
    const category = await alerts.prompt('Category', 'Enter category (e.g. BURGER BAR):', { initialValue: 'MISC' });
    const categoryUpper = category?.trim() ? category.trim().toUpperCase() : 'MISC';

    // A category nobody has used yet is a new category — offer it a hero image.
    let customImageUrl: string | undefined;
    if (!products.some(p => p.category.toUpperCase() === categoryUpper)) {
      const wantsImage = await alerts.confirm(
        'New Category',
        `"${categoryUpper}" doesn't exist yet — would you like to set a custom hero image for it? (A generic one is used otherwise.)`,
        'Set Image',
        'Use Default'
      );
      if (wantsImage) {
        const url = await alerts.prompt('Category Hero Image', 'Paste an image URL for this category:');
        if (url?.trim()) customImageUrl = url.trim();
      }
    }
    const description = await alerts.prompt('Description', 'Short description shown to customers:', { initialValue: 'Freshly prepared gourmet selection.' });
    const ingredients = await alerts.prompt('Ingredients', "Comma-separated list, shown on the dish's listing (optional):");
    const tags = await alerts.prompt('Dietary Tags', 'Comma-separated, e.g. "Vegetarian, Gluten-Free" (optional):');
    try {
      await addStaticProduct({
        name: name.trim(),
        basePrice: price,
        category: categoryUpper,
        description: description?.trim() ? description.trim() : 'Freshly prepared gourmet selection.',
        ingredients: ingredients?.trim() ?? '',
        dietaryTags: splitTags(tags),
        imageUrl: customImageUrl ?? DEFAULT_PRODUCT_IMAGE,
      });
      await loadProducts();
      await alerts.show('Product Added', `${name.trim()} has been added to the catalog.`, 'OK');
    } catch (err) {
      await failed(err);
    }
  };

  /** Optimistic toggle — flips the switch immediately and rolls back if the save fails. */
  const toggleAvailability = async (product: Product) => {
    const isAvailable = !product.isAvailable;
    setProducts(list => list.map(p => (p.id === product.id ? { ...p, isAvailable } : p)));
    try {
      await setProductAvailable(product.id, isAvailable);
      await alerts.show('Inventory Updated', `${product.name} is now marked as ${isAvailable ? 'available' : 'out of stock'}.`, 'OK');
    } catch (err) {
      setProducts(list => list.map(p => (p.id === product.id ? { ...p, isAvailable: !isAvailable } : p)));
      await failed(err);
    }
  };

  /** Edit name/price/description/ingredients/tags; an unparseable price cancels the edit. */
  const editProduct = async (product: Product) => {
    const name = await alerts.prompt('Edit Item', 'Update item name:', { initialValue: product.name });
    if (!name?.trim()) return;
    const priceStr = await alerts.prompt('Edit Price', 'Update base price:', { initialValue: product.basePrice.toFixed(2), keyboard: 'decimal-pad' });
    const price = parseFloat(String(priceStr ?? '').replace(',', '.'));
    if (!Number.isFinite(price)) return;
    const description = await alerts.prompt('Edit Description', 'Short description shown to customers:', { initialValue: product.description });
    const ingredients = await alerts.prompt('Edit Ingredients', 'Comma-separated list (optional):', { initialValue: product.ingredients });
    const tags = await alerts.prompt('Edit Dietary Tags', 'Comma-separated, e.g. "Vegetarian, Gluten-Free" (optional):', {
      initialValue: product.dietaryTags.join(', '),
    });
    try {
      await updateStaticProduct(product, {
        name: name.trim(),
        basePrice: price,
        description: description ?? '',
        ingredients: ingredients ?? '',
        dietaryTags: splitTags(tags),
      });
      await loadProducts();
    } catch (err) {
      await failed(err);
    }
  };

  const deleteProduct = async (product: Product) => {
    const confirmed = await alerts.confirm('Confirm Delete', `Are you sure you want to remove '${product.name}'?`, 'Delete', 'Cancel');
    if (!confirmed) return;
    try {
      await deleteStaticProduct(product.id);
      setProducts(list => list.filter(p => p.id !== product.id));
    } catch (err) {
      await failed(err);
    }
  };

  // ── Cycle menu ──

  const selectWeek = (week: string) => {
    setSelectedWeek(week);
    loadCycleItems(week);
  };

  /** Makes the browsed week the active one; the rotation continues from it. */
  const activateWeek = async () => {
    const weekNumber = Number(selectedWeek.replace('Week ', ''));
    const confirmed = await alerts.confirm(
      'Activate this week?',
      `Make ${selectedWeek} the active menu for the current cycle? Future weeks will keep rotating normally from here.`,
      'Activate',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      await setActiveWeek(weekNumber);
      setActiveWeekNumber(await getActiveWeekNumber());
      await alerts.show('Active Week Updated', `${selectedWeek} is now active for this week's deliveries.`, 'OK');
    } catch (err) {
      await failed(err);
    }
  };

  /** Updates one slot locally after a successful save (avoids refetching the whole week). */
  const patchRow = (row: CycleMenuItemRow, value: string) =>
    setCycleItems(list => list.map(r => (r.dayName === row.dayName && r.categoryLabel === row.categoryLabel ? { ...r, value } : r)));

  const editCycleItem = async (row: CycleMenuItemRow) => {
    const updated = await alerts.prompt(`Edit ${row.dayName} — ${row.categoryLabel}`, 'Update the dish:', { initialValue: row.value });
    if (!updated?.trim() || updated === row.value) return;
    try {
      await updateCycleItem(row.weekKey, row.dayName, row.categoryLabel, updated.trim());
      patchRow(row, updated.trim());
    } catch (err) {
      await failed(err);
    }
  };

  /** "Removing" a dish saves an empty string — the day/category slot itself stays. */
  const removeCycleItem = async (row: CycleMenuItemRow) => {
    if (!row.value.trim()) {
      await alerts.show('Already Empty', 'This slot has no dish to remove.', 'OK');
      return;
    }
    const confirmed = await alerts.confirm(
      'Remove Dish?',
      `Remove "${row.value}" from ${row.dayName} — ${row.categoryLabel}? The slot will be empty until a new dish is added.`,
      'Remove',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      await updateCycleItem(row.weekKey, row.dayName, row.categoryLabel, '');
      patchRow(row, '');
    } catch (err) {
      await failed(err);
    }
  };

  /** Static Menu / Cycle Menu segmented toggle. */
  const typeButton = (label: string, type: MenuType) => {
    const active = menuType === type;
    return (
      <Btn
        title={label}
        onPress={() => setMenuType(type)}
        bold
        radius={8}
        height={38}
        bg={active ? colors.primary : colors.subtleFill}
        color={active ? colors.onPrimary : colors.text}
        style={styles.flex}
      />
    );
  };

  // Product cards use fixed light/dark colours rather than theme tokens (MAUI parity).
  const productText = isDark ? '#F7F2E8' : '#121212';

  return (
    <Page>
      <AdminNavStrip activeRoute="adminmenu" />
      <View style={styles.typeRow}>
        {typeButton('Static Menu', 'Static')}
        {typeButton('Cycle Menu', 'Cycle')}
      </View>

      {menuType === 'Static' ? (
        <>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search menu items..." style={styles.search} />
          <View style={styles.inventoryHeader}>
            <Text style={[styles.heading, { color: colors.text }]}>Menu Inventory</Text>
            <Btn title="+ Add Item" onPress={addProduct} bg={colors.brandGold} color={colors.onBrandGold} bold radius={8} height={38} />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={p => p.id}
            contentContainerStyle={styles.list}
            renderItem={({ item: product }) => (
              <Card radius={12} padding={12} bg={isDark ? '#1C1C1E' : '#FFFFFF'} border={colors.surfaceBorder} style={styles.productCard}>
                <View style={styles.productRow}>
                  <View style={styles.photo}>
                    <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.productName, { color: productText }]} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={[styles.category, { color: productText }]}>{product.category}</Text>
                    <Text style={[styles.productPrice, { color: productText }]}>R{product.basePrice.toFixed(2)}</Text>
                  </View>
                  <View style={styles.available}>
                    <Text style={[styles.availableLabel, { color: productText }]}>Available</Text>
                    <Switch value={product.isAvailable} onValueChange={() => toggleAvailability(product)} onColor={colors.primary} />
                  </View>
                </View>
                <View style={styles.productActions}>
                  <Btn title="Edit" onPress={() => editProduct(product)} bg="rgba(255,255,255,0.2)" color={productText} fontSize={11} height={32} paddingH={12} />
                  <Btn title="Delete" onPress={() => deleteProduct(product)} variant="dangerOutline" fontSize={11} height={32} paddingH={12} />
                </View>
              </Card>
            )}
          />
        </>
      ) : (
        <FlatList
          data={cycleItems}
          keyExtractor={r => `${r.dayName}-${r.categoryLabel}`}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.cycleHeader}>
              <View style={[styles.activeBox, { backgroundColor: colors.subtleFillStrong }]}>
                <Text style={[styles.activeText, { color: colors.brandGold }]}>Currently active for this week: Week {activeWeekNumber} of 8</Text>
              </View>
              <View style={styles.weekRow}>
                <Text style={[styles.browse, { color: colors.text }]}>Browse / activate:</Text>
                <Picker title="Week" options={WEEK_OPTIONS} selected={selectedWeek} onSelect={selectWeek} width={140} />
                <Btn title="Set as Active Week" onPress={activateWeek} bg={colors.brandGold} color={colors.onBrandGold} bold fontSize={12} radius={8} height={36} paddingH={10} />
              </View>
            </View>
          }
          renderItem={({ item: row }) => {
            const empty = !row.value.trim();
            return (
              <Card radius={12} padding={12} style={styles.cycleCard}>
                <View style={styles.cycleRow}>
                  <View style={styles.flex}>
                    <Text style={[styles.cycleHeaderText, { color: colors.brandGold }]}>
                      {row.dayName} — {row.categoryLabel}
                    </Text>
                    <Text style={[styles.cycleValue, { color: empty ? colors.mutedText : colors.text }, empty && styles.italic]}>
                      {empty ? 'No dish set yet' : row.value}
                    </Text>
                  </View>
                  <Btn title={empty ? 'Add' : 'Edit'} onPress={() => editCycleItem(row)} variant="neutral" fontSize={11} height={32} paddingH={12} />
                  {!empty && <Btn title="Remove" onPress={() => removeCycleItem(row)} variant="dangerOutline" fontSize={11} height={32} paddingH={10} />}
                </View>
              </Card>
            );
          }}
        />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  typeRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  search: { marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  inventoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 12, marginTop: 4 },
  heading: { fontSize: 18, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  productCard: { marginBottom: 12, gap: 6 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 65, height: 65, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)' },
  productName: { fontSize: 15, fontWeight: '700' },
  category: { fontSize: 11, opacity: 0.75 },
  productPrice: { fontSize: 13, fontWeight: '700' },
  available: { alignItems: 'center' },
  availableLabel: { fontSize: 10, opacity: 0.75 },
  productActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cycleHeader: { gap: 10, marginTop: 8, marginBottom: 12 },
  activeBox: { borderRadius: 10, padding: 12 },
  activeText: { fontSize: 13, fontWeight: '700' },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  browse: { fontSize: 12, fontWeight: '700' },
  cycleCard: { marginBottom: 10 },
  cycleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cycleHeaderText: { fontSize: 12, fontWeight: '700' },
  cycleValue: { fontSize: 14, marginTop: 4 },
  italic: { fontStyle: 'italic' },
});
