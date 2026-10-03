/** ProductDetailPage.xaml + ProductDetailViewModel. */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Text, TextInput } from '../components/AppText';
import { alerts } from '../components/Alerts';
import { Btn, CheckBox, Page } from '../components/ui';
import { useApp } from '../state/AppState';
import { getNavParam } from '../state/navParams';
import {
  CYCLE_WINDOW,
  fmtDayLabel,
  fmtWeekday,
  getOrderableDeliveryDates,
  isValidDeliveryDate,
  STATIC_WINDOW,
} from '../services/scheduling';
import { fixed } from '../utils/theme';
import type { Option, Product } from '../models';

export default function ProductDetailScreen() {
  const { colors, isDark, selectedOrderingDate, hasSeenCutoffNotice, markCutoffNoticeSeen, addCartItem } = useApp();
  const router = useRouter();
  const navigation = useNavigation();
  const [product] = useState<Product | undefined>(() => getNavParam('SelectedProduct'));
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [specialRequests, setSpecialRequests] = useState('');
  const [allergyNotes, setAllergyNotes] = useState('');
  const [requestsFocused, setRequestsFocused] = useState(false);
  const [allergyFocused, setAllergyFocused] = useState(false);
  const window = product?.menuType === 'cycle' ? CYCLE_WINDOW : STATIC_WINDOW;

  const loadDates = useCallback((): string[] => {
    if (!product) return [];
    return product.lockedDeliveryDate ? [product.lockedDeliveryDate] : getOrderableDeliveryDates(window);
  }, [product, window]);

  const [dates, setDates] = useState<string[]>(loadDates);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const initial = loadDates();
    if (product?.lockedDeliveryDate) return product.lockedDeliveryDate;
    return initial.find(d => d === selectedOrderingDate) ?? initial[0] ?? null;
  });

  useLayoutEffect(() => {
    navigation.setOptions({ title: product?.name ?? '' });
  }, [navigation, product]);

  useEffect(() => {
    if (!product) router.back();
  }, [product, router]);

  // One-time-per-session 9 AM cutoff reminder, shown the first time a dish is opened.
  useFocusEffect(
    useCallback(() => {
      if (!hasSeenCutoffNotice) {
        markCutoffNoticeSeen();
        alerts.show(
          'Order cutoff: 9:00 AM',
          'Orders must be placed by 9:00 AM to make the earliest available delivery slot. Anything placed after 9:00 AM rolls over to the next cutoff window.',
          'Got it'
        );
      }
    }, [hasSeenCutoffNotice, markCutoffNoticeSeen])
  );

  const optionKey = (groupTitle: string, option: Option) => `${groupTitle}::${option.name}`;

  const toggleOption = (groupTitle: string, option: Option, isMultiSelect: boolean) => {
    const key = optionKey(groupTitle, option);
    setSelected(prev => {
      const next = { ...prev };
      if (!isMultiSelect) {
        // Radio group: picking one clears the others in the same group.
        product?.customizationGroups
          .find(g => g.title === groupTitle)
          ?.options.forEach(o => delete next[optionKey(groupTitle, o)]);
        next[key] = true;
      } else {
        next[key] = !prev[key];
      }
      return next;
    });
  };

  const selectedOptions = useMemo(
    () => (product?.customizationGroups ?? []).flatMap(g => g.options.filter(o => selected[optionKey(g.title, o)])),
    [product, selected]
  );
  const totalPrice = (product?.basePrice ?? 0) + selectedOptions.reduce((sum, o) => sum + o.additionalPrice, 0);

  if (!product) return null;

  const addToCart = async () => {
    if (!selectedDate) {
      await alerts.show('Pick a delivery day', "Please choose which day you'd like this delivered.", 'OK');
      return;
    }
    // Re-check in case the page sat open across a cutoff.
    if (!isValidDeliveryDate(selectedDate, window)) {
      await alerts.show('Date no longer available', 'That delivery date has passed the order cutoff. Please pick a new date.', 'OK');
      const fresh = loadDates();
      setDates(fresh);
      setSelectedDate(fresh.find(d => d === selectedOrderingDate) ?? fresh[0] ?? null);
      return;
    }
    addCartItem({
      key: `${product.id}:${Date.now()}`,
      product,
      selectedOptions: selectedOptions.map(o => ({ ...o })),
      specialRequests,
      allergyNotes,
      deliveryDate: selectedDate,
      menuType: product.menuType,
      quantity: 1,
      unitPrice: totalPrice,
    });
    const changeDay = await alerts.confirm(
      'Added to Basket',
      `${product.name} has been added for ${fmtDayLabel(selectedDate)}.`,
      'Order for a different day',
      `Continue with ${fmtWeekday(selectedDate)}`
    );
    if (changeDay) {
      router.push('/select-date');
      return;
    }
    router.back();
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.stack10}>
          <View style={[styles.photo, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
            <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{product.name}</Text>
          <Text style={[styles.price, { color: colors.primary }]}>R{totalPrice.toFixed(2)}</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>

        <View style={styles.line} />

        <View style={styles.stack10}>
          <Text style={[styles.heading, { color: colors.text }]}>Choose a delivery day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
            {dates.map(date => {
              const isSel = date === selectedDate;
              return (
                <Pressable
                  key={date}
                  onPress={() => setSelectedDate(date)}
                  accessibilityRole="radio"
                  aria-checked={isSel}
                  style={[styles.dateOption, { borderColor: colors.primary, backgroundColor: isSel ? colors.primary : 'transparent' }]}
                >
                  <Text style={[styles.dateText, { color: isSel ? colors.onPrimary : colors.text }]} numberOfLines={1}>
                    {fmtDayLabel(date)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.line} />

        {product.customizationGroups.length > 0 && (
          <View style={styles.groups}>
            {product.customizationGroups.map(group => (
              <View key={group.title} style={styles.stack10}>
                <Text style={[styles.heading, { color: colors.text }]}>{group.title}</Text>
                {group.options.map(option => {
                  const checked = !!selected[optionKey(group.title, option)];
                  const label = option.additionalPrice > 0 ? `${option.name} (+R${option.additionalPrice.toFixed(2)})` : option.name;
                  return group.isMultiSelect ? (
                    <Pressable key={option.name} style={styles.optionRow} onPress={() => toggleOption(group.title, option, true)}>
                      <CheckBox checked={checked} onToggle={() => toggleOption(group.title, option, true)} />
                      <Text style={[styles.optionText, { color: checked ? colors.primary : colors.text }]}>{label}</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      key={option.name}
                      style={styles.optionRow}
                      onPress={() => toggleOption(group.title, option, false)}
                      accessibilityRole="radio"
                      aria-checked={checked}
                    >
                      <View style={[styles.radio, { borderColor: colors.primary }]}>
                        {checked && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                      </View>
                      <Text style={[styles.optionText, { color: checked ? colors.primary : colors.text }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {product.customizationGroups.length > 0 && <View style={styles.line} />}

        <View style={styles.stack5}>
          <Text style={[styles.heading, { color: colors.text }]}>Special Requests</Text>
          <TextInput
            value={specialRequests}
            onChangeText={setSpecialRequests}
            placeholder="e.g., No onions, sauce on the side..."
            placeholderTextColor={colors.placeholder}
            multiline
            onFocus={() => setRequestsFocused(true)}
            onBlur={() => setRequestsFocused(false)}
            style={[styles.editor, { height: 70, color: colors.text, backgroundColor: requestsFocused ? colors.tan : colors.editorBg }]}
          />
        </View>

        <View style={styles.stack5}>
          <View style={styles.allergyHeader}>
            <Text style={{ fontSize: 14 }}>⚠️</Text>
            <Text style={[styles.heading, { color: fixed.amber }]}>Allergy Notes (Chef Alert)</Text>
          </View>
          <TextInput
            value={allergyNotes}
            onChangeText={setAllergyNotes}
            placeholder="e.g., Severe peanut allergy — chef alert only"
            placeholderTextColor={colors.placeholder}
            multiline
            onFocus={() => setAllergyFocused(true)}
            onBlur={() => setAllergyFocused(false)}
            style={[styles.editor, { height: 60, color: colors.text, backgroundColor: allergyFocused ? fixed.amberBgStrong : fixed.amberBg }]}
          />
        </View>

        <Btn testID="add-to-basket" title="Add to Basket" onPress={addToCart} height={50} radius={10} style={styles.addButton} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 20 },
  stack10: { gap: 10 },
  stack5: { gap: 5 },
  groups: { gap: 25 },
  photo: { height: 180, borderRadius: 12, overflow: 'hidden' },
  name: { fontSize: 24, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '700' },
  description: { fontSize: 14, color: 'gray' },
  line: { height: 1, backgroundColor: 'lightgray' },
  heading: { fontSize: 16, fontWeight: '700' },
  dateRow: { gap: 10 },
  // The horizontal CollectionView is 88pt tall and stretches each item to it; content sits at the top.
  dateOption: { width: 130, height: 88, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dateText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  optionText: { fontSize: 14 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  editor: { fontSize: 14, padding: 8, textAlignVertical: 'top', borderRadius: 4 },
  allergyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addButton: { marginTop: 20 },
});
