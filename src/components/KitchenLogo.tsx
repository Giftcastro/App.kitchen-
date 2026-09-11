/**
 * Kitchen Co. wordmark logo.
 *
 * Recreates the brand lockup from the official logo:
 *
 *   your kitchen co.
 *   ────────────────
 *
 * Use variant="onDark" (default) on dark backgrounds such as the app's
 * #121212 theme, or variant="onLight" on white/light surfaces.
 *
 * The "POWERED BY CSG FOODS" strip that used to sit between the divider and
 * the accent dash was removed at the client's request (Sep 2026 review), and
 * the accent dash itself was later dropped too — the lockup is now wordmark
 * + divider only, fully black-and-white.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';

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
};

const stylesOnDark = StyleSheet.create({
  container: { alignItems: 'center' },
  wordmark: { ...commonWordmark, color: '#FFFFFF', fontWeight: '300' },
  wordmarkAccent: { ...commonWordmark, color: '#FFFFFF', fontWeight: '800' },
  divider: { ...commonDivider, backgroundColor: '#3A3A3C' },
});

const stylesOnLight = StyleSheet.create({
  container: { alignItems: 'center' },
  wordmark: { ...commonWordmark, color: '#1A1A1A', fontWeight: '300' },
  wordmarkAccent: { ...commonWordmark, color: '#1A1A1A', fontWeight: '800' },
  divider: { ...commonDivider, backgroundColor: '#C7C7CC' },
});

const compactOverrides = {
  wordmark: { fontSize: 24, letterSpacing: -0.3 },
  divider: { width: 150, marginTop: 8 },
};

const stylesOnDarkCompact = StyleSheet.create({
  container: { alignItems: 'center' },
  wordmark: { ...commonWordmark, ...compactOverrides.wordmark, color: '#FFFFFF', fontWeight: '300' },
  wordmarkAccent: { ...commonWordmark, ...compactOverrides.wordmark, color: '#FFFFFF', fontWeight: '800' },
  divider: { ...commonDivider, ...compactOverrides.divider, backgroundColor: '#3A3A3C' },
});

const stylesOnLightCompact = StyleSheet.create({
  container: { alignItems: 'center' },
  wordmark: { ...commonWordmark, ...compactOverrides.wordmark, color: '#1A1A1A', fontWeight: '300' },
  wordmarkAccent: { ...commonWordmark, ...compactOverrides.wordmark, color: '#1A1A1A', fontWeight: '800' },
  divider: { ...commonDivider, ...compactOverrides.divider, backgroundColor: '#C7C7CC' },
});
