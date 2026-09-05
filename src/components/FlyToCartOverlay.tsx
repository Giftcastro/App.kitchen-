import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../utils/theme';

export interface FlyToCartOverlayHandle {
  /** Animates a small cart icon from (fromX, fromY) to (toX, toY), both in window coordinates. */
  trigger: (fromX: number, fromY: number, toX: number, toY: number) => void;
}

const ICON_SIZE = 28;

/**
 * Absolutely-positioned single-icon layer mounted once above the tab
 * navigator. Nothing renders until `trigger()` is called, so it costs
 * nothing when idle.
 */
export const FlyToCartOverlay = forwardRef<FlyToCartOverlayHandle, { theme: ThemeColors }>(
  function FlyToCartOverlay({ theme }, ref) {
    const [flying, setFlying] = useState(false);
    // Lazy useState, not useRef(new Animated.Value(x)).current: that form
    // built a throwaway Animated.Value on every render and read a ref during
    // render. useState guarantees the instance is created once and kept.
    const [progress] = useState(() => new Animated.Value(0));
    const originRef = useRef({ fromX: 0, fromY: 0, toX: 0, toY: 0 });

    useImperativeHandle(ref, () => ({
      trigger(fromX, fromY, toX, toY) {
        originRef.current = { fromX, fromY, toX, toY };
        progress.setValue(0);
        setFlying(true);
        Animated.timing(progress, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }).start(() => setFlying(false));
      },
    }));

    if (!flying) return null;

    const { fromX, fromY, toX, toY } = originRef.current;
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [fromX, toX] });
    // A slight upward arc reads more like a toss than a straight slide.
    const translateY = progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [fromY, Math.min(fromY, toY) - 40, toY],
    });
    const scale = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0.3] });
    const opacity = progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.icon,
          {
            backgroundColor: theme.accent,
            transform: [
              { translateX: Animated.subtract(translateX, ICON_SIZE / 2) },
              { translateY: Animated.subtract(translateY, ICON_SIZE / 2) },
              { scale },
            ],
            opacity,
          },
        ]}
      >
        <Ionicons name="fast-food" size={16} color={theme.onAccent} />
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    elevation: 20,
  },
});
