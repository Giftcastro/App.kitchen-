import React from 'react';
import { Image, ImageStyle, StyleProp, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface BrandLogoProps {
  variant?: 'hero' | 'large' | 'standard' | 'compact';
  style?: StyleProp<ImageStyle>;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'standard',
  style,
}) => {
  const { isDark } = useTheme();

  // Aspect ratio is 1118 / 322 ≈ 3.472
  const dimensions =
    variant === 'hero'
      ? { width: 330, height: 95 }
      : variant === 'large'
      ? { width: 280, height: 81 }
      : variant === 'compact'
      ? { width: 130, height: 38 }
      : { width: 200, height: 58 };

  const logoSource = isDark
    ? require('../../assets/logo_dark.png')
    : require('../../assets/logo_transparent.png');

  return (
    <View style={styles.wrapper}>
      <Image
        source={logoSource}
        style={[dimensions, style]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
