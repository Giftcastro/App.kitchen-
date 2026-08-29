/**
 * Kitchen Co. wordmark logo.
 *
 * Recreates the brand lockup from the official logo:
 *
 *   your kitchen co.
 *   ────────────────
 *   POWERED BY *CSG FOODS
 *
 * Use variant="onDark" (default) on dark backgrounds such as the app's
 * #121212 theme, or variant="onLight" on white/light surfaces.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface KitchenLogoProps {
  /** Color scheme of the surface the logo sits on. Defaults to 'onDark'. */
  variant?: 'onDark' | 'onLight';
  /** Smaller lockup for dense screens (e.g., auth header). */
  compact?: boolean;
}

export default function KitchenLogo({
  variant = 'onDark',
  compact = false,
}: KitchenLogoProps) {
  const styles =
    variant === 'onDark'
      ? compact
        ? stylesOnDarkCompact
        : stylesOnDark
      : compact
        ? stylesOnLightCompact
        : stylesOnLight;

  return (
    <View style={styles.container}>
      {/* Wordmark: "your kitchen" light-weight + "co." bold */}
      <Text style={styles.wordmark} numberOfLines={1}>
        {'your kitchen '}
        <Text style={styles.wordmarkAccent}>co.</Text>
      </Text>

      <View style={styles.divider} />

      {/* Powered-by strip */}
      <Text style={styles.poweredBy}>
        {'POWERED BY '}
        <Text style={styles.poweredByStrong}>*CSG</Text>
        {' FOODS'}
      </Text>
    </View>
  );
}

const commonWordmark = {
  fontSize: 34,
  letterSpacing: -0.5,
};

const commonDivider = {
  width: 190,
  height: 1,
  marginTop: 10,
  marginBottom: 12,
};

const commonPoweredBy = {
  fontSize: 11,
  fontWeight: '400' as const,
  letterSpacing: 2.5,
};

const stylesOnDark = StyleSheet.create({
  container: { alignItems: 'center' },
  wordmark: { ...commonWordmark, color: '#FFFFFF', fontWeight: '300' },
  wordmarkAccent: { ...commonWordmark, color: '#FFFFFF', fontWeight: '800' },
  divider: { ...commonDivider, backgroundColor: '#3A3A3C' },
  poweredBy: { ...commonPoweredBy, color: '#8E8E93' },
  poweredByStrong: { ...commonPoweredBy, color: '#FFFFFF', fontWeight: '800' },
});

const stylesOnLight = StyleSheet.create({
  container: { alignItems: 'center' },
  wordmark: { ...commonWordmark, color: '#1A1A1A', fontWeight: '300' },
  wordmarkAccent: { ...commonWordmark, color: '#1A1A1A', fontWeight: '800' },
  divider: { ...commonDivider, backgroundColor: '#C7C7CC' },
  poweredBy: { ...commonPoweredBy, color: '#6B6B6B' },
  poweredByStrong: { ...commonPoweredBy, color: '#1A1A1A', fontWeight: '800' },
});

const compactOverrides = {
  wordmark: { fontSize: 24, letterSpacing: -0.3 },
  divider: { width: 150, marginTop: 8, marginBottom: 10 },
  poweredBy: { fontSize: 9, letterSpacing: 2 },
};

const stylesOnDarkCompact = StyleSheet.create({
  container: { alignItems: 'center' },
  wordmark: { ...commonWordmark, ...compactOverrides.wordmark, color: '#FFFFFF', fontWeight: '300' },
  wordmarkAccent: { ...commonWordmark, ...compactOverrides.wordmark, color: '#FFFFFF', fontWeight: '800' },
  divider: { ...commonDivider, ...compactOverrides.divider, backgroundColor: '#3A3A3C' },
  poweredBy: { ...commonPoweredBy, ...compactOverrides.poweredBy, color: '#8E8E93' },
  poweredByStrong: { ...commonPoweredBy, ...compactOverrides.poweredBy, color: '#FFFFFF', fontWeight: '800' },
});

const stylesOnLightCompact = StyleSheet.create({
  container: { alignItems: 'center' },
  wordmark: { ...commonWordmark, ...compactOverrides.wordmark, color: '#1A1A1A', fontWeight: '300' },
  wordmarkAccent: { ...commonWordmark, ...compactOverrides.wordmark, color: '#1A1A1A', fontWeight: '800' },
  divider: { ...commonDivider, ...compactOverrides.divider, backgroundColor: '#C7C7CC' },
  poweredBy: { ...commonPoweredBy, ...compactOverrides.poweredBy, color: '#6B6B6B' },
  poweredByStrong: { ...commonPoweredBy, ...compactOverrides.poweredBy, color: '#1A1A1A', fontWeight: '800' },
});
