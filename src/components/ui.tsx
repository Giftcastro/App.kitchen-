/**
 * MAUI control equivalents, styled from Resources/Styles/Styles.xaml:
 * Button (radius 8, 14x10 padding, 14pt, pressed = scale .96 / opacity .88),
 * Border cards, Entry, Picker, Switch, CheckBox, SearchBar — plus the shared
 * PageAnimation entrance (fade in + rise 18px over 260ms) every page runs
 * when it appears.
 */
import React, { useCallback, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardTypeOptions,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch as RNSwitch,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from './AppText';
import { alerts } from './Alerts';
import { useApp } from '../state/AppState';
import { native } from '../utils/theme';

/** PageAnimation.EntranceAsync — replays every time the page appears. */
export function useEntrance(distance = 18, duration = 260) {
  const [progress] = useState(() => new Animated.Value(0));
  useFocusEffect(
    useCallback(() => {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }, [progress, duration])
  );
  return {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  };
}

/** The page's root: background colour + the entrance animation. */
export function Page({ bg, children, style }: { bg?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useApp();
  const entrance = useEntrance();
  return (
    <View style={[styles.fill, { backgroundColor: bg ?? colors.pageBg }]}>
      <Animated.View style={[styles.fill, entrance, style]}>{children}</Animated.View>
    </View>
  );
}

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'neutral' | 'danger' | 'dangerOutline';

interface BtnProps {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  height?: number;
  radius?: number;
  fontSize?: number;
  bold?: boolean;
  bg?: string;
  color?: string;
  borderColor?: string;
  paddingH?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

/** MAUI Button with Styles.xaml's implicit style. */
export function Btn({
  title,
  onPress,
  variant = 'primary',
  disabled,
  height,
  radius = 8,
  fontSize = 14,
  bold,
  bg,
  color,
  borderColor,
  paddingH = 14,
  style,
  textStyle,
  testID,
}: BtnProps) {
  const { colors } = useApp();
  const palette: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    outline: { bg: 'transparent', fg: colors.text, border: colors.surfaceBorder },
    ghost: { bg: 'transparent', fg: colors.primary },
    neutral: { bg: 'rgba(136,136,136,0.13)', fg: colors.text },
    danger: { bg: '#C62828', fg: '#FFFFFF' },
    dangerOutline: { bg: 'transparent', fg: '#C62828', border: '#C62828' },
  };
  const p = palette[variant];
  const background = disabled ? colors.disabledBg : bg ?? p.bg;
  const foreground = disabled ? colors.disabledText : color ?? p.fg;
  const stroke = borderColor ?? p.border;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: background,
          borderRadius: radius,
          paddingHorizontal: paddingH,
          minHeight: height ?? 44,
          height,
        },
        stroke ? { borderWidth: 1, borderColor: stroke } : null,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[{ color: foreground, fontSize, fontWeight: bold ? '700' : '400', textAlign: 'center' }, textStyle]} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

/** MAUI Border: rounded, optionally stroked, optionally with the soft card shadow. */
export function Card({
  children,
  radius = 16,
  padding = 16,
  bg,
  border,
  shadow,
  style,
  onPress,
}: {
  children: React.ReactNode;
  radius?: number;
  padding?: number | [number, number];
  bg?: string;
  border?: string | null;
  shadow?: 'soft' | 'card' | 'float';
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { colors, isDark } = useApp();
  const pad = Array.isArray(padding) ? { paddingHorizontal: padding[0], paddingVertical: padding[1] } : { padding };
  const shadowStyle =
    shadow === 'float'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 }
      : shadow
        ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: shadow === 'soft' ? 2 : 3 },
            shadowOpacity: isDark ? 0.25 : shadow === 'soft' ? 0.04 : 0.03,
            shadowRadius: shadow === 'soft' ? 4 : 5,
            elevation: 2,
          }
        : null;
  const body = [
    { borderRadius: radius, backgroundColor: bg ?? colors.cardBg },
    pad,
    border ? { borderWidth: 1, borderColor: border } : null,
    shadowStyle,
    style,
  ];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...body, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={body}>{children}</View>;
}

export function Divider({ color, style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useApp();
  return <View style={[{ height: 1, backgroundColor: color ?? colors.cardBorder }, style]} />;
}

/** Login/Register-style entry: 50pt rounded border box. */
export function BoxEntry({
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  testID,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  testID?: string;
}) {
  const { colors, isDark } = useApp();
  return (
    <View style={[styles.boxEntry, { borderColor: colors.inputBorder, backgroundColor: isDark ? colors.cardBg : '#FFFFFF' }]}>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#888888"
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' || secure ? 'none' : 'sentences'}
        autoCorrect={false}
        style={[styles.boxEntryInput, { color: colors.text }]}
      />
    </View>
  );
}

/** A plain MAUI Entry (transparent, underlined) — admin forms. */
export function PlainEntry({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secure,
  multiline,
  height,
  bg,
  style,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  multiline?: boolean;
  height?: number;
  bg?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useApp();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ borderBottomWidth: 1, borderBottomColor: focused ? native.androidPrimary : colors.placeholder, backgroundColor: bg }, style]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          { color: colors.text, fontSize: 14, minHeight: 40, paddingVertical: 8, paddingHorizontal: 4 },
          multiline && { height, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}

/** MAUI Picker: shows the selection (or its Title), opens the option list on tap. */
export function Picker({
  title,
  options,
  selected,
  onSelect,
  width,
  disabled,
  style,
  testID,
}: {
  title: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
  width?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useApp();
  const open = async () => {
    if (disabled || options.length === 0) return;
    const choice = await alerts.actionSheet(title, 'Cancel', ...options);
    if (choice) onSelect(choice);
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={open}
      style={[styles.picker, { borderBottomColor: colors.placeholder, width, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Text style={[styles.pickerText, { color: selected ? colors.text : colors.placeholder }]} numberOfLines={1}>
        {selected ?? title}
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
    </Pressable>
  );
}

export function Switch({ value, onValueChange, onColor }: { value: boolean; onValueChange: (v: boolean) => void; onColor?: string }) {
  const { colors } = useApp();
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: onColor ?? colors.primary, false: '#9E9E9E' }}
      thumbColor="#FFFFFF"
      {...(Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : {})}
    />
  );
}

export function CheckBox({ checked, onToggle, color }: { checked: boolean; onToggle: () => void; color?: string }) {
  const { colors } = useApp();
  const tint = color ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
      onPress={onToggle}
      hitSlop={8}
      style={[styles.checkbox, { borderColor: tint, backgroundColor: checked ? tint : 'transparent' }]}
    >
      {checked && <Ionicons name="checkmark" size={15} color={colors.onPrimary} />}
    </Pressable>
  );
}

/** MAUI SearchBar: search glyph, text, clear button. */
export function SearchBar({
  value,
  onChangeText,
  placeholder,
  style,
  bare,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
  bare?: boolean;
}) {
  const { colors } = useApp();
  return (
    <View style={[styles.search, !bare && { borderBottomWidth: 1, borderBottomColor: colors.placeholder }, style]}>
      <Ionicons name="search" size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        autoCorrect={false}
        style={[styles.searchInput, { color: colors.text }]}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Clear search">
          <Ionicons name="close" size={18} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

/** Watermark empty state (Orders, Admin lists). */
export function EmptyState({ emoji, title, message, badge }: { emoji: string; title?: string; message: string; badge?: boolean }) {
  const { colors } = useApp();
  return (
    <View style={styles.empty}>
      {badge ? (
        <View style={[styles.watermark, { backgroundColor: colors.watermark }]}>
          <Text style={{ fontSize: 36, opacity: 0.8 }}>{emoji}</Text>
        </View>
      ) : (
        <Text style={{ fontSize: 36, opacity: 0.8, textAlign: 'center' }}>{emoji}</Text>
      )}
      {title ? <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text> : null}
      <Text style={[styles.emptyMessage, { color: title ? colors.textSecondary : 'gray' }]}>{message}</Text>
    </View>
  );
}

/** Five ★/☆ — RatingStarConverter. */
export function Stars({
  rating,
  size,
  color,
  onPressStar,
}: {
  rating: number;
  size: number;
  color: string;
  onPressStar?: (position: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: onPressStar ? 4 : 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(position =>
        onPressStar ? (
          <Pressable key={position} onPress={() => onPressStar(position)} hitSlop={4} accessibilityLabel={`Rate ${position} star${position === 1 ? '' : 's'}`}>
            <Text style={{ fontSize: size, color }}>{rating >= position ? '★' : '☆'}</Text>
          </Pressable>
        ) : (
          <Text key={position} style={{ fontSize: size, color }}>
            {rating >= position ? '★' : '☆'}
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  btn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  boxEntry: { height: 50, borderWidth: 1, borderRadius: 12, justifyContent: 'center' },
  boxEntryInput: { marginHorizontal: 15, fontSize: 14, height: 48 },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, minHeight: 40, paddingHorizontal: 4 },
  pickerText: { flex: 1, fontSize: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 },
  watermark: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyMessage: { fontSize: 13, textAlign: 'center', maxWidth: 280 },
});
