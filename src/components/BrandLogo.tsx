/**
 * The brand-guideline wordmark: "your kitchen" in Playfair Display with a
 * bold "co.", and a fine rule underneath spanning the wordmark's width.
 * Set as live text (not an image) so it stays crisp at every size.
 *
 * Sizes follow the guideline's minimums: full lockup 38px+, standard 22px,
 * never below 14px on screen.
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useApp } from '../state/AppState';

const MIN_DIGITAL = 14;

export function BrandLogo({
  size = 22,
  color,
  align = 'center',
  style,
}: {
  /** Font size in px (clamped to the 14px digital minimum). */
  size?: number;
  /** Ink colour; defaults to the page's primary text colour. */
  color?: string;
  align?: 'center' | 'left';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useApp();
  const ink = color ?? colors.text;
  const fontSize = Math.max(size, MIN_DIGITAL);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Your Kitchen Co."
      style={[styles.lockup, { alignSelf: align === 'center' ? 'center' : 'flex-start' }, style]}
    >
      <Text style={[styles.regular, { color: ink, fontSize, lineHeight: Math.round(fontSize * 1.25) }]} numberOfLines={1}>
        your kitchen <Text style={styles.bold}>co.</Text>
      </Text>
      <View style={[styles.rule, { backgroundColor: ink, marginTop: Math.max(2, Math.round(fontSize * 0.12)) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: 'stretch' },
  regular: { fontFamily: 'PlayfairDisplay_400Regular' },
  bold: { fontFamily: 'PlayfairDisplay_700Bold' },
  rule: { height: 1, opacity: 0.3 },
});
