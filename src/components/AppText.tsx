/**
 * Drop-in replacements for RN's Text/TextInput that bake in the brand
 * typeface (Montserrat, loaded in src/app/_layout.tsx). Every screen already
 * varies fontWeight (300-900) per element in its own StyleSheet — that still
 * applies on top of this default family, so switching every import over to
 * these wrappers changes the whole app's typeface without having to touch
 * each individual style.
 *
 * Global Text.defaultProps patching doesn't reach react-native-web's actual
 * rendered output on this RN/React version, hence a real wrapper component.
 */
import React from 'react';
import { Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps } from 'react-native';

const FONT_FAMILY = 'Montserrat_400Regular';

export const Text = React.forwardRef<RNText, TextProps>(({ style, ...rest }, ref) => (
  <RNText ref={ref} style={[{ fontFamily: FONT_FAMILY }, style]} {...rest} />
));
Text.displayName = 'Text';

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(({ style, ...rest }, ref) => (
  <RNTextInput ref={ref} style={[{ fontFamily: FONT_FAMILY }, style]} {...rest} />
));
TextInput.displayName = 'TextInput';
