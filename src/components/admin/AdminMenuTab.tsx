import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Modal,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeContext';
import { useCart } from '../../context/CartContext';
import { MenuItem, MenuCategory, CycleWeekPlan, CycleDayPlan } from '../../types';
import { EIGHT_WEEK_CYCLE_DATA, INITIAL_CYCLE_WEEKS, getCategoryHeroImage } from '../../data/mockData';

const saveOrWarn = async <T,>(save: () => Promise<T>): Promise<T | null> => {
  try {
    return await save();
  } catch (e: any) {
    Alert.alert('Not Saved', e?.message || 'The change could not be saved. Please try again.');
    return null;
  }
};

export const AdminMenuTab: React.FC = () => {
  const { theme, isDark } = useTheme();
  const {
    menuItems,
    categories,
    cycleWeeks,
    cyclePlans: liveCyclePlans,
    activeCycleWeekNumber,
    setActiveCycleWeek,
    addMenuItem,
    updateMenuItem,
    archiveMenuItem,
    addCategory,
    updateCategory,
    updateCycleDayPlan,
    updateCycleRotation,
  } = useCart();
  const availableWeeks = cycleWeeks.length > 0 ? cycleWeeks : INITIAL_CYCLE_WEEKS;
  const effectiveCyclePlans = liveCyclePlans.length > 0 ? liveCyclePlans : EIGHT_WEEK_CYCLE_DATA;

  // Sub-tab: 'static' | 'cycle'
  const [activeSubTab, setActiveSubTab] = useState<'static' | 'cycle'>('static');

  // Static Menu states
  const [localItems, setLocalItems] = useState<MenuItem[]>(menuItems);

  useEffect(() => {
    setLocalItems(menuItems);
  }, [menuItems]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing / Creating Dish Modal (FULL ITEM DETAILS)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isCreatingDish, setIsCreatingDish] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editPrice, setEditPrice] = useState<string>('');
  const [editLargePrice, setEditLargePrice] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editIngredients, setEditIngredients] = useState<string>('');
  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [editDietaryTags, setEditDietaryTags] = useState<string[]>([]);
  const [editIsAvailable, setEditIsAvailable] = useState<boolean>(true);

  // Category Creating / Editing Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState<boolean>(false);
  const [editingCat, setEditingCat] = useState<MenuCategory | null>(null);
  const [catNameInput, setCatNameInput] = useState<string>('');
  const [catHeroUrlInput, setCatHeroUrlInput] = useState<string>('');

  // 8-Week Cycle scheduling & editing states
  const [browsingWeekNumber, setBrowsingWeekNumber] = useState<number>(activeCycleWeekNumber || 1);
  const [scheduledAdvanceWeek, setScheduledAdvanceWeek] = useState<number | null>(null);
  const [editingCycleDay, setEditingCycleDay] = useState<{ week: number; day: CycleDayPlan } | null>(null);
  const [editMainMeal, setEditMainMeal] = useState<string>('');
  const [editVegMeal, setEditVegMeal] = useState<string>('');
  const [editHealthyMeal, setEditHealthyMeal] = useState<string>('');
  const [editCurry, setEditCurry] = useState<string>('');
  const [editSandwich, setEditSandwich] = useState<string>('');

  // Editing Week Rotation Title & Description Modal
  const [isEditingWeekMeta, setIsEditingWeekMeta] = useState<boolean>(false);
  const [editWeekTitle, setEditWeekTitle] = useState<string>('');
  const [editWeekDescription, setEditWeekDescription] = useState<string>('');

  useEffect(() => {
    if (activeCycleWeekNumber) {
      setBrowsingWeekNumber(activeCycleWeekNumber);
    }
  }, [activeCycleWeekNumber]);

  // Dietary tags options
  const DIETARY_OPTIONS = ['Halaal', 'Vegetarian', 'Vegan', 'Gluten-Free', 'High-Protein', 'Dairy-Free'];

  const standardCategories = useMemo(() => {
    return categories.filter((c) => c.menuType === 'standard');
  }, [categories]);

  // Filtered static menu items
  const filteredItems = useMemo(() => {
    return localItems.filter((item) => {
      if (item.menuType !== 'standard') return false;
      const matchCat = selectedCategory === 'all' || item.categoryId === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [localItems, selectedCategory, searchQuery]);

  // Open Create Dish Modal
  const handleOpenCreateDish = () => {
    const defaultCatId =
      selectedCategory !== 'all'
        ? selectedCategory
        : standardCategories[0]?.id || categories[0]?.id || 'cat_salad_bar';
    setIsCreatingDish(true);
    setEditingItem({
      id: 'new',
      categoryId: defaultCatId,
      menuType: 'standard',
      name: '',
      description: '',
      ingredients: '',
      price: 85,
      dietaryTags: ['Halaal'],
      isAvailable: true,
    });
    setEditName('');
    setEditPrice('85.00');
    setEditLargePrice('');
    setEditDescription('');
    setEditIngredients('');
    setEditCategoryId(defaultCatId);
    setEditDietaryTags(['Halaal']);
    setEditIsAvailable(true);
  };

  // Open Full Item Edit Modal
  const handleOpenEdit = (item: MenuItem) => {
    setIsCreatingDish(false);
    setEditingItem(item);
    setEditName(item.name);
    setEditPrice(item.price.toFixed(2));
    setEditLargePrice(item.prices?.large ? item.prices.large.toFixed(2) : '');
    setEditDescription(item.description || '');
    setEditIngredients(item.ingredients || '');
    setEditCategoryId(item.categoryId || standardCategories[0]?.id || 'cat_salad_bar');
    setEditDietaryTags(item.dietaryTags || []);
    setEditIsAvailable(item.isAvailable !== false);
  };

  const handleToggleDietaryTag = (tag: string) => {
    setEditDietaryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Save Full Item Edit or Create Dish in Supabase
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (!editName.trim()) {
      Alert.alert('Invalid Name', 'Item name cannot be empty.');
      return;
    }
    const parsedPrice = parseFloat(editPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid base price in Rand.');
      return;
    }
    const parsedLargePrice = editLargePrice.trim() ? parseFloat(editLargePrice) : undefined;
    const matchedCategory = categories.find((c) => c.id === editCategoryId);

    if (isCreatingDish) {
      const newDishPayload: Omit<MenuItem, 'id'> = {
        name: editName.trim(),
        price: parsedPrice,
        prices: {
          standard: parsedPrice,
          large: parsedLargePrice,
        },
        description: editDescription.trim(),
        ingredients: editIngredients.trim(),
        categoryId: editCategoryId,
        categoryName: matchedCategory?.name || 'Standard Classics',
        menuType: 'standard',
        dietaryTags: editDietaryTags as any,
        isAvailable: editIsAvailable,
      };
      setEditingItem(null);
      setIsCreatingDish(false);
      const created = await saveOrWarn(() => addMenuItem(newDishPayload));
      if (!created) return;
      setLocalItems((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
      Alert.alert('Dish Created ✓', `"${created.name}" has been saved to the live database.`);
      return;
    }

    const updates: Partial<MenuItem> = {
      name: editName.trim(),
      price: parsedPrice,
      prices: {
        standard: parsedPrice,
        large: parsedLargePrice,
      },
      description: editDescription.trim(),
      ingredients: editIngredients.trim(),
      categoryId: editCategoryId,
      categoryName: matchedCategory?.name || editingItem.categoryName,
      dietaryTags: editDietaryTags as any,
      isAvailable: editIsAvailable,
    };

    setLocalItems((prev) =>
      prev.map((i) => (i.id === editingItem.id ? { ...i, ...updates } : i))
    );

    const targetId = editingItem.id;
    setEditingItem(null);
    if (!(await saveOrWarn(async () => (await updateMenuItem(targetId, updates), true)))) {
      setLocalItems(menuItems);
      return;
    }
    Alert.alert('Menu Item Updated ✓', `"${editName.trim()}" has been updated in the live database.`);
  };

  // Archive / Soft-Delete Menu Item
  const handleArchiveItem = (item: MenuItem) => {
    Alert.alert(
      'Mark Dish Sold Out / Inactive?',
      `This will mark "${item.name}" as unavailable in the live customer menu catalog.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setEditingItem(null);
            if (!(await saveOrWarn(async () => (await archiveMenuItem(item.id), true)))) return;
            Alert.alert('Dish Updated ✓', `"${item.name}" is now marked Sold Out.`);
          },
        },
      ]
    );
  };

  // Open Category Create / Edit Modal
  const handleOpenCatModal = (cat?: MenuCategory) => {
    if (cat) {
      setEditingCat(cat);
      setCatNameInput(cat.name);
      setCatHeroUrlInput(cat.heroImage || '');
    } else {
      setEditingCat(null);
      setCatNameInput('');
      setCatHeroUrlInput('');
    }
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!catNameInput.trim()) {
      Alert.alert('Invalid Category', 'Category name is required.');
      return;
    }
    setIsCatModalOpen(false);
    if (editingCat) {
      const saved = await saveOrWarn(async () => {
        await updateCategory(editingCat.id, {
          name: catNameInput.trim(),
          heroImage: catHeroUrlInput.trim() || editingCat.heroImage,
        });
        return true;
      });
      if (!saved) return;
      Alert.alert('Category Updated ✓', `"${catNameInput.trim()}" has been updated in the database.`);
    } else {
      const slug = catNameInput.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const created = await saveOrWarn(() =>
        addCategory({
          name: catNameInput.trim(),
          slug,
          heroImage: catHeroUrlInput.trim() || getCategoryHeroImage(undefined, catNameInput.trim()),
          menuType: 'standard',
          displayOrder: categories.length + 1,
          isActive: true,
        })
      );
      if (!created) return;
      Alert.alert('Category Added ✓', `"${catNameInput.trim()}" has been added to the database.`);
    }
  };

  // Open Cycle Day Edit
  const handleOpenEditCycleDay = (weekNum: number, dayPlan: CycleDayPlan) => {
    setEditingCycleDay({ week: weekNum, day: dayPlan });
    setEditMainMeal(dayPlan.main_meal);
    setEditVegMeal(dayPlan.vegetarian_meal);
    setEditHealthyMeal(dayPlan.healthy_meal);
    setEditCurry(dayPlan.curry_of_the_day);
    setEditSandwich(dayPlan.gourmet_sandwich);
  };

  // Save Cycle Day Edit (persisted to Supabase cycle_day_plans)
  const handleSaveCycleDay = async () => {
    if (!editingCycleDay) return;
    const dayUpdates: Partial<CycleDayPlan> = {
      main_meal: editMainMeal.trim(),
      vegetarian_meal: editVegMeal.trim(),
      healthy_meal: editHealthyMeal.trim(),
      curry_of_the_day: editCurry.trim(),
      gourmet_sandwich: editSandwich.trim(),
    };
    const { week, day } = editingCycleDay;
    setEditingCycleDay(null);
    if (!(await saveOrWarn(async () => (await updateCycleDayPlan(week, day.day, dayUpdates), true)))) return;
    Alert.alert('Cycle Menu Updated ✓', `${day.day} (Week ${week}) meals saved to live database.`);
  };

  // Set Browsed Week as Active Live Week in Supabase
  const handleActivateWeekNow = async (weekNum: number) => {
    if (!(await saveOrWarn(async () => (await setActiveCycleWeek(weekNum), true)))) return;
    Alert.alert(
      'Active Rotation Week Updated ✓',
      `Week ${weekNum} is now LIVE as the active Chef's Choice rotation week across all client devices.`
    );
  };

  // Open Edit Week Title & Description Modal
  const handleOpenEditWeekMeta = () => {
    const currentWeekCfg = availableWeeks.find((w) => w.weekNumber === browsingWeekNumber);
    setEditWeekTitle(currentWeekCfg?.title || `Week ${browsingWeekNumber} Chef Rotation`);
    setEditWeekDescription(currentWeekCfg?.description || 'Chef curated cycle menu');
    setIsEditingWeekMeta(true);
  };

  const handleSaveWeekMeta = async () => {
    if (!editWeekTitle.trim()) {
      Alert.alert('Invalid Title', 'Please enter a title for this rotation week.');
      return;
    }
    setIsEditingWeekMeta(false);
    const weekSaved = await saveOrWarn(async () => {
      await updateCycleRotation(browsingWeekNumber, {
        title: editWeekTitle.trim(),
        description: editWeekDescription.trim(),
      });
      return true;
    });
    if (!weekSaved) return;
    Alert.alert('Rotation Week Updated ✓', `Week ${browsingWeekNumber} title & description saved to database.`);
  };

  // Toggle availability
  const handleToggleAvailability = async (item: MenuItem) => {
    const nextAvailable = !item.isAvailable;
    setLocalItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isAvailable: nextAvailable } : i))
    );
    if (!(await saveOrWarn(async () => (await updateMenuItem(item.id, { isAvailable: nextAvailable }), true)))) {
      setLocalItems(menuItems);
    }
  };

  // Schedule Cycle Week (+2 Weeks in Advance)
  const handleScheduleAdvanceWeek = (weekNum: number) => {
    Alert.alert(
      'Not Available Yet',
      `Scheduling is not active yet. To start Week ${weekNum}, open it and use the option to make it the active week when it should begin.`
    );
  };

  // Currently browsed cycle week plan & metadata
  const browsedCyclePlan = useMemo(() => {
    return (
      effectiveCyclePlans.find((p: CycleWeekPlan) => p.week === browsingWeekNumber) ||
      effectiveCyclePlans[0] ||
      EIGHT_WEEK_CYCLE_DATA[0]
    );
  }, [effectiveCyclePlans, browsingWeekNumber]);

  const browsedWeekConfig = useMemo(() => {
    return availableWeeks.find((w) => w.weekNumber === browsingWeekNumber) || availableWeeks[browsingWeekNumber - 1];
  }, [availableWeeks, browsingWeekNumber]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 1. Top Sub-Tab Switcher */}
      <View style={styles.topSwitcher}>
        <View style={[styles.segmentTrack, { backgroundColor: theme.chipBg }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveSubTab('static')}
            style={[
              styles.segmentBtn,
              activeSubTab === 'static' && [styles.segmentBtnActive, { backgroundColor: theme.primary }],
            ]}
          >
            <Ionicons
              name="restaurant-outline"
              size={14}
              color={activeSubTab === 'static' ? theme.textInverse : theme.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                { color: activeSubTab === 'static' ? theme.textInverse : theme.textSecondary },
              ]}
            >
              Menu Catalog ({filteredItems.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveSubTab('cycle')}
            style={[
              styles.segmentBtn,
              activeSubTab === 'cycle' && [styles.segmentBtnActive, { backgroundColor: theme.primary }],
            ]}
          >
            <Ionicons
              name="repeat-outline"
              size={14}
              color={activeSubTab === 'cycle' ? theme.textInverse : theme.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                { color: activeSubTab === 'cycle' ? theme.textInverse : theme.textSecondary },
              ]}
            >
              8-Week Cycle (Live DB)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Sub-Tab 1: Static Menu Catalog */}
      {activeSubTab === 'static' ? (
        <View style={{ flex: 1 }}>
          {/* Search Input + Add Dish / Add Category Actions */}
          <View style={[styles.searchWrapper, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
            <View style={[styles.searchBar, { flex: 1, backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <Ionicons name="search" size={16} color={theme.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search live menu catalog..."
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.textPrimary }]}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleOpenCreateDish}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                height: 38,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: theme.primary,
              }}
            >
              <Ionicons name="add-circle-outline" size={16} color={theme.textInverse} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.textInverse }}>Add Dish</Text>
            </TouchableOpacity>
          </View>

          {/* Category Filter Pills + Add/Edit Category */}
          <View style={styles.categoriesRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setSelectedCategory('all')}
                style={[
                  styles.categoryPill,
                  selectedCategory === 'all'
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: selectedCategory === 'all' ? theme.textInverse : theme.textPrimary }}>
                  All Categories
                </Text>
              </TouchableOpacity>
              {standardCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  onLongPress={() => handleOpenCatModal(cat)}
                  style={[
                    styles.categoryPill,
                    selectedCategory === cat.id
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: selectedCategory === cat.id ? theme.textInverse : theme.textPrimary }}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {selectedCategory !== 'all' && (
                <TouchableOpacity
                  onPress={() => {
                    const activeCat = standardCategories.find((c) => c.id === selectedCategory);
                    if (activeCat) handleOpenCatModal(activeCat);
                  }}
                  style={[styles.categoryPill, { backgroundColor: theme.primaryMuted, borderColor: theme.primary, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                >
                  <Ionicons name="pencil" size={11} color={theme.primary} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>Edit Category</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleOpenCatModal()}
                style={[styles.categoryPill, { backgroundColor: theme.surface, borderColor: theme.brandGold, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
              >
                <Ionicons name="add" size={12} color={theme.brandGold} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.brandGold }}>New Category</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Static Dishes List */}
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const isAvailable = item.isAvailable !== false;
              const matchedCat = categories.find((c) => c.id === item.categoryId);
              const thumbUrl =
                matchedCat?.heroImage ||
                getCategoryHeroImage(item.categoryId, item.categoryName || matchedCat?.name, item.name);
              return (
                <View style={[styles.dishCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                  <Image
                    source={{ uri: thumbUrl }}
                    style={styles.dishThumbnail}
                  />
                  <View style={styles.dishInfo}>
                    <View style={styles.dishTopRow}>
                      <Text style={[styles.dishName, { color: theme.textPrimary }]}>{item.name}</Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleToggleAvailability(item)}
                        style={[
                          styles.availChip,
                          { backgroundColor: isAvailable ? 'rgba(67, 160, 71, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
                        ]}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: isAvailable ? '#43A047' : '#EF4444' }}>
                          {isAvailable ? 'In Stock' : 'Sold Out'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.dishCategoryTag, { color: theme.brandGold }]}>
                      {item.categoryName || matchedCat?.name || 'Standard Menu'}
                    </Text>

                    <Text style={[styles.dishDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                      {item.description}
                    </Text>

                    <View style={styles.dishBottomRow}>
                      <Text style={[styles.dishPrice, { color: theme.primary }]}>
                        R {item.price.toFixed(2)}
                        {item.prices?.large ? ` / R ${item.prices.large.toFixed(2)} (L)` : ''}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleOpenEdit(item)}
                        style={[styles.editBtn, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}
                      >
                        <Ionicons name="pencil" size={12} color={theme.primary} />
                        <Text style={[styles.editBtnText, { color: theme.primary }]}>Edit Item</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </View>
      ) : (
        /* 3. Sub-Tab 2: 8-Week Cycling Menu (Live Database Sync) */
        <ScrollView contentContainerStyle={styles.cycleContainer}>
          {/* Live Database Sync Banner */}
          <View style={[styles.cycleNoticeBanner, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="sync-circle" size={20} color={theme.brandGold} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.cycleNoticeTitle, { color: theme.textPrimary }]}>
                Live 8-Week Chef&apos;s Choice Rotation (Supabase Synced)
              </Text>
              <Text style={[styles.cycleNoticeDesc, { color: theme.textSecondary }]}>
                Week {activeCycleWeekNumber} is currently set as the Live Active Week for this week&apos;s ordering window (and Week {((activeCycleWeekNumber % 8) + 1)} applies to next week&apos;s advance pre-orders).
              </Text>
            </View>
          </View>

          {/* Active vs Advance Sequence Timeline */}
          <View style={[styles.timelineCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.timelineHeading, { color: theme.textPrimary }]}>
              Active Rotation &amp; 2-Week Window Progression
            </Text>

            <View style={styles.timelineFlow}>
              <View style={[styles.timelineStep, { backgroundColor: theme.primary }]}>
                <Text style={[styles.timelineStepText, { color: theme.onPrimary }]}>Week {activeCycleWeekNumber}</Text>
                <Text style={[styles.timelineStepSub, { color: theme.onPrimary }]}>Active Week (Now)</Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color={theme.textMuted} />
              <View style={[styles.timelineStep, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder, borderWidth: 1 }]}>
                <Text style={[styles.timelineStepText, { color: theme.textPrimary }]}>
                  Week {((activeCycleWeekNumber % 8) + 1)}
                </Text>
                <Text style={[styles.timelineStepSub, { color: theme.textSecondary }]}>Next Week (+1)</Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color={theme.textMuted} />
              <View style={[styles.timelineStep, { backgroundColor: theme.brandGold }]}>
                <Text style={[styles.timelineStepText, { color: theme.onBrandGold }]}>
                  Week {scheduledAdvanceWeek || (((activeCycleWeekNumber + 1) % 8) + 1)}
                </Text>
                <Text style={[styles.timelineStepSub, { color: theme.onBrandGold }]}>In 2 Weeks</Text>
              </View>
            </View>

            <Text style={[styles.timelineRuleText, { color: theme.textMuted }]}>
              {scheduledAdvanceWeek
                ? `Progression Rule: Week ${activeCycleWeekNumber} → Week ${((activeCycleWeekNumber % 8) + 1)} → Week ${scheduledAdvanceWeek} → Week ${((scheduledAdvanceWeek % 8) + 1)} → Week 8 → Week 1`
                : 'Default Progression: Cycles sequentially from Week 1 through Week 8 in a rolling loop.'}
            </Text>
          </View>

          {/* Week Selector Pills (Week 1 through Week 8) */}
          <View style={styles.weekPickerRow}>
            <Text style={[styles.weekPickerLabel, { color: theme.brandGold }]}>Browse &amp; Configure Cycle Week:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {availableWeeks.map((w) => {
                const isSelected = browsingWeekNumber === w.weekNumber;
                const isCurrent = activeCycleWeekNumber === w.weekNumber;
                return (
                  <TouchableOpacity
                    key={w.weekNumber}
                    onPress={() => setBrowsingWeekNumber(w.weekNumber)}
                    style={[
                      styles.weekSelectPill,
                      isSelected
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: isSelected ? theme.textInverse : theme.textPrimary }}>
                      Week {w.weekNumber}
                    </Text>
                    {isCurrent && (
                      <View style={styles.currentDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Browsed Week Action Card */}
          <View style={[styles.weekActionCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={[styles.weekActionTitle, { color: theme.textPrimary }]}>
                    Week {browsingWeekNumber}: {browsedWeekConfig?.title || `Rotation Week ${browsingWeekNumber}`}
                  </Text>
                  {activeCycleWeekNumber === browsingWeekNumber && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(67, 160, 71, 0.15)' }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#43A047' }}>LIVE NOW</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.weekActionDesc, { color: theme.textSecondary }]}>
                  {browsedWeekConfig?.description || 'Chef curated daily rotation menu'}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleOpenEditWeekMeta}
                style={[styles.editDayBtn, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}
              >
                <Ionicons name="pencil" size={11} color={theme.primary} />
                <Text style={[styles.editDayBtnText, { color: theme.primary }]}>Edit Title</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, marginTop: 4 }}>
              {activeCycleWeekNumber !== browsingWeekNumber && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleActivateWeekNow(browsingWeekNumber)}
                  style={[styles.scheduleBtn, { backgroundColor: theme.primary }]}
                >
                  <Ionicons name="flash" size={15} color={theme.textInverse} />
                  <Text style={[styles.scheduleBtnText, { color: theme.textInverse }]}>
                    Set Week {browsingWeekNumber} as Live Active Week Now
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleScheduleAdvanceWeek(browsingWeekNumber)}
                style={[styles.scheduleBtn, { backgroundColor: theme.brandGold }]}
              >
                <Ionicons name="calendar-outline" size={15} color={theme.onBrandGold} />
                <Text style={[styles.scheduleBtnText, { color: theme.onBrandGold }]}>
                  Schedule Week {browsingWeekNumber} to Take Effect in 2 Weeks
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Rotating Dishes for Monday - Friday */}
          <View style={styles.daysList}>
            {browsedCyclePlan.days.map((d: CycleDayPlan) => (
              <View key={d.day} style={[styles.dayCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayName, { color: theme.brandGold }]}>{d.day}</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleOpenEditCycleDay(browsedCyclePlan.week, d)}
                    style={[styles.editDayBtn, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}
                  >
                    <Ionicons name="pencil" size={11} color={theme.primary} />
                    <Text style={[styles.editDayBtnText, { color: theme.primary }]}>Edit Day</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dishSlot}>
                  <Text style={[styles.slotLabel, { color: theme.textSecondary }]}>Main Meal:</Text>
                  <Text style={[styles.slotName, { color: theme.textPrimary }]}>{d.main_meal}</Text>
                </View>

                <View style={styles.dishSlot}>
                  <Text style={[styles.slotLabel, { color: theme.textSecondary }]}>Vegetarian:</Text>
                  <Text style={[styles.slotName, { color: theme.textPrimary }]}>{d.vegetarian_meal}</Text>
                </View>

                <View style={styles.dishSlot}>
                  <Text style={[styles.slotLabel, { color: theme.textSecondary }]}>Healthy Meal:</Text>
                  <Text style={[styles.slotName, { color: theme.textPrimary }]}>{d.healthy_meal}</Text>
                </View>

                <View style={styles.dishSlot}>
                  <Text style={[styles.slotLabel, { color: theme.textSecondary }]}>Curry of the Day:</Text>
                  <Text style={[styles.slotName, { color: theme.textPrimary }]}>{d.curry_of_the_day}</Text>
                </View>

                <View style={styles.dishSlot}>
                  <Text style={[styles.slotLabel, { color: theme.textSecondary }]}>Gourmet Sandwich:</Text>
                  <Text style={[styles.slotName, { color: theme.textPrimary }]}>{d.gourmet_sandwich}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ═══════════════════════════════════════════════
          MODAL 1: FULL MENU ITEM EDITOR (CREATE OR EDIT)
         ═══════════════════════════════════════════════ */}
      <Modal visible={!!editingItem} transparent animationType="fade" onRequestClose={() => setEditingItem(null)}>
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                  {isCreatingDish ? 'Add New Dish to Catalog' : 'Edit Menu Item'}
                </Text>
                <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                  Changes sync directly with the live Supabase menu catalog
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.modalCloseIcon}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 10 }}>
              {/* Dish Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Dish Name:</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. Grilled Halloumi & Avocado Wrap"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              {/* Category Picker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Category:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {standardCategories.map((cat) => {
                    const isSel = editCategoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setEditCategoryId(cat.id)}
                        style={[
                          styles.editCatChip,
                          isSel
                            ? { backgroundColor: theme.primary, borderColor: theme.primary }
                            : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                        ]}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: isSel ? theme.textInverse : theme.textPrimary }}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Pricing Row: Base Standard & Large */}
              <View style={styles.priceRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Base Price (ZAR):</Text>
                  <TextInput
                    value={editPrice}
                    onChangeText={setEditPrice}
                    keyboardType="decimal-pad"
                    placeholder="85.00"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Large Price (Optional):</Text>
                  <TextInput
                    value={editLargePrice}
                    onChangeText={setEditLargePrice}
                    keyboardType="decimal-pad"
                    placeholder="105.00"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                  />
                </View>
              </View>

              {/* Availability Switch */}
              <View style={[styles.toggleCardRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleCardTitle, { color: theme.textPrimary }]}>In Stock &amp; Available</Text>
                  <Text style={[styles.toggleCardSub, { color: theme.textSecondary }]}>
                    Disabling marks this dish as &apos;Sold Out&apos; in customer view
                  </Text>
                </View>
                <Switch
                  value={editIsAvailable}
                  onValueChange={setEditIsAvailable}
                  trackColor={{ false: 'rgba(150, 150, 150, 0.3)', true: theme.primary }}
                  {...(Platform.OS === 'web' ? ({ activeThumbColor: theme.onPrimary } as object) : {})}
                />
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Dish Description:</Text>
                <TextInput
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  numberOfLines={2}
                  style={[styles.multilineField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              {/* Ingredients */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Ingredients:</Text>
                <TextInput
                  value={editIngredients}
                  onChangeText={setEditIngredients}
                  multiline
                  numberOfLines={2}
                  style={[styles.multilineField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              {/* Dietary Tags */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Dietary Tags:</Text>
                <View style={styles.tagChipsRow}>
                  {DIETARY_OPTIONS.map((tag) => {
                    const isChecked = editDietaryTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => handleToggleDietaryTag(tag)}
                        style={[
                          styles.dietTagChip,
                          isChecked
                            ? { backgroundColor: theme.primary, borderColor: theme.primary }
                            : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                        ]}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: isChecked ? theme.textInverse : theme.textPrimary }}>
                          {isChecked ? '✓ ' : ''}{tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {!isCreatingDish && editingItem && (
                <TouchableOpacity
                  onPress={() => handleArchiveItem(editingItem)}
                  style={{
                    marginTop: 4,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>
                    Mark Sold Out / Archive Item
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setEditingItem(null)} style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}>
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveEdit} style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}>
                <Text style={{ color: theme.textInverse, fontWeight: '800' }}>
                  {isCreatingDish ? 'Add Dish' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          MODAL 2: CYCLE DAY MENU EDITOR
         ═══════════════════════════════════════════════ */}
      <Modal visible={!!editingCycleDay} transparent animationType="fade" onRequestClose={() => setEditingCycleDay(null)}>
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                  Edit Cycle Day: {editingCycleDay?.day.day} (Week {editingCycleDay?.week})
                </Text>
                <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                  Update the 5 rotating meal items prepared for this weekday in Supabase
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditingCycleDay(null)} style={styles.modalCloseIcon}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 10 }}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>1. Main Meal of the Day:</Text>
                <TextInput
                  value={editMainMeal}
                  onChangeText={setEditMainMeal}
                  multiline
                  style={[styles.multilineField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>2. Vegetarian Meal of the Day:</Text>
                <TextInput
                  value={editVegMeal}
                  onChangeText={setEditVegMeal}
                  multiline
                  style={[styles.multilineField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>3. Healthy Meal:</Text>
                <TextInput
                  value={editHealthyMeal}
                  onChangeText={setEditHealthyMeal}
                  multiline
                  style={[styles.multilineField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>4. Curry of the Day:</Text>
                <TextInput
                  value={editCurry}
                  onChangeText={setEditCurry}
                  multiline
                  style={[styles.multilineField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>5. Gourmet Sandwich:</Text>
                <TextInput
                  value={editSandwich}
                  onChangeText={setEditSandwich}
                  multiline
                  style={[styles.multilineField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setEditingCycleDay(null)} style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}>
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveCycleDay} style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}>
                <Text style={{ color: theme.textInverse, fontWeight: '800' }}>Save Cycle Meals</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          MODAL 3: CATEGORY CREATE / EDIT MODAL
         ═══════════════════════════════════════════════ */}
      <Modal visible={isCatModalOpen} transparent animationType="fade" onRequestClose={() => setIsCatModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                  {editingCat ? `Edit Category: ${editingCat.name}` : 'Create New Category'}
                </Text>
                <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                  Stored in live Supabase menu_categories table
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsCatModalOpen(false)} style={styles.modalCloseIcon}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, paddingBottom: 10 }}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Category Name:</Text>
                <TextInput
                  value={catNameInput}
                  onChangeText={setCatNameInput}
                  placeholder="e.g. Ciao Italy"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Hero Image URL (Optional):</Text>
                <TextInput
                  value={catHeroUrlInput}
                  onChangeText={setCatHeroUrlInput}
                  placeholder="https://images.unsplash.com/..."
                  placeholderTextColor={theme.textMuted}
                  style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setIsCatModalOpen(false)} style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}>
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveCategory} style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}>
                <Text style={{ color: theme.textInverse, fontWeight: '800' }}>Save Category</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          MODAL 4: EDIT ROTATION WEEK TITLE & DESCRIPTION
         ═══════════════════════════════════════════════ */}
      <Modal visible={isEditingWeekMeta} transparent animationType="fade" onRequestClose={() => setIsEditingWeekMeta(false)}>
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                  Edit Week {browsingWeekNumber} Rotation Info
                </Text>
                <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                  Updates the Chef&apos;s Choice rotation banner shown to customers
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditingWeekMeta(false)} style={styles.modalCloseIcon}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, paddingBottom: 10 }}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Rotation Title:</Text>
                <TextInput
                  value={editWeekTitle}
                  onChangeText={setEditWeekTitle}
                  placeholder={`Week ${browsingWeekNumber} Chef Rotation`}
                  placeholderTextColor={theme.textMuted}
                  style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Theme / Description:</Text>
                <TextInput
                  value={editWeekDescription}
                  onChangeText={setEditWeekDescription}
                  multiline
                  style={[styles.multilineField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setIsEditingWeekMeta(false)} style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}>
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveWeekMeta} style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}>
                <Text style={{ color: theme.textInverse, fontWeight: '800' }}>Save Week Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSwitcher: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  segmentTrack: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 20,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 17,
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  categoriesRow: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  dishCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  dishThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  dishInfo: {
    flex: 1,
    gap: 3,
  },
  dishTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dishName: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  availChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dishCategoryTag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dishDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  dishBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dishPrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cycleContainer: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  cycleNoticeBanner: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cycleNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  cycleNoticeDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  timelineCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  timelineHeading: {
    fontSize: 13,
    fontWeight: '800',
  },
  timelineFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  timelineStep: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    gap: 2,
  },
  timelineStepText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  timelineStepSub: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  timelineRuleText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  weekPickerRow: {
    gap: 6,
  },
  weekPickerLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  weekSelectPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#43A047',
  },
  weekActionCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  weekActionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  weekActionDesc: {
    fontSize: 12,
  },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 19,
  },
  scheduleBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  daysList: {
    gap: 10,
  },
  dayCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
    paddingBottom: 6,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '800',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dishSlot: {
    gap: 2,
  },
  slotLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  slotName: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  modalCloseIcon: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  editDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  editDayBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  editCatChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleCardTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  toggleCardSub: {
    fontSize: 10,
    marginTop: 1,
  },
  multilineField: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  tagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dietTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputField: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtn: {
    flex: 1.5,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
