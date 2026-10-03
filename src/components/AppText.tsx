/**
 * Drop-in replacements for RN's Text/TextInput that bake in Open Sans — the
 * MAUI app's only typeface (MauiProgram registers OpenSans-Regular and
 * OpenSans-Semibold; every Label/Button inherits "OpenSansRegular").
 *
 * A custom font family carries exactly one weight per family name on native,
 * so a style's fontWeight is translated into the matching Open Sans face here
 * (and dropped, or Android would ignore the family) instead of every screen
 * having to know the face names. Global Text.defaultProps patching doesn't
 * reach react-native-web's output on this RN version, hence a real wrapper.
 */
import React from 'react';
import { Platform, StyleSheet, Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps, TextStyle } from 'react-native';

const FACES: Record<string, string> = {
  '300': 'OpenSans_300Light',
  '400': 'OpenSans_400Regular',
  '500': 'OpenSans_500Medium',
  '600': 'OpenSans_600SemiBold',
  '700': 'OpenSans_700Bold',
  '800': 'OpenSans_800ExtraBold',
};

function resolveFace(style: TextStyle): TextStyle {
  const weight = style.fontWeight === 'bold' ? '700' : style.fontWeight === 'normal' || !style.fontWeight ? '400' : String(style.fontWeight);
  const clamped = Number(weight) >= 800 ? '800' : Number(weight) <= 300 ? '300' : weight;
  const italic = style.fontStyle === 'italic';
  const base = FACES[clamped] ?? FACES['400'];
  const fontFamily = style.fontFamily ?? (italic ? `${base}_Italic` : base);
  // Web resolves weight against the family itself, so leave it; native needs it gone.
  return Platform.OS === 'web' ? { fontFamily } : { fontFamily, fontWeight: undefined, fontStyle: undefined };
}

export const Text = React.forwardRef<RNText, TextProps>(({ style, ...rest }, ref) => {
  const flat = StyleSheet.flatten(style) ?? {};
  return <RNText ref={ref} style={[flat, resolveFace(flat)]} {...rest} />;
});
Text.displayName = 'Text';

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(({ style, ...rest }, ref) => {
  const flat = StyleSheet.flatten(style) ?? {};
  return <RNTextInput ref={ref} style={[flat, resolveFace(flat)]} {...rest} />;
});
TextInput.displayName = 'TextInput';
