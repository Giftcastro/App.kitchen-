/**
 * Official Kitchen Co. logo lockup, rendered from the brand artwork.
 *
 * Ported from JoTsav/kicthenCoV1 `main` (src/components/BrandLogo.tsx) so the
 * app header carries the same real logo image the reference build uses,
 * instead of the hand-built text wordmark in KitchenLogo.tsx. The variants,
 * widths and dark/light source swap are his — kept as-is on purpose so the
 * two builds stay visually identical.
 *
 * The one deviation from his version: the source PNGs were 1118x322 and had
 * the "POWERED BY CSG FOODS" strip baked in beneath the divider (rows
 * 268-300), which the client asked to drop — see KitchenLogo.tsx, where the
 * same line was removed from the coded wordmark. Since it is part of the
 * image, both files were cropped to 1118x238, keeping the wordmark (rows
 * 30-178) and the divider (row 207) with the same 30px padding the top has.
 * The uncropped originals are still recoverable with
 * `git show origin/main:assets/logo_dark.png`. The variant widths below are
 * unchanged, so the wordmark renders at exactly the size it did before — only
 * the dead vertical space went away; the heights just follow the new ratio.
 */
import React from 'react';
import { Image, ImageStyle, StyleProp, View, StyleSheet } from 'react-native';
import { useKitchen } from '../context/KitchenCoContext';

interface BrandLogoProps {
  variant?: 'large' | 'standard' | 'compact';
  style?: StyleProp<ImageStyle>;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'standard',
  style,
}) => {
  const { isDark } = useKitchen();

  // Aspect ratio is 1118 / 238 ≈ 4.697 (was 3.472 before the CSG crop)
  const dimensions =
    variant === 'large'
      ? { width: 280, height: 60 }
      : variant === 'compact'
      ? { width: 130, height: 28 }
      : { width: 200, height: 43 };

  const logoSource = isDark
    ? require('../../assets/images/logo_dark.png')
    : require('../../assets/images/logo_transparent.png');

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

export default BrandLogo;
