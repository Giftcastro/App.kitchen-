/**
 * Shell's nav bar: Shell.BackgroundColor = page background,
 * Foreground/TitleColor = primary text — shared by the root stack and each
 * tab's own stack.
 */
import type { ThemeColors } from './theme';

export function stackHeader(colors: ThemeColors) {
  return {
    headerStyle: { backgroundColor: colors.pageBg },
    headerTintColor: colors.text,
    headerTitleStyle: { fontFamily: 'OpenSans_600SemiBold', fontSize: 18, color: colors.text },
    headerBackTitle: '',
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.pageBg },
  };
}
