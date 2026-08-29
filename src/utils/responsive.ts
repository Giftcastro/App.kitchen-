/**
 * Shared responsive-layout utilities.
 *
 * Breakpoints follow common RN guidance:
 *   - phone : < 600pt  (compact single/two-column layouts)
 *   - tablet: >= 600pt (wider centered frame, multi-column grids)
 *
 * Use `useResponsive()` in components instead of reading Dimensions directly,
 * so layouts update live on rotation / window resize (web + split-screen).
 */
import { useWindowDimensions } from 'react-native';
import { APP_MAX_WIDTH, TABLET_MAX_WIDTH, TABLET_BREAKPOINT } from './theme';

export type DeviceClass = 'phone' | 'tablet';

export interface ResponsiveInfo {
  /** Current viewport width in points. */
  width: number;
  deviceClass: DeviceClass;
  isTablet: boolean;
  /**
   * Max width the centered app frame should occupy at this viewport size
   * (phones stay at APP_MAX_WIDTH, tablets widen to TABLET_MAX_WIDTH).
   */
  contentMaxWidth: number;
}

export function getResponsiveInfo(width: number): ResponsiveInfo {
  const isTablet = width >= TABLET_BREAKPOINT;
  return {
    width,
    deviceClass: isTablet ? 'tablet' : 'phone',
    isTablet,
    contentMaxWidth: isTablet ? TABLET_MAX_WIDTH : APP_MAX_WIDTH,
  };
}

/** Live responsive info; re-renders on rotation / resize. */
export function useResponsive(): ResponsiveInfo {
  const { width } = useWindowDimensions();
  return getResponsiveInfo(width);
}
